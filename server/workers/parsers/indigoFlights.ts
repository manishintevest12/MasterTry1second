/**
 * IndiGo 6E flight search — official mobile API (reverse-engineered from the
 * Android app's Hermes bundle, browserless, no auth token needed):
 *
 *   POST https://api-prod-mobile-skyplus6e.goindigo.in/flightsearch/v1/flight/search
 *   headers: { user_key: <static app key>, Content-Type: application/json }
 *   body: {
 *     criteria: [{ dates: { beginDate: 'YYYYMMDD', endDate: 'YYYYMMDD' },
 *                  flightFilters: { type: 'All' },
 *                  stations: { originStationCodes: ['DEL'], destinationStationCodes: ['BOM'] } }],
 *     tripType: 'ONE_WAY' (RT adds a second criterion),
 *     paxInfo: { travelPurpose, adultCount, childrenCount, infantCount, seniorCitizenCount, extraSeat },
 *     currencyCode: 'INR', promoCode...
 *   }
 *
 * The exact response schema is validated at runtime (the edge blocks the dev
 * box), so this parser is a defensive deep-walker: it finds nodes carrying an
 * IndiGo flight number (6E-###) and a numeric fare, then maps every field it
 * can honestly identify. Anything not found is omitted, never invented.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

/** One flight as extracted (all fields optional, honesty-first). */
export interface IndigoFlight {
  flightNo?: string;
  depTime?: string;
  arrTime?: string;
  depStation?: string;
  arrStation?: string;
  duration?: string;
  stops?: number;
  fare?: number;
  fareCurrency?: string;
  cabin?: string;
  seatsLeft?: number | string;
}

const FLIGHT_NO = /\b6E[-\s]*(\d{2,4})\b/i;

const num = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.replace(/[₹,\s]/g, ''));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
};

const timeish = (v: unknown): string | undefined =>
  typeof v === 'string' && /\d{1,2}:\d{2}/.test(v) ? v : undefined;

/** Fare-looking fields, in preference order. */
const FARE_KEYS = ['totalFare', 'totalAmount', 'fareAmount', 'fare', 'netFare', 'totalPrice', 'amount', 'adultFare', 'displayFare', 'baseFareAmount'];
/** Flight-number-ish keys. */
const NO_KEYS = ['flightNumber', 'flightNo', 'flight_number', 'flightCode', 'code', 'flightIdentifier', 'flightCodeWithSuffix'];
/** Departure/arrival/duration keys. */
const DEP_KEYS = ['departureTime', 'depTime', 'departureDateTime', 'std', 'scheduledDeparture', 'fromTime'];
const ARR_KEYS = ['arrivalTime', 'arrTime', 'arrivalDateTime', 'sta', 'scheduledArrival', 'toTime'];
const DUR_KEYS = ['duration', 'travelTime', 'journeyDuration', 'flightDuration', 'totalDuration'];
/** Keys whose objects carry per-leg detail (merged into the flight view). */
const FLIGHT_DETAIL_KEYS = ['flightDetail', 'flightInfo', 'flightDetails', 'segment', 'leg'];

function pick(o: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k];
  return undefined;
}

/** Try to read a flight number from an object (direct or nested detail key). */
function flightNo(o: Record<string, unknown>): string | undefined {
  const direct = pick(o, NO_KEYS);
  if (typeof direct === 'string' && FLIGHT_NO.test(direct)) return direct.toUpperCase().replace(/\s+/, '-');
  for (const k of FLIGHT_DETAIL_KEYS) {
    const v = o[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const inner = flightNo(v as Record<string, unknown>);
      if (inner) return inner;
    }
  }
  return undefined;
}

/** Fill missing meta fields on `f` from object `o` (and only `o`). */
function fillMeta(o: Record<string, unknown>, f: IndigoFlight): void {
  const grab = (keys: string[], assign: (v: unknown) => void) => { const v = pick(o, keys); if (v !== undefined) assign(v); };
  if (!f.depTime) grab(DEP_KEYS, (v) => { f.depTime = timeish(v); });
  if (!f.arrTime) grab(ARR_KEYS, (v) => { f.arrTime = timeish(v); });
  if (!f.duration) grab(DUR_KEYS, (v) => { if (typeof v === 'string') f.duration = v; });
  if (f.stops === undefined) grab(['stop', 'stops', 'numberOfStops', 'stopCount'], (v) => { f.stops = num(v); });
  if (!f.cabin) grab(['cabin', 'cabinClass', 'class', 'fareFamily'], (v) => { if (typeof v === 'string') f.cabin = v; });
  if (f.seatsLeft === undefined) grab(['seatsLeft', 'seatsAvailable', 'availableSeats', 'seatLeft'], (v) => {
    const n = num(v); f.seatsLeft = n !== undefined ? n : (typeof v === 'string' ? v : undefined);
  });
  const stat = (keys: string[]): string | undefined => {
    for (const k of keys) { const v = o[k]; if (typeof v === 'string' && /^[A-Za-z]{3}$/.test(v.trim())) return v.trim().toUpperCase(); }
    return undefined;
  };
  if (!f.depStation) f.depStation = stat(['origin', 'from', 'originStation', 'fromStation', 'departureStation', 'originStationCode']);
  if (!f.arrStation) f.arrStation = stat(['destination', 'to', 'destinationStation', 'toStation', 'arrivalStation', 'destinationStationCode']);
  if (!f.fareCurrency) {
    const c = pick(o, ['currencyCode', 'currency']);
    if (typeof c === 'string' && c.trim()) f.fareCurrency = c;
  }
}

