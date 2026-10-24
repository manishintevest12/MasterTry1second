/**
 * Cathay Pacific regression (24 Oct 2026): TSP booking-engine capture.
 * Fixtures recorded LIVE in-browser (Browserbase CDP) 24 Oct 2026: BOM-HKG
 * 29 Oct economy - 46 itineraries; CX660 02:00->09:55 77W 5h25m INR 33,746
 * (checked 23kg + cabin 7kg, 3 seats); fare strip 25 Oct-8 Nov (lowest
 * INR 30,575). Guards: API params + deeplink shape, offer parsing (numbers,
 * ISO times, duration, stops/transits, cheapest fares, baggage, quota),
 * air-calendar strip, and item parity fields.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CX_TSP_API, CX_DEEPLINK, cxParams, cxDeeplink,
  parseCathayOfferFlights, parseCathayAirCalendar, cxFlightItems,
} from '../server/workers/parsers/cathayTsp.ts';

const src: any = { id: 't_flights_cx', name: 'Cathay Pacific', method: 'http', verticals: ['flights'], enabled: true, priority: 15, config: {}, rateLimit: { maxRequestsPerMinute: 2, maxConcurrency: 1 }, freshnessPolicy: {} };
const OFFERS = readFileSync(new URL('./fixtures/cathay_offer_flights_bom_hkg.json', import.meta.url), 'utf8');
const CAL = readFileSync(new URL('./fixtures/cathay_air_calendar_bom_hkg.json', import.meta.url), 'utf8');

test('cx constants match the CDP-captured surface', () => {
  assert.equal(CX_TSP_API, 'https://api.cathaypacific.com/tsp-svc/v1.0/');
  assert.equal(CX_DEEPLINK, 'https://book.cathaypacific.com/tsp/en_IN/flight-selection');
});

test('cxParams encodes the exact live query shape', () => {
  const p = cxParams('BOM', 'HKG', '2026-10-29');
  assert.ok(p.includes('origin=BOM'));
  assert.ok(p.includes('destination=HKG'));
  assert.ok(p.includes('departureDate=2026-10-29'));
  assert.ok(p.includes('cabinClass=Y'));
  assert.ok(p.includes('entryCountry=IN'));
  assert.ok(p.includes('adult=1'));
  assert.ok(p.includes('youngAdult=0&child=0&infant=0&student=0'));
});

test('cxDeeplink is the reproducible booking URL', () => {
  const u = cxDeeplink('BOM', 'HKG', '2026-10-29');
  assert.ok(u.startsWith(CX_DEEPLINK));
  assert.ok(u.includes('ca=Y&o=BOM&d=HKG&a=1'));
  assert.ok(u.includes('ddb1=2026-10-29'));
  assert.ok(u.includes('viewport=desktop'));
});

test('parseCathayOfferFlights decodes the live BOM-HKG capture (46 itineraries)', () => {
  const flights = parseCathayOfferFlights(OFFERS);
  assert.equal(flights.length, 46);
  const cx = flights.find(f => f.flightNumber === 'CX660');
  assert.ok(cx);
  assert.equal(cx.allFlights.length, 1);
  assert.equal(cx.depTime, '02:00');
  assert.equal(cx.arrTime, '09:55');
  assert.equal(cx.depIso, '2026-10-29T02:00:00.000+05:30');
  assert.equal(cx.arrIso, '2026-10-29T09:55:00.000+08:00');
  assert.equal(cx.durationMin, 325);
  assert.equal(cx.stops, 0);
  assert.equal(cx.priceInr, 33746);
  assert.equal(cx.aircraft, '77W');
  assert.equal(cx.seatsLeft, 3);
  assert.equal(cx.baggageNote, 'checked 23kg + cabin 7kg');
  // connecting itinerary: headline prefers the CX flight, transit captured
  const codeshare = flights.find(f => f.allFlights.length === 2);
  assert.ok(codeshare);
  assert.ok(/^CX/.test(codeshare.flightNumber));
  assert.equal(codeshare.stops, 1);
  assert.ok(codeshare.transitVia.length >= 1);
});

test('parseCathayOfferFlights stays honest on bad payloads', () => {
  assert.equal(parseCathayOfferFlights('{"data":{"flightList":[]}}').length, 0);
  assert.equal(parseCathayOfferFlights('not json').length, 0);
  assert.equal(parseCathayOfferFlights('').length, 0);
});

test('parseCathayAirCalendar decodes the live fare strip', () => {
  const strip = parseCathayAirCalendar(CAL);
  assert.ok(strip.length >= 10);
  assert.deepEqual(strip[0], { date: '2026-10-25', priceInr: 113992 });
  const lowest = strip.reduce((m, s) => Math.min(m, s.priceInr), Infinity);
  assert.equal(lowest, 30575);
});

test('cxFlightItems: full rows with TSP deeplink and parity fields', () => {
  const flights = parseCathayOfferFlights(OFFERS);
  const strip = parseCathayAirCalendar(CAL);
  const items = cxFlightItems(flights, src, 'Mumbai', 'Hong Kong', 'BOM', 'HKG', '2026-10-29', strip);
  assert.equal(items.length, 46);
  const it: any = items.find((x: any) => x.attributes.flight_number === 'CX660');
  assert.equal(it.seller, 'Cathay Pacific');
  assert.equal(it.currency, 'INR');
  assert.equal(it.price, 33746);
  assert.equal(it.attributes.departs, '02:00');
  assert.equal(it.attributes.arrives, '09:55');
  assert.equal(it.attributes.duration, '5h 25m');
  assert.equal(it.attributes.stops, 'non-stop');
  assert.equal(it.attributes.baggage, 'checked 23kg + cabin 7kg');
  assert.equal(it.attributes.travel_date, '2026-10-29');
  assert.equal(it.travel.date, '2026-10-29');
  assert.ok(it.sellerUrl.includes('o=BOM&d=HKG'));
  assert.ok(it.title.includes('CX660'));
  assert.ok(it.attributes.price_basis.includes('incl. taxes'));
  assert.ok(it.attributes.fare_strip.includes('₹'));
});
