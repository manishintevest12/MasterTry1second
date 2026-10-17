import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseZeptoSearch, zeptoStoreId, collectZeptoProducts } from '../server/workers/parsers/zeptoSearch';

/** Owner request 17 Oct: add Zepto. Web (zeptonow.com -> zepto.com) is AWS-WAF cookie-challenged on
 *  every endpoint (bff-gateway 202 even in-browser without the challenge cookie; web search is
 *  login-gated), so the worker targets the APK-extracted app route POST api-gateway.zepto.co.in/api/v3/search
 *  (exists: 429=WAF, 404=no-route, verified 17 Oct). Honest-fail; nothing fabricated. */
const src: any = { id: 'w_grocery_zepto', name: 'Zepto worker', vertical: 'grocery', method: 'direct_http' };

test('zeptoStoreId: pulls the store UUID out of a serviceability response at any nesting', () => {
  const svc = JSON.stringify({ data: { serviceable: true, stores: [{ id: 'f5e682bc-1124-4bcf-8fca-734bd8b59d7f', name: 'Gurgaon' }] } });
  assert.equal(zeptoStoreId(svc), 'f5e682bc-1124-4bcf-8fca-734bd8b59d7f');
  assert.equal(zeptoStoreId('{"serviceable": false}'), null);
  assert.equal(zeptoStoreId('not json'), null);
});

test('collectZeptoProducts: walker finds name+price pairs on the same object, handles units/nanos money', () => {
  const deep = { a: { b: { c: { products: [{ productName: 'Amul Taaza Toned Milk', images: ['https://img.example/x.jpg'], variants: [{ price: { units: '30', nanos: 0 }, pack_size: '500 ml' }] }] } } } };
  const out: any[] = [];
  collectZeptoProducts(deep, out);
  assert.equal(out.length, 0, 'price on a child object must not be attributed to the parent name');
  const flat = { products: [{ name: 'Amul Taaza Toned Milk', price: 30, mrp: 32, pack_size: '500 ml' }] };
  const out2: any[] = [];
  collectZeptoProducts(flat, out2);
  assert.equal(out2.length, 1);
  assert.equal(out2[0].price, 30);
  assert.equal(out2[0].mrp, 32);
});

test('parseZeptoSearch: honest offers only (price required, query-relevant, no dupes)', () => {
  const j = JSON.stringify({ products: [
    { name: 'Amul Gold Full Cream Milk', price: 72, mrp: 75, pack_size: '1 ltr', id: 'p1' },
    { name: 'Mother Dairy Toned Milk', price: 30, pack_size: '500 ml' },
    { name: 'Amul Gold Full Cream Milk', price: 72 },
    { name: 'Bread Multigrain', price: 45 },
    { name: 'Milk jug (no price here)' },
  ] });
  const items = parseZeptoSearch(j, src, 'milk', 'Indore', 16);
  assert.equal(items.length, 2); // bread filtered (query relevance), dupe collapsed, priceless skipped
  assert.equal(items[0].title, 'Amul Gold Full Cream Milk');
  assert.equal(items[0].price, 72);
  assert.equal(items[0].listPrice, 75);
  assert.equal(items[0].seller, 'Zepto');
  assert.ok(String(items[0].sellerUrl).startsWith('https://www.zepto.com/search'));
  assert.equal(items[0].identifiers.sku, 'zepto-p1');
});

test('grocery worker: Zepto is a real v3/search task with honest WAF reporting', () => {
  const s = readFileSync('server/workers/verticals/grocery.ts', 'utf8');
  assert.ok(s.includes('api/v3/search'), 'v3/search attempted');
  assert.ok(s.includes('Zepto search WAF 429'), '429 reported honestly (IP-dependent)');
  assert.ok(s.includes("sourceId: 'w_grocery_zepto'"), 'Zepto source id kept');
  assert.ok(s.includes('serviceability-service/api/v1/serviceability'), 'ungated serviceability feeds the store context');
});
