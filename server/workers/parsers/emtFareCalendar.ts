/**
 * EaseMyTrip fare calendar parser — flights vertical (metasearch acquisition).
 *
 * flightservice-seo.easemytrip.com/EmtAppService/FareCalendar/FillCalendarDataByMonth
 * returns the REAL cheapest per-day fare for a route (bookMsg = fare in INR,
 * AirlineCode = operating carrier). Per metasearch policy, the seller surfaced
 * is the AIRLINE that operates the cheapest flight and the deeplink goes to the
 * airline's own website — never to EaseMyTrip.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

interface EmtCell {
  Date: number;
  Active: string;
  Disabled: string;
  fulDate: string | null;
  bookMsg: string | null;
  AirlineCode: string | null;
}

export interface EmtFare {
  date: string;         // "20/10/2026"
  fare: number;        // INR
  airlineCode: string | null;
}

/** Indian carrier codes mapped to seller name + their OWN website (deeplink target). */
export const EMT_AIRLINES: Record<string, { name: string; url?: string }> = {
  // Indian carriers (deeplink site kept for reference; seller is EaseMyTrip now)
  '6E': { name: 'IndiGo', url: 'https://www.goindigo.in/' },
  QP: { name: 'Akasa Air', url: 'https://www.akasaair.com/' },
  AI: { name: 'Air India', url: 'https://www.airindia.com/' },
  IX: { name: 'Air India Express', url: 'https://www.airindiaexpress.com/' },
  SG: { name: 'SpiceJet', url: 'https://www.spicejet.com/' },
  '9I': { name: 'Alliance Air', url: 'https://www.allianceair.in/' },
  // Major international carriers observed live in EMT's engine (name-only: honest
  // identification; ticket selling happens on EaseMyTrip, the seller).
  EK: { name: 'Emirates' }, QR: { name: 'Qatar Airways' }, EY: { name: 'Etihad Airways' },
  WY: { name: 'Oman Air' }, GF: { name: 'Gulf Air' }, SV: { name: 'Saudia' },
  FZ: { name: 'flydubai' }, G9: { name: 'Air Arabia' }, XY: { name: 'Flynas' },
  RJ: { name: 'Royal Jordanian' }, MS: { name: 'EgyptAir' }, AT: { name: 'Royal Air Maroc' },
  ET: { name: 'Ethiopian Airlines' }, KQ: { name: 'Kenya Airways' }, SA: { name: 'South African Airways' },
  TK: { name: 'Turkish Airlines' }, BA: { name: 'British Airways' }, LH: { name: 'Lufthansa' },
  LX: { name: 'Swiss International Air Lines' }, OS: { name: 'Austrian Airlines' },
  AF: { name: 'Air France' }, KL: { name: 'KLM Royal Dutch Airlines' }, AZ: { name: 'ITA Airways' },
  IB: { name: 'Iberia' }, TP: { name: 'TAP Air Portugal' }, AY: { name: 'Finnair' },
  SK: { name: 'SAS' }, BT: { name: 'airBaltic' }, LO: { name: 'LOT Polish Airlines' },
  AC: { name: 'Air Canada' }, AA: { name: 'American Airlines' }, DL: { name: 'Delta Air Lines' },
  UA: { name: 'United Airlines' }, SQ: { name: 'Singapore Airlines' }, TR: { name: 'Scoot' },
  TG: { name: 'Thai Airways' }, PG: { name: 'Bangkok Airways' }, VN: { name: 'Vietnam Airlines' },
  VJ: { name: 'VietJet Air' }, MH: { name: 'Malaysia Airlines' }, OD: { name: 'Batik Air Malaysia' },
  AK: { name: 'AirAsia' }, GA: { name: 'Garuda Indonesia' }, CX: { name: 'Cathay Pacific' },
  CA: { name: 'Air China' }, MU: { name: 'China Eastern Airlines' }, CZ: { name: 'China Southern Airlines' },
  KE: { name: 'Korean Air' }, OZ: { name: 'Asiana Airlines' }, NH: { name: 'ANA' },
  JL: { name: 'Japan Airlines' }, QF: { name: 'Qantas' }, NZ: { name: 'Air New Zealand' },
  UL: { name: 'SriLankan Airlines' }, BG: { name: 'Biman Bangladesh Airlines' },
  PK: { name: 'Pakistan International Airlines' }, KC: { name: 'Air Astana' },
  JD: { name: 'Jordan Aviation' }, H1: { name: 'Hahn Air' }, UK: { name: 'Vistara (merged into Air India)' },
};

