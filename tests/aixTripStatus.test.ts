/**
 * Air India Express flight-status schedule regression (24 Oct 2026):
 * api.airindiaexpress.com/b2c-flightstatus/v2/flight/trip-status is the
 * browserless AIX SCHEDULE source discovered after the fsa per-flight search
 * proved reCAPTCHA/rate-limit gated (the /flight-status page's own backing
 * API — no auth, no sensor, public web subscription key only). Fixture
 * recorded LIVE from the sandbox 24 Oct 2026: DEL-BOM 28 Oct 2026
 * IX1056 08:50 -> 11:15, 8700s block time. Guards: flight-number + local
 * time parsing, wrong-date filtering, malformed bodies never crash, and the
 * schedule-enriched per-flight item build (fare-calendar price + flight
 * schedule, honestly labelled date-level fare).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { aixTripStatusUrl, aixTripStatusBody, aixTripStatusHeaders, parseAixTripStatus, aixScheduledFareItems } from '../server/workers/parsers/aixTripStatus.ts';

const src: any = { id: 't_flights_aix', name: 'Air India Express', method: 'http', verticals: ['flights'], enabled: true, priority: 14, config: {}, rateLimit: { maxRequestsPerMinute: 4, maxConcurrency: 1 }, freshnessPolicy: {} };

const FIX = JSON.parse(readFileSync(new URL('./fixtures/aix_tripstatus_del_bom.json', import.meta.url), 'utf8'));
const LIVE = JSON.stringify(FIX.response);

test('aixTripStatusUrl/body match the airline flight-status API', () => {
  assert.equal(aixTripStatusUrl(), 'https://api.airindiaexpress.com/b2c-flightstatus/v2/flight/trip-status');
  const b = JSON.parse(aixTripStatusBody('DEL', 'BOM', '2026-10-28'));
  assert.equal(b.beginDate, '2026-10-28');
  assert.equal(b.carrierCode, 'IX');
  assert.deepEqual(b.originStations, ['DEL']);
  assert.deepEqual(b.destinationStations, ['BOM']);
  assert.equal(b.identifier, '');
  const h = aixTripStatusHeaders();
  assert.ok(h['Ocp-Apim-Subscription-Key'].length === 32, 'public web subscription key present');
  assert.equal(h['client-id'], 'AIRASIA-WEB-APP');
});

test('parseAixTripStatus decodes the live DEL-BOM fixture', () => {
  const flights = parseAixTripStatus(LIVE, '2026-10-28');
  assert.ok(flights.length >= 1, `expected IX schedule, got ${flights.length}`);
  const f = flights.find((x) => x.flightNo === 'IX1056');
  assert.ok(f, 'IX1056 present');
  assert.equal(f.depTime, '08:50');
  assert.equal(f.arrTime, '11:15');
  assert.equal(f.durationMin, 145); // 8700s
  assert.equal(f.dateIso, '2026-10-28');
  assert.equal(f.fromCode, 'DEL');
  assert.equal(f.toCode, 'BOM');
});

test('parseAixTripStatus filters other dates and never crashes on junk', () => {
  // 25 Oct ask: the fixture's flights are 28 Oct -> filtered out, no invention
  const none = parseAixTripStatus(LIVE, '2026-10-25');
  assert.equal(none.length, 0);
  assert.equal(parseAixTripStatus('[]', '2026-10-28').length, 0);
  assert.equal(parseAixTripStatus('', '2026-10-28').length, 0);
  assert.equal(parseAixTripStatus('not-json', '2026-10-28').length, 0);
  assert.equal(parseAixTripStatus('{"data":{"data":"weird"}}', '2026-10-28').length, 0);
  // rows missing flight number or times are dropped
  const partial = JSON.stringify([{ status: 'success', data: [
    { flightNumber: '', flightDateLocal: '2026-10-28T00:00:00.000Z', originalDepartureTime: '2026-10-28T08:50:00', originalArrivalTime: '2026-10-28T11:15:00' },
    { flightNumber: 'IX1111', flightDateLocal: '2026-10-28T00:00:00.000Z', originalDepartureTime: '', originalArrivalTime: '2026-10-28T11:15:00' },
    { flightNumber: 'IX2222', flightDateLocal: '2026-10-28T00:00:00.000Z', originalDepartureTime: '2026-10-28T09:00:00', originalArrivalTime: '2026-10-28T12:00:00', flyDurationInSecs: '10800' },
  ] }]);
  const got = parseAixTripStatus(partial, '2026-10-28');
  assert.equal(got.length, 1);
  assert.equal(got[0].flightNo, 'IX2222');
  assert.equal(got[0].depTime, '09:00');
  assert.equal(got[0].durationMin, 180);
});

test('aixScheduledFareItems builds honest per-flight cards (fare calendar price + schedule)', () => {
  const flights = parseAixTripStatus(LIVE, '2026-10-28');
  const items = aixScheduledFareItems(flights, { dt: '2026-10-28', pr: 6677, taxes: 1798, available: 37 }, src, 'New Delhi', 'Mumbai', 'DEL', 'BOM');
  assert.equal(items.length, flights.length);
  const it = items[0];
  assert.equal(it.brand, 'Air India Express');
  assert.equal(it.price, 6677);
  assert.equal(it.currency, 'INR');
  assert.equal(it.seller, 'Air India Express');
  assert.equal(it.attributes.flight_number, 'IX1056');
  // owner 24 Oct reference card: IATA codes publish on the row for the card clocks
  assert.equal(it.attributes.origin, 'DEL');
  assert.equal(it.attributes.destination, 'BOM');
  assert.equal(it.attributes.departure_time, '08:50');
  assert.equal(it.attributes.arrival_time, '11:15');
  assert.equal(it.attributes.duration_minutes, '145');
  assert.equal(it.attributes.travel_date, '2026-10-28');
  // honesty: the price is the date-level calendar fare, clearly labelled
  assert.match(it.attributes.price_basis, /fare-calendar/);
  assert.match(it.attributes.data_note, /date's lowest published fare/);
  assert.match(it.attributes.fare_class, /per-flight booking fare may differ/);
  assert.ok(it.sellerUrl.includes('airindiaexpress.com'), 'booking continues on the airline site');
  assert.ok(String(it.identifiers.sku).startsWith('aix-IX1056-2026-10-28-DELBOM'));
});
