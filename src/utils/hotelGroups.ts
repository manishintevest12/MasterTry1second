import type { ComparisonItem } from '../types';

/**
 * Groups hotel offers that are the SAME property across sources (name + city match) so one card can
 * list every site's price (Trivago-style). Only a confident name match merges; otherwise the offer
 * stands alone as a one-row card. Nothing is invented: each row is a real offer from its source.
 */
export interface HotelOfferRow {
  item: ComparisonItem;
  site: string;          // who published this price (Cleartrip, Airbnb, Ixigo, ...)
  price: number;
  freeCancellation?: boolean;
  breakfast?: boolean;
  dealUrlItem: ComparisonItem;
}

export interface HotelGroup {
  key: string;
  name: string;
  image?: string;
  gallery: string[];
  locality?: string;
  city?: string;
  stars?: number;
  rating10?: number;      // normalised to a /10 scale
  ratingCount?: number;
  ratingLabel?: string;
  amenities: string[];
  propertyType?: string;
  rows: HotelOfferRow[];  // cheapest first
  best: HotelOfferRow;
}

const STOP = /\b(hotel|hotels|the|by|a|an|and|resort|resorts|inn|stay|stays|rooms?|boutique|suites?|residency|palace|near|in|at|of|best|luxury|premium|collection|o|oyo|international)\b/g;
export function hotelKey(name: string, city = ''): string {
  const c = city.toLowerCase();
  let t = name.toLowerCase().replace(/&/g, ' ');
  t = t.replace(/[^a-z0-9 ]/g, ' ');
  if (c) t = t.replace(new RegExp(`\\b${c}\\b`, 'g'), ' ');
  t = t.replace(STOP, ' ');
  return [...new Set(t.split(/\s+/).filter(Boolean))].sort().join(' ');
}

const spec = (it: ComparisonItem, ...ks: string[]) => {
  for (const k of ks) { const v = it.specs?.[k]; if (v && v !== 'undefined' && String(v).trim()) return String(v); }
  return undefined;
};
const truthy = (v?: string) => !!v && /^(true|yes|1)$/i.test(v);

/** Metasearch sources are never shown as the seller: their prices are booked on the hotel's own channels. */
export const METASEARCH_SOURCES = new Set(['w_hotels_ixigo']);
export function siteOf(it: ComparisonItem): string {
  const sid = (it as any).evidence?.sourceId as string | undefined;
  if (sid && METASEARCH_SOURCES.has(sid)) return 'Hotel website';
  const map: Record<string, string> = { w_hotels_cleartrip: 'Cleartrip', w_hotels_airbnb: 'Airbnb', w_hotels_booking: 'Booking.com', w_hotels_mmt: 'MakeMyTrip', w_hotels_goibibo: 'Goibibo' };
  if (sid && map[sid]) return map[sid];
  const q = it.sellerQuotes?.[0];
  return q?.sellerName || it.provider || 'Seller';
}

