/**
 * Air India flight-schedule parser (24 Oct 2026 discovery).
 *
 * The airline's PUBLIC "Flight Schedule" page
 * (www.airindia.com/in/en/book/flight-schedule.html — the Angular
 * `airindia_flightschedule` web component) publishes FULL per-flight
 * schedules for ANY route+date (no ±2-day window like the flight-status
 * page), backed by a two-step Azure APIM flow that replays BROWSERLESS:
 *
 *   1) POST https://api.airindia.com/flight-information/v1/auth/token
 *      body "" (empty), headers: Ocp-Apim-Subscription-Key (public DXP key)
 *      -> response header x-access-token: <JWT>. JWT payload carries
 *         { grant, token, iv, iat, exp, aud, iss, sub }.
 *
 *   2) GET  https://api.airindia.com/flight-information/v1/schedules?origin=DEL&destination=BOM&departureDate=2026-10-28
 *      headers: Ocp-Apim-Subscription-Key,
 *               x-access-token: "Bearer <JWT>",
 *               x-signature: sha256hex(queryString + jwtPayload.token + jwtPayload.iv)
 *
 * The signature recipe is lifted verbatim from the component bundle
 * (encryptionService.generateHash: cryptoHash over
 * new TextEncoder().encode(t + r.token + r.iv) with t = the exact query
 * string, r = JSON.parse(atob(jwtPart1))). Verified live browserless from
 * the sandbox 24 Oct 2026: DEL-BOM 28 Oct returned 49 flights with
 * flightNumber, aircraft, local dep/arr times, terminals, stops and
 * operating days (AI 2573 05:30->07:55 A320NEO ... AI 2439 23:00->01:25).
 *
 * This closes the owner's 24 Oct gap (Air India cards had no flight
 * numbers/times because the IBE per-flight chain is Akamai-gated): the
 * fare calendar (airIndiaFares.ts) supplies the date's fare, this parser
 * supplies the airline's own schedule for that exact date.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';
import { AI_SUB_KEY, airIndiaSearchUrl } from './airIndiaFares';
import { createHash } from 'crypto';

export const AI_SCHED_TOKEN_URL = 'https://api.airindia.com/flight-information/v1/auth/token';
export const AI_SCHED_URL = 'https://api.airindia.com/flight-information/v1/schedules';

export function airIndiaSchedHeaders(): Record<string, string> {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'Ocp-Apim-Subscription-Key': AI_SUB_KEY,
    Origin: 'https://www.airindia.com',
    Referer: 'https://www.airindia.com/in/en/book/flight-schedule.html',
  };
}

/** Exact query string the component builds (URLSearchParams insertion order). */
export function airIndiaSchedQuery(origin: string, destination: string, departureDate: string): string {
  return `origin=${origin}&destination=${destination}&departureDate=${departureDate}`;
}

/** sha256hex(qs + jwtPayload.token + jwtPayload.iv) — the bundle's generateHash. */
export function airIndiaSchedSignature(jwt: string, qs: string): string {
  const parts = String(jwt || '').split('.');
  if (parts.length !== 3) return '';
  let payload: any = null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  } catch {
    return '';
  }
  const token = String(payload?.token || '');
  const iv = String(payload?.iv || '');
  return createHash('sha256').update(qs + token + iv, 'utf8').digest('hex');
}

export interface AiScheduledFlight {
  /** "AI2573" (carrierCode + flightNumber). */
  flightNo: string;
  /** Departure date the schedule row is for (YYYY-MM-DD, caller-provided). */
  dateIso: string;
  /** Local departure time HH:MM (from origin.departureLocalTime, +05:30). */
  depTime: string;
  /** Local arrival time HH:MM (from destination.arrivalLocalTime). */
  arrTime: string;
  /** Block time in minutes (entry.duration seconds). */
  durationMin: number;
  /** Airline-reported stops for the itinerary (0 = nonstop). */
  stops: number;
  /** e.g. "AIRBUS A320NEO". */
  aircraft: string;
  /** Departure terminal when published. */
  terminal?: string;
  /** Operating days as published (e.g. ["monday", ...]). */
  operatingDays: string[];
}

/** "2026-10-28T05:30:00.000+05:30" -> "05:30". Returns "" when absent. */
function localHm(iso: unknown): string {
  const m = /T(\d{2}:\d{2})/.exec(String(iso || ''));
  return m ? m[1] : '';
}

/**
 * Parse a schedules body into per-itinerary rows for the wanted date.
 * `data[]` entries are itineraries (connections carry >1 leg in flights[]);
 * only the caller's route is expected (same origin/destination as queried).
 */
