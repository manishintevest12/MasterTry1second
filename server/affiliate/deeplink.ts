/**
 * Module 4 — Dynamic Deeplink Interceptor & Generator (owner blueprint).
 *
 * buildSecureDeeplink(): company/vendor-slug -> active affiliate profile ->
 * network-specific tracking URL. Profile resolution order:
 *   1. affiliate_configs table (admin-managed, per company slug / domain)
 *   2. affiliate_links table (per-domain templates captured by the sync workers)
 *   3. Cuelinks settings fallback (configured campaign only)
 *   4. null -> direct destination (no invented parameters, ever)
 *
 * Masking pointer: the frontend NEVER receives affiliate tokens. It gets
 * /api/out?t=<token>, an HMAC-signed, expiring pointer. The redirect endpoint
 * resolves the token server-side, validates the destination (anti open-redirect)
 * and 302s through the tracking link, recording the click for attribution.
 */
import crypto from 'crypto';
import { settings } from '../common/settings';
import { linkinrTrackingUrl } from './linkinr';
import { log } from '../common/logger';
import { getStore } from '../common/db';

export interface SecureDeeplinkResult {
  trackingUrl: string;      // network tracking URL, or the raw destination when no network matches
  network: string | null;   // null = direct
  matchedProfile: 'affiliate_configs' | 'affiliate_links' | 'amazon_associates' | 'cuelinks_fallback' | 'linkinr' | 'direct';
}

const AFFILIATE_TTL_SEC = 24 * 60 * 60; // pointers live one day

function secret(): string {
  // Prefer a dedicated secret; derive a stable fallback so production works
  // without new env vars (rotation means setting AFFILIATE_SECRET).
  return process.env.AFFILIATE_SECRET || crypto.createHash('sha256')
    .update(`${process.env.DATABASE_URL || process.env.MYSQL_URL || 'try1second'}#affiliate-pointer`).digest('hex');
}

function b64url(s: string): string { return Buffer.from(s, 'utf8').toString('base64url'); }
function unb64url(s: string): string { return Buffer.from(s, 'base64url').toString('utf8'); }

export function createMaskingPointer(destination: string, opts: { offerId?: string; trusted?: boolean } = {}): string {
  const dest = String(destination || '').trim();
  // Never mint a pointer the click endpoint would refuse — a non-HTTP / malformed
  // destination yields '' so cards render without a dead-end link instead of
  // shipping a "Refused:" page to the user (owner bug, 22 Oct).
  try {
    const u = new URL(dest);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    if (!u.hostname || !u.hostname.includes('.')) return '';
  } catch { return ''; }
  // `t: 1` stamps trusted PROVENANCE (coupon/affiliate registry feed or admin partner):
  // click-time validation then permits merchant bridge pages that carry url= params
  // (e.g. a registry merchant whose landing page forwards to the vendor).
  const payload = b64url(JSON.stringify({ d: dest.slice(0, 2000), o: (opts.offerId || '').slice(0, 64), e: Date.now() + AFFILIATE_TTL_SEC * 1000, ...(opts.trusted ? { t: 1 } : {}) }));
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('base64url').slice(0, 32);
  return `/api/out?t=${payload}.${sig}`;
}

export function resolveMaskingPointer(token: string): { destination: string; offerId?: string; trusted?: boolean } | null {
  const m = /^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(String(token || ''));
  if (!m) return null;
  const [payload, sig] = [m[1], m[2]];
  const expect = crypto.createHmac('sha256', secret()).update(payload).digest('base64url').slice(0, 32);
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  try {
    const j = JSON.parse(unb64url(payload));
    if (!j?.d || typeof j.d !== 'string' || Number(j.e) < Date.now()) return null;
    return { destination: String(j.d), offerId: j.o ? String(j.o) : undefined, trusted: j.t === 1 };
  } catch { return null; }
}

/** Safe-domain helper shared by profile lookups. */
export function safeDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

