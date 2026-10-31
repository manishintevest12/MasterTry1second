/**
 * OWNER 31 Oct: "kabhi 400, kabhi ye error, 10 build de diye, abhi tk fix nahi hua — pura project
 * check karo aur 100% fix do."
 *
 * Measured on production while writing this (11:09 UTC restart, bundle index-Bg4kwiqS.js):
 *   /api/version        200 in 0.48s
 *   /api/health         200 in 0.38s
 *   /api/quick-apps     200 in 3.8s cold / 0.5s warm (21KB)
 *   POST /api/scrape/live flights  200 in 0.71s (74KB)
 * So the API itself is healthy and fast — every "ClientException: Connection reset by peer" the
 * owner sees happens on the path between the phone and the Hostinger LiteSpeed edge, which:
 *   - kills idle client sockets after 5s (proven: same socket, 200 then 7s sleep then reset), and
 *   - resets the excess when one page fires many API calls at once (the app needed a 3-request gate
 *     to stop this; the web app never had one, and a mobile page load here fires deals + quick-apps
 *     + banners + showcase + movies together).
 *
 * This is the web counterpart of the app's fix, installed once over window.fetch so all ~56 call
 * sites get it with no change at the call site and no UI change:
 *   1. at most 3 /api/ requests in flight; the rest queue (FIFO) instead of piling onto the edge;
 *   2. identical in-flight GETs share one request (a duplicate burst cannot burn a connection);
 *   3. a transport failure or an edge 429/503 is retried (2 retries, 250/700ms) so a reset becomes
 *      invisible instead of a red error box;
 *   4. anything not same-origin /api/ passes straight through, untouched.
 */

export interface GatedFetchOptions {
  maxConcurrent?: number;
  retries?: number;
  retryStatuses?: number[];
  /** Only URLs for which this returns true are gated. Defaults to same-origin /api/. */
  isGated?: (url: string) => boolean;
}

type Pending = () => void;

const DEFAULT_RETRY_STATUSES = [429, 503];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** A request that died before any bytes of a usable response (what the edge reset looks like). */
function isTransportError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return false;
  const msg = String((error as any)?.message || error || '');
  return /Failed to fetch|NetworkError|Load failed|Connection reset|network connection was lost|fetch failed/i.test(msg);
}

/**
 * Wrap a fetch implementation with the concurrency gate + retries. Exported separately so the
 * behaviour can be tested without touching a browser.
 */
export function createGatedFetch(baseFetch: typeof fetch, options: GatedFetchOptions = {}): typeof fetch {
  const maxConcurrent = Math.max(1, options.maxConcurrent ?? 3);
  const retries = Math.max(0, options.retries ?? 2);
  const retryStatuses = options.retryStatuses ?? DEFAULT_RETRY_STATUSES;
  const isGated = options.isGated ?? (() => true);

  let active = 0;
  const waiting: Pending[] = [];
  const inFlightGets = new Map<string, Promise<Response>>();

  const acquire = (): Promise<void> => {
    if (active < maxConcurrent) {
      active++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => waiting.push(resolve));
  };

  const release = (): void => {
    const next = waiting.shift();
    if (next) {
      next(); // hand the slot straight over: `active` stays the same
      return;
    }
    active--;
  };

  const runOnce = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    await acquire();
    try {
      return await baseFetch(input as any, init);
    } finally {
      release();
    }
  };

  const gatedFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (!isGated(url)) return baseFetch(input as any, init);

    const method = (init?.method || (typeof input === 'object' && 'method' in input ? (input as Request).method : 'GET')).toUpperCase();
    const signal = init?.signal ?? (typeof input === 'object' && 'signal' in input ? (input as Request).signal : undefined);

    // Share an identical GET that is already on the wire. The body must be cloned per caller.
    const getKey = method === 'GET' ? url : '';
    if (getKey) {
      const existing = inFlightGets.get(getKey);
      if (existing) {
        const shared = await existing;
        return shared.clone();
      }
    }

    const execute = (async (): Promise<Response> => {
      let lastError: unknown;
      let lastResponse: Response | undefined;
      for (let attempt = 0; attempt <= retries; attempt++) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        try {
          const response = await runOnce(input, init);
          // The edge's protective mode answers 429/503 with an HTML body instead of our JSON. Those
          // are transient and are answered correctly a moment later (measured repeatedly), so retry
          // rather than showing the owner a red box.
          if (retryStatuses.includes(response.status) && attempt < retries) {
            lastResponse = response;
            await sleep(attempt === 0 ? 250 : 700);
            continue;
          }
          return response;
        } catch (error) {
          lastError = error;
          if (!isTransportError(error) || attempt === retries) throw error;
          await sleep(attempt === 0 ? 250 : 700);
        }
      }
      if (lastResponse) return lastResponse;
      throw lastError;
    })();

    if (getKey) {
      inFlightGets.set(getKey, execute);
      execute.finally(() => inFlightGets.delete(getKey)).catch(() => undefined);
    }
    return execute;
  };

  return gatedFetch as typeof fetch;
}

/** Patch window.fetch once. Safe to call more than once. */
export function installApiGate(): void {
  if (typeof window === 'undefined' || !window.fetch) return;
  const marker = '__t1sApiGate';
  const current = window.fetch as any;
  if (current && current[marker]) return;

  const origin = window.location?.origin ?? '';
  const gated = createGatedFetch(window.fetch.bind(window), {
    maxConcurrent: 3,
    retries: 2,
    isGated: (url) => {
      try {
        const parsed = new URL(url, origin || 'http://localhost');
        return parsed.pathname.startsWith('/api/') && parsed.origin === origin;
      } catch {
        return false;
      }
    },
  }) as any;

  gated[marker] = true;
  window.fetch = gated;
}
