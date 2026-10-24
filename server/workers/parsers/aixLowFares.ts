/**
 * Air India Express (AIX) low-fare calendar parser (24 Oct 2026 discovery).
 *
 * api.airindiaexpress.com is an Azure APIM gateway over a Navitaire ("nsk")
 * backend. The full FSA per-flight search (v4/fsa) is auth-gated (guest JWT
 * chain: aai-authentication/v2/auth/token -> encrypted booking context ->
 * fsa), but the LOW-FARE CALENDAR is OPEN browserless with just the public
 * web subscription key:
 *
 *   POST https://api.airindiaexpress.com/b2c-flightsearch/v2/lowFares
 *   { startDate, endDate, origin, destination, currencyCode: "INR",
 *     includeTaxesAndFees: true, numberOfPassengers: 1, fareType: "None" }
 *   headers: Ocp-Apim-Subscription-Key (public web key), client-id: AIRASIA-WEB-APP
 *
 * Verified live from the sandbox (24 Oct 2026): DEL-BOM returned 31 per-date
 * entries with real INR fares (28 Oct 2026: price 6677, taxesAndFees 1798,
 * available 37). AIX's own date-picker widget displays the `price` field
 * verbatim as the per-day fare, so `price` is the published fare we emit.
 *
 * Response shape:
 *   { "lowFares": [ { "date": "2026-10-28T00:00:00", "price": 6677,
 *       "taxesAndFees": 1798, "available": 37, "noFlights": false,
 *       "soldOut": false, "referenceFareKeys": null }, ... ] }
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export const AIX_API_BASE = 'https://api.airindiaexpress.com';
/** Public web subscription key shipped inside AIX's own client bundle (b2c-flightsearch family). */
export const AIX_SUBSCRIPTION_KEY = 'fe65ec9eec2445d9802be1d6c0295158';

export interface AixDayFare {
  /** ISO date YYYY-MM-DD (from "YYYY-MM-DDT00:00:00"). */
  dt: string;
  /** Published fare in INR (what AIX's own fare calendar widget displays). */
  pr: number;
  /** Taxes+fees component published alongside the fare, when present. */
  taxes?: number;
  /** Seats AIX reports as available for that date, when present. */
  available?: number;
  /** AIX says it flies no flights that day. */
  noFlights: boolean;
  /** AIX says the date is sold out. */
  soldOut: boolean;
}

export function aixLowFaresUrl(): string {
  return `${AIX_API_BASE}/b2c-flightsearch/v2/lowFares`;
}

export function aixLowFaresHeaders(): Record<string, string> {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'Ocp-Apim-Subscription-Key': AIX_SUBSCRIPTION_KEY,
    'client-id': 'AIRASIA-WEB-APP',
    'referring-client': 'https://www.airindiaexpress.com',
    Origin: 'https://www.airindiaexpress.com',
    Referer: 'https://www.airindiaexpress.com/',
  };
}

export function aixLowFaresBody(origin: string, destination: string, startDate: string, endDate: string): string {
  return JSON.stringify({
    startDate,
    endDate,
    origin,
    destination,
    currencyCode: 'INR',
    includeTaxesAndFees: true,
    numberOfPassengers: 1,
    fareType: 'None',
  });
}

/** SRP deeplink (AIX bundle pattern: /search-results?origin=&destination=&triptype=&departureDate=). */
export function aixSearchUrl(fromCode: string, toCode: string, depIso: string): string {
  return `https://www.airindiaexpress.com/search-results?origin=${fromCode}&destination=${toCode}&triptype=OneWay&departureDate=${depIso}`;
}

/** Parse the lowFares calendar body into honest per-date fares. */
export function parseAixLowFares(body: string): AixDayFare[] {
  let d: any;
  try {
    d = JSON.parse(body);
  } catch {
    return [];
  }
  const rows = d?.lowFares;
  if (!Array.isArray(rows)) return [];
  const out: AixDayFare[] = [];
  for (const row of rows) {
    const dt = String(row?.date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dt)) continue;
    const pr = Number(row?.price);
    if (!Number.isFinite(pr) || pr <= 0) continue;
    const taxes = Number(row?.taxesAndFees);
    const available = Number(row?.available);
    out.push({
      dt,
      pr: Math.round(pr),
      taxes: Number.isFinite(taxes) ? taxes : undefined,
      available: Number.isFinite(available) ? available : undefined,
      noFlights: Boolean(row?.noFlights),
      soldOut: Boolean(row?.soldOut),
    });
  }
  return out;
}

/**
 * Emit ONE honest offer like the MMT/Via/Akasa fare-calendar workers: the
 * exact depart date's calendar fare when AIX publishes one for that date,
 * else the cheapest upcoming flyable date (clearly labelled as such). The
 * seller is Air India Express (the airline's own site) — carrier and seller
 * are the same, per the owner seller+airline rule.
 */
export function aixDayFareItems(
  fares: AixDayFare[],
  source: SourceConfig,
  fromCity: string,
  toCity: string,
  fromCode: string,
  toCode: string,
  depIso: string,
): RawSourceItem[] {
  const today = new Date().toISOString().slice(0, 10);
  // Only dates AIX actually sells: noFlights/soldOut rows are not offers.
  const sellable = fares.filter((f) => !f.noFlights && !f.soldOut);
  const exact = sellable.find((f) => f.dt === depIso);
  const upcoming = [...sellable].filter((f) => f.dt >= today).sort((a, b) => a.pr - b.pr);
  const chosen = exact || upcoming[0];
  if (!chosen) return [];
  const isExact = Boolean(exact);
  const routeLabel = `${fromCity} → ${toCity}`;
  const seats = chosen.available !== undefined ? `, ${chosen.available} seats reported available` : '';
  const taxesNote = chosen.taxes !== undefined ? ` (taxes+fees component ₹${chosen.taxes})` : '';
  return [newRawItem(source, {
    title: `Air India Express ${routeLabel} ${isExact ? `on ${chosen.dt}` : `(cheapest upcoming, ${chosen.dt})`} from ₹${chosen.pr}`,
    brand: 'Air India Express',
    price: chosen.pr,
    currency: 'INR',
    seller: 'Air India Express',
    sellerUrl: aixSearchUrl(fromCode, toCode, chosen.dt),
    travel: { route: `${fromCity.toLowerCase()} to ${toCity.toLowerCase()}`, date: chosen.dt },
    attributes: {
      route: routeLabel,
      travel_date: chosen.dt,
      departure_date: chosen.dt,
      airline: 'Air India Express',
      fare_detail: `lowest Air India Express economy fare published on the airline's own fare calendar for ${chosen.dt}${taxesNote}`,
      fare_class: 'lowest economy fare on Air India Express\'s own fare calendar',
      price_basis: `Air India Express fare-calendar API price for this route${isExact ? ' and date' : ' within the returned calendar window'} on ${today}`,
      data_note: `Fare acquired from Air India Express's own API on ${today}${seats}. Flight numbers/times are NOT published by the fare calendar; booking continues on the airline's own website.`,
      image: '',
    },
    identifiers: { sku: `aix-${fromCode}-${toCode}-${chosen.dt}` },
    evidence: {
      sourceUrl: aixLowFaresUrl(),
      extractedFields: ['lowFares[].date', 'lowFares[].price (INR)', 'lowFares[].taxesAndFees', 'lowFares[].available'],
    },
  })];
}