/**
 * Cuelinks merchant campaigns (public campaign IDs, verified live 15 Oct 2026:
 * linksredirect.com/?cid=...&url=... 302s to the exact destination from any
 * client). The campaign listing is browsable at cuelinks.com/campaigns?query=
 * Extend this map as more merchants are joined in the Cuelinks dashboard.
 * NOTE: MakeMyTrip and Goibibo each have a single campaign today (Hotels-
 * named) — Cuelinks attributes by destination domain, so the cid covers that
 * merchant's flights/hotels deeplinks too. Verified live 15 Oct 2026: cid 3801
 * and 3942 both 302 to the exact destination. When the API key is set, the
 * provider's campaign sync can discover newer per-vertical campaigns.
 */
const CUELINKS_MERCHANTS = new Set(['makemytrip.com', 'goibibo.com']);
// Campaign refs (public ids, for the dashboard): makemytrip.com = 3801
// "MakeMyTrip (Hotels)" (access open, deeplink_allowed false — deep-path
// commission not guaranteed but the hop lands on the exact page), goibibo.com =
// 3942 "Goibibo Hotels" (open). Tracking uses OUR per-publisher cid 326794
// (returned by the official /links/convert API), NOT the campaign id.

/** Build a working Cuelinks linkkit deeplink: verified format
 *  https://linksredirect.com/?cid=<campaign>&subid=<publisher>&source=<site>&url=<encoded>
 *  (the old type=nl&campaign= format 301'd to the Cuelinks homepage — dead). */
export function cuelinksMerchantUrl(dest: string): string | null {
  const c = settings.cuelinks;
  if (!c.publisherId) return null;
  let domain: string;
  try { domain = new URL(dest).hostname.toLowerCase().replace(/^www\./, ''); } catch { return null; }
  if (!CUELINKS_MERCHANTS.has(domain)) return null;
  // Mirrors the API-generated tracking_url (source=api) + our subid (sub_ids_allowed=true)
  return `https://linksredirect.com/?cid=${encodeURIComponent(c.cid)}&subid=${encodeURIComponent(c.publisherId)}&source=api&url=${encodeURIComponent(dest)}`;
}

const AMAZON_DOMAINS = /(^|\.)(amazon\.(?:in|com|co\.uk|de|ca|fr|it|es|nl|sg|ae|com\.au|com\.br|com\.mx|jp|co\.jp)|amzn\.to)$/i;

/**
 * Amazon Associates attribution (owner's store tag): append ?tag=<ours> to the
 * EXACT product URL the price came from. Replaces any foreign tag. Pure function
 * over the URL — acquisition and destination are untouched, only attribution
 * is added. Returns null for non-Amazon destinations or an empty tag setting.
 */
export function amazonAssociatesUrl(dest: string): string | null {
  const tag = settings.amazonAssociates?.tag;
  if (!tag) return null;
  let u: URL;
  try { u = new URL(dest); } catch { return null; }
  if (!AMAZON_DOMAINS.test(u.hostname.toLowerCase())) return null;
  u.searchParams.set('tag', tag); // last write wins: our store, never a foreign affiliate's
  return u.toString();
}

/**
 * Resolve an affiliate profile and build the tracking URL for a target
 * product URL. Never invents IDs: an unconfigured company resolves to a
 * direct hop (network=null) and the user still reaches the exact destination.
 */
