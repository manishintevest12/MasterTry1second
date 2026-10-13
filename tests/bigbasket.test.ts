import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseBigbasket } from '../server/workers/parsers/bigbasket';

const src: any = { id: 'w_grocery_bigbasket', name: 'BigBasket', method: 'cffi', adapterVersion: '1', parserVersion: '1', vertical: 'grocery' };
const body = fs.readFileSync(new URL('./fixtures/bigbasket_search.json', import.meta.url), 'utf8');

test('bigbasket: parses real listing JSON into priced, imaged offers', () => {
  const items = parseBigbasket(body, src, 'https://www.bigbasket.com/listing-svc/v2/products?type=ps&slug=milk', 'Mumbai');
  assert.ok(items.length >= 2);
  const it = items[0];
  assert.ok(it.price! > 0);
  assert.equal(it.seller, 'BigBasket');
  assert.match(String(it.attributes?.image_url), /^https:\/\//);
  assert.ok(/\(.+\)$/.test(it.title), 'pack size appended');
  assert.ok(it.identifiers?.sku, 'product id as sku');
});

test('bigbasket: malformed / gated JSON yields no items (never invented)', () => {
  assert.deepEqual(parseBigbasket('not json', src, 'u', 'Mumbai'), []);
  assert.deepEqual(parseBigbasket('{"tabs":null}', src, 'u', 'Mumbai'), []);
  // products without prices are skipped, not zero-priced
  assert.deepEqual(parseBigbasket('{"tabs":[{"product_info":{"products":[{"desc":"X","pricing":{"discount":{"prim_price":{"sp":null}}}}]}}]}', src, 'u', 'Mumbai'), []);
});