export function groupHotels(items: ComparisonItem[]): HotelGroup[] {
  const groups = new Map<string, HotelGroup>();
  for (const it of items) {
    if (!it.priceAvailable && !it.primaryPrice) continue;
    const city = spec(it, 'city') || '';
    // Ixigo's title/provider is the property name; Cleartrip/Airbnb's title is the property name too
    const name = it.title;
    const key = `${hotelKey(name, city)}|${city.toLowerCase()}`;
    const stars = Number(spec(it, 'star rating', 'stars')) || undefined;
    const rawRating = Number(spec(it, 'user rating', 'rating') ?? it.rating) || 0;
    const rating10 = rawRating > 0 ? (rawRating <= 5 ? Math.round(rawRating * 20) / 10 : rawRating) : undefined;
    const img = it.imageUrl || spec(it, 'image', 'image url');
    const amen = (spec(it, 'top offerings') || '').split(',').map((s) => s.trim()).filter((s) => s && !/payment|pay at|₹0|offer|discount|coupon/i.test(s));
    const row: HotelOfferRow = {
      item: it, site: siteOf(it), price: it.primaryPrice,
      freeCancellation: truthy(spec(it, 'free cancellation')) || /free cancel/i.test(spec(it, 'top offerings') || ''),
      breakfast: truthy(spec(it, 'free breakfast')) || /breakfast/i.test(spec(it, 'top offerings') || ''),
      dealUrlItem: it,
    };
    let g = groups.get(key);
    if (!g) {
      g = { key, name, image: img, gallery: [], locality: spec(it, 'locality'), city, stars, rating10,
        ratingCount: Number(spec(it, 'user rating count', 'review count')) || it.reviewCount || undefined,
        ratingLabel: spec(it, 'user rating category'), amenities: [], propertyType: spec(it, 'room type'), rows: [row], best: row };
      groups.set(key, g);
    } else {
      g.rows.push(row);
      if (!g.image && img) g.image = img;
      if (!g.stars && stars) g.stars = stars;
      if (!g.rating10 && rating10) { g.rating10 = rating10; g.ratingCount = Number(spec(it, 'user rating count', 'review count')) || g.ratingCount; g.ratingLabel = spec(it, 'user rating category') || g.ratingLabel; }
      if (!g.locality) g.locality = spec(it, 'locality');
    }
    if (img && !g.gallery.includes(img)) g.gallery.push(img);
    for (const extra of it.images || []) if (extra && !g.gallery.includes(extra)) g.gallery.push(extra);
    for (const a of amen) if (!g.amenities.includes(a)) g.amenities.push(a);
  }
  // Second pass: merge groups whose distinctive tokens are a subset of the other's (same city only).
  // "lalit" ⊂ "lalit grand"; needs >=1 token of 4+ chars so generic words never glue hotels together.
  const merged: HotelGroup[] = [];
  const tokensOf = (g: HotelGroup) => new Set(g.key.split('|')[0].split(' ').filter(Boolean));
  for (const g of [...groups.values()]) {
    const tg = tokensOf(g);
    const host = merged.find((m) => {
      if ((m.city || '').toLowerCase() !== (g.city || '').toLowerCase()) return false;
      const tm = tokensOf(m);
      if (!tm.size || !tg.size) return false;
      const [small, big] = tm.size <= tg.size ? [tm, tg] : [tg, tm];
      if (![...small].every((t) => big.has(t))) return false;
      if (![...small].some((t) => t.length >= 4)) return false;
      // A bare single-token brand ("trident") must not absorb a specific branch ("trident nariman point"):
      // the extra tokens of the bigger side must not name a different locality, so require the larger side to add <=1 token.
      if (big.size - small.size > 1) return false;
      // Different sites only: two rows from the SAME site are different listings, never merged.
      const sitesM = new Set(m.rows.map((r) => r.site));
      return g.rows.every((r) => !sitesM.has(r.site));
    });
    if (!host) { merged.push(g); continue; }
    host.rows.push(...g.rows);
    if (!host.image && g.image) host.image = g.image;
    if (!host.stars && g.stars) host.stars = g.stars;
    if (!host.rating10 && g.rating10) { host.rating10 = g.rating10; host.ratingCount = g.ratingCount; host.ratingLabel = g.ratingLabel; }
    if (!host.locality) host.locality = g.locality;
    for (const im of g.gallery) if (!host.gallery.includes(im)) host.gallery.push(im);
    for (const a of g.amenities) if (!host.amenities.includes(a)) host.amenities.push(a);
  }
  const out = merged;
  for (const g of out) {
    g.rows.sort((a, b) => a.price - b.price);
    g.best = g.rows[0];
    if (g.rows.some((r) => r.freeCancellation) && !g.amenities.some((a) => /free cancel/i.test(a))) g.amenities.unshift('Free cancellation');
  }
  return out;
}

/** "28% less than usual" style badge: only from real data (a higher listed price on the same offer). */
export function dealPercent(g: HotelGroup): number | undefined {
  const it = g.best.item;
  if (it.originalPrice && it.originalPrice > it.primaryPrice) return Math.round((1 - it.primaryPrice / it.originalPrice) * 100);
  if (g.rows.length > 1) {
    const hi = g.rows[g.rows.length - 1].price;
    if (hi > g.best.price) return Math.round((1 - g.best.price / hi) * 100);
  }
  return undefined;
}
