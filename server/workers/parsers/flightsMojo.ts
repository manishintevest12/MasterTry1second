// FlightsMojo (Indian OTA, Gurgaon) — owner OTA expansion (25 Oct 2026).
//
// Recipe (captured via request interception from their own search flow, replayed
// browserless with curl_cffi — no session/tokens needed, client-generated IDs):
//   1. POST https://www.flightsmojo.in/api/flight/search   (body: flightsMojoSearchBody)
//   2. poll POST https://www.flightsmojo.in/api/flight/research (same body) every ~4s;
//      res[0] fills with itineraries within one or two polls (~4-8s).
//
// .in storefront prices in INR (verified live: SG 612 DEL->BOM Rs 5,606, 219
// itineraries). The .com storefront prices in USD — always use flightsmojo.in.
//
// Itinerary shape (res[0][]):
//   { rid, vc: "SG", fare: { pf: 5606, gt: 5606, cur: "INR", ... },
//     fseg: [ { dur: minutes, stp: stops, segs: [ { al, fn, org, dst, dt, at, dur, cbag } ] } ] }
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export const FLIGHTSMOJO_BASE = 'https://www.flightsmojo.in';
export const FLIGHTSMOJO_SEARCH_URL = `${FLIGHTSMOJO_BASE}/api/flight/search`;
export const FLIGHTSMOJO_RESEARCH_URL = `${FLIGHTSMOJO_BASE}/api/flight/research`;

export interface FlightsMojoSegment {
  al?: string; fn?: string; org?: string; dst?: string;
  dt?: string; at?: string; dur?: number; cbag?: string;
}
export interface FlightsMojoItinerary {
  rid?: string; vc?: string;
  fare?: { pf?: number; gt?: number; cur?: string };
  fseg?: Array<{ dur?: number; stp?: number; segs?: FlightsMojoSegment[] }>;
}

/** Build the POST body the site's own JS sends (client-generated IDs are accepted). */
export function flightsMojoSearchBody(fromCode: string, toCode: string, dateIso: string): Record<string, unknown> {
  const session = `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-${Math.random().toString(16).slice(2, 6)}`;
  const key = `${fromCode}${toCode}${dateIso.slice(8)}${dateIso.slice(5, 7)}${dateIso.slice(2, 4)}1001`;
  const searchId = `2510${dateIso.slice(2, 4)}${dateIso.slice(5, 7)}${dateIso.slice(8)}0619542e061b9795ce4deaaa${key}`;
  const arp = (code: string) => ({ airportCode: code, airportName: `${code} Airport`, cityCode: code, cityName: code, countryCode: 'IN', countryName: 'India' });
  return {
    searchURL: null,
    userSessionID: session,
    userSearchID: searchId,
    userLogID: searchId,
    client: 1,
    segment: [{
      originAirport: fromCode, orgArp: arp(fromCode),
      destinationAirport: toCode, destArp: arp(toCode),
      travelDate: `${dateIso}T00:00:00`,
      originAllAirports: false, destinationAllAirports: false,
    }],
    searchDirectFlight: false, flexibleSearch: false, tripType: 1,
    adults: 1, child: 0, infants: 0, cabinType: 1, airline: 'ALL',
    currencyCode: 'INR', siteId: 1, sID: null, rID: null, locale: null,
    isNearBy: false, limit: null, page: null, pageValue: null,
    userIP: null, serverIP: null, fareCachingKey: key,
    isMetaRequest: false, fareType: 0, travelType: 0,
    deepLink: `/flight/searchflights?sec1=${fromCode}|${toCode}|${dateIso}&adults=1&child=0&infants=0&cabin=1&airline=ALL&siteid=1&currency=INR`,
    isGetLiveFare: false, device: 1, isReSearch: false,
    utm_source: 'direct', utm_medium: 'none', utm_campaign: 'none',
    utm_source_first: 'direct', utm_medium_first: 'none', utm_campaign_first: 'none',
    gclid: '', kayakClickId: null, wegoClickId: null,
  };
}

