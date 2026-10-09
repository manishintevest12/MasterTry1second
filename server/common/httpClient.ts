/**
 * Controlled HTTP acquisition client (Section 4.1 + 14).
 * - GET/POST, timeouts, TLS verify, bounded response size, compression (fetch default)
 * - Bounded retries with exponential backoff + jitter, Retry-After handling
 * - Per-source token-bucket rate limits + global + per-source concurrency caps
 * - Failure classification (Section 14)
 * - Structured logging with secret redaction (via logger)
 * - No browser automation, no auth/CAPTCHA bypass. A denial is recorded, not fought.
 */
import { settings } from './settings';
import { log } from './logger';
import type { FailureClass } from '../types';

export class AcquisitionError extends Error {
  constructor(public failureClass: FailureClass, message: string, public httpStatus?: number) {
    super(message);
  }
}

export interface HttpOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  sourceId: string;
  timeoutMs?: number;
  retries?: number;
  maxResponseBytes?: number;
  maxPerMinute?: number; // rate limit for this source
  maxConcurrency?: number; // concurrency cap for this source
  expectJson?: boolean;
}

// --- Rate limiting: token bucket per source ---
const buckets = new Map<string, { tokens: number; lastRefill: number }>();
function takeToken(sourceId: string, maxPerMinute: number): boolean {
  const now = Date.now();
  const b = buckets.get(sourceId) || { tokens: maxPerMinute, lastRefill: now };
  const refill = ((now - b.lastRefill) / 60000) * maxPerMinute;
  b.tokens = Math.min(maxPerMinute, b.tokens + refill);
  b.lastRefill = now;
  if (b.tokens < 1) {
    buckets.set(sourceId, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(sourceId, b);
  return true;
}

// --- Concurrency control: per-source + global semaphore ---
const inflightPerSource = new Map<string, number>();
let globalInflight = 0;

async function acquireSlot(sourceId: string, maxConcurrency: number, globalCap: number): Promise<boolean> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const cur = inflightPerSource.get(sourceId) || 0;
    if (cur < maxConcurrency && globalInflight < globalCap) {
      inflightPerSource.set(sourceId, cur + 1);
      globalInflight++;
      return true;
    }
    await new Promise((r) => setTimeout(r, 100 + Math.random() * 200)); // jittered wait
  }
  return false;
}

function releaseSlot(sourceId: string) {
  inflightPerSource.set(sourceId, Math.max(0, (inflightPerSource.get(sourceId) || 1) - 1));
  globalInflight = Math.max(0, globalInflight - 1);
}

function classifyFailure(err: any): { failureClass: FailureClass; retryable: boolean } {
  const status = err?.httpStatus;
  if (status) {
    if (status === 401) return { failureClass: 'EXPIRED_CREDENTIALS', retryable: false };
    if (status === 403) return { failureClass: 'FORBIDDEN', retryable: false };
    if (status === 404) return { failureClass: 'NOT_FOUND', retryable: false };
    if (status === 429) return { failureClass: 'RATE_LIMITED', retryable: true };
    if (status >= 500) return { failureClass: 'SERVER_ERROR', retryable: true };
  }
  const msg = String(err?.message || err || '').toLowerCase();
  const cause = String((err as any)?.cause?.code || (err as any)?.cause?.message || '').toLowerCase();
  const all = `${msg} ${cause}`;
  if (err?.name === 'AbortError' || all.includes('timeout') || all.includes('aborted')) return { failureClass: 'TIMEOUT', retryable: true };
  if (all.includes('enotfound') || all.includes('eai_again') || all.includes('dns')) return { failureClass: 'DNS_FAILURE', retryable: true };
  if (all.includes('econnrefused') || all.includes('econnreset') || all.includes('socket') || all.includes('fetch failed')) return { failureClass: 'CONNECTION_FAILURE', retryable: true };
  if (all.includes('certificate') || all.includes('tls') || all.includes('ssl') || all.includes('cert_')) return { failureClass: 'TLS_FAILURE', retryable: false };
  if (msg.includes('rate limited')) return { failureClass: 'RATE_LIMITED', retryable: true };
  if (msg.includes('captcha') || msg.includes('challenge') || msg.includes('login')) return { failureClass: 'ACCESS_CHALLENGE', retryable: false };
  if (msg.includes('too large')) return { failureClass: 'MALFORMED_RESPONSE', retryable: false };
  return { failureClass: 'UNKNOWN', retryable: true };
}

const DEFAULT_UA = 'Try1SecondBot/1.0 (+https://try1second.com; compatible; direct HTTP acquisition; contact via site)';

export interface HttpResult {
  ok: boolean;
  status: number;
  body: string;
  contentType: string;
  latencyMs: number;
  failureClass?: FailureClass;
}

