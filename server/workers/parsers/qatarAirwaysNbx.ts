/**
 * Qatar Airways parser (24 Oct 2026 Browserbase CDP discovery).
 *
 * GATE MAP: qatarairways.com homepage + fare-calendar BFF endpoints are OPEN
 * to datacenter curl_cffi (verified sandbox LIVE). The heavier
 * flight-offers endpoint has a path-specific Akamai sensor rule (403 from
 * datacenter curl_cffi; passes in a real browser with valid _abck sensor).
 *
 * CAPTURED SURFACES (all need: Content-Type application/json, qr-lang: en,
 * nbx_fs_api_key: 74f2474702784207a9785eb3ef8ae4e4 (public web key from the
 * nbx booking bundle), session-id: <random uuid>, X-AssignedDeviceID:
 * <32-char id>):
 *
 * 1. POST /dapi/public/bff/web/flight-search/fare-calendars  (OPEN, sandbox LIVE)
 *    body: {channel:"WEB_DESKTOP", itineraries:[{origin,destination,
 *    departureDate,isRequested:true}], cabinClass:"ECONOMY",
 *    ignoreInvalidPromoCode:true, passengers:[{type:"ADT",count:1}],
 *    flexibility:3}
 *    -> {faresFromCalendar:[{date,lowestPrice,currencyCode,appliedDiscount}]}
 *    Verified LIVE 24 Oct: DEL-DOH 27 Oct..2 Nov INR 21,795-23,784.
 *
 * 2. POST /dapi/public/bff/web/flight-search/flight-offers  (Akamai sensor-gated)
 *    body: same minus flexibility
 *    -> {flightOffers:[{origin,destination,duration,numberOfStops,
 *        segments:[{flightNumber, vehicle, departure:{dateTime},
 *        arrival:{dateTime,daysDifference}, operatingAirlineName}],
 *        fareOffers:[{fareFamilyCode, price:{base,total,currencyCode},
 *        availableSeats, cabinType, appliedDiscount}]}]}
 *    Verified LIVE in-browser 24 Oct: QR579 DEL 03:45->DOH 05:35 (A350-900,
 *    Starlink) ECONOMY_CLASSIC INR 43,215; QR4781 16:10->18:25 INR 23,244;
 *    QR4771 21:40->23:55 INR 23,244; QR571 09:55->11:45 INR 61,784.
 *
 * Booking deeplink (from homepage widget bundle getFlightsUrl):
 * booking.qatarairways.com/nsp/views/showBooking.action?widget=QR&searchType=F
 * &addTaxToFare=Y&minPurTime=0&selLang=en&tripType=O&fromStation=DEL&toStation=DOH
 * &departing=2026-10-30&bookingClass=E&adults=1&children=0&infants=0&ofw=0
 * &teenager=0&flexibleDate=off  (date format YYYY-MM-DD, bookingClass E/B/F)
 *
 * WORKER STRATEGY (self-detecting, per owner standing rule): try flight-offers
 * first with a 3-rung fingerprint ladder; persistent 403 -> honest fallback
 * to fare-calendars date-level rows. The moment a clean production IP (or a
 * lifted sensor rule) lets flight-offers through, rows upgrade to full
 * flight-level data automatically.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export const QR_FARE_CALENDARS = 'https://www.qatarairways.com/dapi/public/bff/web/flight-search/fare-calendars';
export const QR_FLIGHT_OFFERS = 'https://www.qatarairways.com/dapi/public/bff/web/flight-search/flight-offers';
export const QR_NBX_API_KEY = '74f2474702784207a9785eb3ef8ae4e4';

/** Headers shared by both BFF endpoints (discovered via CDP 24 Oct 2026). */
export function qrHeaders(sessionId: string, referer: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en',
    'qr-lang': 'en',
    'nbx_fs_api_key': QR_NBX_API_KEY,
    'session-id': sessionId,
    'X-AssignedDeviceID': 'e2uNCDUd44wFRHUQ9QE2U2BMoSCMWnGI',
    Origin: 'https://www.qatarairways.com',
    Referer: referer,
  };
}

export function qrFareCalendarsBody(from: string, to: string, dep: string): string {
  return JSON.stringify({
    channel: 'WEB_DESKTOP',
    itineraries: [{ origin: from, destination: to, departureDate: dep, isRequested: true }],
    cabinClass: 'ECONOMY',
    ignoreInvalidPromoCode: true,
    passengers: [{ type: 'ADT', count: 1 }],
    flexibility: 3,
  });
}

