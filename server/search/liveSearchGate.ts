/**
 * LIVE SEARCH GATE (owner 30 Oct)
 *
 * Wraps the user-facing live search in three cheap layers that all protect CPU without
 * slowing a real answer:
 *
 *  1. REPEAT CACHE - the exact same query answered within T1S_LIVE_REPEAT_CACHE_MS
 *     (default 15s) is replayed from memory. This is the case a phone produces constantly:
 *     the app and the web page both fire, a widget retries, a user taps twice. Only
 *     responses that actually carry rows are cached, so a scan that found nothing is
 *     never frozen into the next request.
 *  2. DUPLICATE SUPPRESSION - identical searches in flight share one pipeline through
 *     the load governor, so two clients cost one scan.
 *  3. CANCELLATION - the caller passes an AbortSignal tied to the client socket. When the
 *     user navigates away, that waiter is abandoned immediately; work other waiters still
 *     want keeps running, and a job that nobody wants any more is dropped before it starts.
 *
 * Nothing here changes the response shape: the caller receives the same SearchResponse
 * (or null when the search could not run at all), so web and app rendering are untouched.
 */

import type { SearchInput } from './searchOrchestrator';
import { runSearch } from './searchOrchestrator';
import type { SearchResponse } from '../types';
import { runGated, governorStats, cpuPercent } from '../common/loadGovernor';

interface CachedResponse {
  at: number;
  body: SearchResponse;
}

const repeatCache = new Map<string, CachedResponse>();
const REPEAT_TTL_MS = () => {
  const n = Number(process.env.T1S_LIVE_REPEAT_CACHE_MS);
  return Number.isFinite(n) && n >= 0 ? n : 15_000;
};
const REPEAT_CACHE_MAX = 400;

export function liveInputKey(input: SearchInput): string {
  return [
    String(input.vertical || ''),
    String(input.query || '').trim().toLowerCase(),
    String(input.city || '').trim().toLowerCase(),
    String(input.pincode || ''),
    String(input.locality || '').trim().toLowerCase(),
    input.travelDates?.depart || '',
    input.travelDates?.return || '',
    input.from || '',
    input.to || '',
    input.guests || '',
    typeof input.lat === 'number' ? input.lat.toFixed(4) : '',
    typeof input.lng === 'number' ? input.lng.toFixed(4) : '',
  ].join('|');
}

/** Only rows make a response worth replaying; an empty scan is never frozen. */
function cacheable(res: SearchResponse | null): boolean {
  if (!res) return false;
  if (!(res.results || []).length) return false;
  const served = String((res.state as any)?.servedFrom || '');
  return served !== 'unavailable' && served !== 'validation';
}

function store(key: string, res: SearchResponse): void {
  if (!cacheable(res)) return;
  if (repeatCache.size >= REPEAT_CACHE_MAX) {
    // Drop the oldest third in one pass; cheaper than per-entry bookkeeping.
    const entries = [...repeatCache.entries()].sort((a, b) => a[1].at - b[1].at);
    for (const [k] of entries.slice(0, Math.ceil(entries.length / 3))) repeatCache.delete(k);
  }
  repeatCache.set(key, { at: Date.now(), body: res });
}

/** Store a response for replay (exposed for tests and for future warm seeding). */
export function repeatCacheStore(key: string, res: SearchResponse): void { store(key, res); }

export function repeatCacheLookup(key: string): SearchResponse | null {
  const hit = repeatCache.get(key);
  if (!hit) return null;
  const ttl = REPEAT_TTL_MS();
  if (ttl <= 0 || Date.now() - hit.at > ttl) { repeatCache.delete(key); return null; }
  return hit.body;
}

export function clearRepeatCache(): void { repeatCache.clear(); }

export interface LiveGateOptions {
  signal?: AbortSignal;
  /** Skip the repeat cache (used by admin/debug callers). */
  bypassRepeatCache?: boolean;
}

/**
 * Run a live search under the governor. Resolves with the SearchResponse, or null when
 * the search could not run (queue full / abandoned) so the caller can fall back to
 * stored rows exactly as it does today.
 */
export async function runLiveSearch(input: SearchInput, opts: LiveGateOptions = {}): Promise<SearchResponse | null> {
  const key = liveInputKey(input);

  if (!opts.bypassRepeatCache) {
    const hit = repeatCacheLookup(key);
    if (hit) {
      return {
        ...hit,
        state: { ...(hit.state as any), servedFrom: 'cache' },
        // untouched rows + labels; latency is measured by the caller
      } as SearchResponse;
    }
  }

  const outcome = await runGated(key, () => runSearch(input), { signal: opts.signal });
  if (outcome.status !== 'ok') {
    if (process.env.LOG_LEVEL === 'debug') {
      console.error(JSON.stringify({ dbg: 'live-gate', key, status: outcome.status, waitedMs: outcome.waitedMs, cpu: Math.round(cpuPercent()) }));
    }
    return null;
  }
  store(key, outcome.value);
  return outcome.value;
}

export const liveGateStats = () => ({ ...governorStats(), repeatCached: repeatCache.size, repeatTtlMs: REPEAT_TTL_MS() });
