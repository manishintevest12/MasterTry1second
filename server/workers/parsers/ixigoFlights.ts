/**
 * Ixigo flights parser — flights vertical.
 *
 * https://www.ixigo.com/search/flight/{from}/{to}/{YYYY-MM-DD}/1/0
 * (city names or IATA codes both work; ixigo redirects to the canonical
 * route page) is a Next.js SSR page. __NEXT_DATA__ →
 * props.pageProps.cheapFlightsData[] ships up to 100 REAL flight entries
 * for the search date: airline, flightNumber ("BLR-DEL-AI2414" — route
 * prefix stripped), fare (INR total), departure/arrival time, duration
 * (minutes), numOfStops. pageProps.searchFormParams carries the resolved
 * origin/destination airports for evidence.
 *
 * No browser automation — pure curl_cffi (chrome impersonation) + JSON.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export const IXIGO_WEB = 'https://www.ixigo.com';

export interface IxigoFlight {
  airline: string;
  airlineCode: string | null;
  flightNumber: string | null;
  fare: number;
  departureDate: string;
  departureTime: string | null;
  arrivalDate: string | null;
  arrivalTime: string | null;
  durationMinutes: number | null;
  stops: number | null;
}

export function parseIxigoFlights(nextData: any): IxigoFlight[] {
  const entries = nextData?.props?.pageProps?.cheapFlightsData;
  if (!Array.isArray(entries)) return [];
  const flights: IxigoFlight[] = [];
  for (const e of entries) {
    const airline = String(e.airline || '').trim();
    const fare = Number(e.fare);
    if (!airline || !Number.isFinite(fare) || fare <= 0) continue; // never publish an unseen price
    // "BLR-DEL-AI2414" → "AI2414"; already-clean codes pass through.
    let fn = String(e.flightNumber || '').trim();
    fn = fn.replace(/^[A-Z]{3}-[A-Z]{3}-/, '');
    let duration: number | null = null;
    const dur = parseInt(String(e.duration ?? ''), 10);
    if (Number.isFinite(dur) && dur > 0) duration = dur;
    flights.push({
      airline,
      airlineCode: e.airlineCode ? String(e.airlineCode) : null,
      flightNumber: fn || null,
      fare: Math.round(fare),
      departureDate: String(e.departure_date || e.date || ''),
      departureTime: e.departure_time ? String(e.departure_time) : null,
      arrivalDate: e.arrival_date ? String(e.arrival_date) : null,
      arrivalTime: e.arrival_time ? String(e.arrival_time) : null,
      durationMinutes: duration,
      stops: Number.isFinite(Number(e.numOfStops)) ? Number(e.numOfStops) : null,
    });
  }
  return flights;
}

export function parseIxigoOffers(
  flights: IxigoFlight[],
  source: SourceConfig,
  from: string,
  to: string,
  date: string,
): RawSourceItem[] {
  const out: RawSourceItem[] = [];
  const seen = new Set<string>();
  for (const f of flights.slice(0, 40)) {
    if (!f.flightNumber) continue;
    const key = `${f.airlineCode || f.airline}|${f.flightNumber}|${f.departureTime}`;
    if (seen.has(key)) continue; // one offer per real flight number
    seen.add(key);
    const attrs: Record<string, any> = {
      airline: f.airline,
      airline_code: f.airlineCode,
      flight_number: f.flightNumber,
      departure_date: f.departureDate,
      departure_time: f.departureTime,
      arrival_date: f.arrivalDate,
      arrival_time: f.arrivalTime,
      duration_minutes: f.durationMinutes,
      stops: f.stops,
      route: `${from} → ${to}`,
      price_basis: 'total one-way fare for 1 adult (economy)',
      data_note: 'Live fares from Ixigo flight search results',
    };
    out.push(newRawItem(source, {
      title: `${f.airline} ${f.flightNumber} · ${from} → ${to}`,
      seller: 'Ixigo',
      sellerUrl: `${IXIGO_WEB}/search/flight/${encodeURIComponent(from.toLowerCase())}/${encodeURIComponent(to.toLowerCase())}/${date}/1/0`, // redirect only to the site that owns the price
      currency: 'INR',
      price: f.fare,
      travel: { route: `${from} to ${to}`.toLowerCase(), date, seatType: 'economy' },
      attributes: attrs,
      evidence: {
        sourceUrl: `${IXIGO_WEB}/search/flight/`,
        sourceReference: f.flightNumber,
        extractedFields: ['title', 'price', 'airline', 'flight_number', 'departure_time', 'arrival_time', 'duration', 'stops'],
      },
    }));
  }
  return out;
}