export function parseAirIndiaSchedules(body: string, wantDateIso: string): AiScheduledFlight[] {
  let d: any;
  try {
    d = JSON.parse(body);
  } catch {
    return [];
  }
  const entries = Array.isArray(d?.data) ? d.data : [];
  const out: AiScheduledFlight[] = [];
  for (const entry of entries) {
    const legs = entry?.flights;
    if (!Array.isArray(legs) || !legs.length) continue;
    const first = legs[0];
    const last = legs[legs.length - 1];
    const depTime = localHm(first?.origin?.departureLocalTime);
    const arrTime = localHm(last?.destination?.arrivalLocalTime);
    const num = String(first?.flightNumber || '').trim();
    const carrier = String(first?.carrierCode || 'AI');
    if (!depTime || !arrTime || !num) continue;
    // The schedules API answers with the route's whole validity window; only
    // rows whose validity covers the asked date are honest for that date.
    const validity = first?.validityPeriod || {};
    const starts = String(validity.start || '').slice(0, 10);
    const ends = String(validity.end || '').slice(0, 10);
    if (starts && wantDateIso < starts) continue;
    if (ends && wantDateIso > ends) continue;
    if (Array.isArray(first?.operatingDays) && first.operatingDays.length) {
      const dow = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dow[new Date(`${wantDateIso}T12:00:00Z`).getUTCDay()];
      if (!first.operatingDays.map((x: any) => String(x).toLowerCase()).includes(dayName)) continue;
    }
    const durSecs = Number(entry?.duration ?? first?.flightDuration);
    out.push({
      flightNo: `${carrier}${num}`,
      dateIso: wantDateIso,
      depTime,
      arrTime,
      durationMin: Number.isFinite(durSecs) && durSecs > 0 ? Math.round(durSecs / 60) : 0,
      stops: Number(entry?.stops ?? first?.stops ?? 0) || 0,
      aircraft: String(first?.airCraftTypeName || first?.airCraftType || ''),
      terminal: first?.origin?.airportTerminal ? String(first.origin.airportTerminal) : undefined,
      operatingDays: Array.isArray(first?.operatingDays) ? first.operatingDays.map((x: any) => String(x)) : [],
    });
  }
  return out;
}

/**
 * Honest per-flight items (same pattern as the AIX schedule enrichment):
 * each Air India itinerary operating the route on the requested date gets
 * its own card with the airline's published schedule, priced with the
 * fare-calendar fare for that same date. The fare is date-level and the
 * labels say so; a schedule failure never blocks the plain fare row.
 */
export function airIndiaScheduledFareItems(
  flights: AiScheduledFlight[],
  dayFare: { dt: string; pr: number; tax?: number },
  source: SourceConfig,
  fromCity: string,
  toCity: string,
  fromCode: string,
  toCode: string,
): RawSourceItem[] {
  const today = new Date().toISOString().slice(0, 10);
  const routeLabel = `${fromCity} → ${toCity}`;
  const taxNote = dayFare.tax !== undefined ? ` (taxes component ₹${dayFare.tax})` : '';
  return flights.map((f) => newRawItem(source, {
    title: `Air India ${fromCity} → ${toCity} ${f.dateIso} from ₹${dayFare.pr} (${f.flightNo}, ${f.depTime}–${f.arrTime})`,
    brand: 'Air India',
    price: dayFare.pr,
    currency: 'INR',
    seller: 'Air India',
    sellerUrl: airIndiaSearchUrl(fromCode, toCode, f.dateIso),
    travel: { route: `${fromCity.toLowerCase()} to ${toCity.toLowerCase()}`, date: f.dateIso },
    attributes: {
      route: routeLabel,
      airline: 'Air India',
      travel_date: f.dateIso,
      departure_date: f.dateIso,
      flight_number: f.flightNo,
      departure_time: f.depTime,
      arrival_time: f.arrTime,
      ...(f.durationMin > 0 ? { duration_minutes: String(f.durationMin) } : {}),
      ...(f.aircraft ? { aircraft: f.aircraft } : {}),
      ...(f.terminal ? { departure_terminal: f.terminal } : {}),
      stops: String(f.stops),
      fare_detail: `Air India flight ${f.flightNo}${f.aircraft ? `, ${f.aircraft}` : ''}, ${fromCode} ${f.depTime} → ${toCode} ${f.arrTime}${f.stops > 0 ? `, ${f.stops} stop` : ', nonstop'}${f.terminal ? `, Terminal ${f.terminal}` : ''}, lowest economy one-way fare (incl. taxes) published for ${f.dateIso}${taxNote}`,
      fare_class: 'lowest economy one-way fare on Air India\'s own fare calendar (per-flight booking fare may differ)',
      price_basis: `Air India fare-calendar price for this route and date, combined with the airline's own published flight schedule, captured ${today}`,
      data_note: `Fare from Air India's fare-calendar API and schedule from Air India's own flight-schedule API on ${today}. The fare is the date's lowest published one-way fare; the exact per-flight fare is confirmed on the airline's own website.`,
      image: '',
    },
    identifiers: { sku: `airindia-${f.flightNo}-${f.dateIso}-${fromCode}${toCode}`.replace(/\s+/g, '') },
    evidence: {
      sourceUrl: AI_SCHED_URL,
      extractedFields: ['data[].flights[].flightNumber', 'data[].flights[].origin.departureLocalTime', 'data[].flights[].destination.arrivalLocalTime', 'data[].duration (secs)', 'fares[].totalPrice.total (INR)'],
    },
  }));
}
