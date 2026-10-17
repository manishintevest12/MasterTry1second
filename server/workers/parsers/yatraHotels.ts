/**
 * Yatra hotels parser — hotels vertical (live per-night rates).
 *
 * Yatra's hotel platform is TravelGuru; the SRP itself is an Akamai-sensored
 * SPA, but the search API behind it is a plain GET, captured 17 Oct 2026 via
 * Playwright + CDP request interception (stealth-capture policy) and fully
 * replayable browserless with curl_cffi chrome — NO browser, no sensor data.
 *
 * Recipe (verified live 17 Oct: Goa 765 results, Indore 256, New Delhi 788,
 * Ujjain 66 — tier-2/3 cities work):
 *   GET https://hotel.yatra.com/tgapi/hotels/v1/pageSearch
 *     ?checkOutDate=DD/MM/YYYY&checkInDate=DD/MM/YYYY&city=<CityName>
 *     &source=BOOKING_ENGINE&tenant=B2C&page=1
 *     &rooms[0].id=1&rooms[0].noOfAdults=2&rooms[0].noOfChildren=0
 *     &type=all&otherRateplans=all&allImages=true&showBOR=true&loggedIn=false&offset=10
 *   headers: x-api-key: JN9aWyj7hJ1ZrExC7Ozo (public — Yatra's own web app sends it),
 *            x-customer-ip: <any client ip string>, accept: application/json,
 *            origin/referer hotel.yatra.com
 *   response: data.content.hotels[] (n=name, id, hsk=slug, gr={rating,reviews},
 *            loc={c,a,la,lo}, cldImage.url, ctg) + data.rates.hotels[]
 *            (id, price=per-night ALL-INCLUSIVE total, basePrice, roomName,
 *            bookable, roomsLeft, currencyCode, freeCancel). Join on id.
 *
 * The deeplink is Yatra's own SRP (price owner) — property page URL format is
 * not guessable from hsk (all variants 404), so users land on the search
 * results with the same city/dates. Never fabricated per metasearch policy.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export const YATRA_HOTELS_API = 'https://hotel.yatra.com/tgapi/hotels/v1/pageSearch';
export const YATRA_HOTELS_API_KEY = 'JN9aWyj7hJ1ZrExC7Ozo';
export const YATRA_SRP = 'https://hotel.yatra.com/nextui/hotel-search/dom/search';

export interface YatraHotel {
  id: string;
  name: string;
  slug: string | null;
  rating: number | null;
  reviews: number | null;
  city: string | null;
  area: string | null;
  lat: number | null;
  lon: number | null;
  imageUrl: string | null;
  categories: string[];
  rackRate: number | null;
  price: number | null;          // rates.hotels[].price — per-night all-inclusive
  basePrice: number | null;
  roomName: string | null;
  bookable: boolean;
  roomsLeft: number | null;
  freeCancel: boolean;
}

const num = (x: any): number | null => {
  if (x == null || x === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};

/** content.hotels[] + rates.hotels[] → normalized offers. */
export function parseYatraHotels(body: any): YatraHotel[] {
  const content = body?.data?.content;
  const rates: any[] = Array.isArray(body?.data?.rates?.hotels) ? body.data.rates.hotels : [];
  const rateById = new Map<string, any>();
  for (const r of rates) if (r?.id) rateById.set(String(r.id), r);
  const hotels: any[] = Array.isArray(content?.hotels) ? content.hotels : [];
  const out: YatraHotel[] = [];
  for (const h of hotels) {
    if (!h || typeof h !== 'object') continue;
    const rate = rateById.get(String(h.id ?? '')) || {};
    out.push({
      id: String(h.id ?? ''),
      name: String(h.n ?? h.orgName ?? '').trim(),
      slug: typeof h.hsk === 'string' ? h.hsk : null,
      rating: num(h?.gr?.rating),
      reviews: num(h?.gr?.reviews),
      city: typeof h?.loc?.c === 'string' ? h.loc.c : null,
      area: typeof h?.loc?.a === 'string' ? h.loc.a : null,
      lat: num(h?.loc?.la),
      lon: num(h?.loc?.lo),
      imageUrl: typeof h?.cldImage?.url === 'string' ? h.cldImage.url : null,
      categories: Array.isArray(h.ctg) ? h.ctg.filter((x: any) => typeof x === 'string') : [],
      rackRate: num(h.r),
      price: num(rate.price),
      basePrice: num(rate.basePrice),
      roomName: typeof rate.roomName === 'string' ? rate.roomName : null,
      bookable: rate.bookable !== false,
      roomsLeft: num(rate.roomsLeft),
      freeCancel: Boolean(rate.freeCancel),
    });
  }
  return out;
}

