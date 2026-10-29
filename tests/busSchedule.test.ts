/**
 * Bus schedule repair (owner 29 Oct): "indore se sirali search kiya tho phle results ni
 * aaya phir uske baad results aaya tho bina time se" — cards whose departure/arrival gap was
 * empty. These pin the repair rules: the same operator's own row is the only donor, an
 * unknown timing is labelled where the time goes (never a blank gap), and a blank card never
 * outranks a timed one.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { backfillBusSchedule, busOperatorKey, orderTimedFirst, repairBusSchedule } from '../server/verticals/busSchedule.ts';

const row = (operator: string, attrs: Record<string, string>, price = 349): any => ({
  provider: 'redBus',
  title: `${operator} · A/C Seater/Sleeper (2+1)`,
  attributes: { operator, ...attrs },
  prices: { effectivePrice: price },
});

test('operator key ignores the listing tail and generic travel words', () => {
  assert.equal(busOperatorKey(row('Maharani Travels', {})), 'maharani');
  assert.equal(busOperatorKey(row('Om Shanti Travels', {})), 'om shanti');
});

test('a bare row takes the timings of the SAME operator row in the same answer', () => {
  const rows = [
    row('Maharani Travels', { 'departure time': '15:20', 'arrival time': '21:00', duration: '5h 40m', 'duration minutes': '340' }, 349),
    row('Maharani Travels', {}, 399),
  ];
  const out = backfillBusSchedule(rows);
  assert.equal(out[1].attributes!['departure time'], '15:20');
  assert.equal(out[1].attributes!['arrival time'], '21:00');
  assert.equal(out[1].attributes!['duration'], '5h 40m');
  assert.equal(out[1].attributes!['departure'], '15:20 → 21:00');
  assert.equal(out[1].attributes!['schedule source'], 'same operator, same search');
  // The donor row is untouched, and no price was rewritten.
  assert.equal(out[0].attributes!['departure time'], '15:20');
  assert.equal(out[1].prices!.effectivePrice, 399);
});

test('a different operator never donates its timings', () => {
  const out = backfillBusSchedule([
    row('Yadav Bus Services', { 'departure time': '19:30', 'arrival time': '00:30' }),
    row('Maharani Travels', {}),
  ]);
  assert.equal(out[1].attributes!['timing unavailable'], '1', 'no borrowed schedule');
});

test('an unknown timing is labelled in the space, never left blank', () => {
  const out = backfillBusSchedule([row('Maharani Travels', {})]);
  assert.match(String(out[0].attributes!['departure']), /Timing on redBus/);
  assert.equal(out[0].attributes!['timing unavailable'], '1');
  assert.equal(out[0].attributes!['departure time'], 'Timing on redBus', 'the empty slot says why');
  assert.equal(out[0].attributes!['timing unavailable'], '1');
});

test('a time printed only inside the label is lifted into the departure time', () => {
  const out = backfillBusSchedule([row('Yadav Bus Services', { departure: '07:30 PM → 12:30 AM' })]);
  assert.equal(out[0].attributes!['departure time'], '19:30');
  assert.equal(out[0].attributes!['timing unavailable'], undefined);
});

test('timed rows lead the feed and stay cheapest-first inside each tier', () => {
  const rows = [
    row('Blank A', {}, 199),
    row('Timed B', { 'departure time': '09:00' }, 500),
    row('Timed C', { 'departure time': '22:00' }, 300),
  ];
  const ordered = orderTimedFirst(rows);
  assert.deepEqual(ordered.map((r) => r.attributes!.operator), ['Timed C', 'Timed B', 'Blank A']);
});

test('repair pass is idempotent (a second run changes nothing)', () => {
  const once = repairBusSchedule([row('Maharani Travels', {}), row('Maharani Travels', { 'departure time': '15:20' })]);
  const twice = repairBusSchedule(once as any);
  assert.deepEqual(twice.map((r) => r.attributes!['departure time']), once.map((r) => r.attributes!['departure time']));
});
