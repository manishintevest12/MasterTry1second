/**
 * API-boundary feed ordering (owner 28 Oct): the installed Play Store app cannot
 * be patched remotely, so "bare flight rows go to the bottom" is enforced in the
 * /api/search response itself.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { flightRowComplete, orderFlightRowsLast } from '../server/search/feedOrder';

const row = (id: string, specs: Record<string, string>, over: Record<string, any> = {}) => ({
  id,
  vertical: 'flights',
  title: id,
  specs,
  ...over,
});

const full = (id: string) =>
  row(id, { 'flight number': '6E6972', 'departure time': '21:40', 'arrival time': '23:20', 'duration minutes': '1h 40m' });

test('a full card needs flight number + departure + arrival', () => {
  assert.equal(flightRowComplete(full('a')), true);
  assert.equal(flightRowComplete(row('b', { 'flight number': '6E6972', 'departure time': '21:40' })), false);
  assert.equal(flightRowComplete(row('c', { 'departure time': '21:40', 'arrival time': '23:20' })), false);
  assert.equal(flightRowComplete(row('d', {})), false);
});

test('complete rows lead in their original order, bare rows trail in theirs', () => {
  const items = [row('bare1', {}), full('a'), row('bare2', { 'flight number': 'AI9580' }), full('b')];
  const out = orderFlightRowsLast(items, 'flights');
  assert.deepEqual(out.map((i: any) => i.id), ['a', 'b', 'bare1', 'bare2']);
});

test('non-flight verticals and all-complete feeds are returned untouched', () => {
  const hotels = [row('h1', {}), row('h2', {})].map((r) => ({ ...r, vertical: 'hotels' }));
  assert.equal(orderFlightRowsLast(hotels, 'hotels'), hotels);
  const allFull = [full('a'), full('b')];
  assert.equal(orderFlightRowsLast(allFull, 'flights'), allFull);
});

test('the vertical is inferred from the rows when the caller omits it', () => {
  const out = orderFlightRowsLast([row('bare', {}), full('a')]);
  assert.deepEqual(out.map((i: any) => i.id), ['a', 'bare']);
});
