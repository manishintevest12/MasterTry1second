/**
 * ONE source of truth for the Cuelinks tracking `cid`.
 *
 * OWNER 12 Nov (screenshot of cuelinks.com/broken-links after a redirection, "fix on priority"):
 * MEASURED against linksredirect.com today with our exact link shape -
 *   cid=326794 -> tracking.icubeswire.co (real attributed hop)
 *   cid=3801 / 3942 (public campaign ids) -> merchant, still fine
 *   cid=278473 -> cuelinks.com/broken-links   <-- 278473 is our PUBLISHER ID, not a cid
 * So one wrong env value, CUELINKS_CID=278473 (easy to do, the dashboard shows the publisher id on every
 * page), turns EVERY exit into the broken-link page the owner saw. The builders now refuse that value and
 * fall back to the cid measured working on this account, instead of trusting whatever is in the env.
 */
import { settings } from '../common/settings';
import { log } from '../common/logger';

/** The per-publisher cid returned by Cuelinks /links/convert for this account; verified live 12 Nov. */
export const KNOWN_GOOD_CUELINKS_CID = '326794';

/** Values that are NOT a cid even though they are numeric ids on the Cuelinks account. */
function isNotACid(value: string): boolean {
  const v = String(value || '').trim();
  if (!v) return true;
  if (!/^\d{3,12}$/.test(v)) return true;                       // cids are plain digits
  if (v === String(settings.cuelinks.publisherId || '').trim()) return true; // publisher id -> broken-links
  if (v === String(settings.cuelinks.campaignId || '').trim()) return false;  // a campaign id still redirects
  return false;
}

/** The cid every Cuelinks URL must use. Never the publisher id; falls back to the verified one. */
let warned = false;
export function resolveCuelinksCid(): string {
  const configured = String(settings.cuelinks.cid || '').trim();
  if (!isNotACid(configured)) return configured;
  if (configured && !warned) {
    warned = true;
    log.warn('Cuelinks', `CUELINKS_CID=${configured} is not a tracking cid (it is the publisher/campaign id) - `
      + `linksredirect answers cuelinks.com/broken-links for it. Using the verified cid ${KNOWN_GOOD_CUELINKS_CID}.`);
  }
  return KNOWN_GOOD_CUELINKS_CID;
}

/** Sub-id must be a short token; anything else is dropped rather than mangling the URL. */
export function resolveCuelinksSubId(raw?: string): string {
  const v = String(raw || '').trim();
  return /^[A-Za-z0-9_-]{1,64}$/.test(v) ? v : '';
}

/**
 * The single verified deeplink shape for this account:
 *   https://linksredirect.com/?cid=<cid>&source=linkkit&url=<encoded destination>
 * The old `?type=nl&campaign=<id>` shape 301s to the Cuelinks homepage, so it is not offered at all.
 */
export function buildCuelinksDeepLink(destination: string, subId?: string): string | null {
  try {
    const u = new URL(String(destination || ''));
    if (u.protocol !== 'https:') return null;
  } catch { return null; }
  const cid = resolveCuelinksCid();
  if (!cid) return null;
  // Shape measured working on this account (12 Nov): cid + subid + source=api + url.
  const sub = resolveCuelinksSubId(subId) || resolveCuelinksSubId(settings.cuelinks.publisherId);
  const subPart = sub ? `&subid=${encodeURIComponent(sub)}` : '';
  return `https://linksredirect.com/?cid=${encodeURIComponent(cid)}${subPart}&source=api&url=${encodeURIComponent(destination)}`;
}

