/**
 * Yatra flights parser (17 Oct 2026) — FULL PER-FLIGHT, browserless.
 *
 * Yatra's SRP is an Angular SPA behind Akamai for the HTML shell, but the
 * air-service JSON API the SRP calls is fully OPEN to plain curl_cffi (no
 * cookies, no sensor, no guest token; verified from a datacenter IP):
 *
 *   1) SEARCH INIT (also returns the first result batch):
 *   GET https://flight.yatra.com/air-service/dom2/trigger
 *       ?ADT=1&CHD=0&INF=0&class=Economy&destination=BOM&destinationCountry=IN
 *       &flexi=0&flight_depart_date=25/10/2026&hb=&noOfSegments=1
 *       &origin=DEL&originCountry=IN&type=O&unique=<ms>&viewName=normal
 *   -> { resultData: [ { isFlights, fltSchedule: { [ORIG+DEST+YYYYMMDD]: [flight...],
 *        airlineNames: { QP: "Akasa Air", ... } },
 *        fareDetails: { [ORIG+DEST+YYYYMMDD]: { [flightId]: { O: { ADT: { tf, bf, ftf } } } } } } ] }
 *
 *   2) PER-AIRLINE POLLS (each adds a batch; polling_id = <searchId>_<supplier>):
 *   GET /air-service/dom2/poll?polling_id=<uuid>_QPAPI|_6EAPI|_AIRASIAAPI|_1AWS4|_SGAPI
 *   (the searchId is any UUID in the trigger body; supplier APIs are the same
 *    keys Yatra's own SRP polls.)
 *
 *   3) FARE-CALENDAR FALLBACK (60-day, per-day per-airline cheapest):
 *   GET /lowest-fare-service/dom2/get-fare?origin=DEL&destination=BOM
 *       &from=17-10-2026&to=15-12-2026&tripType=O&airlines=all&src=srp
 *   -> { ld, lf, day: { "2026-10-18": { lf, af: { AI: { tf, bf, ow: [{fl, ac, an, ddt, adt}] } } } } }
 *
 * Flight shape: ID, OD[] (tdu = duration "HH:MM", fids), OD[0].FS[] = segments
 * (ac = airline IATA, fl = flight number, dd/ad = dep/arr times, dac/aac =
 * airports, du = duration). Fare = fareDetails[routeKey][ID].O.ADT.tf (INR).
 *
 * Seller policy: Yatra is the ticket-selling website -> seller=Yatra, deeplink
 * to Yatra's own SRP URL (the air-search-ui trigger URL the site itself uses).
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';
import { EMT_AIRLINES } from './emtFareCalendar';

export const YATRA_API = 'https://flight.yatra.com';
/** The five supplier APIs Yatra's own SRP polls after the trigger call. */
export const YATRA_SUPPLIERS = ['QPAPI', '6EAPI', 'AIRASIAAPI', '1AWS4', 'SGAPI'] as const;

/** air-service trigger URL (search init; returns the first batch inline). */
export function yatraTriggerUrl(from: string, to: string, depIso: string, countryFrom = 'IN', countryTo = 'IN'): string {
  const [y, m, d] = depIso.split('-');
  return `${YATRA_API}/air-service/dom2/trigger?ADT=1&CHD=0&INF=0&class=Economy`
    + `&destination=${to}&destinationCountry=${countryTo}`
    + `&flexi=0&flight_depart_date=${encodeURIComponent(`${d}/${m}/${y}`)}&hb=`
    + `&noOfSegments=1&origin=${from}&originCountry=${countryFrom}&type=O`
    + `&unique=${Date.now()}&viewName=normal`;
}

