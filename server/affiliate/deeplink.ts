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
import { IATA } from '../common/airportLookup';
import crypto from 'crypto';
import { settings } from '../common/settings';
import { linkinrCampaignFor } from './linkinr';
import { linkinrTrackingUrl, linkinrDeepTrackingUrl } from './linkinr';
import { ekaroTrackingUrl } from './ekaro';
import { log } from '../common/logger';
import { getStore } from '../common/db';

export interface SecureDeeplinkResult {
  trackingUrl: string;      // network tracking URL, or the raw destination when no network matches
  network: string | null;   // null = direct
  matchedProfile: 'affiliate_configs' | 'affiliate_links' | 'amazon_associates' | 'env_template' | 'cuelinks_fallback' | 'linkinr' | 'ekaro_converter' | 'adsense_only' | 'already_tracked' | 'direct';
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
const CUELINKS_BASE_MERCHANTS = ['makemytrip.com', 'goibibo.com', 'shopsy.in'];

/**
 * OWNER 10 Nov ("ab maine env mai cuelink update kr diya"): the allow-list used to be three hardcoded
 * domains, so joining a new advertiser in Cuelinks still paid nothing until someone edited code and
 * shipped it. It is now environment-extensible, in the order the owner actually works:
 *   CUELINKS_EXTRA_MERCHANTS="cleartrip.com,redbus.in,amazon.in"  -> add merchants you joined
 *   CUELINKS_ALL_MERCHANTS=1                                     -> wrap every merchant domain
 * Tracking uses the publisher cid (326794, per the current per-publisher linkkit), so a newly joined
 * merchant starts being attributed from the moment its domain is listed - no deploy of new code.
 * Unlisted domains still go direct, which is the safe default: Cuelinks cannot pay for a campaign the
 * publisher has not joined, and a wrapped-but-unjoined link would hide that fact.
 */
function cuelinksAllowList(): Set<string> {
  const extra = (process.env.CUELINKS_EXTRA_MERCHANTS || '')
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^www\./, ''))
    .filter(Boolean);
  return new Set<string>([...CUELINKS_BASE_MERCHANTS, ...extra]);
}

/** True when every merchant domain may be wrapped (owner opted in explicitly). */
function cuelinksWrapAll(): boolean {
  return /^(1|true|yes|on)$/i.test((process.env.CUELINKS_ALL_MERCHANTS || '').trim());
}

const CUELINKS_MERCHANTS = new Set(CUELINKS_BASE_MERCHANTS);

/** Read-only accessor for the admin coverage view (owner 27 Oct). */
export function cuelinksKnownMerchants(): string[] { return [...cuelinksAllowList()]; }
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
  if (!cuelinksWrapAll() && !cuelinksAllowList().has(domain)) return null;
  // Mirrors the API-generated tracking_url (source=api) + our subid (sub_ids_allowed=true)
  return `https://linksredirect.com/?cid=${encodeURIComponent(c.cid)}&subid=${encodeURIComponent(c.publisherId)}&source=api&url=${encodeURIComponent(dest)}`;
}


/** One extra network = one merchant allow-list + one template. Fail-closed on both. */
interface EnvNetworkSpec {
  network: string;
  merchantsEnv: string;
  templateEnv: string;
  /** Templates baked into the build, used when no env template is set (evergreen partner links). */
  builtin?: Record<string, string>;
}

/**
 * OWNER 10 Nov: "booking.com ka deeplink, evergreen wala link hai isko add kro jiss se booking.com pr
 * deeplink ho ske" - he handed over the CJ (Commission Junction) click link
 * https://www.dpbolvw.net/click-101903513-17293139 plus its 1x1 image pixel. Verified end to end from
 * here: that URL with ?url=<destination> walks dpbolvw.net -> cj.dotomi.com -> emjcd.com and lands on
 * the EXACT Booking.com property page with aid=8133105 and
 * label=affnetcj-17293139_pub-8098022_site-101903513, i.e. real CJ attribution, not a bare homepage hop.
 * CJ is a network of its own, so it gets its own layer: book a hotel and Booking.com is paid via CJ,
 * never via Cuelinks/Admitad. The image pixel is a browser-side tag and is NOT needed here - the click
 * link already carries the tracking, and our exits never render third-party pixels.
 * Booking.com stays evergreen because the CJ click id does not rotate; more CJ merchants can be added
 * later through CJ_MERCHANTS / CJ_LINK_TEMPLATES with no deploy.
 */
