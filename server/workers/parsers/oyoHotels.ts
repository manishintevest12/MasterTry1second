/**
 * OYO Hotels parser — hotels vertical (live per-night rates).
 *
 * OYO publishes its city SEO listing pages (https://www.oyorooms.com/hotels-in-<city>/)
 * fully server-side with the entire listing state embedded as
 * `window.__PRELOADED_STATE__ = {...};` — 20 hotels with REAL per-night prices,
 * images, ratings, address and property URLs, no auth, no WAF (verified live
 * 17 Oct 2026: Goa 20 hotels — Super Collection O Sand Castles Miramar ₹1410
 * (+₹149 tax = ₹1559 total), Indore 20 hotels — Super Townhouse ₹824). Fully
 * browserless via curl_cffi chrome impersonation.
 *
 * Hotel object shape (listing.hotels[]):
 *   id, name, url ("/10179/" → deeplink), address, city, category,
 *   hotel_images[] (images.oyoroomscdn.com), rating { value, count },
 *   pricing { bookingPrice, slashedPrice, discountPercentage,
 *             taxInfo { total_tax, final_price_with_tax } },
 *   geo_location, isSoldOut, status, oneLinerText, amenities.
 *
 * The headline price is OYO's displayed per-night bookingPrice (tax-exclusive),
 * with the inclusive total preserved in price_basis — same convention as Agoda.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';
import { cityVariants, slugOf } from '../../common/cityAlias';

export const OYO_WEB = 'https://www.oyorooms.com';

export interface OyoHotel {
  id: string;
  name: string;
  url: string | null;
  address: string | null;
  city: string | null;
  category: string | null;
  oneLiner: string | null;
  rating: number | null;
  ratingCount: number | null;
  pricePerNight: number | null;      // bookingPrice — displayed, tax-exclusive
  tax: number | null;                // taxInfo.total_tax
  priceInclusive: number | null;     // taxInfo.final_price_with_tax
  slashedPrice: number | null;
  discountPercentage: number | null;
  imageUrl: string | null;
  images: string[];
  lat: number | null;
  lon: number | null;
  soldOut: boolean;
}

/** Slug candidates for /hotels-in-<city>/, best first. */
export function oyoCityPaths(city: string): string[] {
  const out: string[] = [];
  for (const v of cityVariants(city)) {
    const p = `hotels-in-${slugOf(v)}`;
    if (!out.includes(p)) out.push(p);
  }
  return out.slice(0, 6);
}

/**
 * Extract + JSON-parse `window.__PRELOADED_STATE__` from an OYO listing page.
 * The literal is a JSON blob (occasionally double-encoded) terminated by `;`.
 */
export function parseOyoPreloadedState(html: string): Record<string, any> | null {
  const start = html.indexOf('window.__PRELOADED_STATE__');
  if (start === -1) return null;
  const eq = html.indexOf('=', start);
  if (eq === -1) return null;
  let sub = html.slice(eq + 1).trim();
  if (sub.startsWith('JSON.parse("')) {
    // double-encoded variant: JSON.parse("…escaped json…")
    const q = sub.indexOf('"', 'JSON.parse('.length);
    const end = sub.indexOf('")', q);
    const inner = sub.slice(q + 1, end === -1 ? Math.min(sub.length, q + 3_000_000) : end);
    try {
      sub = JSON.parse(`"${inner}"`);
    } catch { /* fallthrough to direct parse */ }
  }
  const tail = sub.indexOf('</script>');
  if (tail !== -1) sub = sub.slice(0, tail);
  sub = sub.trim().replace(/;$/, '');
  try {
    const d = JSON.parse(sub);
    return typeof d === 'string' ? JSON.parse(d) : d;
  } catch {
    return null;
  }
}

