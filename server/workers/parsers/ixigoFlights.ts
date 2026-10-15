/**
 * Ixigo flights parser — flights vertical. (owner policy, 13 Oct 2026)
 *
 * Ixigo is itself a metasearch like Try1Second, so it is used as an ACQUISITION
 * PROVIDER only: __NEXT_DATA__ cheapFlightsData gives real fares, but the SELLER
 * surfaced to the user is the AIRLINE that operates the flight (IndiGo, Air
 * India, ...) and the deeplink goes to the AIRLINE'S OWN website — never to
 * Ixigo. The fare's provenance is credited honestly in attributes.data_note.
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

/**
 * Ixigo route slug tokens: IATA codes always resolve; city-name slugs must be
 * underscore-joined ("new delhi" as %20 or space 404s — verified 14 Oct 2026).
 * Fallback order: IATA -> underscored city -> hyphenated city.
 */
export function ixigoRouteTokens(
  from: string, to: string,
  fromCode?: string, toCode?: string,
  iata: Record<string, string> = {},
): { fromTok: string; toTok: string; alts: string[] } {
  const iataOf = (city: string, code?: string) =>
    (code && /^[A-Z]{3}$/.test(code) ? code.toUpperCase() : iata[city.toLowerCase().trim()] || null);
  const slug = (city: string) => city.toLowerCase().trim().replace(/\s+/g, '_');
  const fromTok = iataOf(from, fromCode) || slug(from);
  const toTok = iataOf(to, toCode) || slug(to);
  const alts: string[] = [];
  const altIata = iataOf(from, fromCode);
  if (altIata && altIata !== fromTok) alts.push(altIata); // underscore city used, IATA retry
  if (altIata) alts.push(slug(from));
  if (fromTok.includes('_')) alts.push(fromTok.replace(/_/g, '-'));
  return { fromTok, toTok, alts };
}

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
  listingUrl = `${IXIGO_WEB}/search/flight/`,  // Ixigo SRP for this exact route/date
): RawSourceItem[] {
  // Seller = Ixigo — the website SELLING the ticket (owner policy 15 Oct: the
  // seller shown is the ticket-selling site, never the operating airline).
  // Deeplink = Ixigo's own search-results page for this exact route+date.
  const out: RawSourceItem[] = [];
  const seen = new Set<string>();
  const bestFare = new Map<string, number>();
  for (const f of flights) {
    if (!f.flightNumber) continue;
    const key = `${f.airlineCode || f.airline}|${f.flightNumber}|${f.departureTime}`;
    // one offer per real flight number, CHEAPEST observed fare wins
    if (!bestFare.has(key) || f.fare < bestFare.get(key)!) {
      bestFare.set(key, f.fare);
      if (!seen.has(key)) seen.add(key);
    }
  }
  for (const f of flights) {
    if (!f.flightNumber) continue;
    const key = `${f.airlineCode || f.airline}|${f.flightNumber}|${f.departureTime}`;
    if (!seen.has(key)) continue;
    seen.delete(key); // emit once
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
      price_basis: 'cheapest observed total one-way fare for 1 adult (economy)',
      data_note: `Fare observed via Ixigo at ${new Date().toISOString().slice(0, 16)}Z; the ticket is SOLD by Ixigo (seller), operating carrier ${f.airline}. Price may change at checkout.`,
    };
    out.push(newRawItem(source, {
      title: `${f.airline} ${f.flightNumber} · ${from} → ${to}`,
      seller: 'Ixigo',
      sellerUrl: listingUrl, // deeplink to Ixigo's own SRP for this exact route/date
      currency: 'INR',
      price: bestFare.get(key)!,
      travel: { route: `${from} to ${to}`.toLowerCase(), date, seatType: 'economy' },
      attributes: attrs,
      evidence: {
        sourceUrl: `${IXIGO_WEB}/search/flight/`,
        sourceReference: f.flightNumber,
        extractedFields: ['title', 'price', 'airline', 'flight_number', 'departure_time', 'arrival_time', 'duration', 'stops'],
      },
    }));
  }
  return out.slice(0, 60);
}
