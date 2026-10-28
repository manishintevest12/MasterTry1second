/**
 * Feed ordering for flight cards (owner 28 Oct): a row that cannot render as the
 * full "second type" card (flight number + real dep → arr + duration + non-stop)
 * must sit at the END of the feed, never take a top slot.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { flightScheduleComplete, scheduleCompleteFirst } from '../src/utils/flightSchedule';

const item = (over: Record<string, any> = {}) => ({
  id: 'x',
  vertical: 'flights',
  primaryPrice: 5000,
  specs: {},
  ...over,
});

const group = (id: string, lead: any) => ({ key: id, best: { item: lead }, rows: [lead] });

test('a card with dep + arr counts as complete', () => {
  assert.equal(flightScheduleComplete(item({ specs: { 'departure time': '21:40', 'arrival time': '23:20' } })), true);
  assert.equal(flightScheduleComplete(item({ specs: { departure: '2026-10-29T21:40:00', arrival: '23:20' } })), true);
  assert.equal(flightScheduleComplete(item({ specs: { departure: '21:40 → 23:20' } })), true);
});

test('a bare airline/route/price row is incomplete', () => {
  assert.equal(flightScheduleComplete(item({ specs: { 'flight number': '6E6972' } })), false);
  assert.equal(flightScheduleComplete(item({ specs: { 'departure time': '21:40' } })), false);
  assert.equal(flightScheduleComplete(item({ specs: {} })), false);
});

test('non-flight rows are never treated as flights', () => {
  assert.equal(flightScheduleComplete({ vertical: 'hotels', specs: {} }), false);
  assert.equal(flightScheduleComplete(null), false);
});

test('complete cards keep their order and lead; incomplete ones move to the end', () => {
  const full1 = group('a', item({ specs: { 'departure time': '06:00', 'arrival time': '07:15' } }));
  const bare1 = group('b', item({ specs: {} }));
  const full2 = group('c', item({ specs: { 'departure time': '21:40', 'arrival time': '23:20' } }));
  const bare2 = group('d', item({ specs: { 'flight number': 'AI9580' } }));

  const ordered = scheduleCompleteFirst([full1, bare1, full2, bare2], (g: any) => g.best.item);
  assert.deepEqual(ordered.map((g: any) => g.key), ['a', 'c', 'b', 'd']);
});

test('the returned array is untouched when every card is complete', () => {
  const gs = [
    group('a', item({ specs: { 'departure time': '06:00', 'arrival time': '07:15' } })),
    group('b', item({ specs: { 'departure time': '21:40', 'arrival time': '23:20' } })),
  ];
  assert.equal(scheduleCompleteFirst(gs, (g: any) => g.best.item), gs);
});