export async function httpAcquire(url: string, opts: HttpOptions): Promise<HttpResult> {
  const {
    method = 'GET',
    headers = {},
    body,
    sourceId,
    timeoutMs = settings.http.connectTimeoutMs,
    retries = settings.http.defaultRetries,
    maxResponseBytes = settings.http.maxResponseBytes,
    maxPerMinute = 30,
    maxConcurrency = 2,
    expectJson,
  } = opts;

  if (!takeToken(sourceId, maxPerMinute)) {
    throw new AcquisitionError('RATE_LIMITED', `Local rate limit reached for ${sourceId}`);
  }

  const gotSlot = await acquireSlot(sourceId, maxConcurrency, settings.http.globalMaxConcurrency);
  if (!gotSlot) throw new AcquisitionError('RATE_LIMITED', `Concurrency limit reached for ${sourceId}`);

  const start = Date.now();
  try {
    let attempt = 0;
    let retryAfterMs = 0;
    // Bounded retry loop for retryable failures only
    while (true) {
      attempt++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          method,
          headers: { 'User-Agent': DEFAULT_UA, Accept: expectJson ? 'application/json' : '*/*', ...headers },
          body,
          signal: controller.signal,
          redirect: 'follow',
        });
        clearTimeout(timer);

        const contentType = response.headers.get('content-type') || '';
        if (response.status === 429) {
          const ra = Number(response.headers.get('retry-after') || 0);
          retryAfterMs = (ra > 0 ? ra * 1000 : 1000 * Math.pow(2, attempt));
          if (attempt <= retries) { await backoff(retryAfterMs); continue; }
          throw new AcquisitionError('RATE_LIMITED', 'HTTP 429 after retries', 429);
        }
        if (response.status === 401) throw new AcquisitionError('EXPIRED_CREDENTIALS', 'HTTP 401', 401);
        if (response.status === 403) throw new AcquisitionError('FORBIDDEN', 'HTTP 403 (source denied access)', 403);
        if (response.status === 404) throw new AcquisitionError('NOT_FOUND', 'HTTP 404', 404);
        if (response.status >= 500) {
          if (attempt <= retries) { await backoff(800 * Math.pow(2, attempt)); continue; }
          throw new AcquisitionError('SERVER_ERROR', `HTTP ${response.status}`, response.status);
        }

        const lenHeader = Number(response.headers.get('content-length') || '0');
        if (lenHeader > maxResponseBytes) throw new AcquisitionError('MALFORMED_RESPONSE', 'Response exceeds bounded size');
        const text = await response.text();
        const truncated = text.length > maxResponseBytes ? text.slice(0, maxResponseBytes) : text;
        if (truncated.length < text.length) log.warn('HttpClient', `Response truncated to bound for ${sourceId}`);

        return {
          ok: response.ok,
          status: response.status,
          body: truncated,
          contentType,
          latencyMs: Date.now() - start,
        };
      } catch (err: any) {
        clearTimeout(timer);
        const { failureClass, retryable } = err instanceof AcquisitionError
          ? { failureClass: err.failureClass, retryable: failureRetryable(err.failureClass) }
          : classifyFailure(err);
        if (retryable && attempt <= retries) {
          log.debug('HttpClient', `Retryable failure (${failureClass}) for ${sourceId}, attempt ${attempt}`);
          await backoff(500 * Math.pow(2, attempt));
          continue;
        }
        log.warn('HttpClient', `Acquisition failed for ${sourceId}`, { failureClass, error: String(err.message || err).slice(0, 200) });
        throw new AcquisitionError(failureClass, String(err.message || err), err?.httpStatus);
      }
    }
  } finally {
    releaseSlot(sourceId);
  }
}

function failureRetryable(fc: FailureClass): boolean {
  return ['TIMEOUT', 'SERVER_ERROR', 'RATE_LIMITED', 'DNS_FAILURE', 'CONNECTION_FAILURE'].includes(fc);
}

async function backoff(baseMs: number) {
  const jitter = Math.random() * baseMs * 0.3;
  await new Promise((r) => setTimeout(r, baseMs + jitter));
}

export async function httpHealthCheck(url: string, sourceId: string): Promise<{ healthy: boolean; latencyMs: number; status?: number; failureClass?: FailureClass }> {
  try {
    const r = await httpAcquire(url, { sourceId, retries: 0, timeoutMs: 4000 });
    return { healthy: r.ok, latencyMs: r.latencyMs, status: r.status };
  } catch (e: any) {
    return { healthy: false, latencyMs: 0, failureClass: e.failureClass || 'UNKNOWN' };
  }
}
