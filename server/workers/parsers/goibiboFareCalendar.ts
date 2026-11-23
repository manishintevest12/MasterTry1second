/**
 * Goibibo fare-calendar parser (23 Nov 2026 discovery — owner: "goibibo flights add kro").
 *
 * Until now Goibibo was the one flight seller with NO price in the results: its SEO route page
 * (goibiboFlights.ts, 17 Oct) is server-rendered but DATE-BLIND — every request returns one
 * far-future service date, so a dated search could only show a schedule with "check live fare".
 *
 * `flights-cb.goibibo.com/api/fareCalendar` is the same flight-cb backend MakeMyTrip's calendar
 * uses (mmtFareCalendar.ts) and it is OPEN browserless: no cookie, no sensor, no Akamai challenge.
 * Verified from the sandbox on 23 Nov 2026 for IDR-DEL: HTTP 200, 327 date keys, real per-date INR
 * lowest fares with the cheapest airline named on each date ("281126" -> ₹ 7,337, Air India Express).
 *
 * What the headers need (measured, each one earned from a rejection):
 *   - `mcid` and `device-id`: without mcid the API answers 403 "Missing Header mcid".
 *   - `it=<ORG>-<DST>-<YYYYMMDD>`: a DDMMYY date answers 400 STATUS_MSG_INVALID_DATE, and a request
 *     without `it` answers 400 "Itinerary ... required".
 *
 * Honest limits, stated on the card: the calendar publishes the per-date LOWEST fare and the
 * cheapest airline only — never flight numbers or departure times. The row says exactly that
 * instead of inventing a schedule; booking continues on Goibibo's own search page for that date.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export interface GoibiboDayFare {
  /** ISO date YYYY-MM-DD decoded from the DDMMYY key. */
  dt: string;
  /** Lowest fare in INR for that date. */
  pr: number;
  /** Cheapest airline name for that date (e.g. "Air India Express"), when Goibibo names it. */
  airline?: string;
  /** Verbatim date label from Goibibo (e.g. "Sat, Nov 28") — evidence field. */
  label: string;
}

/** A stable device id / mcid. Goibibo's own web client sends a UUID here; any UUID is accepted. */
function goibiboDeviceId(): string {
  return '94338e88-73de-4bc6-b77c-b1baf7fdb58f';
}

export function goibiboFareCalendarUrl(fromCode: string, toCode: string, depCompact: string): string {
  const did = goibiboDeviceId();
  return `https://flights-cb.goibibo.com/api/fareCalendar?apiCallTimestamp=${Date.now()}&crId=${did}`
    + `&it=${fromCode}-${toCode}-${depCompact}&tripType=O&pfm=DESKTOP&src=desktop&region=in&cur=INR`
    + `&currency=INR&language=eng&pax=A-1_C-0_I-0&cc=E&cmpId=&dfs=0&forwardFlowRequired=true&shd=true&sortBy=rhino`;
}

/** App headers the flights-cb backend expects (captured 23 Nov 2026; `mcid` is mandatory). */
export function goibiboCalendarHeaders(fromCode: string, toCode: string, depCompact: string): Record<string, string> {
  const did = goibiboDeviceId();
  return {
    Accept: 'application/json',
    'app-ver': '1.0.0',
    'device-id': did,
    'entity-name': 'india',
    os: 'Windows',
    domain: 'in',
    'user-country': 'IN',
    currency: 'INR',
    mcid: did,
    region: 'in',
    pfm: 'DESKTOP',
    src: 'desktop',
    'profile-type': 'b2c',
    Origin: 'https://www.goibibo.com',
    Referer: `https://www.goibibo.com/flight/search?itinerary=${fromCode}-${toCode}-${depCompact}`,
  };
}

