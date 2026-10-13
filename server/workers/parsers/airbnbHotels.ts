/**
 * Airbnb hotels/homes parser — hotels vertical.
 *
 * https://www.airbnb.co.in/s/{city}/homes?checkin=..&checkout=..&adults=2 is
 * server-side rendered. The results ship inside
 * <script data-deferred-state-0> → JSON → niobeClientData[0] →
 * [ "StaysSearch:{request echo}", { data.presentation.staysSearch.results.
 * searchResults[] } ]. Each StaySearchResult carries:
 *   - subtitle (the property name; title is "Flat in Calangute" room type)
 *   - demandStayListing.id — base64("DemandStayListing:<listingId>")
 *     → deeplink https://www.airbnb.co.in/rooms/<listingId>
 *   - structuredDisplayPrice.primaryLine.price ("₹17,325") + .qualifier
 *     ("for 5 nights") → nightly rate = total / nights
 *   - avgRatingLocalized ("4.78 (340)"), contextualPictures[0].picture,
 *     demandStayListing.location.coordinate.
 *
 * Airbnb prices are stay totals, NOT per-night rates: the qualifier is parsed
 * to derive an honest per-night figure. No browser automation — pure
 * curl_cffi (chrome impersonation) + JSON extraction.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export const AIRBNB_WEB = 'https://www.airbnb.co.in';

export interface AirbnbStay {
  name: string;
  roomType: string | null;
  listingId: string;
  deeplink: string;
  priceTotal: number;
  nights: number;
  pricePerNight: number;
  rating: string | null;
  reviews: number | null;
  imageUrl: string | null;
  lat: number | null;
  lon: number | null;
}

/** Extract searchResults[] from the deferred-state JSON (defensive walking). */
export function extractAirbnbSearchResults(deferred: any): any[] {
  try {
    const ncd = deferred?.niobeClientData?.[0];
    if (!Array.isArray(ncd)) return [];
    for (const entry of ncd) {
      if (!entry || typeof entry !== 'object') continue;
      const results =
        entry?.data?.presentation?.staysSearch?.results?.searchResults;
      if (Array.isArray(results) && results.length) return results;
    }
  } catch { /* malformed → caller reports EMPTY */ }
  return [];
}

export function parseAirbnbStays(results: any[]): AirbnbStay[] {
  const stays: AirbnbStay[] = [];
  for (const r of results) {
    if (!r || r.__typename !== 'StaySearchResult') continue;
    const name = String(r.subtitle || r.nameLocalized?.localizedStringWithTranslationPreference || '').trim();
    if (!name) continue;
    const listingB64 = r.demandStayListing?.id || '';
    let listingId = '';
    try {
      listingId = Buffer.from(listingB64, 'base64').toString('utf8').split(':')[1] || '';
    } catch { /* keep empty → skip */ }
    if (!/^\d{5,}$/.test(listingId)) continue;

    const primary = r.structuredDisplayPrice?.primaryLine || {};
    const priceNum = parseInr(primary.price);
    const qualifier = String(primary.qualifier || '');
    const nightsMatch = qualifier.match(/for\s+(\d+)\s+nights?/i);
    const nights = nightsMatch ? parseInt(nightsMatch[1], 10) : (priceNum ? 1 : 0);

    const ratingRaw = String(r.avgRatingLocalized || '');
    const ratingMatch = ratingRaw.match(/^([\d.]+)\s*(?:\((\d+)\))?/);

    const coord = r.demandStayListing?.location?.coordinate;

    stays.push({
      name,
      roomType: r.title ? String(r.title) : null,
      listingId,
      deeplink: `${AIRBNB_WEB}/rooms/${listingId}`,
      priceTotal: priceNum,
      nights,
      pricePerNight: nights > 0 ? Math.round(priceNum / nights) : priceNum,
      rating: ratingMatch ? ratingMatch[1] : null,
      reviews: ratingMatch && ratingMatch[2] ? parseInt(ratingMatch[2], 10) : null,
      imageUrl: r.contextualPictures?.[0]?.picture || null,
      lat: coord?.latitude ?? null,
      lon: coord?.longitude ?? null,
    });
  }
  return stays;
}

function parseInr(s: string | undefined): number {
  if (!s) return 0;
  const m = String(s).replace(/,/g, '').match(/([\d.]+)/);
  return m ? Math.round(parseFloat(m[1])) : 0;
}

export function parseAirbnbOffers(stays: AirbnbStay[], source: SourceConfig, city: string): RawSourceItem[] {
  const out: RawSourceItem[] = [];
  for (const s of stays.slice(0, 25)) {
    if (!s.pricePerNight) continue; // never publish a price we did not see
    const attrs: Record<string, any> = {
      image_url: s.imageUrl,
      rating: s.rating,
      review_count: s.reviews,
      room_type: s.roomType,
      city,
      latitude: s.lat,
      longitude: s.lon,
      price_basis: `per night (total ₹${s.priceTotal.toLocaleString('en-IN')} for ${s.nights} night${s.nights > 1 ? 's' : ''} on Airbnb)`,
      data_note: 'Live stay rates from Airbnb search results',
    };
    out.push(newRawItem(source, {
      title: s.name,
      seller: 'Airbnb',
      sellerUrl: s.deeplink, // redirect only to the site that owns the price
      currency: 'INR',
      price: s.pricePerNight,
      attributes: attrs,
      evidence: {
        sourceUrl: `${AIRBNB_WEB}/s/${encodeURIComponent(city)}/homes`,
        sourceReference: s.listingId,
        extractedFields: ['title', 'price', 'rating', 'image_url', 'deeplink'],
      },
    }));
  }
  return out;
}
