/**
 * Aertrip fares parser — flights vertical.
 *
 * WHY THIS FILE EXISTS (owner 2 Nov: "flight mai aertrip ... add kro")
 * Aertrip is an Indian OTA that sells domestic + international inventory from many
 * suppliers. Its storefront is a JS-only SPA (every non-API path returns the same
 * ~200 KB shell, zero fares in HTML), so there is nothing to parse in the page. What IS
 * reachable with plain HTTP is Aertrip's own JSON API, verified live on 2 Nov 2026:
 *
 *   1) GET /api/v1/flights/search
 *        ?trip_type=single&adult=1&child=0&infant=0&cabinclass=economy
 *        &origin=IDR&destination=DEL&depart=19-11-2026&pType=flight
 *      -> {"success":true,"data":{"sid":"<32 hex>"}}     (depart is DD-MM-YYYY)
 *
 *   2) GET /api/v1/flights/results?sid=<sid>&display_group_id=1&vcodes_grp=<group>
 *      -> {"success":true,"data":{"sid":..,"done":bool,"flights":[ {vendor:"6e",
 *          results:{j:[ {dt:"07:15",at:"08:45",tt:[5400],stp:"0",al:["6E"],
 *          ap:["IDR","DEL"],farepr:7284,leg:[{flights:[{ffk_str:"6E-6627_19112026_07:15_.."}]}]} ]} } ]}}
 *
 * The results endpoint is a progressive feed: the supplier groups answer one at a
 * time and each group's payload carries the journeys IT found. A single call
 * therefore usually answers `"flights":[]`, which is why the worker polls the groups
 * (AERTRIP_GROUPS) rather than deciding "no fares" from the first empty answer.
 *
 * VERIFIED SAMPLE (2 Nov, IDR->DEL 19-11-2026): 6E-6627, 07:15 -> 08:45, nonstop,
 * 5400 s, farepr 7284 INR (base 5325 + taxes 2012 - PPD 53.25 + round-off 0.25).
 *
 * HONESTY RULES
 *  - No invented rows: a journey is emitted only when a price, a departure time, an
 *    arrival time and at least one flight number are all present.
 *  - The ticket is SOLD by Aertrip; the seller field says so and the deeplink opens
 *    Aertrip's own results page for exactly the route + date we searched.
 *  - We never convert currency: only INR quotes are kept.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export const AERTRIP_WEB = 'https://www.aertrip.com';
export const AERTRIP_API = 'https://www.aertrip.com/api/v1/flights';
export const AERTRIP_SELLER = 'Aertrip';

/**
 * Supplier/aggregator groups Aertrip's own results page polls (captured live on
 * 2 Nov 2026 from the SPA's XHR): 6e = IndiGo direct, 6ecr = Cleartrip, emtp =
 * EaseMyTrip, tjsr = TripJack, tbof = TBO, cmsr = ?, cdmg = ?, search = mixed.
 * Polling several groups is what makes rows appear promptly; an unknown group simply
 * answers an empty list and costs one cheap request.
 */
export const AERTRIP_GROUPS = ['6e', '6ecr', 'emtp', 'tjsr', 'tbof', 'cmsr', 'cdmg'] as const;

/** Aertrip wants depart as DD-MM-YYYY (ISO yyyy-mm-dd is rejected/misread). */
export function aertripDepartParam(depIso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(depIso || '').trim());
  if (!m) return '';
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Step 1: the search call that mints the sid for route + date + pax. */
export function aertripSearchUrl(fromCode: string, toCode: string, depIso: string, cabin = 'economy'): string {
  const depart = aertripDepartParam(depIso);
  const q = new URLSearchParams({
    trip_type: 'single',
    adult: '1',
    child: '0',
    infant: '0',
    cabinclass: cabin,
    origin: String(fromCode || '').toUpperCase(),
    destination: String(toCode || '').toUpperCase(),
    depart,
    pType: 'flight',
  });
  return `${AERTRIP_API}/search?${q.toString()}`;
}

/** Step 2: one supplier group's result page. */
export function aertripResultsUrl(sid: string, group: string, displayGroupId = 1): string {
  const q = new URLSearchParams({ sid: String(sid), display_group_id: String(displayGroupId), vcodes_grp: String(group) });
  return `${AERTRIP_API}/results?${q.toString()}`;
}

/** Public results page for the same query — the honest exit for a row. */
export function aertripDeeplink(fromCode: string, toCode: string, depIso: string, cabin = 'economy'): string {
  const depart = aertripDepartParam(depIso);
  return `${AERTRIP_WEB}/v2/flights?trip_type=single&adult=1&child=0&infant=0`
    + `&cabinclass=${encodeURIComponent(cabin)}&origin=${String(fromCode).toUpperCase()}`
    + `&destination=${String(toCode).toUpperCase()}&depart=${depart}`;
}

/** {"success":true,"data":{"sid":"..."}} -> sid, or null when the call did not mint one. */
export function parseAertripSid(body: string): string | null {
  try {
    const js = JSON.parse(body || '{}');
    const sid = js?.data?.sid;
    return typeof sid === 'string' && sid.length >= 8 ? sid : null;
  } catch {
    return null;
  }
}

interface AertripLeg {
  flights?: Array<{ ffk_str?: string; fno?: string; flt_no?: string }>;
}
interface AertripJourney {
  fk?: string;
  dt?: string;
  at?: string;
  tt?: number[] | number;
  stp?: string | number;
  al?: string[];
  ap?: string[];
  farepr?: number;
  grosspr?: number;
  fare?: Record<string, { value?: number }>;
  leg?: AertripLeg[];
  segment_cabin_classes?: string[];
}

