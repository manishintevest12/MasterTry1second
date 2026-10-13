/**
 * Cleartrip hotels parser — hotels vertical.
 *
 * https://www.cleartrip.com/hotels/india/{city-slug} is a Next.js SEO SRP that
 * ships the full first-page hotel cards inside __NEXT_DATA__ →
 * props.pageProps.initialState.results.data.slotsData[] → type
 * "HOTEL_CARD_LIST" → slotData.data.hotelCardList[]. Each card carries the
 * REAL nightly price (priceInfo.data.price, INR, with slashedPrice list price),
 * Cleartrip rating, star rating, locality, Flipkart-CDN poster image
 * (https://rukmini-ct.flixcart.com/<cms path>) and the hotel-details deeplink
 * (action.payload.url, relative to https://www.cleartrip.com).
 *
 * No browser automation — pure curl_cffi fetch + JSON extraction.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export const CLEARTRIP_IMAGE_CDN = 'https://rukmini-ct.flixcart.com/';
export const CLEARTRIP_WEB = 'https://www.cleartrip.com';

export interface CleartripHotel {
  id: string;
  name: string;
  price: number;
  slashedPrice: number;
  currency: string;
  rating: string | null;
  stars: number | null;
  locality: string | null;
  city: string | null;
  imageUrl: string | null;
  deeplink: string;
  freeCancellation: boolean;
  freeBreakfast: boolean;
}

/** Extract hotel cards from a Cleartrip SEO SRP __NEXT_DATA__ JSON document. */
export function parseCleartripHotels(nextData: any): CleartripHotel[] {
  const out: CleartripHotel[] = [];
  const seen = new Set<string>();
  const slots =
    nextData?.props?.pageProps?.initialState?.results?.data?.slotsData;
  if (!Array.isArray(slots)) return out;
  for (const slot of slots) {
    if (slot?.slotData?.type !== 'HOTEL_CARD_LIST') continue;
    const cards = slot?.slotData?.data?.hotelCardList;
    if (!Array.isArray(cards)) continue;
    for (const card of cards) {
      const d = card?.data;
      if (!d?.name || !d?.priceInfo?.data) continue;
      const pi = d.priceInfo.data;
      const price = Number(pi.price) || 0;
      if (price <= 0) continue; // no real price -> skip, never guess
      const id = String(d.ravenTracking?.eventData?.h_hotel_id || pi.hotelId || d.id || '');
      const key = id || `${d.name}|${price}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const imgRaw = d?.imageSlider?.data?.images?.[0]?.data?.url;
      const imageUrl = typeof imgRaw === 'string' && imgRaw.startsWith('http')
        ? imgRaw
        : typeof imgRaw === 'string' && imgRaw
          ? CLEARTRIP_IMAGE_CDN + imgRaw.replace(/^\/+/, '')
          : null;
      const rel = card?.action?.payload?.url;
      const deeplink = typeof rel === 'string' && rel.startsWith('/')
        ? CLEARTRIP_WEB + rel
        : typeof rel === 'string' && rel.startsWith('http')
          ? rel
          : `${CLEARTRIP_WEB}/hotels/`;
      out.push({
        id,
        name: String(d.name).trim(),
        price,
        slashedPrice: Number(pi.slashedPrice) || 0,
        currency: 'INR',
        rating: d?.clearTripRatingAndReview?.data?.rating ? String(d.clearTripRatingAndReview.data.rating) : null,
        stars: Number(d?.starRating) || null,
        locality: d?.locality ? String(d.locality) : null,
        city: d?.city ? String(d.city) : null,
        imageUrl,
        deeplink,
        freeCancellation: Boolean(d?.freeCancellation?.available),
        freeBreakfast: Boolean(d?.freeBreakfast?.available),
      });
    }
  }
  return out;
}

/** Cleartrip hotels → raw offers (price per night, real CDN images, own-site deeplinks). */
export function parseCleartripOffers(
  hotels: CleartripHotel[],
  source: SourceConfig,
): RawSourceItem[] {
  const out: RawSourceItem[] = [];
  for (const h of hotels.slice(0, 30)) {
    const attrs: Record<string, any> = {
      image_url: h.imageUrl,
      rating: h.rating,
      stars: h.stars,
      locality: h.locality,
      city: h.city,
      free_cancellation: h.freeCancellation,
      free_breakfast: h.freeBreakfast,
      price_basis: 'per night for 1 room',
      data_note: 'Live nightly rates from Cleartrip hotel search results',
    };
    out.push(newRawItem(source, {
      title: h.name,
      seller: 'Cleartrip',
      sellerUrl: h.deeplink, // redirect only to the site that owns the price
      currency: 'INR',
      price: h.price,
      listPrice: h.slashedPrice > h.price ? h.slashedPrice : undefined,
      attributes: attrs,
      evidence: {
        sourceUrl: `${CLEARTRIP_WEB}/hotels/india/`,
        sourceReference: h.id,
        extractedFields: ['title', 'price', 'listPrice', 'rating', 'locality', 'image_url', 'deeplink'],
      },
    }));
  }
  return out;
}
