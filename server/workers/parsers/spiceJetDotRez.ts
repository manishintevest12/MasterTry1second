/**
 * SpiceJet dotREZ (Navitaire) fare-calendar + availability parser
 * (24 Oct 2026 browser-assisted discovery, browserless production recipe).
 *
 * www.spicejet.com runs a Navitaire dotREZ backend behind an Angular SPA.
 * The XHRs the search page fires are replayable browserless with curl_cffi
 * once the FULL Chrome header set is present (the edge 403s minimal header
 * sets — `os`, `sec-fetch-*`, `priority` and a cookie are all required).
 *
 *   1. POST https://www.spicejet.com/api/v1/token
 *      headers: content-type: application/json, os: web, authorization: "null"
 *      -> { data: { token: <JWT>, userRoleCode: "MWEB" } }   (fresh dotREZ NSK
 *         token per call, idle timeout 10 min; cached ~8 min here)
 *
 *   2. POST https://www.spicejet.com/api/v2/search/lowfare
 *      { pax: { journeyClass: "ff", adult: 1, child: 0, infant: 0, srCitizen: 0 },
 *        codes: { currency: "INR" }, origin, destination, centerDate }
 *      -> { data: { lowFareDateMarkets: [ { lowestFareAmount:
 *           { fareAmount, farePointAmount, taxesAndFeesAmount }, departureDate,
 *           departureDateToShow, ... } ] } }   (~7-day window around centerDate)
 *
 *   3. POST https://www.spicejet.com/api/v3/search/availability  (metadata)
 *      { destinationStationCode, originStationCode, onWardDate, currency: "INR",
 *        pax: {...} }
 *      -> { data: { trips: [ { journeysAvailable: [ { carrierString:
 *           "SG 612", designator: { arrival, departure, ... }, flightDuration,
 *           departureTime, arrivalTime, fares } ] } ] } }
 *      Prices are NOT in the availability payload (they arrive at commit
 *      time); it is used only for honest flight-number/time metadata.
 *
 * Verified live browserless from the sandbox (24 Oct 2026): DEL-BOM 28 Oct
 * lowfare returned a 7-day calendar (25 Oct ₹6,299 total incl. taxes up) and
 * availability returned SG 612 DEL 19:20 → BOM 21:40, 2h 20m.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export const SJ_API_BASE = 'https://www.spicejet.com';

/** UA + header set the edge demands (a minimal set is 403'd by the WAF). */
export function spiceJetBaseHeaders(authorization: string, referer: string): Record<string, string> {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'content-type': 'application/json',
    os: 'web',
    authorization,
    accept: '*/*',
    'accept-language': 'en-US,en;q=0.9',
    'accept-encoding': 'gzip, deflate, br, zstd',
    referer,
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    priority: 'u=1, i',
    // CleverTap web cookie the SPA always carries; the edge rejects cookieless search POSTs.
    cookie: 'WZRK_G=5e7907422c4f40edb3a313c5a70eedd2',
  };
}

export function spiceJetTokenHeaders(): Record<string, string> {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'content-type': 'application/json',
    os: 'web',
    authorization: 'null',
    accept: '*/*',
    'accept-language': 'en-US,en;q=0.9',
    referer: 'https://www.spicejet.com/',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    cookie: 'WZRK_G=5e7907422c4f40edb3a313c5a70eedd2',
  };
}

export function spiceJetLowFareBody(origin: string, destination: string, centerDate: string): string {
  return JSON.stringify({
    pax: { journeyClass: 'ff', adult: 1, child: 0, infant: 0, srCitizen: 0 },
    codes: { currency: 'INR' },
    origin,
    destination,
    centerDate,
  });
}

export function spiceJetAvailabilityBody(origin: string, destination: string, onWardDate: string): string {
  return JSON.stringify({
    destinationStationCode: destination,
    originStationCode: origin,
    onWardDate,
    currency: 'INR',
    pax: { journeyClass: 'ff', adult: 1, child: 0, infant: 0, srCitizen: 0 },
  });
}

/** SRP deeplink (SPA's own makeSearchParams pattern, 24 Oct). */
export function spiceJetSearchUrl(fromCode: string, toCode: string, depIso: string): string {
  return `https://www.spicejet.com/search?from=${fromCode}&to=${toCode}&tripType=1&departure=${depIso}&adult=1&child=0&srCitizen=0&infant=0&currency=INR`;
}

export interface SjDayFare {
  /** ISO date YYYY-MM-DD (from "YYYY-MM-DDT00:00:00"). */
  dt: string;
  /** Total published fare: fareAmount + farePointAmount + taxesAndFeesAmount. */
  pr: number;
  /** Base fare component, when present. */
  fare?: number;
  /** Taxes+fees component, when present. */
  taxes?: number;
}

/** Parse the lowFareDateMarkets calendar into honest per-date totals. */
export function parseSpiceJetLowFare(body: string): SjDayFare[] {
  let d: any;
  try {
    d = JSON.parse(body);
  } catch {
    return [];
  }
  const rows = d?.data?.lowFareDateMarkets;
  if (!Array.isArray(rows)) return [];
  const out: SjDayFare[] = [];
  for (const row of rows) {
    const dt = String(row?.departureDate || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dt)) continue;
    const amt = row?.lowestFareAmount || {};
    const fare = Number(amt?.fareAmount);
    const points = Number(amt?.farePointAmount);
    const taxes = Number(amt?.taxesAndFeesAmount);
    const total = fare + (Number.isFinite(points) ? points : 0) + (Number.isFinite(taxes) ? taxes : 0);
    if (!Number.isFinite(fare) || fare <= 0 || !Number.isFinite(total) || total <= 0) continue;
    out.push({
      dt,
      pr: Math.round(total),
      fare: Math.round(fare),
      taxes: Number.isFinite(taxes) ? Math.round(taxes) : undefined,
    });
  }
  return out;
}

