/**
 * EaseMyTrip AirBus_New flight-search parser — flights vertical.
 *
 * Reverse-engineered from EMT's own public Angular bundles (flight-search
 * main.js + lazy chunk 652, webpack module 7337/3035) with curl_cffi,
 * fully browserless:
 *
 *  1. POST gi.easemytrip.com/etm/api/etoken/GIT  (static ATK header from the
 *     public SearchJS.js) → { ITK: token, b: ip }
 *  2. POST gi.easemytrip.com/etm/api/etoken/GUT  (header autk = AES-128-CBC of
 *     "EMT|<static secret>|<ip>|<token>", key=iv="hylW@zmEQdG@4Idr" — all shipped
 *     in the public SearchJS.js) → { STK: search token }
 *  3. POST flightservice-node.easemytrip.com/AirAvail_Lights/AirBus_New with
 *     the FlightRQ shape built in chunk-652 GetFlightResult(): org/dept IATA,
 *     deptDT ISO date, Cabin=3 (Economy), TKN=STK. → j[].s[] = every flight with
 *     real INR fares (lstFr[].TF), seat counts (SeatAv), segMatchingKey
 *     "DELBOMTue-20Oct202617:0019:25AI441".
 *
 * Amounts are plain INR (verified against EMT's own rendered listing: Air India
 * Express min ₹6,406 == minp 6406; IndiGo 6E324 ₹6,845 == Ixigo's ₹6,845).
 * Per metasearch policy the seller surfaced is the operating AIRLINE and the
 * deeplink goes to the airline's own website — never to EaseMyTrip; the
 * data_note credits where the fare was observed.
 */
import { createCipheriv } from 'crypto';
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';
import { EMT_AIRLINES } from './emtFareCalendar';

const ENC_KEY = 'hylW@zmEQdG@4Idr'; // key = iv, shipped in EMT's public SearchJS.js
const GIT_URL = 'https://gi.easemytrip.com/etm/api/etoken/GIT';
const GUT_URL = 'https://gi.easemytrip.com/etm/api/etoken/GUT';
const GIT_ATK = 'c0ruxuOD/XqyNXB3kRAqvRUliyqhyFOOUwgDTCP1tLx09TRNEbblvRQLgfPz2ivf';
const EMT_SECRET = 'EMTWvggk6zYLVynBA56C3aNn4HLREMHV9bEP9Q';
const AIRBUS_URL = 'https://flightservice-node.easemytrip.com/AirAvail_Lights/AirBus_New';

/** AES-128-CBC(key=iv) PKCS7 → base64, exactly like CryptoJS EncryptionSearch(). */
export function emtEncrypt(plain: string): string {
  const c = createCipheriv('aes-128-cbc', Buffer.from(ENC_KEY, 'utf8'), Buffer.from(ENC_KEY, 'utf8'));
  return Buffer.concat([c.update(Buffer.from(plain, 'utf8')), c.final()]).toString('base64');
}

export interface EmtFlight {
  segKey: string;          // raw segMatchingKey
  airlineCode: string;      // 6E / AI / QP / SG / IX ...
  flightNo: string;         // "324"
  depTime: string;          // "13:00"
  arrTime: string;          // "15:10"
  fare: number;             // INR
  fareName: string | null;  // "Stretch" / "Retail" / "EMTEXCLUSIVE"
  seats: string;            // SeatAv
  stops: string;            // from SD "Non-Stop|fare|seats|DEL-BOM||"
  durationMin: number;      // computed from times (day rollover for red-eyes)
}

/**
 * segMatchingKey forms seen on live responses:
 *   non-stop:  "DELBOMTue-20Oct202617:0019:25AI441"
 *   1-stop:    "DELGWLTue-20Oct202613:5014:556E6454^GWLBOMTue-20Oct202616:1518:106E5265"
 *   (occasionally the first leg carries no route prefix: "6E6601^HYDBOM...")
 * Each leg: ORIG+DEST + Weekday-DDMMMYYYY + dep(5) + arr(5) + carrier + flightNo.
 */
const SEG_RE = /^[A-Z]{3}[A-Z]{3}[A-Za-z]{3}-\d{2}[A-Za-z]{3}\d{4}(\d{2}:\d{2})(\d{2}:\d{2})\s*([A-Z0-9]{2})\s*(\d+)$/;
const LEG_NO_ROUTE_RE = /^\s*([A-Z0-9]{2})\s*(\d+)$/;

