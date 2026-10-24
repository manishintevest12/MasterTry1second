/**
 * Owner 24 Oct ("ixigo sb jagah hr location ka result de raha hai... flight
 * number aur time match krta hai tho compare kro"): cheapFlightsData entries
 * carry FULL itinerary tokens "ORIG-DEST-FLNO" joined by '*' per leg. The old
 * parser stripped only the first leg, so connecting itineraries surfaced as
 * "6E7136*JAI-DEL-6E6492" — other legs' tokens (AMD/BOM/PNQ) that read like
 * wrong-route results — and DD-MM-YYYY dates broke compare grouping against
 * other sellers' ISO dates.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ixigoLegs, ixigoIsoDate, parseIxigoFlights, parseIxigoOffers } from '../server/workers/parsers/ixigoFlights';

const nextData = (entries: any[]) => ({ props: { pageProps: { cheapFlightsData: entries } } });
const ENTRY = {
  provider: 1044, fare: 7509, numOfStops: 0, airline: 'IndiGo', airlineCode: '6E',
  flightNumber: 'IDR-DEL-6E6627', date: '25-10-2026', fare_key: 'IDR-DEL-6E6627-25102026', hbo: false,
  departure_date: '25-10-2026', departure_time: '07:15', arrival_date: '25-10-2026', arrival_time: '08:45', duration: '90',
};
const VIA_ENTRY = {
  ...ENTRY, fare: 10333, numOfStops: 1, flightNumber: 'IDR-AMD-6E7174*AMD-DEL-6E2263',
  departure_time: '09:00', arrival_time: '15:30', duration: '240',
};
const WRONG_ROUTE_ENTRY = { ...ENTRY, flightNumber: 'PNQ-DEL-AI1804', fare: 5000 };

test('ixigoLegs: direct + connecting itinerary tokens parse into legs', () => {
  assert.deepEqual(ixigoLegs('IDR-DEL-6E6627'), [{ from: 'IDR', to: 'DEL', flightNo: '6E6627' }]);
  assert.deepEqual(ixigoLegs('IDR-JAI-6E7136*JAI-DEL-6E6492'), [
    { from: 'IDR', to: 'JAI', flightNo: '6E7136' },
    { from: 'JAI', to: 'DEL', flightNo: '6E6492' },
  ]);
  assert.deepEqual(ixigoLegs('AI1804'), []); // not a verifiable ORIG-DEST-FLNO token
  assert.deepEqual(ixigoLegs(''), []);
});

test('ixigoIsoDate: DD-MM-YYYY -> ISO, ISO passes through', () => {
  assert.equal(ixigoIsoDate('25-10-2026'), '2026-10-25');
  assert.equal(ixigoIsoDate('2026-10-25'), '2026-10-25');
  assert.equal(ixigoIsoDate(''), '');
  assert.equal(ixigoIsoDate('Oct 25'), '');
});

test('parseIxigoFlights: route guard keeps only this route\'s inventory', () => {
  const flights = parseIxigoFlights(nextData([ENTRY, VIA_ENTRY, WRONG_ROUTE_ENTRY]), 'IDR', 'DEL');
  // The PNQ-DEL leg (a different origin) is skipped honestly.
  assert.equal(flights.length, 2);
  assert.equal(flights[0].flightNumber, '6E6627');
  assert.equal(flights[0].legs.length, 1);
  assert.equal(flights[1].flightNumber, '6E7174+6E2263');
  assert.equal(flights[1].legs.length, 2);
  // ISO dates for cross-seller compare grouping.
  assert.equal(flights[0].departureDate, '2026-10-25');
  assert.equal(flights[0].arrivalDate, '2026-10-25');
});

test('parseIxigoOffers: honest titles, via labels, real travel date', () => {
  const flights = parseIxigoFlights(nextData([ENTRY, VIA_ENTRY]), 'IDR', 'DEL');
  const items = parseIxigoOffers(flights, { id: 'w_flights_ixigo', name: 'Ixigo' } as any, 'Indore', 'Delhi', '2026-10-31', 'https://www.ixigo.com/search/flight/IDR/DEL/2026-10-31/1/0', { indore: 'IDR', delhi: 'DEL', ahmedabad: 'AMD', jaipur: 'JAI' });
  assert.equal(items.length, 2);
  const [direct, via] = items;
  assert.equal(direct.title, 'IndiGo 6E6627 · Indore → Delhi');
  assert.equal(via.title, 'IndiGo 6E7174 + 6E2263 via Ahmedabad · Indore → Delhi (1 stop)');
  assert.equal(via.attributes?.via, 'Ahmedabad');
  assert.equal(via.attributes?.itinerary, 'IDR-AMD 6E7174 * AMD-DEL 6E2263');
  // travel.date is the REAL service date, not the requested one (honesty).
  assert.equal(direct.travel?.date, '2026-10-25');
  assert.match(String(direct.attributes?.data_note), /own service date 2026-10-25/);
  assert.match(String(direct.attributes?.data_note), /searched date was 2026-10-31/);
});

test('same flight number + time + ISO date groups: dedupe keeps cheapest per itinerary', () => {
  const cheap = { ...ENTRY, fare: 7000 };
  const dear = { ...ENTRY, fare: 7509 };
  const flights = parseIxigoFlights(nextData([cheap, dear]), 'IDR', 'DEL');
  const items = parseIxigoOffers(flights, { id: 'w_flights_ixigo' } as any, 'Indore', 'Delhi', '2026-10-25');
  assert.equal(items.length, 1);
  assert.equal(items[0].price, 7000);
});

test('worker wires the route guard with resolved airport codes', () => {
  const src = readFileSync('server/workers/verticals/flights.ts', 'utf8');
  assert.ok(src.includes('parseIxigoFlights(next, fromA.code || rt.fromCode, toA.code || rt.toCode)'), 'guard codes passed');
  assert.ok(src.includes('parseIxigoOffers(flights, ctx.source, rt.from, rt.to, dep, url, IATA)'), 'IATA passed for via labels');
});
