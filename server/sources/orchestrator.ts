/**
 * AcquisitionOrchestrator (Sections 4–5): parallel independent acquisition with
 * per-source isolation, bounded concurrency, progressive results and honest fallback.
 * A slow or failing source never blocks results from another (bulkheads + timeouts).
 */
import type { AdapterResult, ParsedQuery, SourceConfig, VerticalId } from '../types';
import { selectSources } from './registry';
import { recordAttempt, recordFailure, recordSuccess } from './health';
import { log } from '../common/logger';
import type { SourceAdapter } from './contract';
import { HttpAcquisitionAdapter } from './adapters/httpAcquisitionAdapter';
import { StructuredDataAdapter } from './adapters/structuredDataAdapter';
import { AffiliateFeedAdapter, OfficialAPIAdapter, PartnerFeedAdapter, SearchProviderAdapter } from './adapters/feedAndApiAdapters';

import { BrowserRenderAdapter } from './adapters/browserRenderAdapter';

const ADAPTERS: Record<string, SourceAdapter> = {
  browser_render: new BrowserRenderAdapter(),
  direct_http: new HttpAcquisitionAdapter(),
  structured_data: new StructuredDataAdapter(),
  affiliate_feed: new AffiliateFeedAdapter(),
  partner_feed: new PartnerFeedAdapter(),
  official_api: new OfficialAPIAdapter(),
  search_provider: new SearchProviderAdapter(),
};

export function getAdapter(source: SourceConfig): SourceAdapter {
  return ADAPTERS[source.method];
}

export interface AcquisitionOutcome {
  results: AdapterResult[];
  attempted: string[];
  succeeded: string[];
  failed: Array<{ sourceId: string; failureClass: any; error: string }>;
}

/**
 * Runs acquisition across selected sources in parallel (each with its own timeout).
 * Returns as soon as all bounded-parallel promises settle — no source waits on another.
 */
export async function acquireParallel(query: ParsedQuery, opts: { maxSources?: number } = {}): Promise<AcquisitionOutcome> {
  const sources = selectSources(query).slice(0, opts.maxSources ?? 6);
  const outcome: AcquisitionOutcome = { results: [], attempted: sources.map((s) => s.id), succeeded: [], failed: [] };

  if (sources.length === 0) {
    log.info('Orchestrator', 'No eligible enabled sources — returning honest unavailable state');
    return outcome;
  }

  type TaskOutcome =
    | { kind: 'ok'; result: AdapterResult }
    | { kind: 'fail'; sourceId: string; failureClass: any; error: string };

  const runSource = async (source: SourceConfig): Promise<TaskOutcome> => {
    const adapter = getAdapter(source);
    recordAttempt(source.id, 0);
    try {
      const result = await adapter.search({ query, source });
      if (result.success && result.rawItems.length > 0) {
        recordSuccess(source.id, result.latencyMs);
        return { kind: 'ok', result };
      }
      const failureClass = result.failureClass || 'EMPTY_RESPONSE';

      // Section 5.2 fallback: plain cURL often receives a JS-rendered shell with
      // no usable data. Retry ONCE with the headless-browser adapter (only for
      // direct_http sources, only if it returned a URL to render). Capability-
      // honest: without Playwright installed the retry reports
      // CONFIGURATION_REQUIRED and fails cleanly.
      if (source.method === 'direct_http' && result.httpStatus && result.httpStatus < 500) {
        const target = String(source.config?.url || source.config?.baseUrl || '');
        if (/^https:\/\//i.test(target)) {
          const browserSource: SourceConfig = {
            ...source,
            id: `${source.id}#browser`,
            method: 'browser_render',
            config: { ...source.config, url: target },
          };
          recordAttempt(browserSource.id, 0);
          try {
            const browserResult = await ADAPTERS.browser_render.search({ query, source: browserSource });
            if (browserResult.success && browserResult.rawItems.length > 0) {
              recordSuccess(browserSource.id, browserResult.latencyMs);
              return { kind: 'ok', result: browserResult };
            }
            recordFailure(browserSource.id, browserResult.failureClass || 'EMPTY_RESPONSE',
              browserResult.error || 'Browser fallback found no usable data');
          } catch (e: any) {
            recordFailure(browserSource.id, 'UNKNOWN', String(e).slice(0, 120));
          }
        }
      }

      recordFailure(source.id, failureClass, result.error || 'No items');
      return { kind: 'fail', sourceId: source.id, failureClass, error: result.error || 'No items' };
    } catch (e: any) {
      recordFailure(source.id, 'UNKNOWN', String(e).slice(0, 150));
      return { kind: 'fail', sourceId: source.id, failureClass: 'UNKNOWN', error: String(e?.message || e).slice(0, 200) };
    }
  };

  const settled = await Promise.allSettled(sources.map((source) => runSource(source)));
  for (const s of settled) {
    if (s.status !== 'fulfilled') continue;
    const r = s.value;
    if (r.kind === 'ok') {
      outcome.results.push(r.result);
      outcome.succeeded.push(r.result.sourceId);
    } else {
      outcome.failed.push({ sourceId: r.sourceId, failureClass: r.failureClass, error: r.error });
    }
  }
  return outcome;
}

/** Health check sweep used by the admin panel and the background worker. */
export async function checkSourceHealth(source: SourceConfig): Promise<boolean> {
  const adapter = getAdapter(source);
  try {
    const r = await adapter.healthCheck(source);
    if (r.healthy) recordSuccess(source.id, r.latencyMs);
    else recordFailure(source.id, r.failureClass || 'UNKNOWN', 'health check failed');
    return r.healthy;
  } catch {
    recordFailure(source.id, 'UNKNOWN', 'health check threw');
    return false;
  }
}
