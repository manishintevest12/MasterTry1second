/**
 * SaffronStays parser — hotels vertical (live villa per-night rates).
 *
 * SaffronStays lists boutique villas/estates. The search flow was captured via
 * Playwright + CDP request interception (stealth-capture policy) and replays
 * fully browserless with curl_cffi — NO auth token needed.
 *
 * Recipe (verified live 17 Oct 2026: Goa 9 villas/page of 62 total, Karjat,
 * Alibaug, Udaipur all return results):
 *   POST https://ecapi4.saffronstays.com/api/search-advance
 *   body: { location: "<City>", page: 1, no_of_guest: 2, no_of_room: 1,
 *           suitables: [], amenities: [], sort_by: "", signature: "",
 *           min_price: 0, max_price: 2500000, pocket: false, same_day: false,
 *           non_shared: false, new_home: false, top_rated: false,
 *           lat: null, long: null, mint_fresh: false, is_agent: "", distance: 125 }
 *   headers: Content-Type application/json, Origin/Referer saffronstays.com
 *   response: { data: [...], total } — data[] carries title, price_per_night,
 *     per_night_price_after_discount, total_amount_with_tax, base_price_with_tax,
 *     rating, total_reviews, location, latitude/longitude, images (image ids),
 *     seo_url, capacity/max_capacity, bedrooms, is_available, signature.
 *
 * Images live on ImageKit: https://ik.imagekit.io/5tgxhsqev/saffronstays-media/<id>?tr=w-640,q-75
 * Property deeplink: https://www.saffronstays.com/villas/<seo_url> (verified 200).
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export const SAFFRON_API = 'https://ecapi4.saffronstays.com/api/search-advance';
export const SAFFRON_IMG_BASE = 'https://ik.imagekit.io/5tgxhsqev/saffronstays-media';
export const SAFFRON_WEB = 'https://www.saffronstays.com';

export function saffronSearchBody(location: string): Record<string, any> {
  return {
    location, page: 1, no_of_guest: 2, no_of_room: 1,
    suitables: [], amenities: [], sort_by: '', signature: '',
    min_price: 0, max_price: 2500000, pocket: false, same_day: false,
    non_shared: false, new_home: false, top_rated: false,
    lat: null, long: null, mint_fresh: false, is_agent: '', distance: 125,
  };
}

export function saffronImageUrl(imageId: string): string {
  return `${SAFFRON_IMG_BASE}/${imageId}?tr=w-640,q-75`;
}

export interface SaffronVilla {
  id: string;
  title: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  pricePerNight: number | null;
  perNightAfterDiscount: number | null;
  totalWithTax: number | null;
  baseWithTax: number | null;
  rating: number | null;
  reviews: number | null;
  capacity: number | null;
  bedrooms: number | null;
  signature: string | null;
  available: boolean;
  imageIds: string[];
  seoUrl: string | null;
}

const num = (x: any): number | null => {
  if (x == null || x === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};

/** response.data[] → normalized villas. */
export function parseSaffronVillas(data: any[]): SaffronVilla[] {
  const out: SaffronVilla[] = [];
  for (const v of data) {
    if (!v || typeof v !== 'object' || typeof v.title !== 'string') continue;
    out.push({
      id: String(v.id ?? ''),
      title: v.title.trim(),
      location: typeof v.location === 'string' ? v.location : null,
      latitude: num(v.latitude),
      longitude: num(v.longitude),
      pricePerNight: num(v.price_per_night),
      perNightAfterDiscount: num(v.per_night_price_after_discount),
      totalWithTax: num(v.total_amount_with_tax),
      baseWithTax: num(v.base_price_with_tax),
      rating: num(v.rating),
      reviews: num(v.total_reviews),
      capacity: num(v.max_capacity ?? v.capacity),
      bedrooms: num(v.bedrooms),
      signature: typeof v.signature === 'string' ? v.signature : null,
      available: v.is_available !== false,
      imageIds: Array.isArray(v.images) ? v.images.filter((x: any) => typeof x === 'string').slice(0, 6) : [],
      seoUrl: typeof v.seo_url === 'string' ? v.seo_url : null,
    });
  }
  return out;
}

/** SaffronVilla[] → offers. Unavailable/unpriced villas never published. */
export function parseSaffronOffers(
  villas: SaffronVilla[],
  source: SourceConfig,
  city: string,
): RawSourceItem[] {
  const out: RawSourceItem[] = [];
  for (const v of villas) {
    const price = v.perNightAfterDiscount ?? v.pricePerNight;
    if (!v.title || price == null || price <= 0 || !v.available) continue;
    const attrs: Record<string, any> = {
      image_url: v.imageIds[0] ? saffronImageUrl(v.imageIds[0]) : null,
      images: v.imageIds.map(saffronImageUrl).join('|') || null,
      rating: v.rating != null ? v.rating.toFixed(1) : null,
      review_count: v.reviews,
      location: v.location,
      latitude: v.latitude,
      longitude: v.longitude,
      property_id: v.id,
      bedrooms: v.bedrooms,
      max_capacity: v.capacity,
      collection: v.signature,
      price_basis: v.totalWithTax && v.totalWithTax > price
        ? `villa per night on SaffronStays (₹${Math.round(price)} + taxes; total ₹${Math.round(v.totalWithTax)})`
        : 'villa per night on SaffronStays (as listed)',
      data_note: 'Live villa per-night rates observed on SaffronStays search',
    };
    out.push(newRawItem(source, {
      title: v.title,
      seller: 'SaffronStays',
      sellerUrl: v.seoUrl ? `${SAFFRON_WEB}/villas/${v.seoUrl}` : `${SAFFRON_WEB}/villas`,
      currency: 'INR',
      price: Math.round(price),
      attributes: attrs,
      travel: { route: `${city} stay` },
      evidence: {
        sourceUrl: `${SAFFRON_WEB}/search?location=${encodeURIComponent(city)}`,
        sourceReference: v.id,
        extractedFields: ['title', 'price', 'rating', 'review_count', 'image_url', 'deeplink'],
      },
    }));
  }
  return out;
}
