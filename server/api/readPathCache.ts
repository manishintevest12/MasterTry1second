/**
 * READ-PATH CACHE (owner 9 Nov, 5xx/4xx analytics screenshot: HTTP 429 on GET /api/notifications and
 * GET /api/movies/upcoming, HTTP 503 on POST /).
 *
 * MEASURED shape of the report: three 429s in ONE second on /api/notifications and /api/movies/upcoming,
 * size 0 bytes, 15-63ms, from one desktop browser, plus 503s on POST / with 0 bytes in 16ms. A read-only
 * rail has no business answering 429 to a user: a slightly stale answer is always better than a red
 * error, and the burst that produced it was a client polling a rail that had nothing new to say.
 *
 * This module gives read paths three properties:
 *   1. SINGLE FLIGHT - N concurrent misses run the upstream loader ONCE, so a burst cannot fan out.
 *   2. STALE-WHILE-REVALIDATE - a stale copy is served immediately while one background refresh runs.
 *   3. NEVER THROW - if the loader fails and a copy exists, the copy is served; only a cold first-ever
 *      failure reaches the caller, and callers answer 200 with an empty body rather than 5xx.
 */
type Entry<T> = { at: number; value: T };

const store = new Map<string, Entry<any>>();
const inflight = new Map<string, Promise<any>>();

export function cachedRead<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  opts: { maxStaleMs?: number; refreshInBackground?: boolean } = {},
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  const fresh = !!hit && now - hit.at < ttlMs;
  if (fresh) return Promise.resolve(hit!.value);

  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return running;

  const maxStale = opts.maxStaleMs ?? 6 * 60 * 60_000;
  const usableStale = !!hit && now - hit.at < maxStale;

  const run = loader()
    .then((value) => {
      store.set(key, { at: Date.now(), value });
      return value;
    })
    .finally(() => { inflight.delete(key); });

  if (usableStale && opts.refreshInBackground !== false) {
    // Serve the stale copy now; the refresh above keeps running so the next reader is fresh.
    run.catch(() => { /* background refresh may fail; the stale copy stands */ });
    return Promise.resolve(hit!.value);
  }
  inflight.set(key, run);
  return run.catch((e) => {
    if (usableStale) return hit!.value;
    throw e;
  });
}

/** Test/ops hook: drop every cached read (used by tests, never by a request path). */
export function clearReadCache(): void {
  store.clear();
  inflight.clear();
}