/** SRP deeplink on the IN storefront. */
export function flightsMojoSrpUrl(fromCode: string, toCode: string, dateIso: string): string {
  return `${FLIGHTSMOJO_BASE}/flight/searchflights?sec1=${fromCode}%7C${toCode}%7C${dateIso}&adults=1&child=0&infants=0&cabin=1&airline=ALL&siteid=1&currency=INR`;
}

/** Shape-tolerant parse of the research envelope. */
export function parseFlightsMojoResearch(body: unknown): FlightsMojoItinerary[] {
  const root = (body ?? {}) as Record<string, any>;
  if (!Array.isArray(root.res) || root.res.length === 0) return [];
  const itins = root.res[0];
  return Array.isArray(itins) ? itins : [];
}

/**
 * Map itineraries to honest raw items. Only the requested route is kept
 * (first-segment origin + last-segment destination must match), prices below
 * ~Rs 500 are treated as junk and dropped, and duplicates by flight/time are
 * collapsed. INR only (the .in storefront prices in INR).
 */
export function flightsMojoItems(
  itineraries: FlightsMojoItinerary[],
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
  for (const it of itineraries) {
    if (out.length >= cap) break;
    const segs = (it.fseg?.[0]?.segs || []).filter(Boolean);
    if (segs.length === 0) continue;
    // keep only itineraries on the requested route
    const firstOrg = String(segs[0].org || '');
    const lastDst = String(segs[segs.length - 1].dst || '');
    if (firstOrg !== fromCode || lastDst !== toCode) continue;
    // keep only departures on the requested day
    const depDay = String(segs[0].dt || '').slice(0, 10);
    if (depDay !== dateIso) continue;
    const fare = Number(it.fare?.pf ?? it.fare?.gt ?? 0);
    const cur = String(it.fare?.cur || '');
    if (cur !== 'INR') continue; // .in storefront only — never convert USD
    if (!Number.isFinite(fare) || fare < 500) continue; // junk/garbage guard
    const flightNos = segs.map((s) => `${s.al || ''}${s.fn || ''}`).join('-');
    const depTime = String(segs[0].dt || '').slice(11, 16);
    const arrTime = String(segs[segs.length - 1].at || '').slice(11, 16);
    const stops = segs.length - 1;
    const dur = Number(it.fseg?.[0]?.dur || 0) || undefined;
    const key = `${it.vc || ''}|${flightNos}|${depTime}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const routeLabel = `${route.from} → ${route.to}`;
    out.push(newRawItem(source, {
      title: `${it.vc || ''} ${flightNos} · ${routeLabel}`.slice(0, 200),
      brand: String(it.vc || 'FlightsMojo').slice(0, 80),
      price: Math.round(fare),
      currency: 'INR',
      seller: 'FlightsMojo',
      sellerUrl: flightsMojoSrpUrl(fromCode, toCode, dateIso),
      travel: { route: `${route.from.toLowerCase()} to ${route.to.toLowerCase()}`, date: dateIso, seatType: 'economy' },
      attributes: {
        route: routeLabel,
        travel_date: dateIso,
        airline_code: String(it.vc || ''),
        flight_number: flightNos,
        departure: depTime,
        arrival: arrTime,
        stops: String(stops),
        ...(dur ? { duration_minutes: String(dur) } : {}),
        ...(segs[0]?.cbag ? { cabin_baggage: segs[0].cbag } : {}),
        price_basis: `live ${stops === 0 ? 'nonstop' : `${stops}-stop`} fare observed on FlightsMojo's flight search on ${today} (FlightsMojo is the selling website)`,
        data_note: `Fare acquired via FlightsMojo's own search API on ${today}; the ticket is SOLD by FlightsMojo. Price may change at checkout.`,
      },
      identifiers: { sku: `flightsmojo-${flightNos}-${dateIso}-${depTime}`.slice(0, 120) },
      evidence: {
        sourceUrl: FLIGHTSMOJO_SEARCH_URL,
        sourceReference: String(it.rid || '').slice(0, 80),
        extractedFields: ['res[0][].fare.pf (INR)', 'fseg[0].segs[].al/fn/org/dst/dt/at', 'fseg[0].dur'],
      },
    }));
  }
  return out;
}
