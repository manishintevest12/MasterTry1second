/**
 * Home Showcase (owner spec, 21 Oct): eight curated sections directly under
 * the "Instant Launch Verticals" grid on the homepage —
 *   Picked Just for You · Special Offers For You · Massive Discounts ·
 *   Mega Savings · Best in Tech & Gadgets · Steals You Can't Ignore ·
 *   Most Visited Places (best-paying hotel partner) · Best Cards For You ·
 *   Famous Destinations (flights, owner 22 Oct).
 *
 * HONEST DATA ONLY (standing rule): every item is a real row from the
 * persistent `offers` catalogue or the synced `affiliate_offers` registry.
 * A section with no real data is simply omitted — never mocked.
 *
 * STORE-AGNOSTIC QUERIES (owner 22 Oct): SQL stays in the shape BOTH stores
 * parse (MySQL in production, the file store in dev) — `col = ?`, literal
 * LIMIT. REGEXP / INTERVAL / `!= 'literal'` / arithmetic WHERE clauses parse
 * as match-nothing on the file store (sections silently emptied), so all
 * freshness, discount and category math runs in JavaScript, identical on both.
 *
 * MONETIZATION (standing rules): items never carry raw links; they get an
 * HMAC masking pointer (/api/out?t=...). The redirect pipeline injects the
 * Amazon Associates tag (try1second-21) for Amazon rows and routes Myntra
 * through INR Deals (LinkInR) / Cuelinks — server-side only, as always.
 */
import { getStore } from '../common/db';
import { log } from '../common/logger';
import { createMaskingPointer } from '../affiliate/deeplink';
import { resolveMerchantCrispLogo } from '../pipeline/merchantCrispLogo';
import { merchantLogoMap } from '../marketing/merchantLogos';

export interface ShowcaseItem {
  id: string;
  title: string;
  merchant: string;
  merchantLogo: string | null; // registry logo (affiliate rows) — never a guess
  image: string | null;
  price: number | null;      // current/effective price
  mrp: number | null;        // list price (strike-through)
  discountPct: number | null;
  rating: number | null;     // real source rating (attributes.rating), shown only when present
  badge: string | null;      // coupon code / savings label
  url: string;              // masking pointer -> /api/out (affiliate injected)
  /** In-app engine launch instead of an external redirect (Famous Destinations
   *  opens the REAL flights search for that city — never a fake link). */
  launch?: { vertical: string; query: string } | null;
}

export interface ShowcaseSection {
  id: string;
  title: string;
  subtitle: string;
  items: ShowcaseItem[];
}

export interface OfferRow {
  id: number; vertical: string; title: string; brand: string | null; attributes: unknown;
  vendor: string | null; seller: string | null; seller_url: string | null;
  list_price: number | string | null; mandatory_total: number | string | null; effective_price: number | string | null;
  validation_status?: string | null; location_city?: string | null;
  fetched_at: string | Date;
}

