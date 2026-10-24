/**
 * Alliance Air schedule parser (24 Oct 2026 Browserbase CDP discovery).
 *
 * bookme.allianceair.in is a plain Yii PHP app with NO WAF (no Akamai/
 * Cloudflare anywhere) — the whole booking flow replays browserless with
 * curl_cffi in two steps, verified from the sandbox 24 Oct 2026:
 *   1. GET /  -> session cookies (PHPSESSID, _csrf) — also CSRF meta token.
 *   2. POST /search-schedule with the exact browser form body:
 *      org=DEL&des=BOM&dep_date=27/10/2026 (DD/MM/YYYY! any other format
 *      re-renders the homepage) &pax=1 pax(s)&adult=1&child=0&infant=0
 *      &ccy=INR&promo_code=&multi_route=&multi_date=
 * The response page embeds `this.dataSchedule = ["","",{full JSON}"]` with
 * the complete week schedule: connecting_flight_routes[] per flight
 * (flight_number, aircraft, availability, dep/arr hour+minute, 15kg baggage)
 * and fare_info.total_search_fare.amount in INR with full fare components.
 * The /search-schedule/get-full-week AJAX endpoint also exists (X-CSRF-Token
 * header) but returns empty arrays without the form POST first — the page-
 * embedded dataSchedule is the source of truth.
 * Live 24 Oct: DEL-BOM 27 Oct, 9I841 ATR-72 15:25->18:30, INR 7147
 * (Basic 5500 + Airport Tax etc.), availability 6 seats.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export const AA_HOME = 'https://bookme.allianceair.in/';

export function allianceAirSearchBody(origin: string, destination: string, depIso: string): string {
  // depIso is YYYY-MM-DD; the Yii form wants DD/MM/YYYY — anything else gets
  // silently rejected (homepage re-render).
  const m = depIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const ddmm = m ? `${m[3]}/${m[2]}/${m[1]}` : depIso;
  return new URLSearchParams({
    org: origin, des: destination, dep_date: ddmm, ret_date: '',
    pax: '1 pax(s)', adult: '1', child: '0', infant: '0', ccy: 'INR',
    promo_code: '', multi_route: '', multi_date: '',
  }).toString();
}

export function allianceAirSearchUrl(fromCode: string, toCode: string, depIso: string): string {
  return `https://bookme.allianceair.in/search-schedule?org=${fromCode}&des=${toCode}&dep_date=${depIso}`;
}

/** Pull `this.dataSchedule = ["","",{...}"]` out of the rendered search page. */
export function extractAaDataSchedule(pageHtml: string): any | null {
  const i = pageHtml.indexOf('this.dataSchedule = ');
  if (i < 0) return null;
  const start = pageHtml.indexOf('{', i + 20);
  if (start < 0) return null;
  let depth = 0, end = -1, inStr = false, esc = false;
  for (let k = start; k < pageHtml.length; k++) {
    const c = pageHtml[k];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = k + 1; break; } }
  }
  if (end < 0) return null;
  try { return JSON.parse(pageHtml.slice(start, end)); } catch { return null; }
}

export interface AaFlight {
  flightNo: string;
  aircraft: string;
  depTime: string;
  arrTime: string;
  route: string;
  price: number;
  availability: number;
  travelDate: string;
  stops: number;
  baggageKg?: number;
}

/**
 * Parse the dataSchedule JSON into honest per-flight rows. Only flights whose
 * first leg departs on the requested date are emitted (the page returns the
 * whole week; keep the requested day honest).
 */
export function parseAllianceAirSchedule(schedule: any, depIso: string): AaFlight[] {
  const rows = schedule?.departure_schedule;
  if (!Array.isArray(rows)) return [];
  const out: AaFlight[] = [];
  for (const row of rows) {
    const legs = row?.connecting_flight_routes || [];
    const first = legs[0];
    const last = legs[legs.length - 1];
    if (!first || !last) continue;
    const dep = first?.departure_date || {};
    if (!dep?.day) continue;
    const travelDate = `${dep.year}-${String(dep.month).padStart(2, '0')}-${String(dep.day).padStart(2, '0')}`;
    if (travelDate !== depIso) continue;
    const price = Number(row?.fare_info?.total_search_fare?.amount);
    if (!Number.isFinite(price) || price <= 0) continue;
    out.push({
      flightNo: String(first.flight_number || ''),
      aircraft: String(first.aircraft || ''),
      depTime: `${String(dep.hour || '0').padStart(2, '0')}:${String(dep.minute || '0').padStart(2, '0')}`,
      arrTime: `${String(last.arrival_date?.hour || '0').padStart(2, '0')}:${String(last.arrival_date?.minute || '0').padStart(2, '0')}`,
      route: String(first.route || ''),
      price: Math.round(price),
      availability: Number(first.availability || 0),
      travelDate,
      stops: legs.length - 1,
      baggageKg: first?.facilities?.baggage?.adult?.weight || undefined,
    });
  }
  return out;
}

/** Honest per-flight items (Via/EMT per-flight pattern, airline-direct seller). */
export function allianceAirFlightItems(
  flights: AaFlight[],
  source: SourceConfig,
  fromCity: string,
  toCity: string,
  fromCode: string,
  toCode: string,
  depIso: string,
): RawSourceItem[] {
  const today = new Date().toISOString().slice(0, 10);
  return flights.map((f) => newRawItem(source, {
    title: `Alliance Air ${fromCity} → ${toCity} on ${f.travelDate} from ₹${f.price} (${f.flightNo}, ${f.depTime}–${f.arrTime})`,
    brand: 'Alliance Air',
    price: f.price,
    currency: 'INR',
    seller: 'Alliance Air',
    sellerUrl: allianceAirSearchUrl(fromCode, toCode, depIso),
    travel: { route: `${fromCity.toLowerCase()} to ${toCity.toLowerCase()}`, date: f.travelDate },
    attributes: {
      route: `${fromCity} → ${toCity}`,
      airline: 'Alliance Air',
      travel_date: f.travelDate,
      departure_date: f.travelDate,
      flight_number: f.flightNo,
      departure_time: f.depTime,
      arrival_time: f.arrTime,
      aircraft: f.aircraft,
      stops: String(f.stops),
      ...(f.availability > 0 ? { seats_left: String(f.availability) } : {}),
      ...(f.baggageKg ? { baggage_kg: String(f.baggageKg) } : {}),
      fare_detail: `${f.stops === 0 ? 'Direct' : `${f.stops}-stop`} Alliance Air ${f.aircraft} flight ${f.flightNo}, ${f.depTime} → ${f.arrTime}${f.baggageKg ? `, ${f.baggageKg}kg check-in included` : ''}, ${f.availability > 0 ? `${f.availability} seats left` : 'limited seats'}`,
      fare_class: 'lowest published economy fare (incl. taxes) on Alliance Air\'s own booking engine',
      price_basis: `Alliance Air booking-engine price for ${f.travelDate} captured ${today}`,
      data_note: `Fare and schedule acquired from Alliance Air's own booking engine on ${today}; booking continues on Alliance Air's own website.`,
      image: '',
    },
    identifiers: { sku: `allianceair-${f.flightNo}-${f.travelDate}-${fromCode}${toCode}`.replace(/\s+/g, '') },
    evidence: {
      sourceUrl: AA_HOME,
      extractedFields: ['departure_schedule[].connecting_flight_routes[].flight_number', 'departure_date.hour/minute', 'fare_info.total_search_fare.amount (INR)', 'connecting_flight_routes[].availability'],
    },
  }));
}
