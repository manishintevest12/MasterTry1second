/**
 * EaseMyTrip hotels parser — hotels vertical (live per-night rates).
 *
 * EMT's city SEO pages (https://www.easemytrip.com/hotels/hotels-in-<city>/
 * ?checkin=DD-MM-YYYY&checkout=DD-MM-YYYY&c=IN&num_rooms=1&adults=2) are FULL
 * SSR with a JSON-LD <script type="application/ld+json"> ItemList of ~20 hotels:
 * name, starRating.ratingValue, address (streetAddress "Area>Locality"),
 * addressLocality/Region, geo {latitude, longitude}, priceRange (INR per night),
 * image on img.easemytrip.com/emthotel-<hotelId>/..., telephone. No auth, no WAF
 * (verified live 17 Oct 2026: Goa — Estrela Do Mar ₹5693, The Lalit ₹12160;
 * Indore 20 hotels). Fully browserless via curl_cffi chrome.
 *
 * The ld+json items carry no URL; property deeplinks are recovered by joining
 * the hotel id embedded in the image host segment (emthotel-<id>) with the
 * page's /hotels/<slug>-<id>/ anchors. Unmatched hotels fall back to the city
 * SRP deeplink (the page that owns the price) — never a fabricated URL.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';
import { cityVariants, slugOf } from '../../common/cityAlias';

export const EMT_HOTELS_WEB = 'https://www.easemytrip.com';

export interface EmtHotel {
  id: string;
  name: string;
  starRating: number | null;
  area: string | null;
  locality: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  price: number | null;
  imageUrl: string | null;
  deeplink: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
}

/** City slug candidates for /hotels/hotels-in-<city>/. */
export function emtCityPaths(city: string): string[] {
  const out: string[] = [];
  for (const v of cityVariants(city)) {
    const p = `hotels/hotels-in-${slugOf(v)}`;
    if (!out.includes(p)) out.push(p);
  }
  return out.slice(0, 6);
}

/** Extract the JSON-LD ItemList (or bare list) of hotels from the SSR page. */
export function parseEmtLdJson(html: string): any[] {
  const blocks = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
  for (const b of blocks) {
    try {
      const d = JSON.parse(b.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, ''));
      if (d?.['@type'] === 'ItemList' && Array.isArray(d.itemListElement)) return d.itemListElement;
    } catch { /* next block */ }
  }
  return [];
}

/** All /hotels/<slug>-<id>/ anchors on the page → id → deeplink map. */
export function parseEmtHotelLinks(html: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /href="(https:\/\/www\.easemytrip\.com\/hotels\/([a-z0-9-]+)-(\d+)\/?)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const id = m[3];
    if (!map.has(id)) map.set(id, m[1]);
  }
  return map;
}

/** id inside image host segment: img.easemytrip.com/emthotel-<id>/... */
export function emtIdFromImage(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  const m = /emthotel-(\d+)\//.exec(imageUrl);
  return m ? m[1] : null;
}

const num = (x: any): number | null => {
  if (x == null || x === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};

/** ld+json items + page links → normalized hotels. */
export function parseEmtHotels(items: any[], links: Map<string, string>): EmtHotel[] {
  const out: EmtHotel[] = [];
  for (const it of items) {
    if (!it || typeof it !== 'object' || typeof it.name !== 'string') continue;
    const image = typeof it.image === 'string' ? it.image : null;
    const id = emtIdFromImage(image) || '';
    const addr = it.address || {};
    const street = typeof addr.streetAddress === 'string' ? addr.streetAddress : '';
    const [area, localityPart] = street.split('>');
    out.push({
      id,
      name: it.name.trim(),
      starRating: num(it?.starRating?.ratingValue),
      area: area?.trim() || null,
      locality: localityPart?.trim() || (typeof addr.addressLocality === 'string' ? addr.addressLocality : null),
      region: typeof addr.addressRegion === 'string' ? addr.addressRegion : null,
      latitude: num(it?.geo?.latitude),
      longitude: num(it?.geo?.longitude),
      price: num(it.priceRange),
      imageUrl: image,
      deeplink: (id && links.get(id)) || null,
      checkInTime: typeof it.checkInTime === 'string' ? it.checkInTime : null,
      checkOutTime: typeof it.checkOutTime === 'string' ? it.checkOutTime : null,
    });
  }
  return out;
}

/** EmtHotel[] → offers. Price-less rows never published. */
export function parseEmtOffers(
  hotels: EmtHotel[],
  source: SourceConfig,
  city: string,
  meta: { checkin: string; checkout: string; path: string },
): RawSourceItem[] {
  const out: RawSourceItem[] = [];
  const srpUrl = `${EMT_HOTELS_WEB}/${meta.path}/?checkin=${ddmmyyyyDash(meta.checkin)}&checkout=${ddmmyyyyDash(meta.checkout)}&c=IN&num_rooms=1&adults=2`;
  for (const h of hotels) {
    if (!h.name || h.price == null || h.price <= 0) continue;
    const attrs: Record<string, any> = {
      image_url: h.imageUrl,
      star_rating: h.starRating != null ? String(h.starRating) : null,
      area: h.area,
      address: h.locality,
      city: h.region || city,
      latitude: h.latitude,
      longitude: h.longitude,
      property_id: h.id || null,
      price_basis: 'per night as listed on EaseMyTrip city page',
      data_note: 'Live per-night rates observed on EaseMyTrip hotel listing',
    };
    if (h.checkInTime) attrs.check_in_time = h.checkInTime;
    if (h.checkOutTime) attrs.check_out_time = h.checkOutTime;
    out.push(newRawItem(source, {
      title: h.name,
      seller: 'EaseMyTrip',
      sellerUrl: h.deeplink || srpUrl, // property page if id-matched, else the price-owning SRP
      currency: 'INR',
      price: Math.round(h.price),
      attributes: attrs,
      travel: { date: meta.checkin, route: `${city} stay` },
      evidence: {
        sourceUrl: srpUrl,
        sourceReference: h.id || h.name,
        extractedFields: ['title', 'price', 'rating', 'image_url', 'deeplink'],
      },
    }));
  }
  return out;
}

/** yyyy-mm-dd → dd-mm-yyyy (EMT URL format). */
export function ddmmyyyyDash(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}