/** Full pageSearch URL (dates DD/MM/YYYY as Yatra expects). */
export function yatraPageSearchUrl(city: string, checkin: string, checkout: string, page = 1): string {
  const ci = ddmmyyyy(checkin);
  const co = ddmmyyyy(checkout);
  return (
    `${YATRA_HOTELS_API}?checkOutDate=${co}&checkInDate=${ci}&city=${encodeURIComponent(city)}` +
    `&source=BOOKING_ENGINE&tenant=B2C&page=${page}&offset=${page * 10}&rooms%5B0%5D.id=1&rooms%5B0%5D.noOfAdults=2` +
    `&rooms%5B0%5D.noOfChildren=0&type=all&otherRateplans=all&allImages=true&showBOR=true` +
    `&loggedIn=false&offset=10`
  );
}

/** Yatra SRP deeplink (price owner's results page, same city + dates). */
export function yatraSrpUrl(city: string, checkin: string, checkout: string): string {
  const ci = encodeURIComponent(ddmmyyyy(checkin));
  const co = encodeURIComponent(ddmmyyyy(checkout));
  const c = encodeURIComponent(city);
  return (
    `${YATRA_SRP}?checkoutDate=${co}&checkinDate=${ci}&source=BOOKING_ENGINE&pg=1&tenant=B2C` +
    `&city.name=${c}&city.code=${c}&state.name=${c}&state.code=${c}` +
    `&country.name=IND&country.code=IND&roomRequests%5B0%5D.id=1` +
    `&roomRequests%5B0%5D.noOfAdults=2&roomRequests%5B0%5D.noOfChildren=0`
  );
}

/** YatraHotel[] → offers. Unpriced/unbookable rows never published. */
export function parseYatraOffers(
  hotels: YatraHotel[],
  source: SourceConfig,
  city: string,
  meta: { checkin: string; checkout: string },
): RawSourceItem[] {
  const out: RawSourceItem[] = [];
  for (const h of hotels) {
    if (!h.name || h.price == null || h.price <= 0 || !h.bookable) continue;
    const attrs: Record<string, any> = {
      image_url: h.imageUrl,
      rating: h.rating != null ? String(h.rating) : null, // /5 scale on Yatra
      review_count: h.reviews,
      city: h.city || city,
      area: h.area,
      latitude: h.lat,
      longitude: h.lon,
      property_id: h.id,
      room_type: h.roomName,
      price_basis: h.basePrice != null && h.basePrice < h.price
        ? `per night on Yatra (₹${Math.round(h.basePrice)} base + taxes; total ₹${Math.round(h.price)})`
        : 'per night on Yatra (all-inclusive total)',
      data_note: 'Live per-night rates observed on Yatra hotel search',
    };
    if (h.roomsLeft != null && h.roomsLeft <= 5) attrs.rooms_left = String(h.roomsLeft);
    if (h.freeCancel) attrs.free_cancellation = 'true';
    if (h.rackRate != null && h.rackRate > h.price) attrs.rack_rate = String(Math.round(h.rackRate));
    out.push(newRawItem(source, {
      title: h.name,
      seller: 'Yatra',
      sellerUrl: yatraSrpUrl(h.city || city, meta.checkin, meta.checkout),
      currency: 'INR',
      price: Math.round(h.price),
      attributes: attrs,
      travel: { date: meta.checkin, route: `${h.city || city} stay`, roomType: h.roomName || undefined },
      evidence: {
        sourceUrl: yatraSrpUrl(city, meta.checkin, meta.checkout),
        sourceReference: h.id,
        extractedFields: ['title', 'price', 'rating', 'review_count', 'image_url', 'deeplink'],
      },
    }));
  }
  return out;
}

/** yyyy-mm-dd → dd/mm/yyyy (Yatra's API date format). */
export function ddmmyyyy(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}
