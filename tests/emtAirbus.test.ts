/**
 * EMT AirBus regression (24 Oct 2026): flight-number/date parity with the
 * other flight workers. Fixture recorded LIVE from EaseMyTrip's AirBus_New
 * search API 24 Oct 2026 (DEL-BOM 28-Oct): 6E5175 12:55->14:55, Saver 6,393,
 * 93 seats, non-stop. Guards: parse (flight no, times, duration, stops,
 * seats, fare) and item build (flight_number + departure_date + travel.date
 * published so cards group + display like every other seller).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEmtAirbus, emtAirbusItems } from '../server/workers/parsers/emtAirbus.ts';

const src: any = { id: 't_emt', name: 'EaseMyTrip', method: 'http', verticals: ['flights'], enabled: true, priority: 14, config: {}, rateLimit: { maxRequestsPerMinute: 2, maxConcurrency: 1 }, freshnessPolicy: {} };
const BODY = readFileSync(new URL('./fixtures/emt_airbus_del_bom.json', import.meta.url), 'utf8');

test('parseEmtAirbus decodes live AirBus payload (6E5175 DEL-BOM)', () => {
  const flights = parseEmtAirbus(BODY);
  assert.ok(flights.length > 20, `expected many flights, got ${flights.length}`);
  const f = flights.find((x: any) => x.flightNo === '5175' && x.airlineCode === '6E');
  assert.ok(f, '6E5175 present');
  assert.equal(f!.depTime, '12:55');
  assert.equal(f!.arrTime, '14:55');
  assert.equal(f!.durationMin, 120);
  assert.equal(f!.stops, 'Non-stop');
  assert.equal(f!.fareName, 'Saver');
  assert.ok(f!.fare > 0);
});

test('emtAirbusItems publish flight_number, departure_date and travel.date (parity with other sellers)', () => {
  const flights = parseEmtAirbus(BODY);
  const items = emtAirbusItems(flights.slice(0, 30), src, { from: 'Delhi', to: 'Mumbai' }, 'DEL', 'BOM', '2026-10-28');
  assert.ok(items.length >= 5);
  const it: any = items.find((x: any) => x.attributes?.flight_number === '6E5175');
  assert.ok(it, '6E5175 row present');
  assert.equal(it.attributes.flight_number, '6E5175');
  assert.equal(it.attributes.departure_date, '2026-10-28');
  assert.equal(it.travel.date, '2026-10-28');
  assert.equal(it.seller, 'EaseMyTrip');
  assert.ok(it.attributes.airline, 'operating airline published');
  assert.equal(it.currency, 'INR');
  assert.ok(it.price > 0);
  // every row carries the parity fields
  for (const r of items as any[]) {
    assert.ok(r.attributes.flight_number, 'flight_number always present');
    assert.equal(r.attributes.departure_date, '2026-10-28');
    assert.equal(r.travel.date, '2026-10-28');
  }
});