/** Yatra's own SRP deeplink (what the site navigates to on Search). */
export function yatraSrpUrl(from: string, to: string, depIso: string): string {
  const [y, m, d] = depIso.split('-');
  const dd = `${d}/${m}/${y}`;
  // Owner 29 Oct ("yatra pr jaake home page khul raha hai"): this URL is both the row's
  // exit target AND the SRP page Yatra's own SPA lives on, so it has to look exactly like
  // the URL Yatra's homepage form produces. Two things in the old shape were wrong for the
  // PAGE (they were right for the JSON API the worker calls):
  //   1. a trailing empty `arrivalDate=` — Yatra's router reads an empty arrival date as a
  //      malformed search and drops back to the booking home page;
  //   2. the date param was only `flight_depart_date` (the air-service API name); the SRP
  //      router reads `departureDate`.
  // Fix: no empty params, flex=1 (flexible-dates off, which is what the form sends), and
  // BOTH date names set to the same value so either reader finds the searched day.
  return `${YATRA_API}/air-search-ui/dom2/trigger?type=O&viewName=normal&flex=1&noOfSegments=1`
    + `&origin=${from}&originCountry=IN&destination=${to}&destinationCountry=IN`
    + `&departureDate=${encodeURIComponent(dd)}&flight_depart_date=${encodeURIComponent(dd)}`
    + `&ADT=1&CHD=0&INF=0&class=Economy&lang=en&source=fresco-flights`;
}

/** Lowest-fare calendar URL (dd-MM-yyyy window, up to ~60 days). */
export function yatraCalendarUrl(from: string, to: string, fromIso: string, toIso: string): string {
  const f = fromIso.split('-').reverse().join('-');
  const t = toIso.split('-').reverse().join('-');
  return `${YATRA_API}/lowest-fare-service/dom2/get-fare?origin=${from}&destination=${to}`
    + `&from=${f}&to=${t}&tripType=O&airlines=all&_i=${Date.now()}&src=srp`;
}

function airlineName(code: string, map: Record<string, any>): string {
  const n = map?.[code];
  if (typeof n === 'string' && n.trim()) return n.trim();
  const e = EMT_AIRLINES[code];
  if (e?.name) return e.name;
  return code;
}

function hhmm(iso: string, hm: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso} ${hm}` : `${iso} ${hm}`.trim();
}

/**
 * Parse ONE air-service batch (trigger or poll body). routeKey = ORIGDESTYYYYMMDD
 * (e.g. DELBOM20261025). Emits one offer per flight with a real fare.
 */
export function parseYatraBatch(
  body: string,
  source: SourceConfig,
  srpUrl: string,
  routeKey: string,
  fromCity: string,
  toCity: string,
): RawSourceItem[] {
  let root: any;
  try {
    root = JSON.parse(body);
  } catch {
    return [];
  }
  if (typeof root === 'string') { try { root = JSON.parse(root); } catch { return []; } }

  const out: RawSourceItem[] = [];
  const seen = new Set<string>();
  const batches = Array.isArray(root?.resultData) ? root.resultData : [root];

  for (const batch of batches) {
    if (!batch || typeof batch !== 'object') continue;
    if (String(batch.isError) === '1' && !batch.fltSchedule) continue;
    const sched = batch.fltSchedule;
    const airlineMap = sched?.airlineNames || {};
    const flights = sched?.[routeKey];
    const fares = batch.fareDetails?.[routeKey];
    if (!Array.isArray(flights) || !fares) continue;

    for (const f of flights) {
      const od = Array.isArray(f?.OD) ? f.OD[0] : null;
      if (!od) continue;
      const fid = String(od.fid || f.ID || '');
      if (!fid || seen.has(fid)) continue;
      const segs = Array.isArray(od.FS) ? od.FS : [];
      if (!segs.length) continue;
      const fare = fares?.[fid]?.O?.ADT;
      const price = Number(fare?.tf ?? fare?.ftf);
      if (!Number.isFinite(price) || price <= 0) continue;

      const first = segs[0]; const last = segs[segs.length - 1];
      const ac = String(first.ac || '');
      const fl = String(first.fl || '');
      const name = airlineName(ac, airlineMap);
      const stops = segs.length - 1;
      const depDate = String(first.ddt || '').slice(0, 10);
      const routeLabel = `${fromCity} → ${toCity}`;
      seen.add(fid);

      out.push(newRawItem(source, {
        title: `${name} ${ac}${fl ? `-${fl}` : ''} ${routeLabel} ${stops ? `(${stops} stop${stops > 1 ? 's' : ''})` : 'non-stop'}`.slice(0, 200),
        brand: name,
        price: Math.round(price),
        currency: 'INR',
        seller: 'Yatra',
        sellerUrl: srpUrl,
        travel: { route: `${fromCity.toLowerCase()} to ${toCity.toLowerCase()}`, date: depDate },
        attributes: {
          airline: name,
          flight_number: `${ac}${fl}`,
          departure: hhmm(depDate, String(first.dd || '')),
          arrival: hhmm(String(last.adt || '').slice(0, 10), String(last.ad || '')),
          duration: String(od.tdu || first.du || ''),
          stops: String(stops),
          origin: String(first.dac || ''),
          destination: String(last.aac || ''),
          fare_basis: String(od.fareId || 'Economy'),
          price_basis: `total Yatra fare for 1 adult from Yatra's own flight search API on ${new Date().toISOString().slice(0, 10)}`,
          data_note: `Fare acquired from Yatra's official flight search API on ${new Date().toISOString().slice(0, 10)}; booking continues on Yatra's own website.`,
          image: '',
        },
        identifiers: { sku: fid },
        evidence: {
          sourceUrl: srpUrl,
          extractedFields: ['fltSchedule[].OD[].FS[].ac/fl/dd/ad/dac/aac', 'fareDetails[][].O.ADT.tf (INR)', 'airlineNames'],
        },
      }));
    }
  }
  return out;
}