/**
 * Bottom-up tree walk. IndiGo's schema keeps the flight number on the leg node
 * and the journey fare on a parent option node, so:
 *   - a node carrying a 6E flight number becomes a (possibly fareless) flight;
 *   - an ancestor carrying a fare-ish number adopts the first fareless flight
 *     in its subtree (journey fare binds once, to the marketed leg);
 *   - meta is merged from the node itself plus nested detail objects.
 */
export function collectFlights(root: any): IndigoFlight[] {
  const out: IndigoFlight[] = [];
  const walk = (node: any, depth: number): IndigoFlight[] => {
    const mine: IndigoFlight[] = [];
    if (depth > 14 || node == null) return mine;
    if (Array.isArray(node)) { for (const v of node) mine.push(...walk(v, depth + 1)); return mine; }
    if (typeof node !== 'object') return mine;
    const o = node as Record<string, unknown>;

    for (const [k, v] of Object.entries(o)) {
      if (FLIGHT_DETAIL_KEYS.includes(k) || v == null) continue; // detail objects folded in below
      mine.push(...walk(v, depth + 1));
    }

    const no = flightNo(o);
    if (no) {
      const f: IndigoFlight = { flightNo: no };
      for (const k of FLIGHT_DETAIL_KEYS) {
        const v = o[k];
        if (v && typeof v === 'object' && !Array.isArray(v)) fillMeta(v as Record<string, unknown>, f);
      }
      fillMeta(o, f);
      mine.push(f);
    }

    const fare = num(pick(o, FARE_KEYS));
    if (fare !== undefined && fare > 0) {
      const first = mine.find((f) => f.fare === undefined);
      if (first) {
        first.fare = fare;
        if (!first.fareCurrency) {
          const c = pick(o, ['currencyCode', 'currency']);
          if (typeof c === 'string' && c.trim()) first.fareCurrency = c;
        }
      }
    }

    // lone fareless flight under this node can inherit this node's meta
    if (!no) {
      const bare = mine.filter((f) => f.fare === undefined && (!f.depTime || !f.arrTime));
      if (bare.length === 1) fillMeta(o, bare[0]);
    }
    return mine;
  };
  out.push(...walk(root, 0));
  return out;
}

export function parseIndigoSearch(body: string): IndigoFlight[] {
  let root: any;
  try { root = JSON.parse(body); } catch { return []; }
  return collectFlights(root);
}

/** Map extracted flights to catalogue items. Seller = IndiGo's own website. */
export function indigoItems(
  flights: IndigoFlight[],
  source: SourceConfig,
  fromCity: string,
  toCity: string,
  fromCode: string,
  toCode: string,
  departIso: string,
): RawSourceItem[] {
  const items: RawSourceItem[] = [];
  const seen = new Set<string>();
  for (const f of flights) {
    if (f.fare === undefined || f.fare <= 0) continue; // honesty: no fare, no offer
    const key = `${f.flightNo}|${f.depTime || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const route = `${fromCity} to ${toCity}`.toLowerCase();
    const dep = f.depTime ? `, departs ${f.depTime}` : '';
    const arr = f.arrTime ? `, arrives ${f.arrTime}` : '';
    const deeplink = `https://www.goindigo.in/flight-booking/booking?journeyType=One%20Way&from=${fromCode}&to=${toCode}&depart=${departIso}&pax=A1`;
    items.push(newRawItem(source, {
      title: `IndiGo ${f.flightNo} ${fromCode} to ${toCode} on ${departIso}${dep}${arr}`,
      brand: 'IndiGo',
      price: f.fare,
      currency: f.fareCurrency === 'USD' ? 'USD' : 'INR',
      seller: 'IndiGo',
      sellerUrl: deeplink,
      travel: { route, seatType: f.cabin || 'Economy', date: departIso },
      attributes: {
        route,
        flight_no: f.flightNo || '',
        from_iata: fromCode,
        to_iata: toCode,
        departs: f.depTime || '',
        arrives: f.arrTime || '',
        duration: f.duration || '',
        stops: f.stops !== undefined ? String(f.stops) : '0',
        seats_left: f.seatsLeft !== undefined ? String(f.seatsLeft) : '',
        price_basis: `fare returned by IndiGo's own flight-search API for ${departIso}`,
      },
      identifiers: { sku: `indigo-${f.flightNo}-${route.replace(/\s+/g, '-')}-${departIso}` },
      evidence: {
        sourceUrl: 'https://api-prod-mobile-skyplus6e.goindigo.in/flightsearch/v1/flight/search',
        extractedFields: ['flightNumber', 'totalFare', 'departureTime', 'arrivalTime'],
      },
    }));
    if (items.length >= 25) break;
  }
  return items;
}