/** Journey duration in minutes from Aertrip's `tt` (seconds, either scalar or array). */
export function aertripDurationMinutes(j: AertripJourney): number | undefined {
  const raw = Array.isArray(j?.tt) ? Number(j.tt[0]) : Number(j?.tt);
  if (!Number.isFinite(raw) || raw <= 0) return undefined;
  return Math.round(raw / 60);
}

/** "6E-6627_19112026_07:15_REGULAR FARE" -> "6E-6627"; falls back to other keys. */
export function aertripFlightNumber(j: AertripJourney): string {
  const segs = (j?.leg || []).flatMap((l) => l?.flights || []);
  const nums = segs
    .map((s) => String(s?.ffk_str || s?.fno || s?.flt_no || '').split('_')[0].trim())
    .filter((n) => /^[A-Z0-9]{2}-?[A-Z]?\d{1,5}$/i.test(n));
  return nums.join('-');
}

/** All-in price for one adult: grand_total when present, else Aertrip's farepr. */
export function aertripJourneyPrice(j: AertripJourney): number | undefined {
  const gt = Number(j?.fare?.grand_total?.value);
  const fp = Number(j?.farepr);
  const gross = Number(j?.grosspr);
  const pick = [gt, fp, gross].find((v) => Number.isFinite(v) && v > 0);
  return pick ? Math.round(pick) : undefined;
}

/**
 * Parse one group payload into rows. Pure: no network, no clock beyond `today` used
 * for the evidence text. Journeys missing price/time/flight number are dropped, never
 * back-filled — a flight card without a time is worse than no card (owner rule).
 */
export function parseAertripJourneys(
  body: string,
  opts: {
    source: SourceConfig;
    fromCode: string;
    toCode: string;
    dateIso: string;
    routeLabel: string;
    today: string;
  },
): RawSourceItem[] {
  let js: any;
  try {
    js = JSON.parse(body || '{}');
  } catch {
    return [];
  }
  const flights = js?.data?.flights;
  if (!Array.isArray(flights)) return [];

  const deeplink = aertripDeeplink(opts.fromCode, opts.toCode, opts.dateIso);
  const out: RawSourceItem[] = [];
  const seen = new Set<string>();

  for (const f of flights) {
    const journeys: AertripJourney[] = f?.results?.j || [];
    for (const j of journeys) {
      const depTime = String(j?.dt || '').slice(0, 5);
      const arrTime = String(j?.at || '').slice(0, 5);
      const price = aertripJourneyPrice(j);
      const flightNo = aertripFlightNumber(j);
      // Honest gate: every card must carry time + price + a real flight number.
      if (!/^\d{2}:\d{2}$/.test(depTime) || !/^\d{2}:\d{2}$/.test(arrTime)) continue;
      if (!price || price < 500 || price > 500_000) continue;
      if (!flightNo) continue;
      const ap = (j?.ap || []).map((c) => String(c).toUpperCase());
      if (ap.length >= 2 && (ap[0] !== opts.fromCode.toUpperCase() || ap[ap.length - 1] !== opts.toCode.toUpperCase())) continue;

      const carrierCode = String((j?.al || [])[0] || flightNo.split('-')[0] || '').toUpperCase();
      const stops = Number.isFinite(Number(j?.stp)) ? Number(j?.stp) : Math.max(0, (j?.leg || []).length - 1);
      const duration = aertripDurationMinutes(j);
      const cabin = String(j?.segment_cabin_classes?.[0] || 'economy');
      const key = `${flightNo}|${depTime}|${price}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // "6E-6627" for a nonstop; "6E-7136 + 6E-6492" for a connection, so the card
      // never prints the carrier twice ("6E 6E-7136") and both legs stay visible.
      const dispNo = flightNo.split('-').reduce((acc: string[], part, i, arr) => {
        if (i % 2 === 0) acc.push(part + (arr[i + 1] ? `-${arr[i + 1]}` : ''));
        return acc;
      }, []).join(' + ');

      out.push(newRawItem(opts.source, {
        title: `${dispNo} · ${opts.routeLabel}`.slice(0, 200),
        brand: carrierCode.slice(0, 80),
        price,
        currency: 'INR',
        seller: AERTRIP_SELLER,
        sellerUrl: deeplink,
        travel: { route: opts.routeLabel.toLowerCase(), date: opts.dateIso, seatType: cabin },
        attributes: {
          route: opts.routeLabel,
          travel_date: opts.dateIso,
          airline_code: carrierCode,
          flight_number: flightNo,
          departure: depTime,
          arrival: arrTime,
          stops: String(stops),
          ...(duration ? { duration_minutes: String(duration) } : {}),
          cabin,
          price_basis: `live all-inclusive ${stops === 0 ? 'nonstop' : `${stops}-stop`} fare observed on ${AERTRIP_SELLER}'s flight results for ${opts.routeLabel} on ${opts.today} (${AERTRIP_SELLER} is the selling website)`,
          data_note: `Fare acquired via ${AERTRIP_SELLER}'s own flight results API on ${opts.today}; the ticket is SOLD by ${AERTRIP_SELLER}. Price may change at checkout.`,
        },
        identifiers: { sku: `aertrip-${flightNo}-${opts.dateIso}-${depTime}`.slice(0, 120) },
        evidence: {
          sourceUrl: aertripDeeplink(opts.fromCode, opts.toCode, opts.dateIso),
          sourceReference: String(j?.fk || `${flightNo}-${depTime}`).slice(0, 160),
          extractedFields: ['data.flights[].results.j[].dt/at/tt/stp/al/ap/farepr', 'results.j[].leg[].flights[].ffk_str'],
        },
      }));
    }
  }
  return out;
}
