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
export const EMT_AIRLINES: Record<string, { name: string; url: string }> = {
  '6E': { name: 'IndiGo', url: 'https://www.goindigo.in/' },
  QP: { name: 'Akasa Air', url: 'https://www.akasaair.com/' },
  AI: { name: 'Air India', url: 'https://www.airindia.com/' },
  IX: { name: 'Air India Express', url: 'https://www.airindiaexpress.com/' },
  SG: { name: 'SpiceJet', url: 'https://www.spicejet.com/' },
  UK: { name: 'Vistara', url: 'https://www.airvistara.com/' },
  G8: { name: 'Go First', url: 'https://www.flygofirst.com/' },
  '9I': { name: 'Alliance Air', url: 'https://www.allianceair.in/' },
  I5: { name: 'AirAsia India', url: 'https://www.airasia.co.in/' },
  QZ: { name: 'IndiGo', url: 'https://www.goindigo.in/' },
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
  const isExact = exact ? chosen.date === exact.date : false;
  const routeLabel = `${route.from} → ${route.to}`;
  return [newRawItem(source, {
    title: `${al.name} ${routeLabel} ${isExact ? `on ${chosen.date}` : `(cheapest upcoming, ${chosen.date})`} from ₹${chosen.fare}`,
    brand: al.name,
    price: chosen.fare,
    currency: 'INR',
    seller: al.name,
    sellerUrl: al.url,
    travel: { route: `${route.from.toLowerCase()} to ${route.to.toLowerCase()}` },
    attributes: {
      route: routeLabel,
      travel_date: chosen.date,
      fare: String(chosen.fare),
      airline_code: chosen.airlineCode || '',
      price_basis: `cheapest fare observed on EaseMyTrip's live fare calendar on ${today} (acquisition source, not seller)`,
      data_note: `Fare acquired via EaseMyTrip fare calendar on ${today}; booking is on ${al.name}'s own website. Price is the cheapest carrier fare for this route/date and may change at checkout.`,
      image: '',
    },
    identifiers: { sku: `emt-${chosen.airlineCode}-${route.from}-${route.to}-${chosen.date.replace(/\//g, '-')}` },
    evidence: {
      sourceUrl: 'https://flightservice-seo.easemytrip.com/EmtAppService/FareCalendar/FillCalendarDataByMonth',
      extractedFields: ['bookMsg (fare)', 'AirlineCode', 'fulDate'],
    },
  })];
}
