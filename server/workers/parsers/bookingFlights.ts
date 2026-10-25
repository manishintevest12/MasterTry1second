/**
 * Booking.com Flights (BCF) — /api/flights/ gateway.
 *
 * flights.booking.com fronts a Kayak-family flight search API. The recipe was
 * captured from the site's own XHR (GET /api/flights/?type=ONEWAY&...&chal_t=<ms>)
 * with a JSON accept header and the SRP as referer; it replays BROWSERLESS via
 * curl_cffi. From datacenter IPs the edge answers HTTP 202 (bot challenge) or
 * 429 (rate limit) — the worker is a self-detecting full-flow probe (MMT
 * pattern): when the gate lifts on the production Hostinger IP the same code
 * activates and emits priced rows with no owner action.
 *
 * The response is Kayak-shaped but the exact deployment may differ slightly,
 * so the parser is deliberately defensive: it tries the known key paths
 * (flights/legs/segments/carriers, priceMajor+priceMinor), skips anything it
 * cannot honestly resolve, and never fabricates. Currency is checked so a
 * non-INR storefront never poisons rupee comparisons.
 */
import type { SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';
import type { RawSourceItem } from '../../types';

export function bookingFlightsApiUrl(from: string, to: string, dep: string): string {
  const t = Date.now();
  return (
    'https://flights.booking.com/api/flights/?type=ONEWAY&adults=1&cabinClass=ECONOMY' +
    `&depart=${encodeURIComponent(dep)}&from=${encodeURIComponent(from)}.AIRPORT&to=${encodeURIComponent(to)}.AIRPORT` +
    `&chal_t=${t}&force_referer=&enableVI=1&search_source=user`
  );
}

/** Deep-link lands directly on the BCF results page for the route/date. */
export function bookingFlightsSrpUrl(from: string, to: string, dep: string): string {
  return `https://flights.booking.com/airplane-flights/${from}.${to}/${dep}?type=ONEWAY&adults=1&cabinClass=ECONOMY`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const num = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: any): string => (v == null ? '' : String(v).trim());
const asArray = (v: any): any[] => (Array.isArray(v) ? v : []);

/** Kayak-family time: {"date":{year,month,day},"time":"12:55"} or an ISO string. */
function hhmm(v: any): string {
  if (!v) return '';
  if (typeof v === 'string') return v.slice(11, 16);
  if (typeof v === 'object') {
    const t = str(v.time);
    if (/^\d{1,2}:\d{2}/.test(t)) return t.slice(0, 5);
  }
  return '';
}

/** Map of id -> entity for Kayak reference tables (legs, segments, ...). */
function byId(list: any): Map<string, any> {
  const m = new Map<string, any>();
  for (const el of asArray(list)) {
    const id = str(el?.id);
    if (id) m.set(id, el);
  }
  return m;
}

interface ParsedSeg { carrierCode: string; flightNumber: string; dep: string; arr: string; }

function parseSegments(leg: any, segMap: Map<string, any>): ParsedSeg[] {
  const out: ParsedSeg[] = [];
  for (const sid of asArray(leg?.segments)) {
    const seg = segMap.get(str(sid)) ?? (typeof sid === 'object' ? sid : undefined);
    if (!seg) continue;
    const carrierCode =
      str(seg?.carrierCode) ||
      str(seg?.carriers?.marketing?.[0]) ||
      str(seg?.carriers?.[0]) ||
      str(seg?.marketingCarrier?.code) ||
      str(seg?.carrier?.code);
    const flightNumber = str(seg?.flightNumber) || str(seg?.flightNo);
    const dep = hhmm(seg?.departureTime ?? seg?.departTime);
    const arr = hhmm(seg?.arrivalTime ?? seg?.arriveTime);
    if (!flightNumber || !dep) continue;
    out.push({ carrierCode, flightNumber, dep, arr });
  }
  return out;
}

/**
 * Parse a BCF /api/flights/ JSON document into raw items.
 * Returns [] when nothing honest could be extracted (gate empty / shape drift).
 */
export function parseBookingFlights(
  json: any,
  source: SourceConfig,
  fromCode: string,
  toCode: string,
  fromLabel: string,
  toLabel: string,
  dateIso: string,
  cap = 40,
): RawSourceItem[] {
  if (!json || typeof json !== 'object') return [];
  const currency = str(json?.currency || json?.currencyCode).toUpperCase();
  if (currency && currency !== 'INR') return []; // only honest INR storefronts

  const legs = byId(json?.legs);
  const segMap = byId(json?.segments);
  const carriers: Record<string, any> = {};
  for (const c of asArray(json?.carriers)) carriers[str(c?.id)] = c;

  const flights = asArray(json?.flights).filter(Boolean);
  if (!flights.length) return [];

  // Kayak groups rank itineraries; fall back to raw array order.
  const groupOrder: string[] = [
    ...asArray(json?.groups?.cheapest).map(str),
    ...asArray(json?.groups?.best).map(str),
    ...asArray(json?.groups?.recommended).map(str),
    ...asArray(json?.groups?.other).map(str),
  ];
  const idSet = new Set(groupOrder);
  const ordered = [
    ...groupOrder.map((id) => flights.find((f) => str(f?.id) === id)).filter(Boolean),
    ...flights.filter((f) => !idSet.has(str(f?.id))),
  ];

  const today = new Date().toISOString().slice(0, 10);
  const routeLabel = `${fromLabel} → ${toLabel}`;
  const seen = new Set<string>();
  const out: RawSourceItem[] = [];

  for (const f of ordered) {
    if (out.length >= cap) break;
    const price = num(f?.priceMajor) + num(f?.priceMinor) / 100;
    if (!(price > 0) || price < 500 || price > 500000) continue;

    const legIds = asArray(f?.legs).map(str);
    const legObjs = legIds.map((id) => legs.get(id)).filter(Boolean);
    if (!legObjs.length) continue;

    // ONEWAY: exactly one outbound leg. Multi-leg = multi-city, skip honestly.
    if (legObjs.length > 1) continue;

    const segs = parseSegments(legObjs[0], segMap);
    if (!segs.length) continue;
    const first = segs[0];
    const last = segs[segs.length - 1];

    const carrierId = str(legObjs[0]?.carrier);
    const carrierInfo = carriers[carrierId];
    const carrierName = str(carrierInfo?.name) || str(carrierInfo?.displayName) || first.carrierCode || 'Booking.com';
    const carrierCode = first.carrierCode || (carrierName.length <= 3 ? carrierName : '');
    const flightNos = segs.map((s) => `${s.carrierCode || carrierCode}${s.flightNumber}`).join('-');
    const key = `${flightNos}|${first.dep}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const stops = segs.length - 1;
    const dur = num(legObjs[0]?.duration);
    out.push(newRawItem(source, {
      title: `${carrierName} ${flightNos} · ${routeLabel}`.slice(0, 200),
      brand: String(carrierName).slice(0, 80),
      price: Math.round(price),
      currency: 'INR',
      seller: 'Booking.com',
      sellerUrl: bookingFlightsSrpUrl(fromCode, toCode, dateIso),
      travel: { route: `${fromLabel.toLowerCase()} to ${toLabel.toLowerCase()}`, date: dateIso, seatType: 'economy' },
      attributes: {
        route: routeLabel,
        travel_date: dateIso,
        airline: String(carrierName),
        ...(carrierCode ? { airline_code: String(carrierCode) } : {}),
        flight_number: flightNos,
        departure: String(first.dep),
        arrival: String(last.arr),
        stops: String(stops),
        ...(dur ? { duration_minutes: String(Math.round(dur)) } : {}),
        price_basis: `live all-inclusive ${stops === 0 ? 'nonstop' : `${stops}-stop`} fare observed on Booking.com's flight search on ${today} (Booking.com is the selling website)`,
        data_note: `Fare acquired via Booking.com's flight search API on ${today}; the ticket is SOLD by Booking.com. Price may change at checkout.`,
      },
    }));
  }
  return out;
}
