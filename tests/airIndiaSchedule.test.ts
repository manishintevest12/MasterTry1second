/**
 * Air India flight-schedule regression (24 Oct 2026):
 * api.airindia.com/flight-information/v1/schedules is the browserless AI
 * SCHEDULE source discovered via the public /book/flight-schedule.html
 * component (2-step: empty POST auth/token -> x-access-token JWT header;
 * signed GET with x-signature = sha256hex(qs + jwtPayload.token +
 * jwtPayload.iv)). Fixture recorded LIVE from the sandbox 24 Oct 2026:
 * DEL-BOM 28 Oct 2026, 49 itinerary rows (AI 2573 05:30->07:55 A320NEO
 * Terminal 3 ... plus connections and weekly operating-day patterns).
 * Guards: query-string + signature recipe, date/operating-day filtering,
 * junk bodies never crash, honest per-flight item build with the
 * fare-calendar price clearly labelled date-level.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'crypto';
import {
  AI_SCHED_TOKEN_URL, AI_SCHED_URL, airIndiaSchedHeaders, airIndiaSchedQuery,
  airIndiaSchedSignature, parseAirIndiaSchedules, airIndiaScheduledFareItems,
} from '../server/workers/parsers/airIndiaSchedule.ts';

const src: any = { id: 't_flights_airindia', name: 'Air India', method: 'http', verticals: ['flights'], enabled: true, priority: 14, config: {}, rateLimit: { maxRequestsPerMinute: 4, maxConcurrency: 1 }, freshnessPolicy: {} };

const FIX = JSON.parse(readFileSync(new URL('./fixtures/airindia_schedules_del_bom.json', import.meta.url), 'utf8'));
const LIVE = JSON.stringify(FIX.response);

test('AI schedule URLs, headers and query string match the airline component', () => {
  assert.equal(AI_SCHED_TOKEN_URL, 'https://api.airindia.com/flight-information/v1/auth/token');
  assert.equal(AI_SCHED_URL, 'https://api.airindia.com/flight-information/v1/schedules');
  assert.equal(airIndiaSchedQuery('DEL', 'BOM', '2026-10-28'), 'origin=DEL&destination=BOM&departureDate=2026-10-28');
  const h = airIndiaSchedHeaders();
  assert.equal(h['Ocp-Apim-Subscription-Key'], '8ea658f3ac1e44cca129d7ed252d4c42');
  assert.equal(h['Referer'], 'https://www.airindia.com/in/en/book/flight-schedule.html');
});

test('x-signature = sha256hex(qs + jwtPayload.token + jwtPayload.iv) — bundle recipe', () => {
  const payload = { token: 'inner-token', iv: 'the-iv', grant: 'x' };
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const jwt = `eyJhbGciOiJIUzI1NiJ9.${b64}.sigpart`;
  const qs = 'origin=DEL&destination=BOM&departureDate=2026-10-28';
  const expected = createHash('sha256').update(qs + 'inner-token' + 'the-iv').digest('hex');
  assert.equal(airIndiaSchedSignature(jwt, qs), expected);
  // malformed tokens never crash, just return ''
  assert.equal(airIndiaSchedSignature('', qs), '');
  assert.equal(airIndiaSchedSignature('not.a', qs), '');
  assert.equal(airIndiaSchedSignature('a.###b64###.c', qs), '');
});

test('parseAirIndiaSchedules decodes the live DEL-BOM fixture for 28 Oct (Wednesday)', () => {
  const flights = parseAirIndiaSchedules(LIVE, '2026-10-28');
  assert.ok(flights.length >= 20, `expected a real schedule, got ${flights.length}`);
  const byNo: Record<string, typeof flights[0]> = {};
  for (const f of flights) byNo[f.flightNo] = f;
  const f2573 = byNo['AI2573'];
  assert.ok(f2573, 'AI2573 present (operates wednesdays)');
  assert.equal(f2573.depTime, '05:30');
  assert.equal(f2573.arrTime, '07:55');
  assert.equal(f2573.durationMin, 145); // 8700s
  assert.equal(f2573.stops, 0);
  assert.equal(f2573.aircraft, 'AIRBUS A320NEO');
  assert.equal(f2573.terminal, '3');
  assert.equal(f2573.dateIso, '2026-10-28');
});

test('operating-day filtering is honest — a Monday-only flight is not offered on Wednesday', () => {
  const mondayOnly = [{ flights: [{ carrierCode: 'AI', flightNumber: '1111', airCraftTypeName: 'A320', stops: 0,
    origin: { airportCode: 'DEL', departureLocalTime: '2026-10-28T06:00:00.000+05:30' },
    destination: { airportCode: 'BOM', arrivalLocalTime: '2026-10-28T08:00:00.000+05:30' },
    operatingDays: ['monday'], validityPeriod: { start: '2026-10-01T00:00:00.000Z', end: '2026-12-31T00:00:00.000Z' } }], duration: 7200 }];
  // 28 Oct 2026 is a Wednesday -> filtered out
  assert.equal(parseAirIndiaSchedules(JSON.stringify({ data: mondayOnly }), '2026-10-28').length, 0);
  // 26 Oct 2026 is a Monday -> offered
  const mon = parseAirIndiaSchedules(JSON.stringify({ data: mondayOnly }), '2026-10-26');
  assert.equal(mon.length, 1);
  assert.equal(mon[0].flightNo, 'AI1111');
  // outside validity window -> dropped
  assert.equal(parseAirIndiaSchedules(JSON.stringify({ data: mondayOnly }), '2026-09-28').length, 0);
});

test('parseAirIndiaSchedules never crashes on junk', () => {
  assert.equal(parseAirIndiaSchedules('', '2026-10-28').length, 0);
  assert.equal(parseAirIndiaSchedules('not-json', '2026-10-28').length, 0);
  assert.equal(parseAirIndiaSchedules('{}', '2026-10-28').length, 0);
  assert.equal(parseAirIndiaSchedules('{"data":[{},{"flights":[]}]}', '2026-10-28').length, 0);
});

test('airIndiaScheduledFareItems builds honest per-flight cards (fare-calendar price + schedule)', () => {
  const flights = parseAirIndiaSchedules(LIVE, '2026-10-28');
  const items = airIndiaScheduledFareItems(flights, { dt: '2026-10-28', pr: 7205, tax: 1795 }, src, 'New Delhi', 'Mumbai', 'DEL', 'BOM');
  assert.equal(items.length, flights.length);
  const it = items.find((i: any) => i.attributes.flight_number === 'AI2573')!;
  assert.equal(it.brand, 'Air India');
  assert.equal(it.price, 7205);
  assert.equal(it.currency, 'INR');
  assert.equal(it.seller, 'Air India');
  assert.equal(it.attributes.departure_time, '05:30');
  assert.equal(it.attributes.arrival_time, '07:55');
  assert.equal(it.attributes.duration_minutes, '145');
  assert.equal(it.attributes.stops, '0');
  assert.equal(it.attributes.aircraft, 'AIRBUS A320NEO');
  assert.equal(it.attributes.travel_date, '2026-10-28');
  // owner 24 Oct reference card: IATA codes publish on the row for the card clocks
  assert.equal(it.attributes.origin, 'DEL');
  assert.equal(it.attributes.destination, 'BOM');
  // honesty: date-level fare clearly labelled
  assert.match(it.attributes.price_basis, /fare-calendar/);
  assert.match(it.attributes.data_note, /date's lowest published one-way fare/);
  assert.match(it.attributes.fare_class, /per-flight booking fare may differ/);
  assert.ok(String(it.identifiers.sku).startsWith('airindia-AI2573-2026-10-28-DELBOM'));
  assert.ok(it.sellerUrl.includes('airindia.com'), 'booking continues on the airline site');
});
