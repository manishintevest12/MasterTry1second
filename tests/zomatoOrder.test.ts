import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseZomatoMenuPage } from '../server/workers/parsers/zomato';

test('Zomato /order page: JSON.parse-wrapped state yields real dishes with price, desc and photo', () => {
  const html = readFileSync(new URL('./fixtures/zomato-order-page.html', import.meta.url), 'utf8');
  const { dishes, hints } = parseZomatoMenuPage(html);
  assert.equal(hints.preloadedState, 1);
  assert.ok(dishes.length >= 4, `expected dishes, got ${dishes.length}`);
  const thali = dishes.find((d) => d.name === 'Special Thali');
  assert.ok(thali);
  assert.equal(thali!.price, 269);
  assert.match(thali!.image || '', /^https:\/\/b\.zmtcdn\.com\//);
  assert.ok((thali!.description || '').length > 10);
  for (const d of dishes) assert.ok(d.price >= 10 && d.price <= 12000);
});
