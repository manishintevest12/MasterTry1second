/**
 * Ekaro affiliate converter (owner rule, 22 Oct): monetize EVERY retailer
 * deeplink that has no direct partnership — via EarnKaro/Ekaro's public
 * converter API (https://ekaro-api.affiliaters.in/api/converter/public).
 *
 * Position in /api/out: the LAST fallback before a bare direct hop, so direct
 * partnerships (admin affiliate_configs, Amazon Associates, Cuelinks-joined,
 * LinkInR campaigns) always win. Today that means grocery exits (Blinkit,
 * Zepto, Instamart/Swiggy, BigBasket, Flipkart Minutes) and any other
 * retailer without a registered campaign get an Ekaro link.
 *
 * Self-healing + shared-hosting friendly:
 *  - needs EKARO_API_KEY; absent/unauthorized -> returns null (honest direct hop)
 *  - in-memory domain cache: positive 6h (converted link reused), negative 1h
 *    (merchant not on Ekaro -> skip until TTL)
 *  - 2.5s timeout, single in-flight promise per domain (no stampede)
 *  - cab booking deeplinks are excluded upstream (deeplink integrity rule)
 */

const EKARO_ENDPOINT = 'https://ekaro-api.affiliaters.in/api/converter/public';
const POS_TTL_MS = 6 * 60 * 60 * 1000;
const NEG_TTL_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 2500;

interface EkaroCacheEntry { link: string | null; at: number }

const cache = new Map<string, EkaroCacheEntry>();
const inFlight = new Map<string, Promise<string | null>>();
let authWarned = false;

function ekaroEnabled(): boolean {
  return Boolean(process.env.EKARO_API_KEY);
}

function apiKey(): string {
  return String(process.env.EKARO_API_KEY || '').trim();
}

/** Pull the first https monetized URL out of an unknown converter response shape. */
function extractLink(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const seen = new Set<unknown>();
  const stack: unknown[] = [body];
  while (stack.length) {
    const cur = stack.pop();
    if (typeof cur === 'string') {
      if (/^https:\/\/[\w.-]*(?:ekaro|earnkaro)[\w.-]*\//i.test(cur)) return cur;
      continue;
    }
    if (!cur || typeof cur !== 'object' || seen.has(cur)) continue;
    seen.add(cur);
    if (Array.isArray(cur)) { stack.push(...cur); continue; }
    for (const k of Object.keys(cur as Record<string, unknown>)) stack.push((cur as Record<string, unknown>)[k]);
  }
  return null;
}

async function convert(dest: string): Promise<string | null> {
  if (!ekaroEnabled()) return null;
  const url = new URL(dest);
  const host = url.hostname.replace(/^www\./, '');
  const hit = cache.get(host);
  if (hit && Date.now() - hit.at < (hit.link ? POS_TTL_MS : NEG_TTL_MS)) return hit.link;
  const pending = inFlight.get(host);
  if (pending) return pending;
  const task = (async () => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
      const res = await fetch(EKARO_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey()}` },
        body: JSON.stringify({ url: dest }),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (res.status === 401 || res.status === 403) {
        if (!authWarned) { console.warn('[Ekaro] API key rejected (401/403) — exits stay direct until a valid EKARO_API_KEY is set'); authWarned = true; }
        cache.set(host, { link: null, at: Date.now() });
        return null;
      }
      if (!res.ok) { cache.set(host, { link: null, at: Date.now() }); return null; }
      const link = extractLink(await res.json().catch(() => null));
      cache.set(host, { link, at: Date.now() });
      return link;
    } catch {
      cache.set(host, { link: null, at: Date.now() });
      return null;
    } finally {
      inFlight.delete(host);
    }
  })();
  inFlight.set(host, task);
  return task;
}

/** Ekaro tracking link for a retailer destination, or null when not applicable. */
export async function ekaroTrackingUrl(dest: string): Promise<string | null> {
  if (!/^https:\/\//i.test(dest)) return null;
  try { return await convert(dest); } catch { return null; }
}

/** Test hook. */
export function ekaroStats(): { enabled: boolean; domainsCached: number } {
  return { enabled: ekaroEnabled(), domainsCached: cache.size };
}
