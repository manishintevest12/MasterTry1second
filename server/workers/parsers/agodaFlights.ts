// Agoda flights (agoda.com/flights) — owner OTA expansion (25 Oct).
//
// Recipe (captured from the site's own XHR via request interception, replayed
// BROWSERLESS with curl_cffi — verified live from the sandbox):
//   POST https://www.agoda.com/api/gw/flight/SearchUnbundled?
//   Body: client-generated UUIDs (flightsRequestId/requestId/userId), a fixed
//   guest sessionInfo, INR userSettings. No cookies/tokens needed — the gateway
//   responds 200 with ~20 bundles per page (server caps size at 20; paginate
//   trips[0].pagination.number for more). Verified: DEL-BOM 273 total
//   itineraries, 60 unique bundles across 3 pages, real INR fares
//   (IndiGo 6E 5175 Rs 7,082 all-inclusive).
//
// Response shape (per bundle):
//   bundlePrice[0].price.inr.display.perBook.allInclusive  — all-inclusive INR fare
//   itineraries[0].itineraryInfo.{id, totalTripDuration, ticketingCarrierContent}
//   outboundSlice.{duration (min), segments[]: {carrierCode, flightNumber,
//     originAirport, destinationAirport, departDateTime, arrivalDateTime,
//     carrierContent.carrierName, cabinClassContent.cabinClass}}
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export const AGODA_SEARCH_URL = 'https://www.agoda.com/api/gw/flight/SearchUnbundled?';

/** SRP deeplink mirroring the site's own search URL format. */
export function agodaFlightsSrpUrl(fromCode: string, toCode: string, dateIso: string): string {
  return `https://www.agoda.com/flights/search?origin=${fromCode}&destination=${toCode}&departDate=${dateIso}&adults=1&cabinType=Economy`;
}

/** Build the SearchUnbundled POST body (client-generated IDs, INR storefront). */
export function agodaSearchBody(fromCode: string, toCode: string, dateIso: string, page = 1): Record<string, unknown> {
  return {
    flightsRequestId: crypto.randomUUID(),
    passengers: [{ number: 1, passengerType: 1 }],
    trips: [{
      id: 1,
      priority: 1,
      pagination: { size: 20, number: page },
      sort: { field: 8, direction: 0 },
      filter: { cabinType: 4, stops: [], isMixedCabinClassAllowed: true, hackerFare: { disabled: false } },
      slices: [{
        id: 1,
        departureDate: dateIso,
        origin: [{ code: fromCode, type: 1 }],
        destination: [{ code: toCode, type: 1 }],
      }],
    }],
    supportedFeatures: [
      'QuickSort', 'CrossOutPrice', 'Streaming', 'HackerFare', 'OnlineBanking',
      'SupportChildrenInfants', 'TripProtectionMerchant', 'Agency',
      'DisablePublishSearchMessage', 'IncompletePassportRequired', 'VirtualInterlining',
    ],
    context: {
      clientInfo: { applicationName: 'DesktopWeb', clientVersion: '1.0', userId: crypto.randomUUID(), origin: 'IN', pageTypeId: 5501 },
      userSettings: { currencyCode: 'INR', language: 'en-us', languageId: 1, priceView: 304 },
      sessionInfo: { cid: 1917399, id: 'npcudwpurarmgh1b3wmv5zc4', searchEngineClicks: null },
      debugInfo: {},
      trafficMessageInfo: { shouldSendTrafficMessage: false },
      requestInfo: { currentRetryAttempt: 0, requestId: crypto.randomUUID() },
      funnel: 0,
    },
  };
}

export interface AgodaSegment {
  flightNumber?: string;
  originAirport?: string;
  destinationAirport?: string;
  departDateTime?: string;
  arrivalDateTime?: string;
  carrierCode?: string;
  carrierContent?: { carrierName?: string };
  cabinClassContent?: { cabinClass?: string };
}
export interface AgodaBundle {
  key?: string;
  bundlePrice?: Array<{ price?: Record<string, { display?: { perBook?: { allInclusive?: number } } } > }>;
  itineraries?: Array<{ itineraryInfo?: { id?: string; totalTripDuration?: number; availableSeats?: number; ticketingCarrierContent?: { carrierName?: string; carrierCode?: string }; ticketingAirline?: string } }>;
  outboundSlice?: { duration?: number; segments?: AgodaSegment[] };
}

/** Shape-tolerant parse: flatten trips[].bundles[] from a response. */
export function parseAgodaFlights(body: unknown): AgodaBundle[] {
  const root = (body ?? {}) as Record<string, any>;
  const trips = root.trips;
  if (!Array.isArray(trips)) return [];
  const out: AgodaBundle[] = [];
  for (const t of trips) {
    const bundles = (t ?? {}).bundles;
    if (Array.isArray(bundles)) out.push(...bundles.filter(Boolean));
  }
  return out;
}