/**
 * Fallback: the get-fare calendar, per-day per-airline cheapest. For the
 * requested date we emit one honest offer per airline (flight number + times
 * from ow[0], fare tf) — else the cheapest upcoming day.
 */
export function yatraCalendarItems(
  body: string,
  source: SourceConfig,
  fromCity: string,
  toCity: string,
  fromCode: string,
  toCode: string,
  depIso: string,
): RawSourceItem[] {
  let root: any;
  try {
    root = JSON.parse(body);
  } catch {
    return [];
  }
  if (typeof root === 'string') { try { root = JSON.parse(root); } catch { return []; } }
  const day: any = root?.day;
  if (!day || typeof day !== 'object') return [];

  const exact = day[depIso];
  let targetKey: string | null = null;
  if (exact && exact.af && Object.keys(exact.af).length) targetKey = depIso;
  else {
    const upcoming = Object.keys(day).filter((k) => k > depIso).sort();
    for (const k of upcoming) { if (day[k]?.af && Object.keys(day[k].af).length) { targetKey = k; break; } }
  }
  if (!targetKey) return [];

  const dateLabel = targetKey === depIso ? `on ${targetKey}` : `(cheapest upcoming, ${targetKey})`;
  const srp = yatraSrpUrl(fromCode, toCode, targetKey);
  const items: RawSourceItem[] = [];
  for (const [code, af] of Object.entries((day[targetKey] as any).af as Record<string, any>)) {
    const price = Number(af?.tf);
    if (!Number.isFinite(price) || price <= 0) continue;
    const ow = Array.isArray(af.ow) ? af.ow[0] : null;
    const name = String(ow?.an || EMT_AIRLINES[code]?.name || code);
    const fl = String(ow?.fl || '');
    const depT = String(ow?.ddt || '').slice(11, 16);
    const arrT = String(ow?.adt || '').slice(11, 16);
    items.push(newRawItem(source, {
      title: `${name} ${code}${fl ? `-${fl}` : ''} ${fromCity} → ${toCity} ${dateLabel} from ₹${Math.round(price)}`.slice(0, 200),
      brand: name,
      price: Math.round(price),
      currency: 'INR',
      seller: 'Yatra',
      sellerUrl: srp,
      travel: { route: `${fromCity.toLowerCase()} to ${toCity.toLowerCase()}`, date: targetKey },
      attributes: {
        airline: name,
        flight_number: `${code}${fl}`,
        ...(depT ? { departure: depT } : {}),
        ...(arrT ? { arrival: arrT } : {}),
        fare_class: `lowest ${name} fare on Yatra's fare calendar for this route`,
        price_basis: `Yatra lowest-fare calendar value on ${new Date().toISOString().slice(0, 10)}`,
        data_note: `Fare acquired from Yatra's official fare calendar on ${new Date().toISOString().slice(0, 10)}; booking continues on Yatra's own website.`,
        image: '',
      },
      identifiers: { sku: `yatra-cal-${fromCode}-${toCode}-${targetKey}-${code}` },
      evidence: {
        sourceUrl: yatraCalendarUrl(fromCode, toCode, targetKey, targetKey),
        extractedFields: ['day[][].af[].tf (INR)', 'day[][].af[].ow[].fl/ddt/adt'],
      },
    }));
  }
  return items;
}
