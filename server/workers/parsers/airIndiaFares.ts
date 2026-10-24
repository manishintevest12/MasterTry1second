/**
 * Air India fare-calendar parser (24 Oct 2026 Browserbase discovery).
 *
 * www.airindia.com's AEM booking widget fires
 *   POST https://api.airindia.com/airline-fares/v1/search
 *   headers: Ocp-Apim-Subscription-Key: 8ea658f3ac1e44cca129d7ed252d4c42
 *   body: { classType: "ECONOMY", concessionType: null,
 *           itinerary: { origin, destination, departureDate, returnDate: null,
 *                        originCountryCode: "IN" },
 *           tripInfo: { duration: null, range: 60, durationFlexibility: null } }
 * and gets back ~61 daily one-way totals (base + tax, INR). Verified
 * browserless from the sandbox 24 Oct 2026: DEL-BOM 28 Oct one-way =
 * 7205 total (no returnDate row). NOTE: tripInfo.duration MUST be null —
 * duration 1/4 makes the API return round-trip totals (28 Oct 14024/14150). No auth chain — only the public APIM subscription key.
 *
 * The IBE per-flight flow (POST /cbiz-booking/v2/prime/auth/token with
 * {originLocationCode:"del",clientId:"web-pb"} -> Bearer JWT, then POST
 * /cbiz-booking/v2/prime/search/air-bounds) is Akamai "Access Denied" from
 * datacenter IPs. The worker keeps a self-detecting air-bounds probe: when
 * production (Hostinger) IP passes Akamai, per-flight rows can be added
 * without rediscovery (owner self-healing rule 21 Oct).
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export const AI_FARES_URL = 'https://api.airindia.com/airline-fares/v1/search';
export const AI_SUB_KEY = '8ea658f3ac1e44cca129d7ed252d4c42';

export function airIndiaFaresHeaders(): Record<string, string> {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Ocp-Apim-Subscription-Key': AI_SUB_KEY,
    'Content-Type': 'application/json',
    Accept: 'application/json, text/plain, */*',
    Origin: 'https://www.airindia.com',
    Referer: 'https://www.airindia.com/',
    'Accept-Language': 'en-US,en;q=0.9',
  };
}

export function airIndiaFaresBody(origin: string, destination: string, departureDate: string): string {
  return JSON.stringify({
    classType: 'ECONOMY',
    concessionType: null,
    itinerary: { origin, destination, departureDate, returnDate: null, originCountryCode: 'IN' },
    tripInfo: { duration: null, range: 60, durationFlexibility: null },
  });
}

/** SRP deeplink: the IBE booking flow the widget itself opens. */
export function airIndiaSearchUrl(fromCode: string, toCode: string, depIso: string): string {
  return `https://www.airindia.com/in/en/ibe/booking.html?origin=${fromCode}&destination=${toCode}&departDate=${depIso}#/availability/departure`;
}

export interface AiDayFare {
  dt: string;
  pr: number;
  base?: number;
  tax?: number;
}

/** Parse the fare-calendar body into honest per-date one-way totals. */
export function parseAirIndiaFares(body: string): AiDayFare[] {
  let d: any;
  try {
    d = JSON.parse(body);
  } catch {
    return [];
  }
  const rows = d?.data?.fares;
  if (!Array.isArray(rows)) return [];
  const out: AiDayFare[] = [];
  for (const row of rows) {
    const dt = String(row?.departureDate || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dt)) continue;
    const tp = row?.totalPrice || {};
    const total = Number(tp?.total);
    const base = Number(tp?.base);
    const tax = Number(tp?.tax);
    if (!Number.isFinite(total) || total <= 0) continue;
    out.push({
      dt,
      pr: Math.round(total),
      base: Number.isFinite(base) ? Math.round(base) : undefined,
      tax: Number.isFinite(tax) ? Math.round(tax) : undefined,
    });
  }
  return out;
}

/** One honest offer (AIX/SpiceJet fare-calendar pattern). */
export function airIndiaDayFareItems(
  fares: AiDayFare[],
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
  const taxNote = chosen.tax !== undefined ? ` (taxes+fees component ₹${chosen.tax})` : '';
  return [newRawItem(source, {
    title: `Air India ${routeLabel} ${isExact ? `on ${chosen.dt}` : `(cheapest upcoming, ${chosen.dt})`} from ₹${chosen.pr}`,
    brand: 'Air India',
    price: chosen.pr,
    currency: 'INR',
    seller: 'Air India',
    sellerUrl: airIndiaSearchUrl(fromCode, toCode, chosen.dt),
    travel: { route: `${fromCity.toLowerCase()} to ${toCity.toLowerCase()}`, date: chosen.dt },
    attributes: {
      route: routeLabel,
      travel_date: chosen.dt,
      departure_date: chosen.dt,
      airline: 'Air India',
      fare_detail: `lowest Air India economy one-way fare (incl. taxes) published on the airline's own fare calendar for ${chosen.dt}${taxNote}`,
      fare_class: 'lowest economy one-way fare on Air India\'s own fare calendar',
      price_basis: `Air India fare-calendar API price for this route${isExact ? ' and date' : ' within the returned 60-day calendar window'} on ${today}`,
      data_note: `Fare acquired from Air India's own API on ${today}. The airline's per-flight search is not exposed to this server; booking continues on Air India's own website.`,
      image: '',
    },
    identifiers: { sku: `airindia-${fromCode}-${toCode}-${chosen.dt}` },
    evidence: {
      sourceUrl: AI_FARES_URL,
      extractedFields: ['fares[].departureDate', 'fares[].totalPrice.total (INR)', 'fares[].totalPrice.base', 'fares[].totalPrice.tax'],
    },
  })];
}