/** All-inclusive per-booking INR fare from a bundle; NaN when absent/non-INR. */
export function agodaBundleFare(bundle: AgodaBundle): { fare: number; currency: string } {
  const first = (bundle.bundlePrice || [])[0];
  const price = first?.price;
  if (!price || typeof price !== 'object') return { fare: NaN, currency: '' };
  const curKey = Object.keys(price).find((k) => k.toLowerCase() === 'inr');
  if (!curKey) {
    const anyKey = Object.keys(price)[0] || '';
    return { fare: NaN, currency: anyKey.toUpperCase() };
  }
  const fare = Number(price[curKey]?.display?.perBook?.allInclusive);
  return { fare: Number.isFinite(fare) ? fare : NaN, currency: 'INR' };
}

/**
 * Map bundles to honest raw items. Only the requested route is kept (first
 * segment origin + last segment destination must match — DEL searches also
 * return HDO/DXN rows which we drop rather than misattribute), departures must
 * be on the requested day, fares must be INR and sane; duplicates by
 * flight+time are collapsed.
 */
export function agodaFlightsItems(
  bundles: AgodaBundle[],
  source: SourceConfig,
  route: { from: string; to: string },
  fromCode: string,
  toCode: string,
  dateIso: string,
  cap = 40,
): RawSourceItem[] {
  const today = new Date().toISOString().slice(0, 10);
  const out: RawSourceItem[] = [];
  const seen = new Set<string>();
  for (const b of bundles) {
    if (out.length >= cap) break;
    const segs = (b.outboundSlice?.segments || []).filter(Boolean);
    if (segs.length === 0) continue;
    if (String(segs[0].originAirport || '') !== fromCode) continue; // HDO/DXN etc. dropped
    if (String(segs[segs.length - 1].destinationAirport || '') !== toCode) continue;
    const depDay = String(segs[0].departDateTime || '').slice(0, 10);
    if (depDay !== dateIso) continue;
    const { fare, currency } = agodaBundleFare(b);
    if (currency !== 'INR') continue; // never convert
    if (!Number.isFinite(fare) || fare < 500 || fare > 500000) continue;
    // the gateway puts the airline CODE on the itinerary (ticketingAirline),
    // not always on each segment — use it to build flight numbers
    const carrierCode = String(b.itineraries?.[0]?.itineraryInfo?.ticketingAirline || segs[0].carrierCode || '');
    const carrier = segs[0].carrierContent?.carrierName
      || b.itineraries?.[0]?.itineraryInfo?.ticketingCarrierContent?.carrierName
      || carrierCode || 'Agoda';
    const flightNos = segs.map((s) => `${s.carrierCode || carrierCode || ''}${s.flightNumber || ''}`).join('-');
    const depTime = String(segs[0].departDateTime || '').slice(11, 16);
    const arrTime = String(segs[segs.length - 1].arrivalDateTime || '').slice(11, 16);
    const stops = segs.length - 1;
    const dur = Number(b.outboundSlice?.duration || 0) || undefined;
    const key = `${flightNos}|${depTime}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const routeLabel = `${route.from} → ${route.to}`;
    const itineraryId = String(b.itineraries?.[0]?.itineraryInfo?.id || '');
    out.push(newRawItem(source, {
      title: `${carrier} ${flightNos} · ${routeLabel}`.slice(0, 200),
      brand: String(carrier).slice(0, 80),
      price: Math.round(fare),
      currency: 'INR',
      seller: 'Agoda',
      sellerUrl: agodaFlightsSrpUrl(fromCode, toCode, dateIso),
      travel: { route: `${route.from.toLowerCase()} to ${route.to.toLowerCase()}`, date: dateIso, seatType: 'economy' },
      attributes: {
        route: routeLabel,
        travel_date: dateIso,
        airline: String(carrier),
        airline_code: carrierCode,
        flight_number: flightNos,
        departure: String(depTime),
        arrival: String(arrTime),
        stops: String(stops),
        ...(dur ? { duration_minutes: String(dur) } : {}),
        ...(segs[0].cabinClassContent?.cabinClass ? { cabin: segs[0].cabinClassContent.cabinClass } : {}),
        ...(b.itineraries?.[0]?.itineraryInfo?.availableSeats != null ? { seats_left: String(b.itineraries[0].itineraryInfo.availableSeats) } : {}),
        price_basis: `live all-inclusive ${stops === 0 ? 'nonstop' : `${stops}-stop`} fare observed on Agoda's flight search on ${today} (Agoda is the selling website)`,
        data_note: `Fare acquired via Agoda's SearchUnbundled flight API on ${today}; the ticket is SOLD by Agoda. Price may change at checkout.`,
      },
      identifiers: { sku: `agoda-${flightNos}-${dateIso}-${depTime}`.slice(0, 120) },
      evidence: {
        sourceUrl: AGODA_SEARCH_URL,
        sourceReference: (itineraryId || b.key || '').slice(0, 160),
        extractedFields: ['trips[].bundles[].bundlePrice[0].price.inr.display.perBook.allInclusive', 'outboundSlice.segments[].carrierCode/flightNumber/departDateTime', 'outboundSlice.duration'],
      },
    }));
  }
  return out;
}
