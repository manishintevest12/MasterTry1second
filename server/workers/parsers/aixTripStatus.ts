/**
 * Air India Express (AIX) flight-schedule parser (24 Oct 2026 discovery).
 *
 * The airline's PUBLIC flight-status page (www.airindiaexpress.com/flight-status)
 * lets a visitor search by origin+destination+date, and the page's backing API
 * is fully OPEN browserless — no guest JWT, no reCAPTCHA, no Akamai sensor:
 *
 *   POST https://api.airindiaexpress.com/b2c-flightstatus/v2/flight/trip-status
 *   { "beginDate": "2026-10-28", "identifier": "", "carrierCode": "IX",
 *     "originStations": ["DEL"], "destinationStations": ["BOM"] }
 *   headers: same public web subscription key as the fare calendar
 *            (Ocp-Apim-Subscription-Key: fe65..., client-id: AIRASIA-WEB-APP)
 *
 * Returns per-flight SCHEDULE rows (verified live 24 Oct, DEL-BOM 28 Oct):
 *   [ { "status": "success", "data": [ { "flightNumber": "IX1056",
 *       "flightDateLocal": "2026-10-28T00:00:00.000Z",
 *       "originalDepartureTime": "2026-10-28T08:50:00",   (local, no offset)
 *       "originalArrivalTime":   "2026-10-28T11:15:00",
 *       "flyDurationInSecs": "8700",
 *       "scheduledDeparture": { "airportCode": "DEL", "airportCity": "New Delhi", ... },
 *       "scheduledArrival":   { "airportCode": "BOM", "airportCity": "Mumbai", ... },
 *       "flightGenericStatus": "Yet to depart", ... } ] } ]
 *
 * This closes the gap the owner reported (24 Oct): the fare-calendar API (see
 * aixLowFares.ts) publishes only DATE-level fares with no flight numbers or
 * times, and the per-flight fsa endpoint is reCAPTCHA/rate-limit gated.
 * trip-status + lowFares together give honest per-flight cards:
 * flight number, departure/arrival times, duration and the day's published
 * fare — clearly labelled that the per-flight booking fare may differ slightly
 * (fare rules are per date; the calendar shows the date's lowest fare).
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';
import { AIX_API_BASE, AIX_SUBSCRIPTION_KEY, aixSearchUrl } from './aixLowFares';

export interface AixScheduledFlight {
  /** e.g. "IX1056". */
  flightNo: string;
  /** Local departure date the flight operates (YYYY-MM-DD, from flightDateLocal). */
  dateIso: string;
  /** Local departure time HH:MM (from originalDepartureTime). */
  depTime: string;
  /** Local arrival time HH:MM (from originalArrivalTime). */
  arrTime: string;
  /** Block time in minutes (from flyDurationInSecs). */
  durationMin: number;
  /** Origin airport IATA (from scheduledDeparture.airportCode). */
  fromCode: string;
  /** Destination airport IATA (from scheduledArrival.airportCode). */
  toCode: string;
}

export function aixTripStatusUrl(): string {
  return `${AIX_API_BASE}/b2c-flightstatus/v2/flight/trip-status`;
}

export function aixTripStatusHeaders(): Record<string, string> {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'Ocp-Apim-Subscription-Key': AIX_SUBSCRIPTION_KEY,
    'client-id': 'AIRASIA-WEB-APP',
    'referring-client': 'https://www.airindiaexpress.com',
    Origin: 'https://www.airindiaexpress.com',
    Referer: 'https://www.airindiaexpress.com/flight-status',
  };
}

export function aixTripStatusBody(origin: string, destination: string, beginDate: string): string {
  return JSON.stringify({
    beginDate,
    identifier: '',
    carrierCode: 'IX',
    originStations: [origin],
    destinationStations: [destination],
  });
}

/** "2026-10-28T08:50:00" (or "...T08:50:00.000") -> "08:50". Returns "" when absent. */
function localHm(iso: unknown): string {
  const s = String(iso || '');
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(s);
  return m ? `${m[2]}:${m[3]}` : '';
}

