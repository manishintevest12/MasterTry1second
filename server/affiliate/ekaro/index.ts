/**
 * Ekaro affiliate converter (owner rule, 22 Oct): monetize EVERY retailer
 * converter API (https://ekaro-api.affiliaters.in/api/converter).
 *
 * API shape (live-verified 22 Oct, reverse-engineered from the app.affiliaters.in
 * frontend bundle): POST {deal:"<text with link>", convert_option:'convert_only'}
 * with `Authorization: Bearer $EKARO_API_KEY` -> {success:1, data:"<deal text with
 * links replaced in place>", randomPostID}. EarnKaro profit links come back as
 * fktr.in/<code> (Flipkart) and similar short hosts, so extraction keeps every
 * URL in `data` that is NOT the original destination. /api/converter/public is a
 * dead endpoint (401/500) — never use it.
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

const EKARO_ENDPOINT = 'https://ekaro-api.affiliaters.in/api/converter';
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

/** Strip punctuation a deal text glues onto the URL. */
const trimUrl = (u: string): string => u.replace(/[.,;!)'"\]]+$/, '');

/** Pull the converter's monetized URL out of the returned deal text: every
 * https URL that is NOT the original destination, preferring EarnKaro's own
 * short-link hosts when several appear. */
function extractLink(body: unknown, original: string): string | null {
  if (!body || typeof body !== 'object') return null;
  const data = (body as Record<string, unknown>).data;
  if (typeof data !== 'string' || !data) return null;
  const src = new Set([trimUrl(original)]);
  const urls = (data.match(/https?:\/\/[^\s"'<>]+/g) || []).map(trimUrl).filter((u) => !src.has(u));
  if (!urls.length) return null;
  const branded = urls.find((u) => /earnkaro|ekaro|fktr\.in/i.test(u));
  return branded || urls[0];
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
        body: JSON.stringify({ deal: dest, convert_option: 'convert_only' }),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (res.status === 401 || res.status === 403) {
        if (!authWarned) { console.warn('[Ekaro] API key rejected (401/403) — exits stay direct until a valid EKARO_API_KEY is set'); authWarned = true; }
        cache.set(host, { link: null, at: Date.now() });
        return null;
      }
      if (!res.ok) { cache.set(host, { link: null, at: Date.now() }); return null; }
      const json: unknown = await res.json().catch(() => null);
      // success:1 is the documented hit; a 200 with success:0 ('Url not found in
      // post') means the merchant is not on EarnKaro — honest null either way.
      const link = extractLink(json, dest);
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
