import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_QUERY_FOR, queryFitsVertical, seedQueryFor } from '../src/lib/verticalSeed';

// OWNER 4 Nov (screenshot: Hotels box held "Rau Tahsil to Bhopal" -> "No matching options found"):
// every vertical must open with ITS OWN default (hosts Goa, flights <city> to New Delhi, bus <city>
// to Nagpur) and must never search another vertical's shape.
const VERTICALS = ['flights', 'hotels', 'bus', 'cab', 'ecommerce', 'grocery', 'food', 'movies',
  'loans', 'insurance', 'creditcards', 'account'];

test('every vertical has a non-empty web default seed', () => {
  for (const v of VERTICALS) assert.ok(DEFAULT_QUERY_FOR(v, 'Indore').trim().length > 0, `${v} has no seed`);
});

test("the owner's exact seeds on web too", () => {
  assert.equal(DEFAULT_QUERY_FOR('hotels', 'Indore'), 'Goa');
  assert.equal(DEFAULT_QUERY_FOR('flights', 'Indore'), 'Indore to New Delhi');
  assert.equal(DEFAULT_QUERY_FOR('bus', 'Indore'), 'Indore to Nagpur');
  assert.equal(DEFAULT_QUERY_FOR('flights', 'Bhopal'), 'Bhopal to New Delhi');
});

test('a route never belongs to hotels/products and a city never to a route vertical', () => {
  assert.equal(queryFitsVertical('hotels', 'Rau Tahsil to Bhopal'), false);
  assert.equal(queryFitsVertical('flights', 'Rau Tahsil to Bhopal'), true);
  assert.equal(queryFitsVertical('bus', 'Indore to Nagpur'), true);
  assert.equal(queryFitsVertical('grocery', 'tata tea'), true);
  assert.equal(queryFitsVertical('grocery', 'Indore to Nagpur'), false);
  assert.equal(queryFitsVertical('hotels', 'Goa'), true);
  assert.equal(queryFitsVertical('hotels', '  '), false);
});

test('the seed keeps a fitting user query and otherwise uses the vertical default', () => {
  assert.equal(seedQueryFor('hotels', 'Indore', 'Rau Tahsil to Bhopal'), 'Goa');
  assert.equal(seedQueryFor('flights', 'Indore', 'Indore to Mumbai'), 'Indore to Mumbai');
  assert.equal(seedQueryFor('ecommerce', 'Indore', ''), 'mobile phone');
});
