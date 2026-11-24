/**
 * Goibibo flights parser (17 Oct 2026) — LIVE via SSR route landing pages.
 *
 * www.goibibo.com tarpits the root and /flights/ app on datacenter IPs
 * (HTTP/2 reset), but its SEO route landing pages are server-rendered with the
 * FULL listing state: GET https://www.goibibo.com/flights/<from>-to-<to>-flights/
 * embeds a ~1.5MB Next.js __NEXT_DATA__ blob at
 *   props.pageProps.data.state.listing:
 *     - flightSearchParams.itinerary = "DEL-BOM-20/10/2026" (the page's own date)
 *     - journeys.allJourneys[0][] = offers: fare (total INR number),
 *       simpleAirlineHeading {cd, nm} (airline name), flightNumber,
 *       journeyKeys = ["ORIG$DEST$YYYY-MM-DD HH:MM$FLNO|LEG2..."] per leg
 *     - journeyMap.data["DEL$BOM$2026-10-20 06:50$QP-1833"] = depTime/arrTime/
 *       duration{h,m}/stops/depCityCd/arrCityCd
 * The page chooses its own (nearest serviceable) date — every offer is labelled
 * with that real date; nothing is invented. Seller=Goibibo, deeplink to the
 * same route page. Verified live: DEL-BOM 16 journeys (QP 1833 Rs6675 non-stop,
 * IX 1165/1027 Rs6406 1-stop, 6E/SG/AI present), DEL-GOI serves 08/11/2026.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';
import { EMT_AIRLINES } from './emtFareCalendar';

/** Goibibo route-slug aliases (their SEO slugs use legacy spellings). */
const SLUG_ALIASES: Record<string, string> = {
  'new delhi': 'delhi', delhi: 'delhi', mumbai: 'mumbai', bengaluru: 'bangalore',
  bangalore: 'bangalore', mysuru: 'mysore', mysore: 'mysore', gurgaon: 'gurugram',
  gurugram: 'gurugram', 'kolkata': 'kolkata', chennai: 'chennai', hyderabad: 'hyderabad',
  pune: 'pune', goa: 'goa', panaji: 'goa', jaipur: 'jaipur', ahmedabad: 'ahmedabad',
  lucknow: 'lucknow', indore: 'indore', bhopal: 'bhopal', nagpur: 'nagpur',
  patna: 'patna', guwahati: 'guwahati', kochi: 'kochi', coimbatore: 'coimbatore',
  chandigarh: 'chandigarh', varanasi: 'varanasi', srinagar: 'srinagar',
  dehradun: 'dehradun', amritsar: 'amritsar', udaipur: 'udaipur', jodhpur: 'jodhpur',
  trivandrum: 'trivandrum', thiruvananthapuram: 'trivandrum', vizag: 'vizag',
  visakhapatnam: 'vizag', surat: 'surat', vadodara: 'vadodara', rajkot: 'rajkot',
  ranchi: 'ranchi', bhubaneswar: 'bhubaneswar', imphal: 'imphal', agartala: 'agartala',
};


/**
 * Goibibo's route page changed shape (measured 24 Nov 2026). The old
 * `state.listing.journeys.allJourneys` tree is gone; the page now carries
 *   state.Listing.listingResponse.journeyMap
 * keyed by a journey key `ORIG$DEST$YYYY-MM-DD HH:MM$FLNO|LEG2...`, whose value holds
 * depTime/arrTime/stops/duration/seatsLeft/airlineCodes/journeyHeader (airline, HTML).
 * `fareDetails.rtFareMap` is EMPTY: the page publishes SCHEDULES but no per-flight fares.
 *
 * OWNER 24 Nov ("Goibibo ka pura schedule dikhaun ... par price na likhun, sirf Check live fare"):
 * these rows therefore carry NO price and say so (`price_basis: live_fares_unavailable`,
 * `seller_presence: true`). Every field is the page's own; the date on each row is the date the
 * page really publishes, never the date the user searched.
 */
