import test from 'node:test';
import assert from 'node:assert/strict';
import { quickAppsPartnerFirst } from '../server/api/routes';

/** Owner 23 Oct (screenshot): home rail shows exactly 6 partner tiles.
 * /api/quick-apps pins the curated partner domains first; the rest keep order. */
test('quick-apps: the six curated partner domains lead the response', () => {
  const rows = [
    { dom: 'some-seller.in', n: 1 },
    { dom: 'myntra.com', n: 2 },
    { dom: 'another-shop.com', n: 3 },
    { dom: 'zomato.com', n: 4 },
    { dom: 'flipkart.com', n: 5 },
    { dom: 'amazon.in', n: 6 },
    { dom: 'swiggy.com', n: 7 },
    { dom: 'bookmyshow.com', n: 8 },
  ];
  const ordered = quickAppsPartnerFirst(rows);
  assert.deepEqual(ordered.slice(0, 6).map((r: any) => r.dom), [
    'zomato.com', 'flipkart.com', 'amazon.in', 'swiggy.com', 'bookmyshow.com', 'myntra.com',
  ]);
  // non-partners keep their relative registry order after the pinned six
  assert.deepEqual(ordered.slice(6).map((r: any) => r.dom), ['some-seller.in', 'another-shop.com']);
  // input array is not mutated
  assert.equal(rows[0].dom, 'some-seller.in');
});
