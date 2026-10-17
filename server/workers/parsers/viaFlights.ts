/**
 * Via.com flight fare-calendar parser (17 Oct 2026).
 *
 * Via.com (in.via.com) is an old-school jQuery B2C site. Its flight search
 * results (/itinerary) 502/500 for browserless HTTP, but the fare-calendar API
 * the search box uses is fully open:
 *
 *   POST https://in.via.com/apiv2/flight/fare-calendar
 *        ?authToken=553f5767-373f-4d98-9e6d-08fa87400a42
 *        &requestSource=NODE_B2C&flowType=NODE&ajax=true&jsonData=true&__xreq__=true
 *   JSON body (unwrapped): {"src":"DEL","dest":"BOM",
 *        "startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD",
 *        "fareType":"b2c","oneWay":true}
 *   (authToken is PUBLIC, shipped verbatim in /flight/assets/javascripts/*.js
 *    and used by their own pages; found in utils.min.js getFMNUrl.)
 *
 * Response: {"cd": [ { "dt": "2027-02-19", "pr": 6529, "prType": "LOW" }, ...,
 *   ~267 day-entries for the route ], "webDta": { ...page chrome... }}
 * cd[].pr is INR, prType LOW/MEDIUM/HIGH. Empty cd[] means no fares.
 *
 * Like the EMT/IndiGo/Akasa fare calendars, this emits ONE honest offer:
 * the exact requested date if present, else the cheapest upcoming day in the
 * window — always labelled as Via's own lowest fare for the route.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export const VIA_BASE = 'https://in.via.com';
export const VIA_AUTH_TOKEN = '553f5767-373f-4d98-9e6d-08fa87400a42';

export interface ViaDayFare {
  dt: string;   // YYYY-MM-DD
  pr: number;   // INR lowest fare
  prType: string; // LOW | MEDIUM | HIGH
}

export function viaFareCalendarUrl(): string {
  return `${VIA_BASE}/apiv2/flight/fare-calendar?authToken=${VIA_AUTH_TOKEN}`
    + '&requestSource=NODE_B2C&flowType=NODE&ajax=true&jsonData=true&__xreq__=true';
}

/** Canonical Via search-results deeplink (what their own form submits). */
export function viaSearchUrl(fromCode: string, toCode: string, depIso: string): string {
  const [y, m, d] = depIso.split('-');
  const usDate = `${m}/${d}/${y}`;
  return `${VIA_BASE}/flight/search?returnType=one-way`
    + `&destination=${toCode}&bdestination=${toCode}`
    + `&source=${fromCode}&bsource=${fromCode}`
    + `&month=${Number(m)}&day=${Number(d)}&year=${y}&date=${encodeURIComponent(usDate)}`
    + `&numAdults=1&numChildren=0&numInfants=0&validation_result=`
    + `&domesinter=domestic&livequote=-1&flightClass=Economy`
    + `&travType=DOM&routingType=ALL&isAjax=false`;
}

export function parseViaFareCalendar(body: string): ViaDayFare[] {
  let root: any;
  try {
    root = JSON.parse(body);
  } catch {
    return [];
  }
  const cd = root?.cd;
  if (!Array.isArray(cd)) return [];
  const out: ViaDayFare[] = [];
  for (const e of cd) {
    const dt = String(e?.dt || '');
    const pr = Number(e?.pr);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dt) && Number.isFinite(pr) && pr > 0) {
      out.push({ dt, pr, prType: String(e?.prType || '') });
    }
  }
  return out;
}

/** One honest offer: Via.com's own cheapest fare for the exact requested date,
 *  else the cheapest upcoming day in the returned calendar window. */
export function viaDayFareItems(
  fares: ViaDayFare[],
  source: SourceConfig,
  fromCity: string,
  toCity: string,
  fromCode: string,
  toCode: string,
  depIso: string,
): RawSourceItem[] {
  const today = new Date().toISOString().slice(0, 10);
  const exact = fares.find((f) => f.dt === depIso);
  const upcoming = [...fares].sort((a, b) => a.pr - b.pr);
  const chosen = exact || upcoming[0];
  if (!chosen) return [];
  const isExact = Boolean(exact);
  const routeLabel = `${fromCity} → ${toCity}`;
  return [newRawItem(source, {
    title: `Via.com ${routeLabel} ${isExact ? `on ${chosen.dt}` : `(cheapest upcoming, ${chosen.dt})`} from ₹${Math.round(chosen.pr)}`,
    brand: 'Via.com',
    price: Math.round(chosen.pr),
    currency: 'INR',
    seller: 'Via.com',
    sellerUrl: viaSearchUrl(fromCode, toCode, chosen.dt),
    travel: { route: `${fromCity.toLowerCase()} to ${toCity.toLowerCase()}`, date: chosen.dt },
    attributes: {
      route: routeLabel,
      travel_date: chosen.dt,
      fare_class: `lowest economy fare (${chosen.prType || 'LOW'} bucket) from Via.com's own fare calendar`,
      price_basis: `lowest Via.com fare returned by via.com's fare-calendar API on ${today} for this route${isExact ? ' and date' : ' within the returned calendar window'}`,
      data_note: `Fare acquired from Via.com's official fare calendar on ${today}; booking continues on Via.com's own website.`,
      image: '',
    },
    identifiers: { sku: `via-${fromCode}-${toCode}-${chosen.dt}` },
    evidence: {
      sourceUrl: viaFareCalendarUrl(),
      extractedFields: ['cd[].dt', 'cd[].pr (INR)', 'cd[].prType'],
    },
  })];
}
