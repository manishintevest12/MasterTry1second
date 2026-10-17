import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseBlinkit } from '../server/workers/parsers/blinkit';

const src: any = { id: 'w_grocery_blinkit', name: 'Blinkit', method: 'cffi', adapterVersion: '1', parserVersion: '1', vertical: 'grocery' };
const body = fs.readFileSync(new URL('./fixtures/blinkit_search.json', import.meta.url), 'utf8');

test('blinkit: parses real search JSON into priced, imaged offers', () => {
  const items = parseBlinkit(body, src, 'https://blinkit.com/v1/layout/search?q=milk', 'Mumbai');
  assert.ok(items.length >= 1);
  const it = items[0];
  assert.ok(it.price! > 0);
  assert.equal(it.seller, 'Blinkit');
  assert.match(String(it.attributes?.image_url), /^https:\/\//);
  assert.ok(/\(.+\)$/.test(it.title), 'pack size appended to title');
});

test('blinkit: malformed / empty / failed JSON yields no items (never invented)', () => {
  assert.deepEqual(parseBlinkit('not json', src, 'u', 'Mumbai'), []);
  assert.deepEqual(parseBlinkit('{"is_success":false,"response":{"snippets":null}}', src, 'u', 'Mumbai'), []);
});

/** 17 Oct: Blinkit app-gateway route (APK v17.65 XAPK via APKFab). api3.blinkit.com is the
 *  config/domains rollout target for api2.grofers.com and is NOT behind the website's
 *  Cloudflare edge: POST /v1/layout/search with app headers (lat/lon + Grofers UA) returns
 *  the same product_card_snippet_type_2 widgets as the web endpoint. Fixture below is a
 *  real sandbox capture (Gurugram milk, 17 Oct 2026). */
const appBody = fs.readFileSync(new URL('./fixtures/blinkit_app_gateway.json', import.meta.url), 'utf8');

test('blinkit: app-gateway response (api3.blinkit.com) parses with the same parser', () => {
  const items = parseBlinkit(appBody, src, 'https://api3.blinkit.com/v1/layout/search?q=milk', 'Gurugram', 16);
  assert.ok(items.length >= 4, 'app gateway returns real priced products');
  assert.ok(items.every((i) => i.price! > 0));
  assert.ok(items.some((i) => /milk/i.test(i.title)));
});

test('blinkit worker: app gateway is primary, web ladder is fallback', () => {
  const s = fs.readFileSync('server/workers/verticals/grocery.ts', 'utf8');
  assert.ok(s.includes('https://api3.blinkit.com/v1/layout/search'), 'app gateway attempted first');
  assert.ok(s.includes('Grofers/17.65.0'), 'APK app UA used');
  assert.ok(s.includes('usedAppGateway'), 'web fingerprint ladder only runs on app-gateway failure');
});
