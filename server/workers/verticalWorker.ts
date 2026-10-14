/**
 * Vertical Worker framework.
 *
 * Owner requirement: every vertical has its OWN worker and a vertical search runs
 * ONLY that vertical's worker. A worker owns:
 *   - the list of acquisition "tasks" (source id + how to build the request + how to parse it)
 *   - its own per-task timeout, isolation (one failing task never blocks another),
 *     and honest result reporting.
 * Workers return RawSourceItem[] only; normalization/validation/freshness/persist
 * remain the shared pipeline (modular monolith — one MySQL source of truth).
 *
 * Honesty: a task that is blocked / challenged / returns no parseable data records a
 * failure class and contributes nothing. Nothing is ever invented.
 */
import type { AdapterResult, ParsedQuery, RawSourceItem, SourceConfig, VerticalId } from '../types';
import { httpAcquire, AcquisitionError } from '../common/httpClient';
import { failedResult, type SourceAdapter } from '../sources/contract';
import { buildDevFixtures } from '../acquisition/devFixtures';
import { log } from '../common/logger';

export interface WorkerTaskContext {
  query: ParsedQuery;
  source: SourceConfig;
  /** Fetch helper bound to this source's rate limits. */
  fetch: (url: string, opts?: { headers?: Record<string, string>; method?: 'GET' | 'POST'; body?: string; expectJson?: boolean; timeoutMs?: number; maxBytes?: number }) => Promise<{ status: number; body: string; ok: boolean; latencyMs: number }>;
}

export interface WorkerTask {
  /** Matches the SourceConfig.id registered for this task (admin can enable/disable it). */
  sourceId: string;
  name?: string;
  priority?: number;
  maxPerMinute?: number;
  timeoutMs?: number;
  run: (ctx: WorkerTaskContext) => Promise<RawSourceItem[]>;
}

export interface VerticalWorker {
  vertical: VerticalId;
  tasks: WorkerTask[];
}

const BROWSER_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
export const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': BROWSER_UA,
  'Accept-Language': 'en-IN,en;q=0.9',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
};

/** Detect an interstitial that must be reported as ACCESS_CHALLENGE, never parsed as data. */
export function looksLikeChallenge(body: string): boolean {
  // Amazon/Flipkart soft-blocks often serve HTTP 200 with an "apologies" shell:
  // real product listings are absent and the page self-describes as automated.
  const head = body.slice(0, 6000);
  const shell = body.length < 120_000;
  const markers = /captcha|robot check|are you a human|unusual traffic|access denied|enable javascript and cookies|verify you human|bm-verify|api-services-support@amazon\.com|enter the characters you see below|to discuss automated access|datadome|cf-chl|px-captcha|blocked|not available in your region/i;
  return markers.test(head) && !/application\/ld\+json/i.test(head)
    || (shell && markers.test(body) && !/"asin"|productTitle|plp-card/i.test(body));
}

/** Runs one task with isolation; converts every outcome into an AdapterResult. */
export async function runTask(worker: VerticalWorker, task: WorkerTask, source: SourceConfig, query: ParsedQuery): Promise<AdapterResult> {
  const started = Date.now();
  const fetchedAt = new Date().toISOString();
  const ctx: WorkerTaskContext = {
    query,
    source,
    fetch: async (url, opts = {}) => {
      const r = await httpAcquire(url, {
        sourceId: source.id,
        method: opts.method,
        body: opts.body,
        headers: { ...BROWSER_HEADERS, ...(opts.headers || {}) },
        expectJson: opts.expectJson,
        timeoutMs: opts.timeoutMs ?? 12_000,
        ...(opts.maxBytes ? { maxResponseBytes: opts.maxBytes } : {}),
        retries: 1,
        maxPerMinute: source.rateLimit.maxRequestsPerMinute,
        maxConcurrency: source.rateLimit.maxConcurrency,
      });
      return { status: r.status, body: r.body, ok: r.ok, latencyMs: r.latencyMs };
    },
  };
  try {
    const rawItems = await Promise.race([
      task.run(ctx),
      new Promise<RawSourceItem[]>((_, rej) => setTimeout(() => rej(new AcquisitionError('TIMEOUT', `worker task exceeded ${(task.timeoutMs ?? 18_000) / 1000}s`)), task.timeoutMs ?? 18_000)),
    ]);
    if (!rawItems.length) {
      return failedResult(source, 'EMPTY_RESPONSE', `${worker.vertical} worker: source returned no parseable offers`, Date.now() - started);
    }
    return { success: true, sourceId: source.id, sourceMethod: source.method, rawItems, latencyMs: Date.now() - started, fetchedAt };
  } catch (e: any) {
    const fc = e instanceof AcquisitionError ? e.failureClass : 'UNKNOWN';
    log.debug('VerticalWorker', `${worker.vertical}/${task.sourceId} failed`, { fc, error: String(e?.message || e).slice(0, 140) });
    // Development-only fixture fallback: if the dev IP got WAF-blocked and
    // T1S_DEV_FIXTURES=1, return clearly-labelled fixtures so testing continues.
    const fixtures = buildDevFixtures(source, worker.vertical, String(query.rawQuery || query.entityName || ''));
    if (fixtures.length) {
      log.warn('VerticalWorker', `Using DEV fixture for ${source.id} (dev-mode fallback for ${fc})`);
      return { success: true, sourceId: source.id, sourceMethod: source.method, rawItems: fixtures, latencyMs: Date.now() - started, fetchedAt };
    }
    return failedResult(source, fc as any, String(e?.message || e).slice(0, 200), Date.now() - started, e?.httpStatus);
  }
}

/** SourceAdapter that delegates to the vertical worker task bound to the source id. */
export class VerticalWorkerAdapter implements SourceAdapter {
  readonly id = 'vertical_worker_adapter';
  readonly method = 'direct_http' as const;
  readonly adapterVersion = '2.0.0';
  readonly parserVersion = '2.0.0';

  constructor(private workers: Map<string, { worker: VerticalWorker; task: WorkerTask }>) {}

  async search(ctx: { query: ParsedQuery; source: SourceConfig }): Promise<AdapterResult> {
    const entry = this.workers.get(ctx.source.id);
    if (!entry) return failedResult(ctx.source, 'CAPABILITY_UNAVAILABLE', 'No vertical worker task bound to this source', 0);
    return runTask(entry.worker, entry.task, ctx.source, ctx.query);
  }

  async healthCheck(source: SourceConfig) {
    const entry = this.workers.get(source.id);
    return { healthy: Boolean(entry), latencyMs: 0, failureClass: entry ? undefined : ('CAPABILITY_UNAVAILABLE' as any) };
  }
  getFreshness(source: SourceConfig) { return source.freshnessPolicy; }
  getExpiry(): string | null { return null; }
}

// ---- Registry of the 13 vertical workers ----
const WORKERS = new Map<VerticalId, VerticalWorker>();
const TASK_INDEX = new Map<string, { worker: VerticalWorker; task: WorkerTask }>();

export function registerVerticalWorker(worker: VerticalWorker) {
  WORKERS.set(worker.vertical, worker);
  for (const t of worker.tasks) TASK_INDEX.set(t.sourceId, { worker, task: t });
}
export function getVerticalWorker(v: VerticalId): VerticalWorker | undefined { return WORKERS.get(v); }
export function allVerticalWorkers(): VerticalWorker[] { return [...WORKERS.values()]; }
export function workerTaskIndex() { return TASK_INDEX; }
