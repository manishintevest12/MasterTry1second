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
  /** Parsed legs of the itinerary token ("IDR-JAI-6E7136*JAI-DEL-6E6492"). */
  legs: Array<{ from: string; to: string; flightNo: string }>;
}

/**
 * Owner 24 Oct ("ixigo hr location ka result dikhata hai"): every
 * cheapFlightsData entry's flightNumber is a full itinerary token
 * "ORIG-DEST-FLNO" joined by '*' per leg — e.g. "IDR-DEL-6E6627" (direct)
 * or "IDR-JAI-6E7136*JAI-DEL-6E6492" (Indore->Jaipur->Delhi). The old parser
 * stripped only the FIRST leg prefix, so connecting itineraries surfaced as
 * "6E7136*JAI-DEL-6E6492" — tokens of OTHER legs (AMD/BOM/PNQ) that read like
 * wrong-route results. Legs keep the full picture; the route guard below
 * skips any entry that does not actually start at the searched origin and
 * end at the searched destination.
 */
export function ixigoLegs(fn: string): Array<{ from: string; to: string; flightNo: string }> {
  const segs = String(fn || '').split('*').map((x) => x.trim()).filter(Boolean);
  const legs: Array<{ from: string; to: string; flightNo: string }> = [];
  for (const seg of segs) {
    const m = seg.match(/^([A-Z]{3})-([A-Z]{3})-(.+)$/);
    if (!m) return [];
    legs.push({ from: m[1], to: m[2], flightNo: m[3] });
  }
  return legs;
}

/** DD-MM-YYYY (Ixigo's block format) -> ISO YYYY-MM-DD, or '' when unparsable. */
export function ixigoIsoDate(d: string): string {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(d || '').trim());
  if (!m) return /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) ? String(d).trim() : '';
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function parseIxigoFlights(
  nextData: any,
  /** Route guard (owner 24 Oct): the entry itinerary must really run from -> to. */
  fromCode?: string,
  toCode?: string,
): IxigoFlight[] {
  const entries = nextData?.props?.pageProps?.cheapFlightsData;
  if (!Array.isArray(entries)) return [];
  const flights: IxigoFlight[] = [];
  for (const e of entries) {
    const airline = String(e.airline || '').trim();
    const fare = Number(e.fare);
    if (!airline || !Number.isFinite(fare) || fare <= 0) continue; // never publish an unseen price
    const legs = ixigoLegs(String(e.flightNumber || ''));
    if (!legs.length) continue; // not an ORIG-DEST-FLNO token we can verify
    // Route guard: first leg must depart the searched origin and the last leg
    // must land at the searched destination. Anything else is a different
    // route's inventory (owner 24 Oct: never show another location's flight).
    if (fromCode && legs[0].from !== fromCode.toUpperCase()) continue;
    if (toCode && legs[legs.length - 1].to !== toCode.toUpperCase()) continue;
    // Display flight number(s): joined numbers per leg for connections.
    const fn = legs.map((l) => l.flightNo).join('+');
    let duration: number | null = null;
    const dur = parseInt(String(e.duration ?? ''), 10);
    if (Number.isFinite(dur) && dur > 0) duration = dur;
    flights.push({
      airline,
      airlineCode: e.airlineCode ? String(e.airlineCode) : null,
      flightNumber: fn,
      fare: Math.round(fare),
      // ISO dates (owner 24 Oct): the old DD-MM-YYYY strings broke the
      // flight-number+time compare grouping against other sellers' ISO dates.
      departureDate: ixigoIsoDate(String(e.departure_date || e.date || '')),
      departureTime: e.departure_time ? String(e.departure_time) : null,
      arrivalDate: e.arrival_date ? ixigoIsoDate(String(e.arrival_date)) : null,
      arrivalTime: e.arrival_time ? String(e.arrival_time) : null,
      durationMinutes: duration,
      stops: Number.isFinite(Number(e.numOfStops)) ? Number(e.numOfStops) : null,
      legs,
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
  /** city->IATA map (airportLookup.IATA) for readable via labels. */
  iata: Record<string, string> = {},
): RawSourceItem[] {
  // Seller = Ixigo — the website SELLING the ticket (owner policy 15 Oct: the
  // seller shown is the ticket-selling site, never the operating airline).
  // Deeplink = Ixigo's own search-results page for this exact route+date.
  const cityOfCode = new Map<string, string>();
  for (const [city, code] of Object.entries(iata)) {
    if (!cityOfCode.has(code)) cityOfCode.set(code, city.replace(/\b\w/g, (c) => c.toUpperCase()));
  }
  const out: RawSourceItem[] = [];
  const seen = new Set<string>();
  const bestFare = new Map<string, number>();
  for (const f of flights) {
    if (!f.flightNumber) continue;
    const key = `${f.airlineCode || f.airline}|${f.flightNumber}|${f.departureTime}`;
    // one offer per real itinerary, CHEAPEST observed fare wins
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
    const isMulti = f.legs.length > 1;
    // Owner 24 Oct title fix: connecting itineraries used to surface as
    // "6E7136*JAI-DEL-6E6492" (stripped first leg — read like a wrong-route
    // flight). Now: "IndiGo 6E7136 + 6E6492 via Jaipur · Indore → Delhi (1 stop)".
    const viaCities = f.legs.slice(0, -1).map((l) => cityOfCode.get(l.to) || l.to);
    const viaLabel = isMulti ? ` via ${viaCities.join(', ')}` : '';
    const stopsLabel = isMulti ? ` (${Math.max(1, f.legs.length - 1)} stop${f.legs.length > 2 ? 's' : ''})` : '';
    // Honest date (owner 24 Oct): Ixigo's block serves its own service date,
    // which may differ from the requested one — the row carries the REAL
    // departure date and labels the difference, never a requested-date claim.
    const actualDate = f.departureDate || date;
    const dateNote = actualDate && date && actualDate !== date
      ? ` Ixigo published fares for its own service date ${actualDate}; the searched date was ${date} — verify the date on Ixigo's page.`
      : '';
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
      data_note: `Fare observed via Ixigo at ${new Date().toISOString().slice(0, 16)}Z; the ticket is SOLD by Ixigo (seller), operating carrier ${f.airline}. Price may change at checkout.${dateNote}`,
    };
    if (isMulti) {
      attrs.itinerary = f.legs.map((l) => `${l.from}-${l.to} ${l.flightNo}`).join(' * ');
      attrs.via = viaCities.join(', ');
    }
    out.push(newRawItem(source, {
      title: `${f.airline} ${f.legs.map((l) => l.flightNo).join(' + ')}${viaLabel} · ${from} → ${to}${stopsLabel}`,
      seller: 'Ixigo',
      sellerUrl: listingUrl, // deeplink to Ixigo's own SRP for this exact route/date
      currency: 'INR',
      price: bestFare.get(key)!,
      travel: { route: `${from} to ${to}`.toLowerCase(), date: actualDate, seatType: 'economy' },
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
