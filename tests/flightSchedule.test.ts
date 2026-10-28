/**
 * Flight schedule memory tests (owner 28 Oct).
 *
 * The owner's rule: a flight row must render in FULL form (flight number, real
 * dep → arr, duration, non-stop). Timings are never invented — they are copied
 * from a row of the SAME flight number that a real source published. Anything we
 * cannot complete keeps its bare row (the feed orders it last instead).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';

import {
  enrichFlightSchedules,
  hasFlightSchedule,
  learnFlightSchedules,
  normalizeClockTime,
  normalizeFlightNo,
  resetFlightScheduleMemory,
  flightScheduleMemorySize,
} from '../server/common/flightSchedule';

const flight = (over: Record<string, any> = {}) => ({
  id: 'o1',
  vertical: 'flights',
  title: 'IndiGo 6E6972 · Indore → Delhi',
  seller: 'Ixigo',
  price: 6786,
  travel: { route: 'indore to delhi', date: '2026-10-29' },
  attributes: {},
  ...over,
});

test('normalizeFlightNo keeps real airline codes and rejects dates/plain numbers', () => {
  assert.equal(normalizeFlightNo('6E 6972'), '6E6972');
  assert.equal(normalizeFlightNo('6e-6972'), '6E6972');
  assert.equal(normalizeFlightNo('AI9580'), 'AI9580');
  assert.equal(normalizeFlightNo('2026-10-29'), null);
  assert.equal(normalizeFlightNo('6796'), null);
  assert.equal(normalizeFlightNo(''), null);
});

test('normalizeClockTime understands every shape the parsers publish', () => {
  assert.equal(normalizeClockTime('21:40'), '21:40');
  assert.equal(normalizeClockTime('9:40'), '09:40');
  assert.equal(normalizeClockTime('2026-10-29T21:40:00'), '21:40');
  assert.equal(normalizeClockTime('09:40 PM'), '21:40');
  assert.equal(normalizeClockTime('nope'), null);
  assert.equal(normalizeClockTime(''), null);
});

test('a live row teaches the same flight number its timings (catalogue row completed)', () => {
  resetFlightScheduleMemory();
  const live = flight({
    seller: 'Ixigo',
    attributes: { flight_number: '6E6972', departure_time: '21:40', arrival_time: '23:20', duration_minutes: 100, stops: 0, airline: 'IndiGo' },
  });
  const bare = flight({
    id: 'o2',
    seller: 'EaseMyTrip',
    title: 'IndiGo 6E6972 · Indore → Delhi',
    attributes: {},
  });

  const out = enrichFlightSchedules([live, bare]);
  const filled = out[1] as any;
  assert.equal(filled.attributes.departure, '21:40');
  assert.equal(filled.attributes.arrival, '23:20');
  assert.equal(filled.attributes.duration_minutes, 100);
  assert.equal(filled.attributes.stops, 0);
  // Provenance is kept so the timings are auditable, never presented as fresh.
  assert.equal(filled.attributes.schedule_source, 'observed_live_row');
  // The original object is untouched (callers keep their own copy).
  assert.equal((bare as any).attributes.departure, undefined);
});

test('nothing is invented when the flight number has no observed schedule', () => {
  resetFlightScheduleMemory();
  const bare = flight({ attributes: {} });
  const out = enrichFlightSchedules([bare]);
  assert.equal((out[0] as any).attributes.departure, undefined);
  assert.equal((out[0] as any).attributes.arrival, undefined);
  assert.equal(hasFlightSchedule({ vertical: 'flights', specs: {} }), false);
});

test('a different route for the same flight number is refused, not guessed', () => {
  resetFlightScheduleMemory();
  learnFlightSchedules([
    flight({
      travel: { route: 'indore to delhi', date: '2026-10-29' },
      attributes: { flight_number: '6E6972', departure_time: '21:40', arrival_time: '23:20', route: 'IDR → DEL' },
    }),
    flight({
      travel: { route: 'mumbai to goa', date: '2026-10-29' },
      attributes: { flight_number: '6E6972', departure_time: '08:10', arrival_time: '09:25', route: 'BOM → GOI' },
    }),
  ]);
  // Two routes on record → the flight number alone is ambiguous.
  const out = enrichFlightSchedules([
    flight({ travel: { route: 'delhi to pune', date: '2026-10-29' }, attributes: { flight_number: '6E6972' } }),
  ]);
  assert.equal((out[0] as any).attributes.departure, undefined);
});

test('enrichment ignores non-flight verticals entirely', () => {
  resetFlightScheduleMemory();
  learnFlightSchedules([
    flight({ attributes: { flight_number: '6E6972', departure_time: '21:40', arrival_time: '23:20' } }),
  ]);
  const hotel = { id: 'h1', vertical: 'hotels', title: 'Taj', attributes: {} };
  const out = enrichFlightSchedules([hotel]);
  assert.equal(out[0], hotel);
  assert.equal(flightScheduleMemorySize(), 1);
});

test('hasFlightSchedule reads the mapped specs the cards use', () => {
  assert.equal(hasFlightSchedule({ vertical: 'flights', specs: { 'departure time': '21:40', 'arrival time': '23:20' } }), true);
  assert.equal(hasFlightSchedule({ vertical: 'flights', specs: { departure: '21:40 → 23:20' } }), false);
  assert.equal(hasFlightSchedule({ vertical: 'flights', specs: { 'departure time': '21:40' } }), false);
});
