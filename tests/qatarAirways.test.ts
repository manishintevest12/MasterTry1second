/**
 * Qatar Airways regression (24 Oct 2026): nbx booking BFF.
 * Fixtures recorded LIVE 24 Oct 2026:
 *  - fare-calendars response via sandbox curl_cffi replay (open endpoint):
 *    DEL-DOH 27 Oct..2 Nov 2026, INR 21,795-23,784 (requested 30 Oct 23,244).
 *  - flight-offers response captured in-browser (Akamai sensor-gated path):
 *    QR579 03:45->05:35 INR 43,215; QR571 09:55->11:45 INR 61,784;
 *    QR4781 16:10->18:25 INR 23,244; QR4771 21:40->23:55 INR 23,244.
 * Guards: both endpoint request bodies, header set, calendar parsing
 * (exact-date selection), flight parsing (exact-date honesty, best-economy
 * reduction, seats), booking deeplink shape, item parity fields.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  QR_FARE_CALENDARS, QR_FLIGHT_OFFERS, QR_NBX_API_KEY,
  qrHeaders, qrFareCalendarsBody, qrFlightOffersBody, qrBookingUrl,
  parseQrFareCalendars, parseQrFlightOffers, qrFlightItems, qrCalendarItems,
} from '../server/workers/parsers/qatarAirwaysNbx.ts';

const src: any = { id: 't_flights_qatar', name: 'Qatar Airways', method: 'http', verticals: ['flights'], enabled: true, priority: 15, config: {}, rateLimit: { maxRequestsPerMinute: 2, maxConcurrency: 1 }, freshnessPolicy: {} };
const CAL = readFileSync(new URL('./fixtures/qr_fare_calendars_del_doh.json', import.meta.url), 'utf8');
const OFFERS = readFileSync(new URL('./fixtures/qr_flight_offers_del_doh.json', import.meta.url), 'utf8');

test('qr endpoints + api key constants match CDP capture', () => {
  assert.equal(QR_FARE_CALENDARS, 'https://www.qatarairways.com/dapi/public/bff/web/flight-search/fare-calendars');
  assert.equal(QR_FLIGHT_OFFERS, 'https://www.qatarairways.com/dapi/public/bff/web/flight-search/flight-offers');
  assert.equal(QR_NBX_API_KEY, '74f2474702784207a9785eb3ef8ae4e4');
});

test('qrHeaders replays the CDP-captured header set', () => {
  const h = qrHeaders('sess-1', 'https://ref');
  assert.equal(h['nbx_fs_api_key'], QR_NBX_API_KEY);
  assert.equal(h['session-id'], 'sess-1');
  assert.equal(h['qr-lang'], 'en');
  assert.ok(h['X-AssignedDeviceID']);
  assert.equal(h['Content-Type'], 'application/json');
});

test('request bodies match the CDP-captured shapes', () => {
  const cal = JSON.parse(qrFareCalendarsBody('DEL', 'DOH', '2026-10-30'));
  assert.equal(cal.channel, 'WEB_DESKTOP');
  assert.equal(cal.itineraries[0].origin, 'DEL');
  assert.equal(cal.itineraries[0].destination, 'DOH');
  assert.equal(cal.itineraries[0].departureDate, '2026-10-30');
  assert.equal(cal.itineraries[0].isRequested, true);
  assert.equal(cal.cabinClass, 'ECONOMY');
  assert.equal(cal.passengers[0].type, 'ADT');
  assert.equal(cal.flexibility, 3);
  const off = JSON.parse(qrFlightOffersBody('DEL', 'DOH', '2026-10-30'));
  assert.equal(off.flexibility, undefined); // offers body has no flexibility
  assert.deepEqual(off.passengers, [{ type: 'ADT', count: 1 }]);
});

test('parseQrFareCalendars decodes the live DEL-DOH week and picks the requested date', () => {
  const { requested, all } = parseQrFareCalendars(CAL, '2026-10-30');
  assert.equal(all.length, 7);
  assert.equal(requested!.date, '2026-10-30');
  assert.equal(requested!.lowestPrice, 23244);
  assert.equal(requested!.currencyCode, 'INR');
  assert.ok(all.some(r => r.date === '2026-10-28' && r.lowestPrice === 21795));
});

test('parseQrFareCalendars: other-date requests stay honest-empty', () => {
  assert.equal(parseQrFareCalendars(CAL, '2026-12-01').requested, null);
  assert.equal(parseQrFareCalendars('not json', '2026-10-30').requested, null);
});

test('parseQrFlightOffers decodes the live in-browser capture with best-economy fares', () => {
  const offers = parseQrFlightOffers(OFFERS, '2026-10-30');
  assert.equal(offers.length, 4); // AI2909 codeshare without QR eco fares dropped
  const byFn = Object.fromEntries(offers.map(o => [o.flightNumber, o]));
  assert.equal(byFn.QR579.depTime, '03:45');
  assert.equal(byFn.QR579.arrTime, '05:35');
  assert.equal(byFn.QR579.bestEcoTotal, 43215);
  assert.equal(byFn.QR579.fareFamily, 'ECONOMY_CLASSIC');
  assert.equal(byFn.QR579.seats, 9);
  assert.equal(byFn.QR579.stops, 0);
  assert.equal(byFn.QR571.bestEcoTotal, 61784);
  assert.equal(byFn.QR4781.bestEcoTotal, 23244);
  assert.equal(byFn.QR4771.bestEcoTotal, 23244);
  assert.ok(byFn.QR579.aircraft.includes('A350'));
});

test('parseQrFlightOffers enforces exact-date honesty', () => {
  assert.equal(parseQrFlightOffers(OFFERS, '2026-10-29').length, 0);
});

test('qrFlightItems: full flight rows with times, aircraft and booking deeplink', () => {
  const offers = parseQrFlightOffers(OFFERS, '2026-10-30');
  const items = qrFlightItems(offers, src, 'Delhi', 'Doha', 'DEL', 'DOH', '2026-10-30');
  assert.equal(items.length, 4);
  const it: any = items[0];
  assert.equal(it.seller, 'Qatar Airways');
  assert.equal(it.currency, 'INR');
  assert.equal(it.attributes.flight_number, 'QR579');
  assert.equal(it.attributes.departs, '03:45');
  assert.equal(it.attributes.arrives, '05:35');
  assert.equal(it.attributes.stops, 'non-stop');
  assert.equal(it.attributes.travel_date, '2026-10-30');
  assert.ok(it.sellerUrl.includes('showBooking.action'));
  assert.ok(it.sellerUrl.includes('departing=2026-10-30'));
  assert.ok(it.title.includes('QR579'));
  assert.equal(it.travel.date, '2026-10-30');
  assert.ok(it.attributes.price_basis.includes('incl. taxes'));
});

test('qrCalendarItems: honest date-level fallback row with live caveat', () => {
  const { requested } = parseQrFareCalendars(CAL, '2026-10-30');
  const items = qrCalendarItems(requested!, src, 'Delhi', 'Doha', 'DEL', 'DOH');
  assert.equal(items.length, 1);
  const it: any = items[0];
  assert.equal(it.price, 23244);
  assert.equal(it.attributes.travel_date, '2026-10-30');
  assert.ok(it.sellerUrl.includes('fromStation=DEL'));
  assert.ok(it.sellerUrl.includes('toStation=DOH'));
  assert.ok(it.attributes.data_note.includes('fare-calendar'));
  assert.ok(it.attributes.price_basis.includes('lowest economy fare'));
});

test('qrBookingUrl matches the homepage widget getFlightsUrl shape (YYYY-MM-DD)', () => {
  const u = qrBookingUrl('DEL', 'DOH', '2026-10-28');
  assert.ok(u.startsWith('https://booking.qatarairways.com/nsp/views/showBooking.action?'));
  assert.ok(u.includes('widget=QR&searchType=F&addTaxToFare=Y&minPurTime=0'));
  assert.ok(u.includes('tripType=O&fromStation=DEL&toStation=DOH'));
  assert.ok(u.includes('departing=2026-10-28&bookingClass=E&adults=1'));
});
