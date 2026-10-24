/**
 * Uber m.uber.com/go guest Products flow (discovered 24 Oct 2026).
 * Fixture: live captured graphql response for Rajwada -> Devi Ahilyabai Holkar
 * Airport (Indore) from the anonymous Products query.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  UBER_PRODUCTS_QUERY,
  buildUberProductsRequestBody,
  parseUberProductsResponse,
  buildUberGoBookUrl,
} from '../server/workers/parsers/uberGoProducts';

const FIXTURE = readFileSync(new URL('./fixtures/uber_go_products_idr_rajwada_airport.json', import.meta.url), 'utf8');
const pickup = { lat: 22.71771, lng: 75.8544848, name: 'Rajwada' };
const drop = { lat: 22.7280036, lng: 75.804099, name: 'Devi Ahilyabai Holkar Airport' };

test('captured query is the verbatim Products operation with fragments', () => {
  assert.ok(UBER_PRODUCTS_QUERY.startsWith('query Products('));
  assert.ok(UBER_PRODUCTS_QUERY.includes('fragment ProductsFragment on RVWebCommonProductsResponse'));
  assert.ok(UBER_PRODUCTS_QUERY.includes('fragment ProductFragment on RVWebCommonProduct'));
});

test('request body matches the exact shape Uber\'s own bundle sends', () => {
  const b = JSON.parse(buildUberProductsRequestBody(pickup, drop));
  assert.equal(b.operationName, 'Products');
  assert.equal(b.query, UBER_PRODUCTS_QUERY);
  assert.deepEqual(b.variables, {
    includeRecommended: false,
    destinations: [{ latitude: 22.7280036, longitude: 75.804099 }],
    isHcv: false,
    payment: { uberCashToggleOn: true },
    pickup: { latitude: 22.71771, longitude: 75.8544848 },
    targetProductType: 'ANONYMOUS',
  });
});

test('fixture: 15 deduped Indore products, login-gated fares stay null (never invented)', () => {
  const prods = parseUberProductsResponse(FIXTURE);
  assert.equal(prods.length, 15); // 17 raw rows, 2 duplicates ("Intercity Saver", "Request Any")
  assert.equal(prods[0].displayName, 'Go Intercity');
  assert.equal(prods[0].capacity, 4);
  assert.ok(prods[0].isAvailable);
  for (const p of prods) assert.equal(p.fare, null, `fare for ${p.displayName} must stay null, never invented`);
});

test('when Uber exposes a guest fare it is parsed honestly (self-healing probe shape)', () => {
  const withFare = JSON.parse(FIXTURE);
  const f = withFare.data.products.tiers[1].products[0].fares[0]; // Uber Go
  f.fare = '₹ 284';
  f.fareAmountE5 = 28400000;
  const prods = parseUberProductsResponse(JSON.stringify(withFare));
  const go = prods.find((p) => p.displayName === 'Uber Go')!;
  assert.equal(go.fare, 284);
});

test('fareAmountE5 alone converts to rupees', () => {
  const j = { data: { products: { tiers: [{ title: 'Economy', products: [{ displayName: 'Uber Go', fares: [{ capacity: 4, fare: '', fareAmountE5: 31250000 }], isAvailable: true }] }] } } };
  const [p] = parseUberProductsResponse(JSON.stringify(j));
  assert.equal(p.fare, 313); // 31250000 / 100000 = 312.5 -> honest rounding
});

test('malformed/empty bodies never throw', () => {
  assert.deepEqual(parseUberProductsResponse(''), []);
  assert.deepEqual(parseUberProductsResponse('<html>login</html>'), []);
  assert.deepEqual(parseUberProductsResponse('{"errors": []}'), []);
});

test('booking deeplink is the owner-specified m.uber.com/looking format', () => {
  const url = buildUberGoBookUrl('vjgXa6VEp5eVJNMBtlPEsYZ5agg9cy_w', pickup, drop);
  assert.ok(url.startsWith('https://m.uber.com/looking/?client_id=vjgXa6VEp5eVJNMBtlPEsYZ5agg9cy_w&'));
  assert.ok(url.includes('pickup=' + encodeURIComponent(JSON.stringify({ latitude: 22.71771, longitude: 75.8544848, addressLine1: 'Rajwada' }))));
  assert.ok(url.includes('drop[0]=' + encodeURIComponent(JSON.stringify({ latitude: 22.7280036, longitude: 75.804099, addressLine1: 'Devi Ahilyabai Holkar Airport' }))));
});
