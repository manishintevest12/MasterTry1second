/**
 * Owner 30 Oct: "flight mai time ni aa raha uska time le kr aao kaise v agar phir v
 * naa aaye tho usko hide kr do jo time naa de."
 *
 * These tests pin the two halves of that rule without touching the network:
 *  - a row whose source published timings only in its TITLE text still counts as timed
 *    (broader key/text extraction in server/common/flightSchedule.ts);
 *  - a flight row that is still timeless after the backfill is HIDDEN;
 *  - a seller presence card (no fare claimed) is NOT hidden — it is a different,
 *    owner-requested feature, not a flight with a missing time;
 *  - other verticals are never touched;
 *  - routes parsed out of the card route string resolve to the right Ixigo tokens.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';

import {
  backfillFlightTimes,
  hideFlightRowsWithoutTimes,
  resetFlightTimeBackfill,
  routeTokensOf,
} from '../server/search/flightTimeBackfill';
import {
  enrichFlightSchedules,
  hasFlightSchedule,
  resetFlightScheduleMemory,
} from '../server/common/flightSchedule';

const flight = (over: Record<string, any> = {}) => ({
  id: 'f1',
  vertical: 'flights',
  title: 'IndiGo 6E6972',
  seller: 'IndiGo',
  vendor: 'IndiGo',
  brand: 'IndiGo',
  attributes: { flight_number: '6E6972', route: 'Indore → Delhi' },
  travel: { route: 'indore to delhi', date: '2026-11-09' },
  prices: { currency: 'INR', effectivePrice: 5400, mandatoryTotal: 5400, listPrice: 5400 },
  ...over,
});

test('routeTokensOf reads city names and IATA codes', () => {
  assert.deepEqual(routeTokensOf('Indore → Delhi'), { from: 'indore', to: 'delhi' });
  assert.deepEqual(routeTokensOf('indore to delhi'), { from: 'indore', to: 'delhi' });
  assert.deepEqual(routeTokensOf('IDR-DEL'), { from: 'idr', to: 'del' });
  assert.equal(routeTokensOf(''), null);
});

test('a flight row with a fare but no time is hidden', () => {
  const rows = [flight(), flight({ id: 'f2', title: 'Air India AI1852' })];
  const out = hideFlightRowsWithoutTimes(rows);
  assert.equal(out.kept.length, 0);
  assert.equal(out.dropped.length, 2);
  assert.equal(out.dropped[0].reason, 'no_time');
});

test('a flight row that has both times survives', () => {
  const rows = [flight({ attributes: { flight_number: 'AI1852', departure: '13:55', arrival: '15:30' } })];
  const out = hideFlightRowsWithoutTimes(rows);
  assert.equal(out.kept.length, 1);
  assert.equal(out.dropped.length, 0);
});

test('timings published only in the card text still count (no false hide)', () => {
  const row = flight({
    title: 'IndiGo 6E 6972',
    subtitle: '6E6972 21:40 → 23:35 · non-stop',
    attributes: { flight_number: '6E6972' },
  });
  const filled = enrichFlightSchedules([row] as any)[0] as any;
  assert.equal(hasFlightSchedule(filled), true, 'text timings must be picked up');
  const out = hideFlightRowsWithoutTimes([filled]);
  assert.equal(out.kept.length, 1);
  assert.equal(out.dropped.length, 0);
});

test('non-standard attribute keys (std/sta) are honoured', () => {
  const row = flight({ attributes: { flight_number: '6E6972', std: '07:10', sta: '09:05' } });
  const out = hideFlightRowsWithoutTimes([row] as any);
  assert.equal(out.kept.length, 1);
});

test('a seller presence card is never hidden by the flight time rule', () => {
  const presence = {
    id: 'presence_w_flights_mmt_indore_delhi_2026-11-09',
    vertical: 'flights',
    title: 'MakeMyTrip flights: Indore → Delhi',
    seller: 'MakeMyTrip',
    attributes: { price_basis: 'live_fares_unavailable', route: 'Indore → Delhi' },
    travel: { route: 'indore to delhi', date: '2026-11-09' },
    prices: { currency: 'INR', fees: {} },
  };
  const out = hideFlightRowsWithoutTimes([presence, flight()] as any);
  assert.equal(out.kept.length, 1);
  assert.equal((out.kept[0] as any).id, presence.id);
  assert.equal(out.dropped.length, 1);
});

test('other verticals are untouched by the flight hide rule', () => {
  const hotel = { id: 'h1', vertical: 'hotels', title: 'Taj Shimla', seller: 'Agoda', attributes: {}, prices: { effectivePrice: 9000 } };
  const out = hideFlightRowsWithoutTimes([hotel] as any);
  assert.equal(out.kept.length, 1);
  assert.equal(out.dropped.length, 0);
});

test('backfill fills a row from a schedule learned in the same batch, without any network call', async () => {
  resetFlightScheduleMemory();
  resetFlightTimeBackfill();
  const teacher = flight({
    id: 't1',
    attributes: { flight_number: '6E6972', departure: '21:40', arrival: '23:35', route: 'IDR → DEL' },
  });
  const bare = flight({ id: 'b1', attributes: { flight_number: '6E6972', route: 'IDR → DEL' } });
  const out = await backfillFlightTimes([teacher, bare] as any, { harvest: false });
  assert.equal(out.length, 2);
  const filled = out.find((r: any) => r.id === 'b1') as any;
  assert.equal(hasFlightSchedule(filled), true);
  assert.equal(filled.attributes.departure, '21:40');
  assert.equal(filled.attributes.arrival, '23:35');
  // Nothing invented for a different flight number: that row stays bare and is hidden.
  const stranger = flight({ id: 's1', attributes: { flight_number: 'UK999', route: 'IDR → DEL' } });
  const hidden = hideFlightRowsWithoutTimes(await backfillFlightTimes([stranger] as any, { harvest: false }));
  assert.equal(hidden.kept.length, 0);
  assert.equal(hidden.dropped.length, 1);
});