/** listing.hotels[] → normalized OyoHotel[] (no price invention). */
export function parseOyoHotels(state: Record<string, any>): OyoHotel[] {
  const raw = state?.listing?.hotels;
  if (!Array.isArray(raw)) return [];
  const num = (x: any): number | null => {
    if (x == null || x === '') return null;
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  };
  const out: OyoHotel[] = [];
  for (const h of raw) {
    if (!h || typeof h !== 'object') continue;
    const pricing = h.pricing || {};
    const tax = pricing.taxInfo || {};
    const rating = h.rating || {};
    const geo = h.geo_location || {};
    const images = (Array.isArray(h.hotel_images) ? h.hotel_images : [])
      .filter((u: any) => typeof u === 'string' && u.startsWith('http'));
    out.push({
      id: String(h.id ?? ''),
      name: String(h.name ?? '').trim(),
      url: typeof h.url === 'string' && h.url.startsWith('/') ? h.url : null,
      address: typeof h.address === 'string' ? h.address : null,
      city: typeof h.city === 'string' ? h.city : null,
      category: typeof h.category === 'string' ? h.category : null,
      oneLiner: typeof h.oneLinerText === 'string' ? h.oneLinerText : null,
      rating: num(rating.value),
      ratingCount: num(rating.count),
      pricePerNight: num(pricing.bookingPrice),
      tax: num(tax.total_tax),
      priceInclusive: num(tax.final_price_with_tax),
      slashedPrice: num(pricing.slashedPrice),
      discountPercentage: num(pricing.discountPercentage),
      imageUrl: images[0] || null,
      images: images.slice(0, 6),
      lat: num(geo.lat ?? geo.latitude),
      lon: num(geo.lng ?? geo.long ?? geo.longitude),
      soldOut: Boolean(h.isSoldOut) || h.status === 'Soldout',
    });
  }
  return out;
}

/** OyoHotel[] → offers. Sold-out and price-less hotels are never published. */
export function parseOyoOffers(
  hotels: OyoHotel[],
  source: SourceConfig,
  city: string,
  meta: { checkin: string; checkout: string; path: string },
): RawSourceItem[] {
  const out: RawSourceItem[] = [];
  const srpUrl = `${OYO_WEB}/${meta.path}/?checkin=${fmtDdMmYyyy(meta.checkin)}&checkout=${fmtDdMmYyyy(meta.checkout)}&guests=2&rooms=1`;
  for (const h of hotels) {
    if (!h.name || h.soldOut || h.pricePerNight == null || h.pricePerNight <= 0) continue;
    const deeplink = h.url ? `${OYO_WEB}${h.url}` : srpUrl; // redirect only to the price owner
    const attrs: Record<string, any> = {
      image_url: h.imageUrl,
      images: h.images.join('|'),
      rating: h.rating != null ? String(h.rating) : null, // already /5
      review_count: h.ratingCount,
      address: h.address,
      city: h.city || city,
      property_category: h.category,
      latitude: h.lat,
      longitude: h.lon,
      property_id: h.id,
      price_basis: h.priceInclusive != null
        ? `per night on OYO (₹${Math.round(h.pricePerNight)} + ₹${Math.round(h.tax ?? 0)} tax; total ₹${Math.round(h.priceInclusive)})`
        : 'per night on OYO (tax-exclusive booking price)',
      data_note: 'Live per-night rates observed on OYO city listing',
    };
    if (h.discountPercentage) attrs.discount = `${Math.round(h.discountPercentage)}% off`;
    if (h.oneLiner) attrs.tagline = h.oneLiner;
    out.push(newRawItem(source, {
      title: h.name,
      seller: 'OYO',
      sellerUrl: deeplink,
      currency: 'INR',
      price: Math.round(h.pricePerNight),
      listPrice: h.slashedPrice && h.slashedPrice > h.pricePerNight ? Math.round(h.slashedPrice) : undefined,
      attributes: attrs,
      travel: { date: meta.checkin, route: `${city} stay`, roomType: h.category || undefined },
      evidence: {
        sourceUrl: srpUrl,
        sourceReference: h.id,
        extractedFields: ['title', 'price', 'rating', 'review_count', 'image_url', 'deeplink'],
      },
    }));
  }
  return out;
}

/** yyyy-mm-dd → dd/mm/yyyy (OYO's URL format). */
export function fmtDdMmYyyy(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}