export interface SjJourney {
  /** e.g. "SG 612". */
  carrier: string;
  /** ISO datetime. */
  departure: string;
  arrival: string;
  /** e.g. "2h 20m". */
  duration?: string;
  /** Cheap remaining seats on the lowest fare class (availability, not price). */
  seatsAvailable?: number;
}

/** Parse availability journeys for flight-number/time metadata (no prices). */
export function parseSpiceJetAvailability(body: string): SjJourney[] {
  let d: any;
  try {
    d = JSON.parse(body);
  } catch {
    return [];
  }
  const trips = d?.data?.trips;
  if (!Array.isArray(trips)) return [];
  const out: SjJourney[] = [];
  for (const trip of trips) {
    const journeys = trip?.journeysAvailable;
    if (!Array.isArray(journeys)) continue;
    for (const j of journeys) {
      const des = j?.designator || {};
      const carrier = String(j?.carrierString || '').trim();
      const departure = String(des?.departure || '');
      const arrival = String(des?.arrival || '');
      if (!carrier || !/^\d{4}-\d{2}-\d{2}T/.test(departure)) continue;
      let seats: number | undefined;
      const fares = j?.fares;
      if (fares && typeof fares === 'object') {
        const counts = Object.values(fares).map((f: any) => Number(f?.availableCount)).filter((n) => Number.isFinite(n));
        if (counts.length) seats = Math.min(...counts);
      }
      out.push({
        carrier,
        departure,
        arrival,
        duration: j?.flightDuration ? String(j.flightDuration) : undefined,
        seatsAvailable: seats,
      });
    }
  }
  return out;
}

/**
 * Emit ONE honest offer (MMT/Via/Akasa/AIX fare-calendar pattern): the exact
 * depart date's calendar fare when SpiceJet publishes one, else the cheapest
 * upcoming date (clearly labelled). Enriched with real flight metadata from
 * the availability endpoint when the chosen date matches it. Seller and
 * carrier are the same (airline's own site), per the owner seller+airline rule.
 */
export function spiceJetDayFareItems(
  fares: SjDayFare[],
  journeys: SjJourney[],
  source: SourceConfig,
  fromCity: string,
  toCity: string,
  fromCode: string,
  toCode: string,
  depIso: string,
): RawSourceItem[] {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = [...fares].filter((f) => f.dt >= today).sort((a, b) => a.pr - b.pr);
  const exact = upcoming.find((f) => f.dt === depIso);
  const chosen = exact || upcoming[0];
  if (!chosen) return [];
  const isExact = Boolean(exact);
  const routeLabel = `${fromCity} → ${toCity}`;
  // Real flight metadata for the chosen date, if availability reported it.
  const j = journeys.find((x) => x.departure.slice(0, 10) === chosen.dt);
  const meta = j
    ? ` First flight: ${j.carrier}, departs ${j.departure.slice(11, 16)}${j.duration ? `, duration ${j.duration}` : ''}${j.seatsAvailable !== undefined ? `, lowest-fare seats reported: ${j.seatsAvailable}` : ''}.`
    : '';
  const taxesNote = chosen.taxes !== undefined ? ` (taxes+fees component ₹${chosen.taxes})` : '';
  return [newRawItem(source, {
    title: `SpiceJet ${routeLabel} ${isExact ? `on ${chosen.dt}` : `(cheapest upcoming, ${chosen.dt})`} from ₹${chosen.pr}`,
    brand: 'SpiceJet',
    price: chosen.pr,
    currency: 'INR',
    seller: 'SpiceJet',
    sellerUrl: spiceJetSearchUrl(fromCode, toCode, chosen.dt),
    travel: { route: `${fromCity.toLowerCase()} to ${toCity.toLowerCase()}`, date: chosen.dt },
    attributes: {
      route: routeLabel,
      travel_date: chosen.dt,
      departure_date: chosen.dt,
      airline: 'SpiceJet',
      ...(j ? { flight_number: j.carrier, departure_time: j.departure.slice(11, 16), arrival_time: j.arrival.slice(11, 16), flight_duration: j.duration || '' } : {}),
      fare_detail: `lowest SpiceJet economy fare (incl. taxes) published on the airline's own fare calendar for ${chosen.dt}${taxesNote}`,
      fare_class: 'lowest economy fare on SpiceJet\'s own fare calendar',
      price_basis: `SpiceJet dotREZ API price for this route${isExact ? ' and date' : ' within the returned calendar window'} on ${today}`,
      data_note: `Fare acquired from SpiceJet's own API on ${today}.${meta || ' Flight numbers/times for this date were not returned; booking continues on the airline\'s own website.'}`,
      image: '',
    },
    identifiers: { sku: `spicejet-${fromCode}-${toCode}-${chosen.dt}` },
    evidence: {
      sourceUrl: `${SJ_API_BASE}/api/v2/search/lowfare`,
      extractedFields: ['lowFareDateMarkets[].lowestFareAmount.fareAmount', 'taxesAndFeesAmount', 'departureDate', 'journeysAvailable[].carrierString'],
    },
  })];
}