export function qrFlightOffersBody(from: string, to: string, dep: string): string {
  return JSON.stringify({
    channel: 'WEB_DESKTOP',
    itineraries: [{ origin: from, destination: to, departureDate: dep, isRequested: true }],
    cabinClass: 'ECONOMY',
    ignoreInvalidPromoCode: true,
    passengers: [{ type: 'ADT', count: 1 }],
  });
}

/** Booking deeplink (homepage widget getFlightsUrl shape, YYYY-MM-DD date). */
export function qrBookingUrl(from: string, to: string, dep: string): string {
  return `https://booking.qatarairways.com/nsp/views/showBooking.action?widget=QR&searchType=F&addTaxToFare=Y&minPurTime=0&selLang=en&tripType=O&fromStation=${from}&toStation=${to}&departing=${dep}&bookingClass=E&adults=1&children=0&infants=0&ofw=0&teenager=0&flexibleDate=off`;
}

export interface QrFareCalendarEntry {
  date: string;
  lowestPrice: number;
  currencyCode: string;
}

/** Parse fare-calendars response (returns only the requested date's entry + all). */
export function parseQrFareCalendars(body: string, dep: string): { requested: QrFareCalendarEntry | null; all: QrFareCalendarEntry[] } {
  let j: any;
  try { j = JSON.parse(body); } catch { return { requested: null, all: [] }; }
  const rows: QrFareCalendarEntry[] = (j?.faresFromCalendar || [])
    .filter((f: any) => f && typeof f.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f.date) && Number(f.lowestPrice) > 0)
    .map((f: any) => ({ date: f.date, lowestPrice: Number(f.lowestPrice), currencyCode: String(f.currencyCode || 'INR') }));
  return { requested: rows.find(r => r.date === dep) || null, all: rows };
}

export interface QrFlightOffer {
  flightNumber: string;
  airline: string;
  depIso: string;      // 2026-10-30
  depTime: string;     // 03:45
  arrTime: string;     // 05:35 (+1 day marker handled by caller)
  arrNextDay: boolean;
  stops: number;
  durationSec: number;
  aircraft: string;
  bestEcoTotal: number;
  currencyCode: string;
  fareFamily: string;
  seats: number;
}