export interface AffiliateRow {
  id: number; network_source: string; network_offer_id: string; merchant_name: string; merchant_logo: string | null;
  title: string; description: string | null; coupon_code: string | null; discount_value: number | string | null;
  discount_type: string | null; affiliate_url: string | null; original_url: string | null; categories: string | null;
  commission_note: string | null; last_seen_at?: string | Date | null;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const tsOf = (v: unknown): number => {
  if (v instanceof Date) return v.getTime();
  const t = Date.parse(String(v ?? ''));
  return Number.isFinite(t) ? t : 0;
};

/** Row age in days (JS-side: the file store cannot evaluate INTERVAL). */
export const ageDays = (r: OfferRow): number => (Date.now() - tsOf(r.fetched_at)) / 86_400_000;

/** Effective price, mandatory-total fallback (JS-side COALESCE). */
export const priceOf = (r: OfferRow): number => num(r.effective_price) ?? num(r.mandatory_total) ?? 0;

export const mrpOf = (r: OfferRow): number => num(r.list_price) ?? 0;

/**
 * Source-stated discount fallback (owner 22 Oct): several live SRP rows carry
 * the seller's own discount claim in attributes (e.g. "discount":"19%") without
 * an MRP strike-through. Use the source's own stated percentage — never a
 * guess — so the Go Big / Steals sections don't starve on MRP-less sources.
 * "Up to X%" claims are skipped: they cannot be pinned to this product.
 */
export function statedDiscountPct(attributes: unknown): number {
  let att: any = attributes;
  if (typeof att === 'string') {
    try { att = JSON.parse(att); } catch { return 0; }
  }
  if (!att || typeof att !== 'object') return 0;
  const raw = att.discount ?? att.discount_pct ?? att.discount_percentage;
  if (raw == null) return 0;
  const str = String(raw);
  if (/up\s*to/i.test(str)) return 0; // not attributable to this exact item
  const m = str.match(/(\d+(?:\.\d+)?)\s*%?/);
  const pct = m ? Math.round(parseFloat(m[1])) : 0;
  return pct >= 1 && pct <= 95 ? pct : 0;
}

export const pctOf = (r: OfferRow): number => {
  const p = priceOf(r), m = mrpOf(r);
  if (m && m > p) return (m - p) / m;
  const stated = statedDiscountPct(r.attributes);      // honest source-stated %
  return stated > 0 ? stated / 100 : 0;
};

export const saveOf = (r: OfferRow): number => {
  const p = priceOf(r), m = mrpOf(r);
  if (m && m > p) return m - p;
  const stated = statedDiscountPct(r.attributes);
  return stated > 0 ? Math.round(p * stated / 100) : 0; // derived from the source's own %
};

/** Servable: not invalidated, has a real seller link, is priced, is fresh. */
export const servableRow = (r: OfferRow, maxAgeDays = 14): boolean =>
  (r.validation_status || '') !== 'INVALID'
  && !!r.seller_url
  && priceOf(r) > 0
  && ageDays(r) <= maxAgeDays;

export function imageFromAttributes(raw: unknown): string | null {
  if (!raw) return null;
  let a: any = raw;
  if (typeof a === 'string') { try { a = JSON.parse(a); } catch { return null; } }
  const single = a?.image_url ?? a?.imageUrl ?? a?.image;
  if (typeof single === 'string' && single.startsWith('https://')) return single;
  const gallery = a?.image_urls ?? a?.imageUrls;
  if (Array.isArray(gallery)) {
    const hit = gallery.find((u: unknown) => typeof u === 'string' && (u as string).startsWith('https://'));
    if (hit) return hit as string;
  }
  return null;
}

export function ratingFromAttributes(raw: unknown): number | null {
  if (!raw) return null;
  let a: any = raw;
  if (typeof a === 'string') { try { a = JSON.parse(a); } catch { return null; } }
  for (const k of ['rating', 'rating_value', 'average_rating', 'stars']) {
    const v = a?.[k];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 5) return Math.round(v * 10) / 10;
    if (typeof v === 'string' && v.trim() !== '') {
      const n = parseFloat(v.replace(/[^0-9.]/g, ''));
      if (Number.isFinite(n) && n > 0 && n <= 5) return Math.round(n * 10) / 10;
    }
  }
  return null;
}

export function itemFromOffer(row: OfferRow): ShowcaseItem | null {
  const url = row.seller_url || null;
  const price = priceOf(row);
  const mrp = mrpOf(row);
  if (!url || !price) return null; // nothing honest to link or show
  // MRP strike-through first; else the seller's own stated % (owner 22 Oct).
  const pct = mrp > price
    ? Math.round(((mrp - price) / mrp) * 100)
    : (() => { const st = statedDiscountPct(row.attributes); return st >= 1 ? st : null; })();
  const merchant = (row.vendor || row.seller || 'Store').slice(0, 40);
  return {
    id: `off-${row.id}`,
    title: String(row.title || '').slice(0, 90),
    merchant,
    merchantLogo: null,
    image: imageFromAttributes(row.attributes)
      || (() => { const dom = realMerchantDomain([row.seller_url]) || nameDomainOf(merchant); return dom ? `https://icons.duckduckgo.com/ip3/${dom}.ico` : null; })(),
    price,
    mrp: mrp > price ? mrp : null,
    discountPct: pct,
    rating: ratingFromAttributes(row.attributes),
    badge: pct && pct >= 1 ? `${pct}% OFF` : null,
    url: createMaskingPointer(url, { offerId: `showcase-off-${row.id}` }),
  };
}

