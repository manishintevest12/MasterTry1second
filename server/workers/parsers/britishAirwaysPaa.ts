/**
 * British Airways parser (24 Oct 2026 discovery - recipe-only availability).
 *
 * GATE MAP (sandbox + Browserbase, 24 Oct 2026): britishairways.com serves
 * all GETs (pages, bundles, lookup/jsonp/cabinHelper) to datacenter IPs, but
 * EVERY POST tarpits - /api/grant (public OAuth grant) and the availability
 * API hang with 0 bytes received on chrome and safari rungs, and the live
 * browser could not complete the availability call either (flightList stuck
 * on "Loading flight results" with Akamai BMP sensor posts). This is the
 * deepest gate class in the fleet (same tier as MMT per-flight).
 *
 * CAPTURED RECIPE (from the public ba-sell SPA bundle, main.9a9027224030c0fe.js,
 * plus live CDP observation of the flow):
 *   1. POST /api/grant  body "grant_type=urn:com:baplc:oauth:grant:public"
 *      Authorization: Client client_id="bacomngprod" (createPublicToken)
 *   2. POST /api/sc4/badotcomadapter-paa/rs/v1/flightavailability/search;ondwanted=1?metasearchdata=<ORG>_<DST>_<DATE>
 *      headers: ba_integrity_tokenV1: <token>
 *      body: { ondSearches:[{originLocationCode,destinationLocationCode,departureDate}],
 *              cabin:"M", ticketFlexibility:"LOWEST",
 *              passengerMix:{adultCount:1,youngAdultCount:0,childCount:0,infantCount:0},
 *              cug:false, includeCalendar:true, calendarDays:3, baIntegrityTokenV1:<token> }
 *      Integrity token (generateIntegrityTokenV1, deobfuscated from bundle):
 *        base64( hex( SHA256( departureDate.toUpperCase() + origin.toUpperCase()
 *                              + destination ) ) )
 *   3. Response shape (schema from bundle consumers): availabilityData[].availableOptions[]
 *      with flightEvents[] {departureDateTime, arrivalDateTime, departureLocation.airport.code,
 *      arrivalLocation.airport.code, marketingCarrierCode/marketingFlightNumber} and
 *      availableCabinsForOption[] {dominantFareType, cabinPrice.lowestJourneyPrice}.
 *      NOTE (BA UI disclaimer): flight-list prices EXCLUDE taxes/fees/carrier charges.
 *   4. OPEN helper (sandbox-verified 200): GET /lookup/jsonp/cabinHelper/getCabinsForRoute/<to>/<from>/en
 *      -> {"reply":{"M":"Economy",...}} - route/cabin validation, usable as a
 *      cheap liveness check even while availability is gated.
 *   Booking deeplink (live-observed):
 *   /travel/book/public/en_gb/flightList?onds=DEL-LHR_2026-10-28&ad=1&yad=0&ch=0&inf=0&cabin=M&flex=LOWEST&ond=1
 *
 * PRODUCTION STRATEGY (self-detecting probe, owner standing rule): grant ->
 * availability chain with 3-rung ladder; a tarpit (timeout, 0 bytes) or 403
 * maps to honest ACCESS_CHALLENGE and the probe self-activates on a clean
 * production IP. The availability schema here is bundle-derived, not yet
 * live-validated; the parser is defensive and fails loudly (SCHEMA_MISMATCH)
 * so a prod validation run gives us the exact payload to tighten against.
 */
import { createHash } from 'node:crypto';
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export const BA_AVAILABILITY_API = 'https://www.britishairways.com/api/sc4/badotcomadapter-paa/rs/v1/flightavailability/search';
export const BA_GRANT_API = 'https://www.britishairways.com/api/grant';
export const BA_CABIN_HELPER = (from: string, to: string) =>
  `https://www.britishairways.com/lookup/jsonp/cabinHelper/getCabinsForRoute/${to}/${from}/en`;
export const BA_FLIGHTLIST = 'https://www.britishairways.com/travel/book/public/en_gb/flightList';

/** Deobfuscated generateIntegrityTokenV1: base64(hex(sha256(date.toUpperCase()+origin.toUpperCase()+destination))). */
export function baIntegrityToken(dep: string, from: string, to: string): string {
  const raw = `${dep.toUpperCase()}${from.toUpperCase()}${to}`;
  const hex = createHash('sha256').update(raw).digest('hex');
  return Buffer.from(hex, 'hex').toString('base64');
}

/** Exact live-observed flight-list deeplink. */
export function baDeeplink(from: string, to: string, dep: string): string {
  return `${BA_FLIGHTLIST}?onds=${from}-${to}_${dep}&ad=1&yad=0&ch=0&inf=0&cabin=M&flex=LOWEST&ond=1`;
}

/** Exact availability POST body from the bundle's getAvailability(). */
export function baAvailabilityBody(from: string, to: string, dep: string): Record<string, unknown> {
  return {
    ondSearches: [{ originLocationCode: from, destinationLocationCode: to, departureDate: dep }],
    cabin: 'M',
    ticketFlexibility: 'LOWEST',
    passengerMix: { adultCount: 1, youngAdultCount: 0, childCount: 0, infantCount: 0 },
    cug: false,
    includeCalendar: true,
    calendarDays: 3,
    baIntegrityTokenV1: baIntegrityToken(dep, from, to),
  };
}

