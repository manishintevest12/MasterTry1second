/**
 * Akasa Air fares parser — flights vertical.
 *
 * Akasa's own IBE (booking SPA at akasaair.com/booking) calls
 * https://prod-bl.qp.akasaair.com/api/ibe/availability/v2/search
 * with a full ISO-8601 startDate (WITH +05:30 offset — a bare yyyy-mm-dd
 * is a 400 DateTimeParseException) and returns a 61-day low-fare
 * calendar for the route as XML: <APIResponse><data><date>..</date>
 * <price>6568.00</price><isLowest/><noFlights/><soldOut/></data>...
 *
 * Akasa is the operating airline (not a metasearch), so seller = Akasa Air
 * and the deeplink goes to Akasa's own booking flow.
 *
 * The per-flight POST /api/ibe/availability/search needs a token from
 * POST /api/ibe/token/generateToken, which is edge-blocked (nginx 403)
 * from datacenter IPs — only this fare-calendar GET is used.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export const AKASA_API_BASE = 'https://prod-bl.qp.akasaair.com/api/ibe';
export const AKASA_WEB = 'https://www.akasaair.com';

export interface AkasaDayFare {
  date: string;      // "2026-10-21"
  price: number;     // INR
  isLowest: boolean;
  noFlights: boolean;
  soldOut: boolean;
}

/** Build the fare-calendar URL for a route; startDate must be full ISO with +05:30. */
export function akasaFareCalendarUrl(fromCode: string, toCode: string, depIso: string): string {
  const start = `${depIso}T00:00:00%2B05:30`; // URL-encoded offset — a bare date is a 400
  return `${AKASA_API_BASE}/availability/v2/search?origin=${fromCode}&destination=${toCode}`
    + `&startDate=${start}&numberOfPassengers=1&channel=WEB&currencyCode=INR`;
}

/**
 * Honest no-service detector (owner 24 Oct): the fare-calendar API answers
 * 422 {"code":"INVALID_STATION", "message":"Invalid Origin"|"Invalid Destination"}
 * for every route Akasa Air does not fly (verified live: IDR-x always 422 while
 * DEL-BOM returns a priced 200). Such an answer is a SUCCESSFUL acquisition
 * proving there is no Akasa service on the route — the worker returns [] and
 * neither the circuit nor a misleading "feed unreachable" presence card fires.
 */
export function akasaHonestNoService(status: number, body: string): boolean {
  return status === 422 && /INVALID_STATION/i.test(body || '');
}

/** Parse the XML fare-calendar document into per-day fares (no data invented). */
export function parseAkasaFareCalendar(xml: string): AkasaDayFare[] {
  const out: AkasaDayFare[] = [];
  const blocks = xml.match(/<data>[\s\S]*?<\/data>/g) || [];
  for (const b of blocks) {
    const date = b.match(/<date>([^<]+)<\/date>/)?.[1]?.slice(0, 10) || null;
    const price = Number(b.match(/<price>([^<]+)<\/price>/)?.[1] || 0);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    out.push({
      date,
      price,
      isLowest: /<isLowest>true<\/isLowest>/.test(b),
      noFlights: /<noFlights>true<\/noFlights>/.test(b),
      soldOut: /<soldOut>true<\/soldOut>/.test(b),
    });
  }
  return out;
}

/** Fare-calendar item: exact requested date, else cheapest available day in the window. */
export function akasaDayFareItems(
  fares: AkasaDayFare[],
  source: SourceConfig,
  fromCity: string,
  toCity: string,
  fromCode: string,
  toCode: string,
  depIso: string,
): RawSourceItem[] {
  const today = new Date().toISOString().slice(0, 10);
  const bookable = fares.filter((f) => f.price > 0 && !f.noFlights && !f.soldOut);
  const exact = bookable.find((f) => f.date === depIso);
  const upcoming = [...bookable].sort((a, b) => a.price - b.price);
  const chosen = exact || upcoming[0];
  if (!chosen) return [];
  const isExact = Boolean(exact);
  const routeLabel = `${fromCity} → ${toCity}`;
  const deeplink = `${AKASA_WEB}/booking`;
  return [newRawItem(source, {
    title: `Akasa Air ${routeLabel} ${isExact ? `on ${chosen.date}` : `(cheapest upcoming, ${chosen.date})`} from ₹${Math.round(chosen.price)}`,
    brand: 'Akasa Air',
    price: Math.round(chosen.price),
    currency: 'INR',
    seller: 'Akasa Air',
    sellerUrl: deeplink,
    travel: { route: `${fromCity.toLowerCase()} to ${toCity.toLowerCase()}`, date: chosen.date },
    attributes: {
      route: routeLabel,
      travel_date: chosen.date,
      fare_class: 'lowest economy fare (taxes included) from Akasa Air\'s own fare calendar',
      price_basis: `lowest Akasa Air fare returned by Akasa's own booking API on ${today} for this route${isExact ? ' and date' : ' within the next 60 days'}`,
      data_note: `Fare acquired from Akasa Air's official low-fare calendar on ${today}; booking is on Akasa Air's own website.`,
      image: '',
    },
    identifiers: { sku: `akasa-${fromCode}-${toCode}-${chosen.date}` },
    evidence: {
      sourceUrl: akasaFareCalendarUrl(fromCode, toCode, depIso),
      extractedFields: ['data[].date', 'data[].price (INR)', 'isLowest', 'noFlights', 'soldOut'],
    },
  })];
}