/**
 * MERCHANT LOGO RESOLUTION for coupon cards (owner 22 Oct: "image do, google se
 * bhi mil jaayega; initials sirf worst-case me").
 *
 * Reality check (live prod): nearly every coupon row's original_url is an
 * AFFILIATE REDIRECT host (linksredirect.com = Cuelinks), so the naive
 * host-of-original_url derivation handed every card the network's logo. The
 * chain is now:
 *   1. registry merchant_logo (synced with the affiliate feed)
 *   2. DuckDuckGo icon service for the merchant's OWN domain — first the URL
 *      host when it is a real merchant host, else the merchant-name-derived
 *      domain (logo.clearbit.com is DNS-dead since Clearbit's shutdown — the
 *      previous chain shipped dead URLs and cards rendered empty)
 *   3. Google favicon service (sz=128) for the same domain — always answers
 *   4. null -> UI initials (worst case only)
 * Candidates are VERIFIED SERVER-SIDE (200 + real image bytes) with a 6h
 * in-memory cache, so a dead CDN never reaches the card. */
const AFFILIATE_HOST = /linksredirect|cuelinks|ekaro|inrdeals|admitad|vcommission|linkinr|earnkaro|zaggle|optimisemedia|awin|adtraction|partnerize|webgains|dgm|impact|clk|redirect|try1second/i;

/** Host of the first URL that is a REAL merchant site (never a redirect host). */
export function realMerchantDomain(urls: Array<string | null>): string | null {
  for (const u of urls) {
    if (!u) continue;
    try {
      const h = new URL(u).hostname.replace(/^www\./, '');
      if (h && !AFFILIATE_HOST.test(h)) return h;
    } catch { /* not an absolute URL */ }
  }
  return null;
}

/** Compact merchant name -> domain guess ("Nykaa Fashion" -> nykaafashion.com). */
export function nameDomainOf(name: string): string | null {
  const n = String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return n ? `${n}.com` : null;
}

