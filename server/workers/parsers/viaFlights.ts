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


export interface ViaJourneyLeg {
  carrierCode: string;      // "6E"
  carrierName: string;      // "IndiGo"
  flightNo: string;          // "6627"
  flyTime: number;          // minutes
  depTime: string;          // "2026-10-26 07:15:00.000"
  arrTime: string;
  depCode: string; arrCode: string;
  depCity: string; arrCity: string;
}

export interface ViaJourney {
  flightKey: string;        // "6E-6627-false-Flexi Fare#"
  price: number;            // INR total incl. tax
  seatsLeft: number;
  legs: ViaJourneyLeg[];
  durationMin: number;      // total journey time (journeyInfo[0].journeyTime)
  fareType: string;         // "Flexi Fare"
  refundable: boolean;
}

/** POST /apiv2/flight/search JSON -> journeys. Cracked 24 Oct 2026 with
 *  browser-assisted discovery (Playwright CDP on in.via.com): the search box
 *  POSTs {"sectorInfos":[{"src":{code,name,city},"dest":{...},"date":...}]}
 *  to /apiv2/flight/search and replays it in production with curl_cffi
 *  (chrome TLS) — no browser automation in production, per the standing rule.
 *  Response: onwardJourneys[] -> { fares.totalFare.total.amount, flights[],
 *  journeyInfo[0].journeyTime, seatsLeft }. */
export function parseViaSearchJourneys(body: string): ViaJourney[] {
  let root: any;
  try { root = JSON.parse(body); } catch { return []; }
  const js = root?.onwardJourneys;
  if (!Array.isArray(js)) return [];
  const out: ViaJourney[] = [];
  for (const j of js) {
    const amount = Number(j?.fares?.totalFare?.total?.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const legsRaw = Array.isArray(j?.flights) ? j.flights : [];
    const legs: ViaJourneyLeg[] = [];
    for (const l of legsRaw) {
      const depT = String(l?.depDetail?.time || '');
      const arrT = String(l?.arrDetail?.time || '');
      if (!/^\d{4}-\d{2}-\d{2} /.test(depT) || !/^\d{4}-\d{2}-\d{2} /.test(arrT)) continue;
      legs.push({
        carrierCode: String(l?.carrier?.code || ''),
        carrierName: String(l?.carrier?.name || ''),
        flightNo: String(l?.flightNo || ''),
        flyTime: Number(l?.flyTime) || 0,
        depTime: depT.slice(0, 16),   // "2026-10-26 07:15"
        arrTime: arrT.slice(0, 16),
        depCode: String(l?.depDetail?.code || ''),
        arrCode: String(l?.arrDetail?.code || ''),
        depCity: String(l?.depDetail?.city || l?.depDetail?.name || ''),
        arrCity: String(l?.arrDetail?.city || l?.arrDetail?.name || ''),
      });
    }
    if (!legs.length) continue;
    const dur = Number(Array.isArray(j?.journeyInfo) ? j.journeyInfo[0]?.journeyTime : 0) || legs[0]?.flyTime || 0;
    out.push({
      flightKey: String(j?.flightKey || ''),
      price: Math.round(amount),
      seatsLeft: Number(j?.seatsLeft) || 0,
      legs,
      durationMin: dur,
      fareType: String(legsRaw[0]?.fareType || ''),
      refundable: Boolean(legsRaw[0]?.refundable),
    });
  }
  return out;
}

/** One honest offer per unique flight (cheapest fare across its fare classes),
 *  cheapest-first, capped. Full per-flight metadata: number, times, duration,
 *  stops — everything the flight strip on the cards needs. */
export function viaSearchItems(
  journeys: ViaJourney[],
  source: SourceConfig,
  fromCity: string,
  toCity: string,
  fromCode: string,
  toCode: string,
  depIso: string,
): RawSourceItem[] {
  // cheapest journey per flightKey (same flight sells multiple fare classes)
  const byKey = new Map<string, ViaJourney>();
  for (const j of journeys) {
    if (!j.flightKey) continue;
    const prev = byKey.get(j.flightKey);
    if (!prev || j.price < prev.price) byKey.set(j.flightKey, j);
  }
  const uniq = [...byKey.values()].sort((a, b) => a.price - b.price).slice(0, 25);
  const today = new Date().toISOString().slice(0, 10);
  const routeLabel = `${fromCity} → ${toCity}`;
  return uniq.map((j) => {
    const fno = j.legs.map((l) => `${l.carrierCode} ${l.flightNo}`.trim()).join(' + ');
    const dep = j.legs[0].depTime;   // "2026-10-26 07:15"
    const arr = j.legs[j.legs.length - 1].arrTime;
    const stops = j.legs.length - 1;
    const airline = j.legs[0].carrierName;
    const hhmm = (min: number) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
    return newRawItem(source, {
      title: `${airline} ${fno} · ${routeLabel}`,
      brand: airline,
      price: j.price,
      currency: 'INR',
      seller: 'Via.com',
      sellerUrl: viaSearchUrl(fromCode, toCode, depIso),
      travel: { route: `${fromCity.toLowerCase()} to ${toCity.toLowerCase()}`, date: depIso },
      attributes: {
        route: routeLabel,
        travel_date: depIso,
        flight_number: fno,
        departure: dep,
        arrival: arr,
        duration: hhmm(j.durationMin),
        stops: String(stops),
        seats_left: j.seatsLeft > 0 ? String(j.seatsLeft) : '',
        fare_class: j.fareType,
        refundable: j.refundable ? 'yes' : '',
        price_basis: `Via.com live search fare for ${depIso} (total incl. taxes), acquired from Via.com's own search API on ${today}`,
        data_note: `Per-flight fare from Via.com's official search API on ${today}; booking continues on Via.com's own website.`,
        image: '',
      },
      identifiers: { sku: `via-flight-${j.flightKey.replace(/[^A-Za-z0-9-]/g, '')}-${depIso}` },
      evidence: {
        sourceUrl: viaSearchApiUrl(),
        extractedFields: ['onwardJourneys[].flightKey', 'fares.totalFare.total.amount (INR)', 'flights[].flightNo', 'flights[].depDetail.time', 'flights[].arrDetail.time', 'journeyInfo[0].journeyTime'],
      },
    });
  });
}

/** The search API endpoint itself (request shape discovered 24 Oct 2026). */
export function viaSearchApiUrl(): string {
  return `${VIA_BASE}/apiv2/flight/search?&flowType=NODE&ajax=true&jsonData=true`;
}

/** The exact POST body Via.com's own search box sends (browser-captured 24 Oct
 *  2026); domestic one-way, 1 adult, all cabins — replayed verbatim. */
export function viaSearchRequestBody(fromCode: string, fromCity: string, toCode: string, toCity: string, depIso: string): string {
  return JSON.stringify({
    sectorInfos: [{
      src: { code: fromCode, name: fromCity, city: fromCity },
      dest: { code: toCode, name: toCity, city: toCity },
      date: depIso,
      debug: false,
    }],
    class: 'ALL',
    paxCount: { adt: 1, chd: 0, inf: 0 },
    route: 'ALL',
    disc: false, multiHop: false, multiCity: false, senior: false, special: false,
    domestic: true, isOfflineSearch: false, isPaxWiseCommission: false,
    isComboAllowed: false, isLiveSearch: false,
  });
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