export function parseGoibiboSchedule(
  html: string,
  source: SourceConfig,
  pageUrl: string,
  fromCity: string,
  toCity: string,
): RawSourceItem[] {
  let root: any = null;
  const m = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (m) { try { root = JSON.parse(m[1]); } catch { root = null; } }
  const listing = root?.props?.pageProps?.data?.state?.Listing?.listingResponse;
  const jm: Record<string, any> = listing?.journeyMap || {};
  const keys = Object.keys(jm);
  if (!keys.length) return [];

  const out: RawSourceItem[] = [];
  const seen = new Set<string>();
  for (const key of keys) {
    const seg = jm[key] || {};
    const legs = String(key).split('|');
    const first = legs[0] || '';
    const parts = first.split('$');
    const flightNo = String(parts[3] || '').replace(/_/g, ' ').trim();
    const when = String(parts[2] || '').trim();
    const serviceDate = (when.match(/^(\d{4}-\d{2}-\d{2})/) || [])[1] || '';
    const stops = Number(seg.stops ?? (legs.length - 1));
    const airline = stripTags(String(seg.journeyHeader || seg.airlineNamesOnly || '')).trim()
      || EMT_AIRLINES[String((seg.airlineCodes || [])[0] || '')]?.name || 'Flight';
    const depT = String(seg.depTime || '').trim();
    const arrT = String(seg.arrTime || '').trim();
    if (!depT || !arrT) continue;
    const dur = seg.duration && (seg.duration.h || seg.duration.m)
      ? `${seg.duration.h || '00'}h ${seg.duration.m || '00'}m` : '';
    const seats = String(seg.seatsLeft || '').replace(/[^0-9]/g, '');
    const dedupe = `${flightNo}|${depT}|${arrT}|${serviceDate}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    out.push(newRawItem(source, {
      title: `${airline} ${flightNo} ${fromCity} → ${toCity} ${stops ? `(${stops} stop${stops > 1 ? 's' : ''})` : 'non-stop'}${serviceDate ? ` on ${serviceDate}` : ''}`
        .replace(/\s+/g, ' ').slice(0, 200),
      brand: airline,
      seller: 'Goibibo',
      sellerUrl: pageUrl,
      travel: { route: `${fromCity.toLowerCase()} to ${toCity.toLowerCase()}`, ...(serviceDate ? { date: serviceDate } : {}) },
      availability: 'unknown',
      attributes: {
        airline,
        flight_number: flightNo,
        departure: depT,
        arrival: arrT,
        stops: String(stops),
        ...(dur ? { duration: dur } : {}),
        ...(seats ? { seats_available: seats } : {}),
        origin: String(seg.depCityCd || parts[0] || ''),
        destination: String(seg.arrCityCd || '') || String(toCity),
        ...(serviceDate ? { schedule_date: serviceDate } : {}),
        price_basis: 'live_fares_unavailable',
        seller_presence: 'true',
        booking_cta: 'Check live fare',
        data_note: `Goibibo's own route page publishes this flight's schedule (times, stops, airline) but no fare for it${serviceDate ? ` on its ${serviceDate} listing` : ''}; no price is claimed here. The button opens Goibibo's own dated search.`,
        image: '',
      },
      identifiers: { sku: `gi-sched-${dedupe}`.replace(/[^A-Za-z0-9.-]/g, '-') },
      evidence: {
        sourceUrl: pageUrl,
        extractedFields: ['state.Listing.listingResponse.journeyMap (times, stops, airline, seats) — no fare published'],
      },
    }));
  }
  return out;
}

export function goibiboRouteUrl(fromCity: string, toCity: string): string {
  const slug = (c: string) => {
    const k = String(c).toLowerCase().trim().replace(/\s*\([^)]*\)/g, '').trim();
    return (SLUG_ALIASES[k] || k).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  };
  return `https://www.goibibo.com/flights/${slug(fromCity)}-to-${slug(toCity)}-flights/`;
}

interface GiJourney {
  fare?: number;
  finalFare?: string;
  flightNumber?: string;
  simpleAirlineHeading?: { cd?: string; nm?: string };
  airlineCodes?: string[];
  journeyKeys?: string[];
}

function stripTags(s: string): string {
  return String(s).replace(/<[^>]*>/g, '').trim();
}

/**
 * Parse a Goibibo SSR route page. fromCity/toCity are the display cities.
 * Emits one offer per journey with its REAL total INR fare and page date.
 */
