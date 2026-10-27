/**
 * LinkInR deep-link bridge (owner 27 Oct: "agoda wagera sb add hai naa deeplink iss
 * affiliate id se, muje hr jagah 100% workable link chahiye").
 *
 * LIVE-VERIFIED 27 Oct:
 *  - https://linkinr.com?campaign_id=3NCvAx&inventory_id=dkNuid&url=<deep> DROPS the url:
 *    both requests 302 to the same CJ click URL and land on https://www.agoda.com/
 *    (merchant homepage) — the user loses the hotel/city page they were comparing.
 *  - The CJ click URL LinkInR hands out DOES honour url:
 *      https://www.tkqlhce.com/click-101523230-17095162?url=<deep>
 *    lands on the exact deep page and still carries our attribution
 *    (cid=1942726&publisher=7109575&pid=101523230&cj_aid=17095162&tag=…&sid=…).
 *
 * So: resolve the campaign ONCE (no-follow), remember the CJ click base, then append the
 * real destination. Attribution is the same click, the user lands exactly where they
 * were headed. If the hop ever stops honouring url (CJ rule change) we fall back to the
 * plain LinkInR hop, and the probe re-tests automatically (self-healing, owner rule).
 */
const CJ_HOSTS = /(^|\.)(tkqlhce\.com|anrdoezrs\.net|dpbolvw\.net|jdoqocy\.com|kqzyfj\.com|emjcd\.com|ftjcfx\.com|qksrv\.net|sjv\.io)$/i;
const HOP_TTL_MS = 6 * 60 * 60 * 1000;   // re-resolve every 6h (network links can rotate)
const FAIL_TTL_MS = 15 * 60 * 1000;      // negative cache: don't hammer a broken hop

interface Hop { base: string; at: number; ok: boolean }
const hops = new Map<string, Hop>();

/** Volatile per-click params (sid/tag are minted per click) — drop them from the base. */
export function cjClickBase(location: string): string | null {
  try {
    const u = new URL(location);
    if (!CJ_HOSTS.test(u.hostname)) return null;
    for (const k of ['sid', 'tag', 'url', 'SID']) u.searchParams.delete(k);
    let base = u.toString();
    // `…?url=` already present after stripping would look like `?&url=`; normalise.
    base = base.replace(/[?&]+$/, '');
    return base;
  } catch { return null; }
}

/** Compose the deep tracking URL from a CJ click base + the real destination. */
export function cjDeepUrl(base: string, deepUrl: string): string {
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}url=${encodeURIComponent(deepUrl)}`;
}

async function resolveHop(linkinrUrl: string, campaignId: string): Promise<Hop | null> {
  const cached = hops.get(campaignId);
  const now = Date.now();
  if (cached && now - cached.at < (cached.ok ? HOP_TTL_MS : FAIL_TTL_MS)) return cached;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(linkinrUrl, {
      method: 'GET', redirect: 'manual', signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36' },
    }).finally(() => clearTimeout(t));
    const loc = res.headers.get('location') || '';
    const base = cjClickBase(loc);
    const hop: Hop = base
      ? { base, at: now, ok: true }
      : { base: '', at: now, ok: false };
    hops.set(campaignId, hop);
    return hop;
  } catch {
    const hop: Hop = { base: '', at: now, ok: false };
    hops.set(campaignId, hop);
    return hop;
  }
}

/**
 * Returns a deep, attributed tracking URL for `dest`, or null when the hop cannot be
 * resolved (caller then uses the plain LinkInR link, so monetization never regresses).
 */
export async function linkinrDeepUrl(plainUrl: string, campaignId: string, dest: string): Promise<string | null> {
  const hop = await resolveHop(plainUrl, campaignId);
  if (!hop?.ok || !hop.base) return null;
  return cjDeepUrl(hop.base, dest);
}

/** Test seam: forget cached hops. */
export function _resetLinkInrHops(): void { hops.clear(); }