const CJ_EVERGREEN: Record<string, string> = {
  'booking.com': 'https://www.dpbolvw.net/click-101903513-17293139?url={DESTINATION}',
};

const ENV_NETWORKS: EnvNetworkSpec[] = [
  { network: 'admitad', merchantsEnv: 'ADMITAD_MERCHANTS', templateEnv: 'ADMITAD_LINK_TEMPLATE' },
  { network: 'vcommission', merchantsEnv: 'VCOMMISSION_MERCHANTS', templateEnv: 'VCOMMISSION_LINK_TEMPLATE' },
  { network: 'inrdeals', merchantsEnv: 'INRDEALS_MERCHANTS', templateEnv: 'INRDEALS_LINK_TEMPLATE' },
  { network: 'cj', merchantsEnv: 'CJ_MERCHANTS', templateEnv: 'CJ_LINK_TEMPLATE', builtin: CJ_EVERGREEN },
];

/** Domain match that also covers subdomains: hotels.booking.com matches a booking.com entry. */
function domainMatches(domain: string, listed: string): boolean {
  return domain === listed || domain.endsWith(`.${listed}`);
}

/** Finds the listed/builtin entry that covers this domain, subdomains included. */
function pickForDomain<T>(map: Record<string, T>, domain: string): T | null {
  if (Object.prototype.hasOwnProperty.call(map, domain)) return map[domain];
  const hit = Object.keys(map)
    .filter((k) => domainMatches(domain, k))
    .sort((a, b) => b.length - a.length)[0];
  return hit ? map[hit] : null;
}

/** Built-in (evergreen) template for a domain, if this network ships one. */
function builtinTemplate(spec: EnvNetworkSpec, domain: string): string | null {
  const tpl = spec.builtin ? pickForDomain(spec.builtin, domain) : null;
  if (!tpl) return null;
  return tpl.startsWith('https://') && tpl.includes('{DESTINATION}') ? tpl : null;
}

/**
 * Per-domain template map, e.g. VCOMMISSION_LINK_TEMPLATES='{"ajio.com":"https://track.vcommission.com/click?campaign_id=10364&pub_id=132657&deeplink={DESTINATION}"}'.
 * Admitad and vCommission hand out ONE tracking base per campaign, so a merchant allow-list plus a
 * single template cannot cover the account: the map is what lets 54 vCommission campaigns work at once
 * without a deploy. The single-template variable stays supported for a one-campaign account.
 */
function envTemplateMap(name: string): Record<string, string> {
  const raw = (process.env[name] || '').trim();
  if (!raw.startsWith('{')) return {};
  try {
    const parsed = JSON.parse(raw);
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const domain = String(k).toLowerCase().replace(/^www\./, '');
      const tpl = String(v || '').trim();
      if (domain && tpl.startsWith('https://') && tpl.includes('{DESTINATION}')) out[domain] = tpl;
    }
    return out;
  } catch {
    return {};
  }
}

function envList(name: string): string[] {
  return (process.env[name] || '')
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^www\./, ''))
    .filter(Boolean);
}

/** Which env network claims this domain, if any (no link building). */
export function envNetworkFor(domain: string): string | null {
  for (const spec of ENV_NETWORKS) {
    if (builtinTemplate(spec, domain)) return spec.network;
    if (envList(spec.merchantsEnv).some((d) => domainMatches(domain, d))) return spec.network;
    if (pickForDomain(envTemplateMap(spec.templateEnv + 'S'), domain)) return spec.network;
  }
  return null;
}

/** Builds the tracking URL for the env network that claims this domain, or null. */
function envTemplateNetworkFor(domain: string, dest: string): { network: string; url: string } | null {
  for (const spec of ENV_NETWORKS) {
    const builtin = builtinTemplate(spec, domain);
    const listed = envList(spec.merchantsEnv).some((d) => domainMatches(domain, d));
    const perDomain = pickForDomain(envTemplateMap(spec.templateEnv + 'S'), domain);
    if (!listed && !perDomain && !builtin) continue;
    const tpl = perDomain || (process.env[spec.templateEnv] || '').trim() || builtin || '';
    if (!tpl.startsWith('https://') || !tpl.includes('{DESTINATION}')) return null; // fail closed
    return { network: spec.network, url: tpl.replace('{DESTINATION}', encodeURIComponent(dest)) };
  }
  return null;
}

