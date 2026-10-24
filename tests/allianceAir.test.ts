/**
 * Alliance Air regression (24 Oct 2026): bookme.allianceair.in (Yii PHP, NO
 * WAF) replays browserless. Fixture recorded LIVE from the sandbox 24 Oct
 * 2026: DEL-BOM week of 26 Oct, 27 Oct flights incl. 9I841 ATR-72 15:25->
 * 18:30, fare_info.total 7147 INR (Basic 5500 + Airport Tax), 6 seats.
 * Guards: DD/MM/YYYY form body, dataSchedule JSON extraction, exact-date row
 * filtering, per-flight item build, honest empty for unserved weeks.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { allianceAirSearchBody, extractAaDataSchedule, parseAllianceAirSchedule, allianceAirFlightItems, allianceAirSearchUrl } from '../server/workers/parsers/allianceAir.ts';

const src: any = { id: 't_flights_allianceair', name: 'Alliance Air', method: 'http', verticals: ['flights'], enabled: true, priority: 14, config: {}, rateLimit: { maxRequestsPerMinute: 4, maxConcurrency: 1 }, freshnessPolicy: {} };

const FIX = JSON.parse(readFileSync(new URL('./fixtures/allianceair_search_del_bom.json', import.meta.url), 'utf8'));
const SCHEDULE = FIX.response;

// Synthetic page embedding the fixture JSON the way the real search page does.
const SYN_PAGE = `<html><script>var x = 1; this.dataSchedule = ["","",${JSON.stringify(SCHEDULE)}];</script></html>`;

test('allianceAirSearchBody uses DD/MM/YYYY and the exact browser form shape', () => {
  const b = new URLSearchParams(allianceAirSearchBody('DEL', 'BOM', '2026-10-27'));
  assert.equal(b.get('org'), 'DEL');
  assert.equal(b.get('des'), 'BOM');
  assert.equal(b.get('dep_date'), '27/10/2026', 'wrong date format gets silently rejected by Yii');
  assert.equal(b.get('pax'), '1 pax(s)');
  assert.equal(b.get('ccy'), 'INR');
  assert.equal(b.get('multi_route'), '');
});

test('extractAaDataSchedule pulls the embedded JSON out of the page', () => {
  const d = extractAaDataSchedule(SYN_PAGE);
  assert.ok(d, 'schedule extracted');
  assert.equal(d.origin, 'DEL');
  assert.ok(Array.isArray(d.departure_schedule));
  assert.ok(d.departure_schedule.length >= 1);
});

test('extractAaDataSchedule returns null on pages without the marker', () => {
  assert.equal(extractAaDataSchedule('<html><body>home</body></html>'), null);
});

test('parseAllianceAirSchedule: 27 Oct rows decode with times, fare, seats, baggage', () => {
  const flights = parseAllianceAirSchedule(SCHEDULE, '2026-10-27');
  assert.ok(flights.length >= 1, `expected 27 Oct flights, got ${flights.length}`);
  const f = flights.find((x) => x.flightNo === '9I841');
  assert.ok(f, '9I841 present');
  assert.equal(f.price, 7147);
  assert.equal(f.depTime, '15:25');
  assert.equal(f.arrTime, '18:30');
  assert.equal(f.aircraft, 'ATR-72');
  assert.equal(f.stops, 0);
  assert.equal(f.travelDate, '2026-10-27');
  assert.equal(f.availability, 6);
  assert.equal(f.baggageKg, 15);
});

test('parseAllianceAirSchedule: only requested date rows are honest', () => {
  const other = parseAllianceAirSchedule(SCHEDULE, '2026-10-25');
  assert.equal(other.length, 0, 'no flights on 25 Oct in fixture — honest empty');
});

test('allianceAirFlightItems: per-flight rows with seller Alliance Air and booking deeplink', () => {
  const flights = parseAllianceAirSchedule(SCHEDULE, '2026-10-27');
  const items = allianceAirFlightItems(flights, src, 'Delhi', 'Mumbai', 'DEL', 'BOM', '2026-10-27');
  assert.equal(items.length, flights.length);
  const it: any = items.find((x: any) => x.attributes.flight_number === '9I841');
  assert.ok(it, '9I841 item present');
  assert.equal(it.seller, 'Alliance Air');
  assert.equal(it.currency, 'INR');
  assert.equal(it.attributes.airline, 'Alliance Air');
  assert.equal(it.attributes.departure_date, '2026-10-27');
  assert.match(it.title, /9I841/);
  assert.match(it.title, /15:25–18:30/);
  assert.equal(it.sellerUrl, allianceAirSearchUrl('DEL', 'BOM', '2026-10-27'));
});

test('allianceAirFlightItems: empty schedule emits nothing', () => {
  assert.equal(allianceAirFlightItems([], src, 'Delhi', 'Mumbai', 'DEL', 'BOM', '2026-10-27').length, 0);
});
