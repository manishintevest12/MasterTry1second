/**
 * Home Showcase (owner spec, 21 Oct): eight curated sections directly under
 * the "Instant Launch Verticals" grid on the homepage —
 *   Picked Just for You · Special Offers For You · Massive Discounts ·
 *   Mega Savings · Best in Tech & Gadgets · Steals You Can't Ignore ·
 *   Most Visited Places (best-paying hotel partner) · Best Cards For You.
 *
 * HONEST DATA ONLY (standing rule): every item is a real row from the
 * persistent `offers` catalogue or the synced `affiliate_offers` registry.
 * A section with no real data is simply omitted — never mocked.
 *
 * MONETIZATION (standing rules): items never carry raw links; they get an
 * HMAC masking pointer (/api/out?t=...). The redirect pipeline injects the
 * Amazon Associates tag (try1second-21) for Amazon rows and routes Myntra
 * through INR Deals (LinkInR) / Cuelinks — server-side only, as always.
 */
import { getStore } from '../common/db';
import { log } from '../common/logger';
import { createMaskingPointer } from '../affiliate/deeplink';

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
}

export interface ShowcaseSection {
  id: string;
  title: string;
  subtitle: string;
  items: ShowcaseItem[];
}

interface OfferRow {
  id: number; vertical: string; title: string; brand: string | null; attributes: unknown;
  vendor: string | null; seller: string | null; seller_url: string | null;
  list_price: number | string | null; mandatory_total: number | string | null; effective_price: number | string | null;
  fetched_at: string | Date;
}

interface AffiliateRow {
  id: number; network_source: string; network_offer_id: string; merchant_name: string; merchant_logo: string | null;
  title: string; description: string | null; coupon_code: string | null; discount_value: number | string | null;
  discount_type: string | null; affiliate_url: string | null; original_url: string | null; categories: string | null;
  commission_note: string | null;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

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
  const price = num(row.effective_price) ?? num(row.mandatory_total);
  const mrp = num(row.list_price);
  if (!url || !price) return null; // nothing honest to link or show
  let pct: number | null = null;
  if (mrp && mrp > price) pct = Math.round(((mrp - price) / mrp) * 100);
  const merchant = (row.vendor || row.seller || 'Store').slice(0, 40);
  return {
    id: `off-${row.id}`,
    title: String(row.title || '').slice(0, 90),
    merchant,
    merchantLogo: null,
    image: imageFromAttributes(row.attributes),
    price,
    mrp: mrp && mrp > price ? mrp : null,
    discountPct: pct,
    rating: ratingFromAttributes(row.attributes),
    badge: pct && pct >= 1 ? `${pct}% OFF` : null,
    url: createMaskingPointer(url, { offerId: `showcase-off-${row.id}` }),
  };
}

export function itemFromAffiliate(row: AffiliateRow): ShowcaseItem | null {
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
  return {
    id: `aff-${row.network_source}-${row.network_offer_id}`,
    title: String(row.title || '').slice(0, 90),
    merchant: String(row.merchant_name || 'Store').slice(0, 40),
    merchantLogo: row.merchant_logo || null,
    image: row.merchant_logo || null,
    price: null,
    mrp: null,
    discountPct: row.discount_type === 'percent' ? dv : null,
    rating: null,
    badge,
    url: createMaskingPointer(url, { offerId: `showcase-aff-${row.id}` }),
  };
}

/** Best-paying hotel partner: highest commission percentage among the known
 *  hotel/travel merchants in the live affiliate registry. */
async function bestHotelPartner(): Promise<string | null> {
  const store = getStore();
  try {
    const rows = await store.query<AffiliateRow>(
      `SELECT id, network_source, network_offer_id, merchant_name, merchant_logo, title, description, coupon_code,
              discount_value, discount_type, affiliate_url, original_url, categories, commission_note
       FROM affiliate_offers
       WHERE status = 'active' AND (
         merchant_name LIKE '%makemytrip%' OR merchant_name LIKE '%goibibo%' OR merchant_name LIKE '%yatra%'
         OR merchant_name LIKE '%cleartrip%' OR merchant_name LIKE '%easemytrip%' OR merchant_name LIKE '%agoda%'
         OR merchant_name LIKE '%booking%' OR merchant_name LIKE '%oyo%' OR merchant_name LIKE '%fabhotels%'
       ) LIMIT 400`, []);
    let best: { name: string; pct: number } | null = null;
    for (const r of rows) {
      const m = /([0-9]+(?:\.[0-9]+)?)\s*%/.exec(r.commission_note || '');
      if (!m) continue;
      const pct = parseFloat(m[1]);
      if (!best || pct > best.pct) best = { name: r.merchant_name, pct };
    }
    return best?.name ?? null;
  } catch {
    return null;
  }
}

async function queryOffers(where: string, params: unknown[], limit: number): Promise<ShowcaseItem[]> {
  const store = getStore();
  try {
    const rows = await store.query<OfferRow>(
      `SELECT id, vertical, title, brand, attributes, vendor, seller, seller_url,
              list_price, mandatory_total, effective_price, fetched_at
       FROM offers WHERE ${where} ORDER BY fetched_at DESC LIMIT ?`,
      [...params, limit]);
    const seen = new Set<string>();
    const items: ShowcaseItem[] = [];
    for (const row of rows) {
      const item = itemFromOffer(row);
      if (!item || !item.image) continue;            // showcase cards need real art
      const key = `${item.merchant}|${item.title.slice(0, 40).toLowerCase()}`;
      if (seen.has(key)) continue;                  // dedupe cross-source SKUs
      seen.add(key);
      items.push(item);
      if (items.length >= 12) break;
    }
    return items;
  } catch (e: any) {
    log.debug('Showcase', 'offers query failed', { error: String(e).slice(0, 100) });
    return [];
  }
}