/** Parse a trip-status body into per-flight schedule rows for the wanted date. */
export function parseAixTripStatus(body: string, wantDateIso: string): AixScheduledFlight[] {
  let d: any;
  try {
    d = JSON.parse(body);
  } catch {
    return [];
  }
  // The endpoint answers with an array of {status, message, data: [...]}; a
  // non-array (or empty) body simply means no published schedule — never a
  // crash, and never an invented flight.
  const envelopes = Array.isArray(d) ? d : [d];
  const out: AixScheduledFlight[] = [];
  for (const env of envelopes) {
    const rows = env?.data;
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const flightNo = String(row?.flightNumber || '').trim();
      if (!flightNo) continue;
      const dateIso = String(row?.flightDateLocal || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso) || dateIso !== wantDateIso) continue;
      const depTime = localHm(row?.originalDepartureTime);
      const arrTime = localHm(row?.originalArrivalTime);
      if (!depTime || !arrTime) continue;
      const durSecs = Number(row?.flyDurationInSecs);
      out.push({
        flightNo,
        dateIso,
        depTime,
        arrTime,
        durationMin: Number.isFinite(durSecs) && durSecs > 0 ? Math.round(durSecs / 60) : 0,
        fromCode: String(row?.scheduledDeparture?.airportCode || ''),
        toCode: String(row?.scheduledArrival?.airportCode || ''),
      });
    }
  }
  return out;
}

/**
 * Honest per-flight items (Alliance Air / Via per-flight pattern): each AIX
 * flight operating the route on the requested date gets its own card with
 * the airline's published flight number and schedule times, priced with the
 * fare-calendar fare for that same date. The fare is date-level (the airline
 * publishes per-date lowest fares; per-flight booking fares can differ), and
 * the labels say so explicitly. If the schedule lookup yields nothing, the
 * caller falls back to the plain date-level fare row — no invented times.
 */
export function aixScheduledFareItems(
  flights: AixScheduledFlight[],
  dayFare: { dt: string; pr: number; taxes?: number; available?: number },
  source: SourceConfig,
  fromCity: string,
  toCity: string,
  fromCode: string,
  toCode: string,
): RawSourceItem[] {
  const today = new Date().toISOString().slice(0, 10);
  const routeLabel = `${fromCity} → ${toCity}`;
  const taxesNote = dayFare.taxes !== undefined ? ` (taxes+fees component ₹${dayFare.taxes})` : '';
  const seats = dayFare.available !== undefined ? `, ${dayFare.available} seats reported available that day` : '';
  return flights.map((f) => newRawItem(source, {
    title: `Air India Express ${fromCity} → ${toCity} ${f.dateIso} from ₹${dayFare.pr} (${f.flightNo}, ${f.depTime}–${f.arrTime})`,
    brand: 'Air India Express',
    price: dayFare.pr,
    currency: 'INR',
    seller: 'Air India Express',
    sellerUrl: aixSearchUrl(fromCode, toCode, f.dateIso),
    travel: { route: `${fromCity.toLowerCase()} to ${toCity.toLowerCase()}`, date: f.dateIso },
    attributes: {
      route: routeLabel,
      airline: 'Air India Express',
      travel_date: f.dateIso,
      departure_date: f.dateIso,
      flight_number: f.flightNo,
      departure_time: f.depTime,
      arrival_time: f.arrTime,
      ...(f.durationMin > 0 ? { duration_minutes: String(f.durationMin) } : {}),
      fare_detail: `Air India Express flight ${f.flightNo}, ${fromCode} ${f.depTime} → ${toCode} ${f.arrTime}${f.durationMin > 0 ? `, ${f.durationMin} min block time` : ''}, lowest economy fare published for ${f.dateIso}${taxesNote}`,
      fare_class: 'lowest economy fare on Air India Express\'s own fare calendar (per-flight booking fare may differ)',
      price_basis: `Air India Express fare-calendar price for this route and date, combined with the airline's own flight-status schedule, captured ${today}`,
      data_note: `Fare from the airline's fare-calendar API and schedule from the airline's flight-status API on ${today}${seats}. The fare is the date's lowest published fare; the exact per-flight fare is confirmed on the airline's own website.`,
      image: '',
    },
    identifiers: { sku: `aix-${f.flightNo}-${f.dateIso}-${fromCode}${toCode}`.replace(/\s+/g, '') },
    evidence: {
      sourceUrl: aixTripStatusUrl(),
      extractedFields: ['data[].flightNumber', 'data[].originalDepartureTime', 'data[].originalArrivalTime', 'data[].flyDurationInSecs', 'lowFares[].price (INR)'],
    },
  }));
}