/** Decode the DDMMYY fare key to an ISO date (the response's own `txt` label is kept as evidence). */
function keyToIso(key: string): string | null {
  if (!/^\d{6}$/.test(key)) return null;
  const dd = Number(key.slice(0, 2));
  const mm = Number(key.slice(2, 4));
  const yy = Number(key.slice(4, 6));
  if (dd < 1 || dd > 31 || mm < 1 || mm > 12) return null;
  const year = 2000 + yy;
  const iso = `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  const check = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(check.getTime()) || check.getUTCDate() !== dd || check.getUTCMonth() !== mm - 1) return null;
  return iso;
}

export function parseGoibiboFareCalendar(body: string): GoibiboDayFare[] {
  let d: any;
  try {
    d = JSON.parse(body);
  } catch {
    return [];
  }
  const fares = d?.fares;
  if (!fares || typeof fares !== 'object') return [];
  const out: GoibiboDayFare[] = [];
  for (const [key, fRaw] of Object.entries<any>(fares)) {
    const dt = keyToIso(key);
    if (!dt) continue;
    // "₹ 7,337" / "7,337" -> 7337
    const pr = Number(String(fRaw?.fr ?? '').replace(/[^\d.]/g, ''));
    if (!Number.isFinite(pr) || pr <= 0) continue;
    const airline = fRaw?.airlineInfo?.name ? String(fRaw.airlineInfo.name) : undefined;
    out.push({ dt, pr, airline, label: String(fRaw?.txt || '') });
  }
  return out;
}

/** The public Goibibo search URL for a route + date (the user's booking target). */
export function goibiboSearchUrl(fromCode: string, toCode: string, depIso: string): string {
  const depCompact = String(depIso || '').replace(/-/g, '');
  return `https://www.goibibo.com/flight/search/?tripType=O&itinerary=${fromCode}-${toCode}-${depCompact}`
    + '&paxType=A-1_C-0_I-0&cabinClass=E&sTime=0&forwardFlowRequired=true&intl=false&ssr=false';
}

/**
 * Emit ONE honest offer, like the MMT/Via calendar workers: the exact depart date's calendar fare
 * when Goibibo publishes one, else the cheapest upcoming date CLEARLY labelled as a different date.
 * Seller is Goibibo, and the cheapest airline is named (owner rule: seller + airline on the card).
 */
export function goibiboDayFareItems(
  fares: GoibiboDayFare[],
  source: SourceConfig,
  fromCity: string,
  toCity: string,
  fromCode: string,
  toCode: string,
  depIso: string,
): RawSourceItem[] {
  const today = new Date().toISOString().slice(0, 10);
  const exact = fares.find((f) => f.dt === depIso);
  const upcoming = [...fares].filter((f) => f.dt >= today).sort((a, b) => a.pr - b.pr);
  const chosen = exact || upcoming[0];
  if (!chosen) return [];
  const isExact = Boolean(exact);
  const routeLabel = `${fromCity} → ${toCity}`;
  const airlineLabel = chosen.airline ? ` (${chosen.airline})` : '';
  return [newRawItem(source, {
    title: `Goibibo ${routeLabel} ${isExact ? `on ${chosen.dt}` : `(cheapest upcoming, ${chosen.dt})`} from ₹${Math.round(chosen.pr)}${airlineLabel}`,
    brand: 'Goibibo',
    price: Math.round(chosen.pr),
    currency: 'INR',
    seller: 'Goibibo',
    sellerUrl: goibiboSearchUrl(fromCode, toCode, chosen.dt),
    travel: { route: `${fromCity.toLowerCase()} to ${toCity.toLowerCase()}`, date: chosen.dt },
    attributes: {
      route: routeLabel,
      travel_date: chosen.dt,
      departure_date: chosen.dt,
      airline: chosen.airline || '',
      fare_detail: chosen.airline
        ? `lowest ${chosen.airline} economy fare published by Goibibo for ${chosen.dt}`
        : `lowest economy fare published by Goibibo for ${chosen.dt}`,
      fare_class: chosen.airline
        ? `lowest economy fare on Goibibo's calendar, flown by ${chosen.airline}`
        : "lowest economy fare on Goibibo's fare calendar",
      // Machine-readable for the cards (website + Flutter app read the same field), with the full sentence in
      // data_note so no client has to parse prose.
      price_basis: isExact ? 'live_fare' : 'cheapest_upcoming_fare',
      data_note: `Lowest Goibibo fare from the fare-calendar API on ${today} for this route${isExact ? ' and date' : ' within the returned calendar window'}. Fare acquired from Goibibo's fare calendar on ${today} (date label "${chosen.label}"); the calendar publishes the per-date lowest fare and the cheapest airline only, so no flight number or time is claimed. Booking continues on Goibibo's own search page.`,
      image: '',
    },
    identifiers: { sku: `gi-${fromCode}-${toCode}-${chosen.dt}` },
    evidence: {
      sourceUrl: goibiboFareCalendarUrl(fromCode, toCode, String(chosen.dt).replace(/-/g, '')),
      extractedFields: ['per-date lowest INR fare', 'cheapest airline name', 'date label'],
    },
  })];
}
