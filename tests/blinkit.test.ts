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