/**
 * Pure, DB-free routing preview: which layer WOULD pay for this domain right now, using only what is
 * configured in the environment and the static maps. The coverage report uses this so it can be
 * regenerated without touching production MySQL. It deliberately answers "who pays today", not
 * "which layer wins after admin overrides" - admin rows live in the DB and always outrank this.
 */
export function affiliateNetworkFor(domain: string): string | null {
  const d = domain.toLowerCase().replace(/^www\./, '');
  const envNet = envNetworkFor(d);
  if (envNet) return envNet;
  if (AMAZON_DOMAINS.test(d)) return 'amazon-associates';
  if (cuelinksAllowList().has(d) || cuelinksWrapAll()) return 'cuelinks';
  // LinkInR campaigns are a static sheet inside the module (no env gate needed).
  try { if (linkinrCampaignFor(`https://${d}/`) ) return 'linkinr'; } catch { /* ignore */ }
  // Ekaro/EarnKaro can only convert when its key exists; otherwise it is an honest direct hop.
  if (Boolean((process.env.EKARO_API_KEY || '').trim())) return 'ekaro';
  return null;
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
/** Tracking/redirect hosts: a URL already on one of these is OUR monetized link
 *  (manual finance inventory template, a cab book link, an owner-typed affiliate URL).
 *  Re-converting it would double-wrap and lose the destination page, so
 *  buildSecureDeeplink returns it untouched (owner 27 Oct). */
const ALREADY_TRACKED_HOSTS = /(^|\.)(linksredirect\.com|fktr\.in|myntr\.it|earnkaro\.com|ekaro\.[a-z.]+|affiliaters\.in|bitli\.in|linkinr\.[a-z.]+|vcommission\.com|inr\.deals|cuelinks\.com|cashkaro\.com|amzn\.to|go\.redirectingat\.com|sjv\.io|linksynergy\.com|clicweb|pxf\.io|dl\.flipkart\.com)$/i;

export function looksAlreadyTracked(url: string): boolean {
  try { return ALREADY_TRACKED_HOSTS.test(new URL(url).hostname.toLowerCase()); } catch { return false; }
}

export async function buildSecureDeeplink(targetUrl: string, opts: { companySlug?: string } = {}): Promise<SecureDeeplinkResult> { 
  // Already-tracked link: pass through untouched (never double-monetize).
  if (looksAlreadyTracked(targetUrl)) {
    return { trackingUrl: targetUrl, network: 'already_tracked', matchedProfile: 'already_tracked' };
  }
  const domain = safeDomain(targetUrl);
  const store = getStore();
  // 1. Admin-managed affiliate_configs (slug, exact domain, or registrable-domain
  //    suffix match — a profile saved for 'yatra.com' also covers hotel.yatra.com,
  //    flights.yatra.com, www.yatra.com; the LONGEST domain wins, so a more
  //    specific profile ('hotel.yatra.com') can still override a broad one).
  try {
    const slug = (opts.companySlug || '').toLowerCase().slice(0, 64);
    // Registrable-domain candidates so a profile saved for 'yatra.com' also
    // covers hotel.yatra.com / flights.yatra.com / www.yatra.com. Longest
    // company_domain wins, so a specific profile can override a broad one.
    const labels = domain.split('.').filter(Boolean);
    const parent2 = labels.length >= 2 ? labels.slice(-2).join('.') : domain;
    const parent3 = labels.length >= 3 ? labels.slice(-3).join('.') : domain;
    const rows = await store.query<any>(
      `SELECT network, campaign_key, template, subid_param, extra_params, monetization, affiliate_id FROM affiliate_configs
       WHERE active = 1 AND (slug = ? OR company_domain = ? OR company_domain = ? OR company_domain = ?)
       ORDER BY CHAR_LENGTH(company_domain) DESC LIMIT 1`, [slug, domain, parent2, parent3]);
    const r = rows?.[0];
    // Owner 27 Oct: merchants with NO affiliate program (Blinkit/Zepto/Instamart/BigBasket)
    // are marked monetization='adsense' in the admin registry. They take the honest direct
    // hop — the money comes from the AdSense unit on the exit page — instead of a pointless
    // Cuelinks/Ekaro conversion attempt that can only fail and add latency.
    if (r && String(r.monetization || '').toLowerCase() === 'adsense' && !r.template) {
      return { trackingUrl: targetUrl, network: 'direct', matchedProfile: 'adsense_only' };
    }
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
  // 2.5 OWNER 10 Nov: "jitne v cuelinks se hai wo cuelinks se commission de, jitne direct hai wo
  // direct se de, aur jo admitad, inrdeals, earnkaro wagera se hai unko waha se dene do". Each extra
  // network is driven by a merchant allow-list plus one template, so a merchant is routed to the
  // network it was actually joined on and never double-counted:
  //   ADMITAD_MERCHANTS + ADMITAD_LINK_TEMPLATE
  //   VCOMMISSION_MERCHANTS + VCOMMISSION_LINK_TEMPLATE
  //   INRDEALS_MERCHANTS + INRDEALS_LINK_TEMPLATE
  // (Cuelinks stays network 3 below; Ekaro/EarnKaro stays 3.7; direct stays last.)
  const envNet = envTemplateNetworkFor(domain, targetUrl);
  if (envNet) return { trackingUrl: envNet.url, network: envNet.network, matchedProfile: 'env_template' };
  // 3. Cuelinks known-merchant campaigns (publisher 278473): monetized linkkit
  //    deeplink for every joined merchant — makemytrip.com today.
  const cuelinks = cuelinksMerchantUrl(targetUrl);
  if (cuelinks) return { trackingUrl: cuelinks, network: 'cuelinks', matchedProfile: 'cuelinks_fallback' };
  // 3.5 LinkInR campaigns (owner sheet, 21 Oct 2026): monetize every merchant
  //     that has an active campaign but NO direct partner. Direct partners
  //     resolved above (admin configs, Amazon Associates, Cuelinks-joined
  //     MMT/Goibibo) always win; this layer only catches the rest, so every
  //     remaining exit earns affiliate revenue instead of a bare hop.
  // Owner 22 Oct: cab in-app booking links (m.uber.com/looking, book.olacabs.com)
  // carry the prefilled pickup + drop trip. LinkInR does NOT deep-link (the
  // destination URL is dropped) — converting these would land the user on the
  // campaign's generic page and silently lose the trip. Their affiliate
  // attribution (client_id + admin utm params) is already baked into the URL by
  // /api/cab/book, so they stay direct here.
  const cabBookLink = /^https:\/\/(m\.uber\.com\/looking|book\.olacabs\.com\/|rapido\.cc\/)/.test(targetUrl);
  const linkinr = cabBookLink ? null : await linkinrDeepTrackingUrl(targetUrl);
  if (linkinr) return { trackingUrl: linkinr, network: 'linkinr', matchedProfile: 'linkinr' };
  // 3.7 Ekaro converter (owner rule 22 Oct): every remaining retailer deeplink
  //     with no direct partnership (today: grocery exits — Blinkit, Zepto,
  //     Instamart, BigBasket, Flipkart Minutes — and any other campaign-less
  //     merchant) gets an EarnKaro/Ekaro monetized link. Needs EKARO_API_KEY;
  //     absent or rejected -> honest direct hop, self-heals when the key lands.
  if (!cabBookLink) {
    const ekaro = await ekaroTrackingUrl(targetUrl);
    if (ekaro) return { trackingUrl: ekaro, network: 'ekaro', matchedProfile: 'ekaro_converter' };
  }
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

/** Owner 24 Oct ("payment-page deeplinks"): when a scraped row ships without its
 *  product URL, the Order Now pointer was EMPTY — web opened a blank tab and
 *  Flutter dropped to the compare page, so the user never reached the merchant
 *  page where they pay. This builds an HONEST per-merchant SEARCH deeplink for
 *  the item title (a real published page pattern, never a fabricated product
 *  URL): the user lands on the merchant's own search for exactly that item,
 *  the affiliate converter (/api/out → Cuelinks/Ekaro) wraps it unchanged.
 *  Unknown vendor -> '' (old behaviour, no invention). */
import { merchantDeepLink } from './merchantLinks';

export function merchantSearchFallback(vendor: string, title: string, vertical?: string, travel?: { route?: string; date?: string; city?: string }): string {
  // Owner 27 Oct ("kuch website pr deeplink ho raha hai par kuch pr ni — sb pr ho
  // jaye"): the full confirmed merchant registry is served by merchantDeepLink.
  const deep = merchantDeepLink(vendor, title, vertical, travel || {});
  if (deep) return deep;
  const v = String(vendor || '').toLowerCase();
  const q = encodeURIComponent(String(title || '').trim().slice(0, 80));
  if (!v || !q) return '';
  const has = (...keys: string[]) => keys.some((k) => v.includes(k));
  // Owner 24 Oct evening ("payment-page deeplinks"): travel merchants get the
  // ROUTE-PREFILLED SRP, never their homepage. Route comes from the offer's own
  // travel block ("indore to delhi"); IATA codes from the shared airport table.
  // If we cannot resolve both endpoints honestly we keep the shallower page —
  // we never invent a route that was not searched.
  const mmtFlightSrp = (): string => {
    const legs = String(travel?.route || '').toLowerCase().split(/\s+to\s+/);
    if (legs.length !== 2) return '';
    const from = IATA[legs[0].trim()];
    const to = IATA[legs[1].trim()];
    if (!from || !to) return '';
    const d = String(travel?.date || '');
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '';
    if (!iso) return '';
    const [y, m, day] = iso.split('-');
    const it = `${from}-${to}-${day}/${m}/${y}`;
    return `https://www.makemytrip.com/flight/search?itinerary=${encodeURIComponent(it)}&tripType=O&paxType=1-A-C&intl=false&cabinClass=E&cc=INR`;
  };
  if (has('amazon')) return `https://www.amazon.in/s?k=${q}`;
  if (has('flipkart')) return `https://www.flipkart.com/search?q=${q}`;
  // Shopsy (shopsy.in) replaced Meesho on 5 Nov. The exit is a plain search URL; the
  // Cuelinks linkkit hop is applied by cuelinksMerchantUrl() (publisher 278473).
  if (has('shopsy')) return `https://www.shopsy.in/search?q=${q}`;
  if (has('myntra')) return `https://www.myntra.com/${encodeURIComponent(String(title || '').trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-').slice(0, 60))}`;
  if (has('ajio')) return `https://www.ajio.com/search/?text=${q}`;
  if (has('tata') && has('cliq')) return `https://www.tatacliq.com/search/?searchCategory=all&text=${q}`;
  if (has('swiggy') && has('instamart')) return `https://www.swiggy.com/instamart/search?query=${q}`;
  if (has('swiggy')) return `https://swiggy.com/search?query=${q}`;
  if (has('blinkit')) return `https://blinkit.com/s/?q=${q}`;
  if (has('zepto')) return `https://www.zepto.com/search?query=${q}`;
  if (has('bigbasket', 'bb now')) return `https://www.bigbasket.com/ps/?q=${q}`;
  if (has('zomato')) return `https://www.zomato.com/search?query=${q}`;
  if (has('domino')) return `https://www.dominos.co.in/menu`;
  if (has('bookmyshow')) return 'https://in.bookmyshow.com/explore/movies';
  if (has('makemytrip')) {
    if (vertical === 'flights') return mmtFlightSrp() || `https://www.makemytrip.com/flights/`;
    if (vertical === 'bus') {
      const legs = String(travel?.route || '').split(/\s+to\s+/i);
      const d = String(travel?.date || '');
      if (legs.length === 2 && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
        const [y, m, day] = d.split('-');
        const f = legs[0].trim().replace(/\s+/g, '-');
        const t = legs[1].trim().replace(/\s+/g, '-');
        return `https://www.makemytrip.com/bus/search/${encodeURIComponent(f)}/${encodeURIComponent(t)}/${day}-${m}-${y}`;
      }
    }
    return `https://www.makemytrip.com/${vertical === 'bus' ? 'bus/' : ''}`;
  }
  return '';
}