export function parseEmtFareCalendar(jsonText: string, wantDate: string): EmtFare[] {
  const data = JSON.parse(jsonText) as Array<Record<string, unknown>>;
  if (!Array.isArray(data) || !data[0]) return [];
  const rows = ['FstRow', 'SndRow', 'TrdRow', 'ForthRow', 'FifthRow', 'SixRow'] as const;
  const fares: EmtFare[] = [];
  const seen = new Set<string>();
  for (const rn of rows) {
    const cells = (data[0][rn] as EmtCell[] | undefined) || [];
    for (const c of cells) {
      if (!c?.fulDate || !c.bookMsg) continue;
      const fare = Number(String(c.bookMsg).replace(/[^0-9]/g, ''));
      if (!fare || fare <= 0 || seen.has(c.fulDate)) continue;
      seen.add(c.fulDate);
      fares.push({ date: c.fulDate, fare, airlineCode: c.AirlineCode || null });
    }
  }
  return fares;
}

/** Build the offer for the requested date (or the cheapest upcoming day honestly labelled). */
export function emtFareItems(
  fares: EmtFare[],
  source: SourceConfig,
  route: { from: string; to: string },
  wantDate: string,   // "20/10/2026"
  fromCode = '',      // IATA origin (for the EMT search deeplink)
  toCode = '',        // IATA destination
): RawSourceItem[] {
  const today = new Date().toISOString().slice(0, 10);
  const airline = (code: string | null) => (code && EMT_AIRLINES[code]) ? EMT_AIRLINES[code] : null;
  // 1) exact requested date
  const exact = fares.find((f) => f.date === wantDate && airline(f.airlineCode));
  // 2) cheapest within the upcoming calendar (fallback)
  const upcoming = fares
    .filter((f) => airline(f.airlineCode))
    .sort((a, b) => a.fare - b.fare);
  const chosen = exact || upcoming[0];
  if (!chosen) return [];
  const al = airline(chosen.airlineCode)!;
  const emtSearchUrl = `https://www.easemytrip.com/flight-search?searchParams=${encodeURIComponent(`${fromCode}-${route.from}|${toCode}-${route.to}|${chosen.date}`)}`;
  const isExact = exact ? chosen.date === exact.date : false;
  const routeLabel = `${route.from} → ${route.to}`;
  return [newRawItem(source, {
    title: `${al.name} ${routeLabel} ${isExact ? `on ${chosen.date}` : `(cheapest upcoming, ${chosen.date})`} from ₹${chosen.fare}`,
    brand: al.name,
    price: chosen.fare,
    currency: 'INR',
    seller: 'EaseMyTrip',
    sellerUrl: emtSearchUrl,
    travel: { route: `${route.from.toLowerCase()} to ${route.to.toLowerCase()}` },
    attributes: {
      route: routeLabel,
      travel_date: chosen.date,
      fare: String(chosen.fare),
      airline_code: chosen.airlineCode || '',
      price_basis: `cheapest ${al.name} fare observed on EaseMyTrip's live fare calendar on ${today} (EaseMyTrip is the selling website)`,
      data_note: `Fare acquired via EaseMyTrip fare calendar on ${today}; the ticket is SOLD by EaseMyTrip (seller). Cheapest carrier fare for this route/date; may change at checkout.`,
      image: '',
    },
    identifiers: { sku: `emt-${chosen.airlineCode}-${route.from}-${route.to}-${chosen.date.replace(/\//g, '-')}` },
    evidence: {
      sourceUrl: 'https://flightservice-seo.easemytrip.com/EmtAppService/FareCalendar/FillCalendarDataByMonth',
      extractedFields: ['bookMsg (fare)', 'AirlineCode', 'fulDate'],
    },
  })];
}
