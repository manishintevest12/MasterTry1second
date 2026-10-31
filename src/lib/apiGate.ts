/**
 * OWNER 31 Oct: "already cloudflare ka details diya hua hai, please check and fix everything in app."
 *
 * The Cloudflare relay (https://t1s-api-relay.allleadsspipl.workers.dev) already protects the Flutter
 * app: it retries an upstream reset up to 6 times on fresh connections, so the Hostinger edge's
 * 5s idle-socket kills and connection-cap resets never reach the user. The web app never used it —
 * browsers still talk to www.try1second.com directly, which is exactly why the owner keeps seeing
 * "ClientException: Connection reset by peer" in mobile Chrome while the app behaves.
 *
 * This module closes that gap and keeps the concurrency hygiene that browsers need:
 *   1. at most 3 /api/ requests in flight (the app learned this the hard way with maxConnectionsPerHost);
 *   2. identical in-flight GETs share one request;
 *   3. a transport failure or an edge 429/503 is retried, on the same origin first and then THROUGH
 *      THE CLOUDFLARE RELAY, which is the hop that actually survives the edge;
 *   4. the route that worked is remembered for the session, so a page that needed the relay keeps
 *      using it instead of re-paying the failed attempt on every call;
 *   5. non-/api/ and cross-origin traffic is untouched, and a real JSON 400 still reaches the caller
 *      straight away (never retried, never rewritten).
 */

/**
 * Cloudflare Worker that fronts the same API. Kept in sync with deploy/api-relay-cloudflare and the
 * Flutter app's kDefaultApiBase. Override at build time with VITE_API_RELAY if the worker ever moves.
 */
export const RELAY_BASE: string =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_RELAY) ||
  'https://t1s-api-relay.allleadsspipl.workers.dev';

export interface GatedFetchOptions {
  maxConcurrent?: number;
  retriesPerRoute?: number;
  retryStatuses?: number[];
  isGated?: (url: string) => boolean;
  /** Absolute base of the Cloudflare relay. Empty string disables the relay hop. */
  relayBase?: string;
}

const DEFAULT_RETRY_STATUSES = [429, 503];
const PREFER_RELAY_KEY = 't1s_prefer_relay';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransportError(error: unknown): boolean {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') return false;
  const msg = String((error as any)?.message || error || '');
  return /Failed to fetch|NetworkError|Load failed|Connection reset|network connection was lost|fetch failed|ERR_CONNECTION/i.test(msg);
}

/** Same-origin /api/x?y  ->  https://relay/api/x?y  (relay preserves path + query). */
export function relayUrlFor(absoluteUrl: string, relayBase: string): string | null {
  if (!relayBase) return null;
  try {
    const parsed = new URL(absoluteUrl);
    if (!parsed.pathname.startsWith('/api/') && !parsed.pathname.startsWith('/uploads/')) return null;
    return relayBase.replace(/\/+$/, '') + parsed.pathname + parsed.search;
  } catch {
    return null;
  }
}

export function createGatedFetch(baseFetch: typeof fetch, options: GatedFetchOptions = {}): typeof fetch {
  const maxConcurrent = Math.max(1, options.maxConcurrent ?? 3);
  const retriesPerRoute = Math.max(0, options.retriesPerRoute ?? 1);
  const retryStatuses = options.retryStatuses ?? DEFAULT_RETRY_STATUSES;
  const isGated = options.isGated ?? (() => true);
  const relayBase = options.relayBase ?? '';

  let active = 0;
  const waiting: Array<() => void> = [];
  const inFlightGets = new Map<string, Promise<Response>>();
  let preferRelay = false;
  try {
    preferRelay = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(PREFER_RELAY_KEY) === '1';
  } catch {
    preferRelay = false;
  }

  const rememberRelay = (on: boolean): void => {
    preferRelay = on;
    try {
      if (on) sessionStorage.setItem(PREFER_RELAY_KEY, '1');
    } catch {
      /* storage disabled: in-memory preference is enough */
    }
  };

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
      next();
      return;
    }
    active--;
  };

  const runOnce = async (request: Request): Promise<Response> => {
    await acquire();
    try {
      return await baseFetch(request);
    } finally {
      release();
    }
  };

  const gatedFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const absolute = typeof input === 'string'
      ? new URL(input, typeof location !== 'undefined' ? location.href : 'http://localhost').toString()
      : input instanceof URL
        ? input.toString()
        : input.url;

    if (!isGated(absolute)) return baseFetch(input as any, init);

    const method = (init?.method || (typeof input === 'object' && 'method' in input ? (input as Request).method : 'GET')).toUpperCase();
    const signal = init?.signal ?? (typeof input === 'object' && 'signal' in input ? (input as Request).signal : undefined);
    const relayUrl = relayUrlFor(absolute, relayBase);

    const cacheKey = method === 'GET' ? absolute : '';
    if (cacheKey) {
      const existing = inFlightGets.get(cacheKey);
      if (existing) return (await existing).clone();
    }

    // One canonical request whose body is never consumed (every attempt runs on a clone), so the
    // relay hop can replay a POST with its payload intact.
    const canonical = typeof input === 'object' && 'clone' in input && input instanceof Request
      ? input
      : new Request(absolute, init);

    const routes: Array<{ url: string; viaRelay: boolean }> = [];
    const originRoute = { url: absolute, viaRelay: false };
    const relayRoute = relayUrl ? { url: relayUrl, viaRelay: true } : null;
    if (preferRelay && relayRoute) routes.push(relayRoute, originRoute);
    else routes.push(originRoute);
    if (relayRoute && !preferRelay) routes.push(relayRoute);

    const execute = (async (): Promise<Response> => {
      let lastError: unknown;
      let lastResponse: Response | undefined;

      for (const route of routes) {
        for (let attempt = 0; attempt <= retriesPerRoute; attempt++) {
          if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
          try {
            const attemptRequest = route.url === absolute ? canonical.clone() : new Request(route.url, canonical.clone());
            const response = await runOnce(attemptRequest);

            // The edge's protective mode answers 429/503 with an HTML body. Those are transient, so
            // they are retried on the same route before falling through to the relay.
            if (retryStatuses.includes(response.status) && attempt < retriesPerRoute) {
              lastResponse = response;
              await sleep(attempt === 0 ? 250 : 700);
              continue;
            }
            // A route that produced a real answer is the route to keep.
            if (route.viaRelay && response.status < 500) rememberRelay(true);
            else if (!route.viaRelay && preferRelay && response.status < 500) rememberRelay(false);
            return response;
          } catch (error) {
            lastError = error;
            if (!isTransportError(error)) throw error;
            if (attempt < retriesPerRoute) await sleep(attempt === 0 ? 250 : 700);
          }
        }
      }

      if (lastResponse) return lastResponse;
      throw lastError;
    })();

    if (cacheKey) {
      inFlightGets.set(cacheKey, execute);
      execute.finally(() => inFlightGets.delete(cacheKey)).catch(() => undefined);
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
    retriesPerRoute: 1,
    relayBase: RELAY_BASE,
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