/** Availability URL with the ondwanted suffix exactly as the SPA builds it. */
export function baAvailabilityUrl(from: string, to: string, dep: string): string {
  return `${BA_AVAILABILITY_API};ondwanted=1?metasearchdata=${from}_${to}_${dep}`;
}

/** Parse the cabinHelper reply (open endpoint). */
export function parseBaCabinHelper(body: string): Record<string, string> {
  try { return JSON.parse(body)?.reply || {}; } catch { return {}; }
}

export interface BaFlight {
  flightNumber: string;      // BA142
  depTime: string;
  arrTime: string;
  depIso: string;
  arrIso: string;
  stops: number;
  price: number;              // lowest journey price (excl. taxes - BA UI disclaimer)
  currency: string;
  cabin: string;              // Economy / Premium Economy / Business/Club / First
}

const isoTime = (iso: string) => (iso || '').slice(11, 16);

/**
 * Defensive parse of the PAA availability response. Schema is bundle-derived
 * (availabilityData[].availableOptions[].flightEvents / availableCabinsForOption);
 * if BA's live payload differs, this throws 'SCHEMA_MISMATCH' loudly so the
 * prod validation run surfaces the real shape.
 */
export function parseBaAvailability(body: string): BaFlight[] {
  let d: any;
  try { d = JSON.parse(body); } catch { throw new Error('SCHEMA_MISMATCH: not JSON'); }
  const ond = Array.isArray(d?.availabilityData) ? d.availabilityData[0] : d;
  const options = ond?.availableOptions;
  if (!Array.isArray(options) || !options.length) {
    throw new Error('SCHEMA_MISMATCH: availabilityData[].availableOptions missing');
  }
  const out: BaFlight[] = [];
  for (const opt of options) {
    const events = opt?.flightEvents;
    if (!Array.isArray(events) || !events.length) continue;
    const first = events[0];
    const last = events[events.length - 1];
    const fn = `${first.marketingCarrierCode || first.marketingCarrier?.carrierCode || ''}${first.marketingFlightNumber || first.marketingCarrier?.flightNumber || ''}`;
    // cheapest available cabin
    const cabins = Array.isArray(opt.availableCabinsForOption) ? opt.availableCabinsForOption : [];
    const priced = cabins
      .filter((c: any) => !c.isNotAvailable && typeof c?.cabinPrice?.lowestJourneyPrice === 'number')
      .sort((a: any, b: any) => a.cabinPrice.lowestJourneyPrice - b.cabinPrice.lowestJourneyPrice);
    const best = priced[0];
    if (!fn || !best) continue;
    const price = best.cabinPrice.lowestJourneyPriceRounded || Math.ceil(best.cabinPrice.lowestJourneyPrice);
    const key = `${fn}-${isoTime(first.departureDateTime || '')}`;
    if (out.some(o => `${o.flightNumber}-${o.depTime}` === key)) continue;
    out.push({
      flightNumber: fn,
      depTime: isoTime(first.departureDateTime || ''),
      arrTime: isoTime(last.arrivalDateTime || ''),
      depIso: first.departureDateTime || '',
      arrIso: last.arrivalDateTime || '',
      stops: Math.max(0, events.length - 1),
      price,
      currency: best.cabinPrice.currencyCode || best.fareCurrency || 'GBP',
      cabin: best.dominantFareName || best.dominantFareType || '',
    });
  }
  if (!out.length) throw new Error('SCHEMA_MISMATCH: no priced flight options decoded');
  return out;
}

/** Rows for the search index. Prices are EXCL. taxes (BA flight-list disclaimer). */
export function baFlightItems(flights: BaFlight[], source: SourceConfig, fromCity: string, toCity: string, fromCode: string, toCode: string, dep: string): RawSourceItem[] {
  const today = new Date().toISOString().slice(0, 10);
  return flights.map(o => newRawItem(source, {
    title: `British Airways ${o.flightNumber} ${fromCity} → ${toCity} ${o.depTime}–${o.arrTime} · ${o.currency} ${o.price.toLocaleString('en-IN')}`,
    brand: 'British Airways',
    price: o.price,
    currency: o.currency,
    seller: 'British Airways',
    sellerUrl: baDeeplink(fromCode, toCode, dep),
    travel: { route: `${fromCity.toLowerCase()} to ${toCity.toLowerCase()}`, date: dep },
    attributes: {
      route: `${fromCity} → ${toCity}`,
      airline: 'British Airways',
      flight_number: o.flightNumber,
      travel_date: dep,
      departure_date: dep,
      departs: o.depTime,
      arrives: o.arrTime,
      duration: '',
      stops: o.stops === 0 ? 'non-stop' : `${o.stops} stop${o.stops > 1 ? 's' : ''}`,
      fare_class: (o.cabin || 'economy').toLowerCase(),
      price_basis: `British Airways live ${o.cabin || 'fare'} base fare (EXCLUDES taxes/fees/carrier charges) for 1 adult on ${dep} captured ${today}`,
      data_note: 'Live per-flight data from British Airways\' own booking engine (badotcomadapter-paa availability API). BA displays base fares excluding taxes on its flight list.',
      image: '',
    },
    identifiers: { sku: `ba-${o.flightNumber}-${dep}` },
    evidence: {
      sourceUrl: BA_AVAILABILITY_API,
      extractedFields: ['availabilityData[].availableOptions[].flightEvents', 'availableCabinsForOption[].cabinPrice.lowestJourneyPrice'],
    },
  }));
}
