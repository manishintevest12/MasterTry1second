// BudgetAir (Travix) low-fare calendar — owner-requested OTA expansion (24 Oct 2026).
//
// Recipe (captured from BudgetAir's own datepicker XHR, verified browserless):
//   GET https://rest.budgetair.com/restapi/soa2/36017/lowPrice_lowPriceCalendarSearch
//       ?departureCode=DEL&arrivalCode=BOM&currency=INR
//   -> {"ResponseStatus": {...}, "response": [{ "date": "2026-10-28", "totalPrice": "7075" }, ...]}
// ~348 priced dates covering the next ~12 months (per-day lowest TOTAL price,
// taxes included). Browserless from any IP, no session, no tokens. The site's
// own JS reads it with parseFloat(e.totalPrice) — totalPrice may be a string,
// a float, or null (no fare cached for that date).
//
// SRP deeplink verified live: https://www.budgetair.com/en_us/flights/DEL/BOM/2026-10-28
// (the /en-in locale 302s back to en_us — BudgetAir sells India routes from the
// global en_us storefront, prices returned in INR).
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export const BUDGETAIR_CALENDAR_URL = 'https://rest.budgetair.com/restapi/soa2/36017/lowPrice_lowPriceCalendarSearch';
export const BUDGETAIR_WEB = 'https://www.budgetair.com/en_us';

export interface BudgetAirDayFare {
  date: string;
  price: number;
}

export function budgetAirCalendarUrl(fromCode: string, toCode: string, currency = 'INR'): string {
  const q = new URLSearchParams({ departureCode: fromCode, arrivalCode: toCode, currency });
  return `${BUDGETAIR_CALENDAR_URL}?${q.toString()}`;
}

/** Shape-tolerant parse of the SOA2 calendar envelope. Never throws on odd entries. */
export function parseBudgetAirCalendar(body: unknown): BudgetAirDayFare[] {
  const root = (body ?? {}) as Record<string, any>;
  const list = Array.isArray(root.response) ? root.response : Array.isArray(body) ? (body as any[]) : [];
  const out: BudgetAirDayFare[] = [];
  for (const e of list) {
    if (!e || typeof e !== 'object') continue;
    const date = String(e.date ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const raw = e.totalPrice;
    const price = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''));
    if (!Number.isFinite(price) || price <= 0) continue; // null / "0" = no cached fare
    out.push({ date, price });
  }
  return out;
}

/**
 * Emit one honest row from the calendar: the exact requested depart date when
 * BudgetAir has a cached fare for it, else the cheapest upcoming date (clearly
 * labelled, Akasa/Via fare-calendar pattern).
 */
export function budgetAirDayFareItems(
  fares: BudgetAirDayFare[],
  source: SourceConfig,
  fromCity: string,
  toCity: string,
  fromCode: string,
  toCode: string,
  depIso: string,
): RawSourceItem[] {
  const today = new Date().toISOString().slice(0, 10);
  const exact = fares.find((f) => f.date === depIso);
  const upcoming = [...fares].filter((f) => f.date >= today).sort((a, b) => a.price - b.price);
  const chosen = exact || upcoming[0];
  if (!chosen) return [];
  const isExact = Boolean(exact);
  const routeLabel = `${fromCity} → ${toCity}`;
  const deeplink = `${BUDGETAIR_WEB}/flights/${fromCode}/${toCode}/${chosen.date}`;
  return [newRawItem(source, {
    title: `BudgetAir ${routeLabel} ${isExact ? `on ${chosen.date}` : `(cheapest upcoming, ${chosen.date})`} from ₹${Math.round(chosen.price)}`,
    brand: 'BudgetAir',
    price: Math.round(chosen.price),
    currency: 'INR',
    seller: 'BudgetAir',
    sellerUrl: deeplink,
    travel: { route: `${fromCity.toLowerCase()} to ${toCity.toLowerCase()}`, date: chosen.date },
    attributes: {
      route: routeLabel,
      travel_date: chosen.date,
      fare_class: 'lowest economy fare (taxes included) from BudgetAir\'s own low-fare calendar',
      price_basis: `lowest BudgetAir fare returned by Travix's lowPrice calendar API on ${today} for this route${isExact ? ' and date' : ' within the next 12 months'}`,
      data_note: `Fare acquired from BudgetAir's official low-fare calendar on ${today}; booking is on BudgetAir's own website.`,
      image: '',
    },
    identifiers: { sku: `budgetair-${fromCode}-${toCode}-${chosen.date}` },
    evidence: {
      sourceUrl: budgetAirCalendarUrl(fromCode, toCode),
      extractedFields: ['response[].date', 'response[].totalPrice (INR)'],
    },
  })];
}