export async function buildSecureDeeplink(targetUrl: string, opts: { companySlug?: string } = {}): Promise<SecureDeeplinkResult> {
  const domain = safeDomain(targetUrl);
  const store = getStore();
  // 1. Admin-managed affiliate_configs (slug or domain match)
  try {
    const slug = (opts.companySlug || '').toLowerCase().slice(0, 64);
    const rows = await store.query<any>(
      `SELECT network, campaign_key, template, subid_param, extra_params FROM affiliate_configs
       WHERE active = 1 AND (slug = ? OR company_domain = ?) LIMIT 1`, [slug, domain]);
    const r = rows?.[0];
    if (r?.template) {
      const extra = parseJsonObj(r.extra_params);
      const url = renderTemplate(String(r.template), targetUrl, extra, String(r.subid_param || 'subid'));
      return { trackingUrl: url, network: String(r.network || 'direct'), matchedProfile: 'affiliate_configs' };
    }
  } catch { /* table absent — fall through */ }
  // 1.5 Amazon Associates: our own store tag on the exact amazon.* product URL.
  // Runs after admin affiliate_configs (explicit admin override still wins) and
  // before network fallbacks: a direct amazon.in link must never route through
  // Cuelinks when we have our own Associates store for it.
  const amz = amazonAssociatesUrl(targetUrl);
  if (amz) return { trackingUrl: amz, network: 'amazon-associates', matchedProfile: 'amazon_associates' };
  // 2. Per-domain templates captured by affiliate sync workers
  try {
    const rows = await store.query<any>(
      `SELECT network_id, deep_link_template, campaign_id, sub_id FROM affiliate_links
       WHERE vendor_domain = ? LIMIT 1`, [domain]);
    const r = rows?.[0];
    if (r?.deep_link_template) {
      const url = renderTemplate(String(r.deep_link_template), targetUrl, { campaign: r.campaign_id || '', subid: r.sub_id || '' }, 'subid');
      return { trackingUrl: url, network: String(r.network_id || 'direct'), matchedProfile: 'affiliate_links' };
    }
  } catch { /* fall through */ }
  // 3. Cuelinks known-merchant campaigns (publisher 278473): monetized linkkit
  //    deeplink for every joined merchant — makemytrip.com today.
  const cuelinks = cuelinksMerchantUrl(targetUrl);
  if (cuelinks) return { trackingUrl: cuelinks, network: 'cuelinks', matchedProfile: 'cuelinks_fallback' };
  // 3.5 LinkInR campaigns (owner sheet, 21 Oct 2026): monetize every merchant
  //     that has an active campaign but NO direct partner. Direct partners
  //     resolved above (admin configs, Amazon Associates, Cuelinks-joined
  //     MMT/Goibibo) always win; this layer only catches the rest, so every
  //     remaining exit earns affiliate revenue instead of a bare hop.
  const linkinr = linkinrTrackingUrl(targetUrl);
  if (linkinr) return { trackingUrl: linkinr, network: 'linkinr', matchedProfile: 'linkinr' };
  // 4. Direct — honest, no invented parameters
  return { trackingUrl: targetUrl, network: null, matchedProfile: 'direct' };
}

/** Template renderer: {url}=single-encoded, {url2}=double-encoded (vCommission u=),
 *  {subid}/{campaign}/{click} from extra/opts. Unknown placeholders are removed. */
function renderTemplate(tpl: string, dest: string, extra: Record<string, string>, subidParam: string): string {
  const out = tpl
    .replace(/\{url2\}/g, encodeURIComponent(encodeURIComponent(dest)))
    .replace(/\{url\}/g, encodeURIComponent(dest))
    .replace(new RegExp(`\\{${subidParam}\\}|\\{subid\\}`, 'g'), encodeURIComponent(extra.subid || settings.cuelinks.subId || 'try1second'))
    .replace(/\{campaign\}/g, encodeURIComponent(extra.campaign || ''))
    .replace(/\{click\}/g, crypto.randomBytes(6).toString('hex'));
  return out.replace(/\{[a-z0-9_]+\}/gi, '');
}

function parseJsonObj(v: any): Record<string, string> {
  if (!v) return {};
  try { const j = typeof v === 'string' ? JSON.parse(v) : v; return j && typeof j === 'object' ? j : {}; } catch { return {}; }
}

/** Click recording for attribution (best-effort, mirrors Section 15 rules). */
export async function recordPointerClick(dest: string, offerId: string | undefined, network: string | null): Promise<string | null> {
  const clickId = crypto.randomUUID();
  try {
    const store = getStore();
    await store.execute(
      `INSERT INTO affiliate_clicks (offer_id, network_id, vendor_domain, destination_url, click_id, user_id)
       VALUES (?, ?, ?, ?, ?, NULL)`,
      [offerId ? (Number(String(offerId).match(/\d+/)?.[0]) || null) : null, network || 'direct', safeDomain(dest), dest.slice(0, 2000), clickId],
    );
  } catch (e) { log.debug('Affiliate', 'click recording skipped', {}); }
  return clickId;
}
