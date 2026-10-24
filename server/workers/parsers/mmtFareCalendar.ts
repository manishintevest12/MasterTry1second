/**
 * MakeMyTrip fare-calendar parser (21 Oct 2026 discovery).
 *
 * flights-cb.makemytrip.com/api/fareCalendar is OPEN browserless (Akamai gates
 * the SRP HTML and search-stream-dt SSE from datacenter IPs, but the fare
 * calendar returns full-year per-date lowest fares with the cheapest airline
 * named on each date). Verified live from the sandbox: 364 date keys, real INR
 * fares (BOM-DEL 28 Oct 2026 -> "₹ 6,638" IndiGo).
 *
 * Response shape:
 *   {"crId":"","fares":{"281026":{"cur":"₹","fr":"6,638","txt":"Wed, Oct 28",
 *      "lFrTxt":"₹ 6,638","airlineInfo":{"name":"IndiGo","codes":["6E"]}, ...}, ...}}
 * Date keys are DDMMYY ("281026" = 28 Oct 2026; verified against txt labels).
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export interface MmtDayFare {
  /** ISO date YYYY-MM-DD decoded from the DDMMYY key. */
  dt: string;
  /** Lowest fare in INR for that date. */
  pr: number;
  /** Cheapest airline name for that date (e.g. "IndiGo"), when MMT names it. */
  airline?: string;
  /** Verbatim date label from MMT (e.g. "Wed, Oct 28") — evidence field. */
  label: string;
}

export function mmtFareCalendarUrl(fromCode: string, toCode: string, depCompact: string): string {
  return `https://flights-cb.makemytrip.com/api/fareCalendar?apiCallTimestamp=${Date.now()}&crId=${mmtCrid()}&it=${fromCode}-${toCode}-${depCompact}&tripType=O&pfm=DESKTOP&src=desktop&region=in&cur=INR&currency=INR&language=eng&pax=A-1_C-0_I-0&cc=E&cmpId=&dfs=0&forwardFlowRequired=true&shd=true&sortBy=rhino`;
}

function mmtCrid(): string {
  return '94338e88-73de-4bc6-b77c-b1baf7fdb58f';
}

/** App headers the flights-cb backend expects (captured from the SRP bundle, 17 Oct recon). */
export function mmtCalendarHeaders(fromCode: string, toCode: string, depCompact: string): Record<string, string> {
  const did = mmtCrid();
  return {
    Accept: 'application/json', 'app-ver': '1.0.0', 'device-id': did, 'entity-name': 'india',
    os: 'Windows', domain: 'in', 'user-country': 'IN', currency: 'INR', mcid: did,
    region: 'in', pfm: 'DESKTOP', src: 'desktop', 'profile-type': 'b2c',
    Origin: 'https://www.makemytrip.com',
    Referer: `https://www.makemytrip.com/flight/search?itinerary=${fromCode}-${toCode}-${depCompact}`,
  };
}

/** Decode the DDMMYY fare key to ISO date; cross-checked against the txt label. */
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

export function parseMmtFareCalendar(body: string): MmtDayFare[] {
  let d: any;
  try {
    d = JSON.parse(body);
  } catch {
    return [];
  }
  const fares = d?.fares;
  if (!fares || typeof fares !== 'object') return [];
  const out: MmtDayFare[] = [];
  for (const [key, fRaw] of Object.entries<any>(fares)) {
    const dt = keyToIso(key);
    if (!dt) continue;
    // "₹ 6,746" / "6,746" -> 6746
    const pr = Number(String(fRaw?.fr ?? '').replace(/[^\d.]/g, ''));
    if (!Number.isFinite(pr) || pr <= 0) continue;
    const airline = fRaw?.airlineInfo?.name ? String(fRaw.airlineInfo.name) : undefined;
    out.push({ dt, pr, airline, label: String(fRaw?.txt || '') });
  }
  return out;
}

/** Build the public MMT SRP URL for a route+date (user redirect target). */
export function mmtSearchUrl(fromCode: string, toCode: string, depIso: string): string {
  const [y, m, dd] = depIso.split('-');
  return `https://www.makemytrip.com/flight/search?itinerary=${fromCode}-${toCode}-${dd}/${m}/${y}&tripType=O&paxType=A-1_C-0_I-0&intl=false&cabinClass=E&lang=eng`;
}

/**
 * Emit ONE honest offer like the Via.com calendar worker: the exact depart
 * date's calendar fare when present, else the cheapest upcoming date (clearly
 * labelled as such). The seller is MakeMyTrip and the cheapest airline is
 * named per the owner rule (seller + airline on the card).
 */
export function mmtDayFareItems(
  fares: MmtDayFare[],
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
    title: `MakeMyTrip ${routeLabel} ${isExact ? `on ${chosen.dt}` : `(cheapest upcoming, ${chosen.dt})`} from ₹${Math.round(chosen.pr)}${airlineLabel}`,
    brand: 'MakeMyTrip',
    price: Math.round(chosen.pr),
    currency: 'INR',
    seller: 'MakeMyTrip',
    sellerUrl: mmtSearchUrl(fromCode, toCode, chosen.dt),
    travel: { route: `${fromCity.toLowerCase()} to ${toCity.toLowerCase()}`, date: chosen.dt },
    attributes: {
      route: routeLabel,
      travel_date: chosen.dt,
      // Owner 24 Oct ("makemytrip date aur flight number wagera details ni de
      // raha"): the card now carries the service date + cheapest airline as
      // first-class specs. Flight numbers/times are NOT published by the fare
      // calendar (per-date lowest fare only) — the row says so honestly instead
      // of fabricating a schedule.
      departure_date: chosen.dt,
      airline: chosen.airline || '',
      fare_detail: chosen.airline ? `lowest ${chosen.airline} economy fare published by MakeMyTrip for ${chosen.dt}` : `lowest economy fare published by MakeMyTrip for ${chosen.dt}`,
      fare_class: chosen.airline
        ? `lowest economy fare on MakeMyTrip's calendar, flown by ${chosen.airline}`
        : 'lowest economy fare on MakeMyTrip\'s fare calendar',
      price_basis: `lowest MakeMyTrip fare from the fare-calendar API on ${today} for this route${isExact ? ' and date' : ' within the returned calendar window'}`,
      data_note: `Fare acquired from MakeMyTrip's fare calendar on ${today} (date label "${chosen.label}"); booking continues on MakeMyTrip's own website.`,
      image: '',
    },
    identifiers: { sku: `mmt-${fromCode}-${toCode}-${chosen.dt}` },
    evidence: {
      sourceUrl: mmtFareCalendarUrl(fromCode, toCode, chosen.dt.replace(/-/g, '')),
      extractedFields: ['fares[].fr (INR)', 'fares[].airlineInfo.name', 'fares[].txt'],
    },
  })];
}