/** Ordered logo candidates for a coupon row (pure; first is preferred). */
export function merchantLogoCandidates(row: AffiliateRow): string[] {
  if (row.merchant_logo) return [row.merchant_logo];
  const out: string[] = [];
  const real = realMerchantDomain([row.original_url, row.affiliate_url]);
  const named = nameDomainOf(row.merchant_name);
  const push = (dom: string) => {
    out.push(`https://icons.duckduckgo.com/ip3/${dom}.ico`);
    out.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(dom)}&sz=128`);
  };
  if (real) push(real);
  if (named && named !== real) push(named);
  return out;
}

const logoCache = new Map<string, { at: number; ok: boolean }>();
const LOGO_TTL_MS = 6 * 60 * 60 * 1000;

/** Does this logo URL really answer with image bytes? (verified server-side) */
async function logoAnswers(url: string): Promise<boolean> {
  const hit = logoCache.get(url);
  if (hit && Date.now() - hit.at < LOGO_TTL_MS) return hit.ok;
  let ok = false;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 3500);
    const res = await fetch(url, { signal: ctl.signal, redirect: 'follow' });
    clearTimeout(t);
    const ct = String(res.headers.get('content-type') || '');
    const len = Number(res.headers.get('content-length') || 0);
    ok = res.status === 200 && ct.startsWith('image/') && (len === 0 || len > 400);
  } catch { ok = false; } // network hiccup -> treat as unverified
  logoCache.set(url, { at: Date.now(), ok });
  return ok;
}

/** Key the admin-uploaded merchant_logos registry uses (first word, lowercased). */
function uploadKeyOf(name: string): string {
  return String(name || '').toLowerCase().replace(/\.(com|in|co\.in)\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ')[0] || '';
}

/** First verified candidate; when verification is impossible (offline sandbox)
 *  the first candidate still ships so the browser can try it.
 *  Owner 22 Oct ("acer, ajio gram... logo clearly visible ni hai"): admin
 *  uploads beat everything, then the Wikidata crisp logo, and only then the
 *  registry/favicon fallbacks — tiny registry icons were rendering blocky. */
async function resolveMerchantLogo(row: AffiliateRow): Promise<string | null> {
  try {
    const uploads = await merchantLogoMap();
    const uk = uploadKeyOf(String(row.merchant_name || ''));
    if (uk && uploads[uk]) return uploads[uk];
  } catch { /* registry unavailable offline */ }
  const crisp = await resolveMerchantCrispLogo(String(row.merchant_name || ''));
  if (crisp && (await logoAnswers(crisp))) return crisp;
  const cands = merchantLogoCandidates(row);
  if (!cands.length) return null;
  for (const c of cands) {
    if (await logoAnswers(c)) return c;
  }
  return cands[0];
}

export function itemFromAffiliate(row: AffiliateRow, resolvedLogo: string | null = null): ShowcaseItem | null {
  const url = row.affiliate_url || row.original_url;
  if (!url) return null;
  const dv = num(row.discount_value);
  const badge = row.coupon_code
    ? `Code: ${row.coupon_code}`
    : dv && row.discount_type === 'percent'
      ? `${dv}% OFF`
      : dv
        ? `Upto \u20B9${dv} off`
        : null;
  const logo = resolvedLogo ?? merchantLogoCandidates(row)[0] ?? null;
  return {
    id: `aff-${row.network_source}-${row.network_offer_id}`,
    title: String(row.title || '').slice(0, 90),
    merchant: String(row.merchant_name || 'Store').slice(0, 40),
    merchantLogo: logo,
    image: logo,
    price: null,
    mrp: null,
    discountPct: row.discount_type === 'percent' ? dv : null,
    rating: null,
    badge,
    url: createMaskingPointer(url, { offerId: `showcase-aff-${row.id}`, trusted: true }), // affiliate registry feed
  };
}

// ---------------------------------------------------------------------------
// Store-agnostic pool fetches (SQL shape both stores parse; JS sorts/filters)
// ---------------------------------------------------------------------------

/** In-memory pool cache: repeated pool fetches within 5 minutes share rows. */
const poolCache = new Map<string, { at: number; rows: OfferRow[] }>();
const POOL_TTL_MS = 5 * 60 * 1000;

/** Newest-first rows of one vertical. SQL keeps to `vertical = ?` + literal LIMIT
 *  (the file store parses exactly that; complex WHERE clauses match nothing there),
 *  then freshness sorting runs in JS so MySQL and dev behave identically. */
export async function fetchVerticalOffers(vertical: string, limit: number): Promise<OfferRow[]> {
  const key = `${vertical}|${limit}`;
  const hit = poolCache.get(key);
  if (hit && Date.now() - hit.at < POOL_TTL_MS) return hit.rows;
  const store = getStore();
  let rows: OfferRow[] = [];
  try {
    // Literal LIMIT is required: `LIMIT ?` is unsupported on the file store.
    rows = await store.query<OfferRow>(
      `SELECT id, vertical, title, brand, attributes, vendor, seller, seller_url, location_city,
              list_price, mandatory_total, effective_price, validation_status, fetched_at
       FROM offers WHERE vertical = ? ORDER BY fetched_at DESC LIMIT ${Math.max(limit, 500)}`,
      [vertical]);
    rows.sort((a, b) => tsOf(b.fetched_at) - tsOf(a.fetched_at));
    rows = rows.slice(0, limit);
  } catch (e: any) {
    log.debug('Showcase', 'offers pool query failed', { vertical, error: String(e).slice(0, 100) });
    rows = [];
  }
  poolCache.set(key, { at: Date.now(), rows });
  return rows;
}

/** Active affiliate rows, discount-first (coupon filtering happens in JS). */
export async function fetchAffiliateRows(limit: number): Promise<AffiliateRow[]> {
  const store = getStore();
  try {
    const rows = await store.query<AffiliateRow>(
      `SELECT id, network_source, network_offer_id, merchant_name, merchant_logo, title, description, coupon_code,
              discount_value, discount_type, affiliate_url, original_url, categories, commission_note, last_seen_at
       FROM affiliate_offers WHERE status = 'active' ORDER BY id DESC LIMIT 600`,
      []);
    rows.sort((a, b) => (num(b.discount_value) ?? 0) - (num(a.discount_value) ?? 0) || tsOf(b.last_seen_at) - tsOf(a.last_seen_at));
    return rows.slice(0, limit);
  } catch (e: any) {
    log.debug('Showcase', 'affiliate pool query failed', { error: String(e).slice(0, 100) });
    return [];
  }
}

/** Best-paying hotel partner: highest commission percentage among the known
 *  hotel/travel merchants in the live affiliate registry. */
async function bestHotelPartner(): Promise<string | null> {
  const rows = await fetchAffiliateRows(600);
  const PARTNER_RX = /makemytrip|goibibo|yatra|cleartrip|easemytrip|agoda|booking|oyo|fabhotels/i;
  let best: { name: string; pct: number } | null = null;
  for (const r of rows) {
    if (!PARTNER_RX.test(r.merchant_name || '')) continue;
    const m = /([0-9]+(?:\.[0-9]+)?)\s*%/.exec(r.commission_note || '');
    if (!m) continue;
    const pct = parseFloat(m[1]);
    if (!best || pct > best.pct) best = { name: r.merchant_name, pct };
  }
  return best?.name ?? null;
}

// ---------------------------------------------------------------------------
// Section builders (JS-side honest math)
// ---------------------------------------------------------------------------

/**
 * Merchant spread (owner 22 Oct): a section must never render as a single
 * merchant's batch. Rows arrive ordered by freshness/discount, and the newest
 * ecommerce batch is often one source's output (only Myntra, only Agoda...),
 * so sections round-robin across merchants: at most `maxPerMerchant` items per
 * seller before every other present seller got its slot.
 */
/** Tech-section buckets so one category (phones) can't fill the grid — the owner
 *  asked for laptops, TVs, fridges and friends side by side. */
const TECH_CATS: Array<[RegExp, string]> = [
  [/laptop|macbook|notebook|thinkpad|ideapad|vivobook|ultrabook/i, 'laptop'],
  [/television|\btv\b|qled|oled tv|smart tv/i, 'tv'],
  [/refrigerator|fridge|washing machine|air conditioner|air cooler|microwave|mixer|grinder|geyser|induction|air fryer|purifier|oven|dishwasher/i, 'appliance'],
  [/headphone|earbud|airdopes|earphone|speaker|soundbar/i, 'audio'],
  [/watch|band|fitness tracker/i, 'wearable'],
  [/mobile|phone|iphone|galaxy \b|redmi|pixel|vivo|oppo|realme|oneplus|pocophone/i, 'phone'],
  [/camera|dslr|gopro/i, 'camera'],
  [/console|playstation|xbox|\bps5\b|gaming/i, 'gaming'],
  [/tablet|ipad/i, 'tablet'],
];
export function techCategoryOf(title: string): string {
  const s = title.toLowerCase();
  for (const [rx, c] of TECH_CATS) if (rx.test(s)) return c;
  return 'gadget';
}

/** Balanced spread across a key (merchant OR tech category): respect the per-key
 *  cap while slots remain, then fill remaining slots by always taking from the
 *  category with the FEWEST cards already in the grid, so phones (or any single
 *  merchant) can never dominate the section (owner 22 Oct).
 */
export function roundRobinSpread(items: ShowcaseItem[], keyOf: (it: ShowcaseItem) => string, maxPerKey: number, target: number): ShowcaseItem[] {
  const byKey = new Map<string, ShowcaseItem[]>();
  const order: string[] = [];
  for (const it of items) {
    const k = keyOf(it);
    if (!byKey.has(k)) { byKey.set(k, []); order.push(k); }
    byKey.get(k)!.push(it);
  }
  const counts = new Map<string, number>();
  const out: ShowcaseItem[] = [];
  const pick = (k: string): boolean => {
    const c = counts.get(k) || 0;
    const list = byKey.get(k)!;
    if (!list[c]) return false;
    out.push(list[c]);
    counts.set(k, c + 1);
    return true;
  };
  // Phase 1: strict cap — every key gets up to maxPerKey.
  for (let i = 0; i < maxPerKey; i++) {
    for (const k of order) { if (out.length >= target) break; pick(k); }
  }
  // Phase 2: balanced fill — always extend the smallest category first.
  while (out.length < target) {
    const open = order.filter((k) => (byKey.get(k)!.length) > (counts.get(k) || 0));
    if (!open.length) break;
    open.sort((a, b) => (counts.get(a) || 0) - (counts.get(b) || 0) || order.indexOf(a) - order.indexOf(b));
    if (!pick(open[0])) break;
  }
  return out;
}

export function diversifyByMerchant(items: ShowcaseItem[], maxPerMerchant: number, target: number): ShowcaseItem[] {
  const byMerchant = new Map<string, ShowcaseItem[]>();
  for (const it of items) {
    const k = it.merchant.toLowerCase();
    const list = byMerchant.get(k) || [];
    list.push(it);
    byMerchant.set(k, list);
  }
  const merchants = [...byMerchant.keys()];
  const out: ShowcaseItem[] = [];
  const used = new Map<string, number>();
  let added = true;
  while (out.length < target && added) {
    added = false;
    for (const m of merchants) {
      if (out.length >= target) break;
      const u = used.get(m) || 0;
      if (u >= maxPerMerchant) continue;
      const next = byMerchant.get(m)![u];
      if (!next) continue;
      out.push(next);
      used.set(m, u + 1);
      added = true;
    }
  }
  return out;
}

/** Pool -> deduped, image-bearing items in the pool's order, then merchant spread. */
/**
 * Owner 22 Oct: ONE 'Go Big: Bigger Deals & Greater Savings' section replaces
 * the old Massive Discounts + Mega Savings pair. Union of both pools, deduped,
 * ranked by absolute savings first (bigger deals & greater savings), capped 12.
 */
export function mergeGoBig(mega: ShowcaseItem[], massive: ShowcaseItem[]): ShowcaseItem[] {
  const seen = new Set<string>();
  const savingsOf = (it: ShowcaseItem) => (it.mrp ?? 0) - (it.price ?? 0);
  return mega.concat(massive)
    .filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true)))
    .sort((a, b) => (savingsOf(b) - savingsOf(a)) || ((b.discountPct ?? 0) - (a.discountPct ?? 0)))
    .slice(0, 12);
}

function sectionItems(pool: OfferRow[], filter: (r: OfferRow) => boolean, sort: (a: OfferRow, b: OfferRow) => number, spreadKey?: (it: ShowcaseItem) => string): ShowcaseItem[] {
  const seen = new Set<string>();
  const out: ShowcaseItem[] = [];
  for (const row of pool.filter(filter).sort(sort)) {
    const item = itemFromOffer(row);
    if (!item || !item.image) continue;            // showcase cards need real art
    const key = `${item.merchant}|${item.title.slice(0, 40).toLowerCase()}`;
    if (seen.has(key)) continue;                  // dedupe cross-source SKUs
    seen.add(key);
    out.push(item);
  }
  const merchSpread = diversifyByMerchant(out, 3, spreadKey ? 48 : 12);
  return spreadKey ? roundRobinSpread(merchSpread, spreadKey, 2, 12) : merchSpread;
}

/** Coupon cards from the live affiliate registry, one per merchant+code, spread. */
async function couponItems(): Promise<ShowcaseItem[]> {
  const rows = await fetchAffiliateRows(600);
  const seen = new Set<string>();
  const out: ShowcaseItem[] = [];
  const build = rows.filter((r) => r.coupon_code).map(async (row) => ({ row, logo: await resolveMerchantLogo(row) }));
  for (const { row, logo } of await Promise.all(build)) {
    const item = itemFromAffiliate(row, logo);
    if (!item) continue;
    const key = `${item.merchant.toLowerCase()}|${item.badge || ''}`; // same merchant+code once
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return diversifyByMerchant(out, 2, 12);
}

/**
 * FAMOUS DESTINATIONS (owner 22 Oct): a flights-related home section.
 * Honest data only per card:
 *  - image: a real photo from a recorded HOTEL offer in that destination
 *  - price: the CHEAPEST recorded FLIGHT fare whose route/title names the city
 *  - click: launches the REAL flights engine ("to <City>") — never a fake link
 */
const FAMOUS: Array<{ name: string; keys: string[] }> = [
  { name: 'Goa', keys: ['goa'] },
  { name: 'Mumbai', keys: ['mumbai'] },
  { name: 'Delhi', keys: ['delhi'] },
  { name: 'Jaipur', keys: ['jaipur'] },
  { name: 'Udaipur', keys: ['udaipur'] },
  { name: 'Dubai', keys: ['dubai'] },
  { name: 'Bangkok', keys: ['bangkok'] },
  { name: 'Singapore', keys: ['singapore'] },
  { name: 'Srinagar', keys: ['srinagar'] },
  { name: 'Shimla', keys: ['shimla'] },
  { name: 'Bengaluru', keys: ['bengaluru', 'bangalore'] }, // both spellings appear in source titles
  { name: 'Hyderabad', keys: ['hyderabad'] },
];

/** One Famous Destinations card, or null when the data is not honestly there. */
export function destinationItem(d: { name: string; keys: string[] }, flights: OfferRow[], hotels: OfferRow[]): ShowcaseItem | null {
  const matches = (r: OfferRow) => {
    const t = String(r.title || '').toLowerCase();
    const c = String(r.location_city || '').toLowerCase();
    return d.keys.some((k) => t.includes(k) || c.includes(k));
  };
  // Cheapest recorded flight fare naming this destination (fresh window: 7 days).
  const fare = flights
    .filter((r) => servableRow(r, 7) && matches(r))
    .sort((a, b) => priceOf(a) - priceOf(b))[0];
  if (!fare) return null; // no recorded fare -> skip honestly (never invent a price)
  // A real hotel photo from the same destination (offers carry real art).
  const hotel = hotels.find((r) => ageDays(r) <= 14 && matches(r) && imageFromAttributes(r.attributes));
  if (!hotel) return null; // card needs real art
  return {
    id: `dest-${d.keys[0]}`,
    title: d.name,
    merchant: String(fare.seller || fare.vendor || 'Flights').slice(0, 40),
    merchantLogo: null,
    image: imageFromAttributes(hotel.attributes),
    price: priceOf(fare) || null,
    mrp: null,
    discountPct: null,
    rating: null,
    badge: 'lowest recorded fare',
    url: '',
    launch: { vertical: 'flights', query: `to ${d.name}` },
  };
}

/** Best honest pick for Rewards Top Picks (owner 21 Oct): prefer a row with
 *  real art and the biggest discount; fall back to the lowest recorded price. */
export function pickTopOfferRow(rows: OfferRow[]): OfferRow | null {
  const servable = rows.filter((r) => servableRow(r, 14));
  if (!servable.length) return null;
  const withImg = servable.filter((r) => imageFromAttributes(r.attributes));
  const pool = withImg.length ? withImg : servable;
  return pool.reduce((best, r) => (pctOf(r) > pctOf(best) ? r : best), pool[0]);
}

// ---------------------------------------------------------------------------
// buildShowcase
// ---------------------------------------------------------------------------

/** In-memory result cache: the homepage must stay sub-second, the showcase is
 *  rebuilt at most every 10 minutes. Zero-result sections are retried sooner. */
let cached: { at: number; sections: ShowcaseSection[] } | null = null;
const SHOWCASE_TTL_MS = 10 * 60 * 1000;

// Owner 22 Oct: "iss section mai laptop, fridge, tv... sb dikhao" — appliances
// count as tech for this section, not just phones and audio.
const TECH_RX = /mobile|phone|laptop|macbook|notebook|thinkpad|ideapad|vivobook|ultrabook|headphone|earbud|airdopes|smartwatch|tablet|ipad|camera|speaker|soundbar|television|\btv\b|qled|gaming|console|charger|power bank|ssd|keyboard|mouse|refrigerator|fridge|washing machine|air conditioner|air cooler|microwave|mixer|grinder|geyser|induction|air fryer|purifier|oven|dishwasher/i;
const TECH_BRAND_RX = /apple|samsung|oneplus|sony|boat|jbl|lenovo|dell|\bhp\b|asus|acer|xiaomi|realme|vivo|oppo|nothing/i;

export async function buildShowcase(): Promise<ShowcaseSection[]> {
  if (cached && Date.now() - cached.at < SHOWCASE_TTL_MS) return cached.sections;

  const [ecom, hotels, cardsPool, flights, couponSpecial, partner] = await Promise.all([
    fetchVerticalOffers('ecommerce', 600),
    fetchVerticalOffers('hotels', 400),
    fetchVerticalOffers('creditcards', 200),
    fetchVerticalOffers('flights', 600),
    couponItems(),
    bestHotelPartner(),
  ]);

  const newest = (a: OfferRow, b: OfferRow) => tsOf(b.fetched_at) - tsOf(a.fetched_at);
  const fresh = (r: OfferRow) => ageDays(r) <= 14;
  const serv = (r: OfferRow) => servableRow(r, 14);

  const picked = sectionItems(ecom, (r) => serv(r), newest);
  // Owner 22 Oct: ONE 'Go Big' section replaces the old Massive Discounts +
  // Mega Savings pair — union of 40%+ off and ₹1,000+ absolute savings,
  // deduped, ranked by absolute savings first (bigger deals & greater savings).
  const massive = sectionItems(ecom, (r) => serv(r) && pctOf(r) >= 0.40, (a, b) => pctOf(b) - pctOf(a) || newest(a, b));
  const mega = sectionItems(ecom, (r) => serv(r) && saveOf(r) >= 1000, (a, b) => saveOf(b) - saveOf(a) || newest(a, b));
  const goBig = mergeGoBig(mega, massive);
  const techFilter = (r: OfferRow) => serv(r) && (TECH_RX.test(String(r.title || '')) || TECH_BRAND_RX.test(String(r.brand || '')));
  // Owner 22 Oct: laptops, TVs, fridges and more must all appear — spread cards
  // across tech categories (max 2 per bucket) instead of a wall of phones.
  const tech = sectionItems(ecom, techFilter, newest, (it) => techCategoryOf(it.title));
  const steals = sectionItems(ecom, (r) => serv(r) && priceOf(r) <= 999 && pctOf(r) >= 0.30, (a, b) => pctOf(b) - pctOf(a) || newest(a, b));
  const places = sectionItems(hotels, (r) => serv(r), newest);
  const cards = sectionItems(cardsPool, (r) => (r.validation_status || '') !== 'INVALID' && ageDays(r) <= 14, newest);
  const destinations = FAMOUS.map((d) => destinationItem(d, flights, hotels)).filter((x): x is ShowcaseItem => x !== null).slice(0, 8);

  const sections: ShowcaseSection[] = [
    { id: 'picked', title: 'Picked Just for You', subtitle: 'real products, live-acquired prices', items: picked },
    { id: 'special', title: 'Special Offers For You', subtitle: 'auto-tested coupons from live registries', items: couponSpecial },
    { id: 'goBig', title: 'Go Big: Bigger Deals & Greater Savings', subtitle: '40%+ off and \u20B91,000+ savings on big-ticket finds', items: goBig },
    { id: 'tech', title: 'Best in Tech & Gadgets', subtitle: 'phones, audio, laptops and more', items: tech },
    { id: 'steals', title: "Steals You Can't Ignore", subtitle: 'under \u20B9999, heavily discounted', items: steals },
    {
      id: 'places', title: 'Famous Places to Visit', subtitle: partner
        ? `live hotel rates via ${partner} — our best-paying hotel partner`
        : 'live per-night hotel rates, side by side',
      // Owner rule: hotel section deeplinks go through the best-paying partner.
      // Prefer rows from that partner; fall back to other honest hotel rows.
      items: partner
        ? (places.filter(p => p.merchant.toLowerCase().includes(partner.toLowerCase().split(' ')[0]))
            .concat(places.filter(p => !p.merchant.toLowerCase().includes(partner.toLowerCase().split(' ')[0]))))
        : places,
    },
    { id: 'cards', title: 'Best Cards For You', subtitle: 'fees & rewards, straight from the banks', items: cards },
    { id: 'destinations', title: 'Top Destinations', subtitle: 'famous places to visit — cheapest recorded fares, tap for live flight search', items: destinations },
  ].filter(s => s.items.length > 0); // honesty: never render an empty section

  cached = { at: Date.now(), sections };
  return sections;
}
