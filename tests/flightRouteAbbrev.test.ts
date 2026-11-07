import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeFromQuery, expandCityToken } from '../server/workers/verticals/flights';

// OWNER 7 Nov (screenshot: flights "delhi to mum" answered 0 rows because every source was asked
// for a place literally named "mum"): typed short forms and bare IATA codes resolve to real cities
// BEFORE any source is called, so the app and the site ask the same question.
test('three-letter short forms become real cities', () => {
  const rt = routeFromQuery('delhi to mum')!;
  assert.equal(rt.to, 'Mumbai');
  assert.equal(rt.toCode, 'BOM');
  assert.equal(rt.fromCode, 'DEL');
});

test('bare IATA codes on both sides resolve', () => {
  const rt = routeFromQuery('bom to blr')!;
  assert.equal(rt.from, 'Mumbai');
  assert.equal(rt.to, 'Bengaluru');
  assert.equal(rt.fromCode, 'BOM');
  assert.equal(rt.toCode, 'BLR');
});

test('already-correct routes are untouched and still get their codes', () => {
  const rt = routeFromQuery('Indore (IDR) to Delhi (DEL)')!;
  assert.equal(rt.from, 'Indore');
  assert.equal(rt.to, 'Delhi');
  assert.equal(rt.fromCode, 'IDR');
  assert.equal(rt.toCode, 'DEL');
  const plain = routeFromQuery('patna to delhi flight')!;
  // A typed city that matches a known code comes back capitalised as the real city name.
  assert.equal(plain.from, 'Patna');
  assert.equal(plain.to, 'Delhi');
  assert.equal(plain.fromCode, 'PAT');
});

test('a normal city word is never mistaken for a code', () => {
  assert.equal(expandCityToken('Jaipur'), 'Jaipur');
  assert.equal(expandCityToken('goa'), 'Goa');
  assert.equal(expandCityToken('mumbai'), 'Mumbai');
  assert.equal(expandCityToken('mum'), 'Mumbai');
  assert.equal(expandCityToken('DEL'), 'Delhi');
});