/** Parse j[].s[] into flat flights; cheapest fare per flight wins. */
export function parseEmtAirbus(jsonText: string): EmtFlight[] {
  const d = JSON.parse(jsonText) as any;
  const groups = Array.isArray(d?.j) ? d.j : [];
  const out: EmtFlight[] = [];
  for (const g of groups) {
    for (const f of g?.s || []) {
      const segKey = String(f?.segMatchingKey || '');
      const legs = segKey.split('^').map((s) => s.trim());
      const parsed = legs
        .map((leg) => {
          const m = leg.match(SEG_RE);
          if (m) return { dep: m[1], arr: m[2], ac: m[3], fn: m[4], full: true };
          const n = leg.match(LEG_NO_ROUTE_RE);
          if (n) return { dep: '', arr: '', ac: n[1], fn: n[2], full: false };
          return null;
        })
        .filter(Boolean) as Array<{ dep: string; arr: string; ac: string; fn: string; full: boolean }>;
      if (parsed.length === 0 || !parsed.some((p) => p.full)) continue;
      const fullLegs = parsed.filter((p) => p.full);
      const depTime = fullLegs[0].dep; const arrTime = fullLegs[fullLegs.length - 1].arr;
      const airlineCode = parsed[0].ac;
      const flightNo = parsed.map((p) => p.fn).join('-'); // "6E5119-6E5146" for connections
      const fares = Array.isArray(f?.lstFr) ? f.lstFr : [];
      let fare = 0; let fareName: string | null = null;
      for (const fr of fares) {
        const tf = Number(fr?.TF) || 0;
        if (tf > 0 && (fare === 0 || tf < fare)) { fare = tf; fareName = fr?.FN || null; }
      }
      if (!fare || !depTime || !arrTime) continue;
      const sd = String(f?.SD || '');
      const stops = fullLegs.length === 1 ? 'Non-stop' : `${fullLegs.length - 1} stop${fullLegs.length > 2 ? 's' : ''}`;
      const [dh, dm] = depTime.split(':').map(Number);
      const [ah, amm] = arrTime.split(':').map(Number);
      let durMin = (ah * 60 + amm) - (dh * 60 + dm);
      if (durMin < 0) durMin += 24 * 60; // red-eye arrival next day
      out.push({
        segKey, airlineCode, flightNo, depTime, arrTime,
        fare, fareName, seats: String(f?.SeatAv ?? ''), stops, durationMin: durMin,
      });
    }
  }
  return out;
}

const hhmm = (mins: number) => `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;

/** Build one honest offer per real flight (cheapest-first, capped). */
export function emtAirbusItems(
  flights: EmtFlight[],
  source: SourceConfig,
  route: { from: string; to: string },
  fromCode: string,
  toCode: string,
  dateIso: string,
  fromCountry = 'India',
  toCountry = 'India',
  cap = 60,
): RawSourceItem[] {
  const today = new Date().toISOString().slice(0, 10);
  const routeLabel = `${route.from} → ${route.to}`;
  // EMT's own listing URL format: srch=CODE-City-Country|CODE-City-Country|dd/mm/yyyy.
  // Country comes from the global airport resolver (static map says India).
  const emtListing = `https://www.easemytrip.com/flight-search/listing?srch=${fromCode}-${encodeURIComponent(route.from)}-${encodeURIComponent(fromCountry || 'India')}%7C${toCode}-${encodeURIComponent(route.to)}-${encodeURIComponent(toCountry || 'India')}%7C${dateIso.split('-').reverse().join('/')}&px=1-0-0&cbn=Economy&isow=true&isdm=true`;
  const seen = new Set<string>();
  const items: RawSourceItem[] = [];
  for (const f of flights.sort((a, b) => a.fare - b.fare)) {
    // Known carriers get their honest name; unknown codes keep the raw IATA code
    // (never invented). Either way the SELLER is EaseMyTrip — the ticket-selling
    // website (owner policy 15 Oct) — not the operating airline.
    const al = EMT_AIRLINES[f.airlineCode];
    const alName = al?.name || f.airlineCode;
    const key = `${alName}|${f.flightNo}|${f.depTime}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (items.length >= cap) break;
    items.push(newRawItem(source, {
      title: `${alName} ${f.airlineCode}${f.flightNo} · ${routeLabel}`,
      brand: alName,
      price: f.fare,
      currency: 'INR',
      seller: 'EaseMyTrip',
      sellerUrl: emtListing,
      travel: { route: `${route.from.toLowerCase()} to ${route.to.toLowerCase()}`, date: dateIso },
      attributes: {
        route: routeLabel,
        airline: alName,
        flight_number: `${f.airlineCode}${f.flightNo}`,
        travel_date: dateIso,
        departure_date: dateIso,
        departure: f.depTime,
        arrival: f.arrTime,
        duration: hhmm(f.durationMin),
        stops: f.stops,
        seats: f.seats ? `${f.seats} seats left` : '',
        fare_basis: f.fareName ? `${f.fareName} fare` : '',
        price_basis: `live ${f.fareName || alName} fare observed on EaseMyTrip's flight search on ${today} (EaseMyTrip is the selling website)`,
        data_note: `Fare acquired via EaseMyTrip flight search API on ${today}; the ticket is SOLD by EaseMyTrip (seller), operating carrier ${alName}. Fare may change at checkout.`,
        deep_link_ref: emtListing,
      },
      identifiers: { sku: `emt-airbus-${f.airlineCode}-${f.flightNo}-${dateIso}` },
      evidence: {
        sourceUrl: AIRBUS_URL,
        extractedFields: ['segMatchingKey', 'lstFr[].TF (INR)', 'SeatAv', 'SD (stops)'],
      },
    }));
  }
  return items;
}