/** Parse flight-offers response into per-flight rows (best economy fare). */
export function parseQrFlightOffers(body: string, dep: string): QrFlightOffer[] {
  let j: any;
  try { j = JSON.parse(body); } catch { return []; }
  const out: QrFlightOffer[] = [];
  const seen = new Set<string>();
  for (const o of j?.flightOffers || []) {
    const segs = o?.segments || [];
    const first = segs[0];
    const last = segs[segs.length - 1];
    if (!first?.flightNumber || !first?.departure?.dateTime) continue;
    const depDt = String(first.departure.dateTime).slice(0, 19); // 2026-10-30T03:45:00
    const depDate = depDt.slice(0, 10);
    if (depDate !== dep) continue; // exact-date honesty
    const depTime = depDt.slice(11, 16);
    const arrDt = String(last?.arrival?.dateTime || '');
    const arrTime = arrDt.slice(11, 16);
    const arrNextDay = String(last?.arrival?.dateTime || '').slice(0, 10) > depDate || Number(last?.arrival?.daysDifference || 0) > 0;
    // best economy fare
    const ecoFares = (o.fareOffers || []).filter((f: any) => f?.cabinType === 'ECONOMY' && Number(f?.price?.total) > 0);
    if (!ecoFares.length) continue; // codeshares w/o QR fares
    const best = ecoFares.reduce((a: any, b: any) => (Number(b.price.total) < Number(a.price.total) ? b : a));
    const key = `${first.flightNumber}-${depTime}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      flightNumber: String(first.flightNumber),
      airline: String(first.operatingAirlineName || 'Qatar Airways'),
      depIso: depDate,
      depTime,
      arrTime,
      arrNextDay,
      stops: Number(o.numberOfStops || 0),
      durationSec: Number(o.duration || 0),
      aircraft: String(first.vehicle?.name || ''),
      bestEcoTotal: Number(best.price.total),
      currencyCode: String(best.price.currencyCode || 'INR'),
      fareFamily: String(best.fareFamilyCode || ''),
      seats: Number(best.availableSeats || 0),
    });
  }
  return out;
}

/** Honest full flight-level rows (when flight-offers is reachable). */
export function qrFlightItems(offers: QrFlightOffer[], source: SourceConfig, fromCity: string, toCity: string, fromCode: string, toCode: string, dep: string): RawSourceItem[] {
  const today = new Date().toISOString().slice(0, 10);
  return offers.map(o => newRawItem(source, {
    title: `Qatar Airways ${o.flightNumber} ${fromCity} → ${toCity} ${o.depTime}–${o.arrTime}${o.arrNextDay ? '+1' : ''} · ₹${o.bestEcoTotal.toLocaleString('en-IN')}`,
    brand: 'Qatar Airways',
    price: o.bestEcoTotal,
    currency: o.currencyCode,
    seller: 'Qatar Airways',
    sellerUrl: qrBookingUrl(fromCode, toCode, o.depIso),
    travel: { route: `${fromCity.toLowerCase()} to ${toCity.toLowerCase()}`, date: o.depIso },
    attributes: {
      route: `${fromCity} → ${toCity}`,
      airline: o.airline,
      flight_number: o.flightNumber,
      travel_date: o.depIso,
      departure_date: o.depIso,
      departs: o.depTime,
      arrives: o.arrTime,
      duration: o.durationSec ? `${Math.floor(o.durationSec / 3600)}h ${Math.round((o.durationSec % 3600) / 60)}m` : '',
      stops: o.stops === 0 ? 'non-stop' : `${o.stops} stop${o.stops > 1 ? 's' : ''}`,
      aircraft: o.aircraft,
      fare_class: o.fareFamily.replace(/_/g, ' ').toLowerCase(),
      seats_left: o.seats > 0 ? String(o.seats) : '',
      price_basis: `Qatar Airways live economy fare (${o.fareFamily}) incl. taxes for 1 adult on ${o.depIso} captured ${today}`,
      data_note: `Live per-flight data from Qatar Airways' own booking API (flight-search BFF). Price is total incl. taxes for 1 adult.`,
      image: '',
    },
    identifiers: { sku: `qr-${o.flightNumber}-${o.depIso}` },
    evidence: {
      sourceUrl: QR_FLIGHT_OFFERS,
      extractedFields: ['flightOffers[].segments[].flightNumber', 'departure.dateTime', 'arrival.dateTime', 'fareOffers[].price.total'],
    },
  }));
}

/** Honest date-level fare-calendar rows (fallback when flight-offers is gated). */
export function qrCalendarItems(entry: QrFareCalendarEntry, source: SourceConfig, fromCity: string, toCity: string, fromCode: string, toCode: string): RawSourceItem[] {
  const today = new Date().toISOString().slice(0, 10);
  return [newRawItem(source, {
    title: `Qatar Airways ${fromCity} → ${toCity} on ${entry.date} from ₹${entry.lowestPrice.toLocaleString('en-IN')} (economy)`,
    brand: 'Qatar Airways',
    price: entry.lowestPrice,
    currency: entry.currencyCode,
    seller: 'Qatar Airways',
    sellerUrl: qrBookingUrl(fromCode, toCode, entry.date),
    travel: { route: `${fromCity.toLowerCase()} to ${toCity.toLowerCase()}`, date: entry.date },
    attributes: {
      route: `${fromCity} → ${toCity}`,
      airline: 'Qatar Airways',
      travel_date: entry.date,
      departure_date: entry.date,
      fare_class: 'Economy (lowest fare of the day)',
      stops: '',
      price_basis: `Qatar Airways live fare-calendar lowest economy fare for 1 adult on ${entry.date} captured ${today}`,
      data_note: `Lowest fare of the day from Qatar Airways' own live fare-calendar API (incl. taxes, 1 adult). Flight times/numbers are shown on the booking page.`,
      image: '',
    },
    identifiers: { sku: `qr-cal-${fromCode}${toCode}-${entry.date}` },
    evidence: {
      sourceUrl: QR_FARE_CALENDARS,
      extractedFields: ['faresFromCalendar[].date', 'faresFromCalendar[].lowestPrice'],
    },
  })];
}