export function parseGoibiboSsr(
  html: string,
  source: SourceConfig,
  pageUrl: string,
  fromCity: string,
  toCity: string,
): RawSourceItem[] {
  let root: any = null;
  const m = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (m) {
    try { root = JSON.parse(m[1]); } catch { root = null; }
  }
  if (!root) {
    // fallback: largest script body containing journeyMap
    for (const s of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) {
      const b = s[1];
      if (b.includes('"journeyMap"') && b.trim().startsWith('{')) {
        try { root = JSON.parse(b); break; } catch { /* keep looking */ }
      }
    }
  }
  const listing = root?.props?.pageProps?.data?.state?.listing;
  if (!listing) return [];

  // real date of this page's fares, e.g. itinerary "DEL-BOM-20/10/2026"
  const itin = String(listing?.flightSearchParams?.itinerary || '');
  const dm = itin.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const fareDate = dm ? `${dm[3]}-${dm[2]}-${dm[1]}` : '';
  const jm: Record<string, any> = listing?.journeyMap?.data || {};
  const groups = listing?.journeys?.allJourneys;
  if (!Array.isArray(groups) || !groups.length) return [];
  // OWNER 24 Nov ("goibibo mai sirf ek card aa raha hai"): `allJourneys` is a list of GROUPS - one per cabin /
  // fare family and, on a return search, one per leg. Only `groups[0]` was read, so a listing with 16 journeys
  // could reach the page as a single card. Every group is read now and de-duplicated by its own journey key, so
  // one flight is never shown twice and no flight is silently dropped.
  const journeys: GiJourney[] = (Array.isArray(groups[0]) ? groups.flat(1) : groups)
    .filter((j: any) => j && typeof j === 'object') as GiJourney[];
  const seenKeys = new Set<string>();

  const out: RawSourceItem[] = [];
  for (const j of journeys) {
    const price = Number(j.fare);
    if (!Number.isFinite(price) || price <= 0) continue;
    const keys = Array.isArray(j.journeyKeys) ? j.journeyKeys : [];
    if (!keys.length) continue;
    const dedupeKey = String(keys[0]);
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);
    const legs = String(keys[0]).split('|');
    const firstKey = legs[0]; const lastKey = legs[legs.length - 1];
    const firstSeg = jm[firstKey]; const lastSeg = jm[lastKey];
    if (!firstSeg) continue;
    const stops = legs.length - 1;
    const name = stripTags(String(j.simpleAirlineHeading?.nm || '')) || EMT_AIRLINES[String(j.airlineCodes?.[0] || '')]?.name || 'Flight';
    const flightNo = stripTags(String(j.flightNumber || j.simpleAirlineHeading?.cd || '')).slice(0, 40);
    const depT = String(firstSeg.depTime || '');
    const arrT = String(lastSeg?.arrTime || '');
    // OWNER 24 Nov ("seats left ye sb batao"): Goibibo publishes the seat count on the journey or on its first
    // segment under several spellings. Only a real number is carried - an absent count stays absent.
    const seatRaw = [
      (j as any).seatsLeft, (j as any).seats, (j as any).availableSeats, (j as any).seatsAvailable,
      firstSeg?.seatsLeft, firstSeg?.seats, firstSeg?.availableSeats, firstSeg?.seatsAvailable,
    ].find((v: any) => v !== undefined && v !== null && String(v).trim() !== '');
    const seats = seatRaw === undefined ? '' : String(seatRaw).replace(/[^0-9]/g, '');
    const routeLabel = `${fromCity} → ${toCity}`;
    // OWNER 24 Nov ("date ni aata"): the journey key itself carries the departure day
    // (`ORIG$DEST$YYYY-MM-DD HH:MM$FLNO`). The page-level itinerary date was the only source before, so a page whose
    // itinerary token was missing or stale produced a card with no date at all. The row's own key wins; the page date
    // is the fallback.
    const keyDate = (String(firstKey).match(/(\d{4})-(\d{2})-(\d{2})/) || [])
      .slice(1).join('-');
    const rowDate = keyDate || fareDate;
    const dateLabel = rowDate ? `on ${rowDate}` : '';

    out.push(newRawItem(source, {
      title: `${name} ${flightNo} ${routeLabel} ${stops ? `(${stops} stop${stops > 1 ? 's' : ''})` : 'non-stop'} ${dateLabel}`.slice(0, 200),
      brand: name,
      price: Math.round(price),
      currency: 'INR',
      seller: 'Goibibo',
      sellerUrl: pageUrl,
      travel: { route: `${fromCity.toLowerCase()} to ${toCity.toLowerCase()}`, date: rowDate },
      attributes: {
        airline: name,
        flight_number: flightNo,
        ...(depT ? { departure: depT } : {}),
        ...(arrT ? { arrival: arrT } : {}),
        stops: String(stops),
        ...(seats ? { seats_available: seats } : {}),
        origin: String(firstSeg.depCityCd || ''),
        destination: String(lastSeg?.arrCityCd || '') || String(toCity),
        ...(firstSeg.duration ? { duration: `${firstSeg.duration.h || '00'}h ${firstSeg.duration.m || '00'}m` } : {}),
        price_basis: `total Goibibo fare for 1 adult from Goibibo's own route-page listing on ${new Date().toISOString().slice(0, 10)}`,
        data_note: `Fare acquired from Goibibo's server-rendered route page on ${new Date().toISOString().slice(0, 10)}${rowDate ? ` for its service date ${rowDate}` : ''}; booking continues on Goibibo's own website.`,
        image: '',
      },
      identifiers: { sku: `gi-${keys[0]}`.replace(/[^A-Za-z0-9$|.:-]/g, '-') },
      evidence: {
        sourceUrl: pageUrl,
        extractedFields: ['listing.journeys.allJourneys[].fare (INR)', 'simpleAirlineHeading.nm', 'journeyKeys', 'journeyMap.data[].depTime/arrTime/stops'],
      },
    }));
  }
  return out;
}
