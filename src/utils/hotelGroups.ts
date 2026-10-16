import type { ComparisonItem } from '../types';
import { normalizeHotelName, sameHotel, type HotelComparable } from './hotelNormalize';

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

export function hotelKey(name: string, city = ''): string {
  return normalizeHotelName(name, city);
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

/**
 * Default ('best') hotel feed order — owner rule (16 Oct 2026): cards comparing
 * 2+ companies come FIRST (cheapest among them first), single-site hotels follow
 * (again cheapest first). Pure price order only when the user explicitly picks
 * the Cheapest filter (then a cheap single-property hotel may top the feed).
 */
export function compareHotelGroupsDefault(a: HotelGroup, b: HotelGroup): number {
  const multi = (g: HotelGroup) => (g.rows.length >= 2 ? 0 : 1);
  return multi(a) - multi(b)
    || (a.best.price || Infinity) - (b.best.price || Infinity)
    || (b.rating10 || 0) - (a.rating10 || 0);
}

export function groupHotels(items: ComparisonItem[]): HotelGroup[] {
  const groups = new Map<string, HotelGroup>();
  for (const it of items) {
    if (!it.priceAvailable && !it.primaryPrice) continue;
    const city = spec(it, 'city') || '';
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

  // Second pass: merge groups using similar-product / sameHotel matching
  const merged: HotelGroup[] = [];
  for (const g of groups.values()) {
    const host = merged.find((m) => {
      // Create Comparable representation
      const compM: HotelComparable = {
        name: m.name,
        city: m.city,
        lat: Number(spec(m.best.item, 'lat', 'latitude')),
        lng: Number(spec(m.best.item, 'lng', 'longitude')),
        site: m.best.site,
        specs: m.best.item.specs,
      };
      const compG: HotelComparable = {
        name: g.name,
        city: g.city,
        lat: Number(spec(g.best.item, 'lat', 'latitude')),
        lng: Number(spec(g.best.item, 'lng', 'longitude')),
        site: g.best.site,
        specs: g.best.item.specs,
      };

      // Check if any sites in g overlap with sites in m
      const sitesM = new Set(m.rows.map((r) => r.site));
      if (g.rows.some((r) => sitesM.has(r.site))) {
        return false;
      }

      return sameHotel(compM, compG);
    });

    if (!host) {
      merged.push(g);
      continue;
    }

    host.rows.push(...g.rows);
    if (!host.image && g.image) host.image = g.image;
    if (!host.stars && g.stars) host.stars = g.stars;
    if (!host.rating10 && g.rating10) {
      host.rating10 = g.rating10;
      host.ratingCount = g.ratingCount;
      host.ratingLabel = g.ratingLabel;
    }
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