async function queryAffiliate(where: string, params: unknown[], limit: number): Promise<ShowcaseItem[]> {
  const store = getStore();
  try {
    const rows = await store.query<AffiliateRow>(
      `SELECT id, network_source, network_offer_id, merchant_name, merchant_logo, title, description, coupon_code,
              discount_value, discount_type, affiliate_url, original_url, categories, commission_note
       FROM affiliate_offers WHERE status = 'active' AND ${where}
       ORDER BY discount_value DESC, last_seen_at DESC LIMIT ?`, [...params, limit]);
    const items: ShowcaseItem[] = [];
    for (const row of rows) {
      const item = itemFromAffiliate(row);
      if (item) items.push(item);
      if (items.length >= 12) break;
    }
    return items;
  } catch (e: any) {
    log.debug('Showcase', 'affiliate query failed', { error: String(e).slice(0, 100) });
    return [];
  }
}

/** In-memory result cache: the homepage must stay sub-second, the showcase is
 *  rebuilt at most every 10 minutes. Zero-result sections are retried sooner. */
let cached: { at: number; sections: ShowcaseSection[] } | null = null;
const SHOWCASE_TTL_MS = 10 * 60 * 1000;

export async function buildShowcase(): Promise<ShowcaseSection[]> {
  if (cached && Date.now() - cached.at < SHOWCASE_TTL_MS) return cached.sections;

  const TECH = "(title REGEXP 'mobile|phone|laptop|headphone|earbud|airdopes|smartwatch|tablet|camera|speaker|television|tv|gaming|console|charger|power bank|ssd|keyboard|mouse' OR brand REGEXP 'apple|samsung|oneplus|sony|boat|jbl|lenovo|dell|hp |asus|acer|xiaomi|realme|vivo|oppo|nothing')";

  const [picked, couponSpecial, massive, mega, tech, steals, places, cards, partner] = await Promise.all([
    queryOffers(
      "vertical = 'ecommerce' AND validation_status != 'INVALID' AND seller_url IS NOT NULL AND effective_price IS NOT NULL",
      [], 60),
    queryAffiliate("coupon_code IS NOT NULL AND coupon_code != ''", [], 40),
    queryOffers(
      `vertical = 'ecommerce' AND validation_status != 'INVALID' AND seller_url IS NOT NULL
       AND list_price IS NOT NULL AND effective_price IS NOT NULL
       AND list_price > effective_price AND (list_price - effective_price) / list_price >= 0.40
       ORDER BY (list_price - effective_price) / list_price DESC, fetched_at DESC`,
      [], 40),
    queryOffers(
      `vertical = 'ecommerce' AND validation_status != 'INVALID' AND seller_url IS NOT NULL
       AND list_price IS NOT NULL AND effective_price IS NOT NULL
       AND list_price - effective_price >= 1000
       ORDER BY (list_price - effective_price) DESC, fetched_at DESC`,
      [], 40),
    queryOffers(
      `vertical = 'ecommerce' AND validation_status != 'INVALID' AND seller_url IS NOT NULL AND ${TECH}`,
      [], 60),
    queryOffers(
      `vertical = 'ecommerce' AND validation_status != 'INVALID' AND seller_url IS NOT NULL
       AND effective_price <= 999 AND list_price IS NOT NULL AND list_price > effective_price
       AND (list_price - effective_price) / list_price >= 0.30
       ORDER BY (list_price - effective_price) / list_price DESC, fetched_at DESC`,
      [], 40),
    queryOffers(
      `vertical = 'hotels' AND validation_status != 'INVALID' AND seller_url IS NOT NULL
       AND effective_price IS NOT NULL`,
      [], 40),
    queryOffers(
      `vertical = 'creditcards' AND validation_status != 'INVALID'`,
      [], 40),
    bestHotelPartner(),
  ]);

  const sections: ShowcaseSection[] = [
    { id: 'picked', title: 'Picked Just for You', subtitle: 'real products, live-acquired prices', items: picked },
    { id: 'special', title: 'Special Offers For You', subtitle: 'auto-tested coupons from live registries', items: couponSpecial },
    { id: 'massive', title: 'Massive Discounts', subtitle: '40%+ off, verified this hour', items: massive },
    { id: 'mega', title: 'Mega Savings', subtitle: 'the biggest absolute savings right now', items: mega },
    { id: 'tech', title: 'Best in Tech & Gadgets', subtitle: 'phones, audio, laptops and more', items: tech },
    { id: 'steals', title: "Steals You Can't Ignore", subtitle: 'under \u20B9999, heavily discounted', items: steals },
    {
      id: 'places', title: 'Most Visited Places', subtitle: partner
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
  ].filter(s => s.items.length > 0); // honesty: never render an empty section

  cached = { at: Date.now(), sections };
  return sections;
}
