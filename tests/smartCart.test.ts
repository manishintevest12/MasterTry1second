import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groceryProductKey, bestUnitPricesPerStore, computeStoreTotals } from '../server/smartcart/basket';

// Owner rule: Smart Cart compares a basket across stores, totals it per store,
// and the cheapest FULL basket wins the redirect.

test('groceryProductKey: pack-size spelling collapses across stores', () => {
  assert.equal(groceryProductKey('Amul Butter 100 g'), groceryProductKey('Amul Butter - 100g'));
  assert.equal(groceryProductKey('Tata Salt 1 kg'), groceryProductKey('tata salt 1kg'));
  assert.notEqual(groceryProductKey('Amul Butter 100 g'), groceryProductKey('Amul Butter 500 g'));
});

test('bestUnitPricesPerStore: picks the searched product and the best price per store', () => {
  const offers = [
    { seller: 'Blinkit', price: 54, title: 'Amul Butter 100 g', url: '/o/1' },
    { seller: 'Zepto', price: 52, title: 'Amul Butter 100g', url: '/o/2' },
    { seller: 'Blinkit', price: 49, title: 'Amul Butter 100 g (old)', url: '/o/3' }, // cheaper same-store dup
    { seller: 'JioMart', price: 30, title: 'Amul Butter Case 12x100g', url: '/o/4' }, // different product
  ];
  const r = bestUnitPricesPerStore('amul butter', offers as any);
  const blinkit = r.unitPrices.find((u) => u.seller === 'Blinkit');
  assert.equal(blinkit?.price, 49, 'cheapest same-store offer wins');
  assert.equal(r.unitPrices.find((u) => u.seller === 'Zepto')?.price, 52);
  assert.ok(!r.unitPrices.find((u) => u.seller === 'JioMart'), 'different product never joins the basket row');
});

test('computeStoreTotals: cheapest FULL basket ranks first with savings', () => {
  const items = [
    { name: 'milk 1l', qty: 2, found: true, unitPrices: [
      { seller: 'Blinkit', price: 66, title: 'Milk 1L', url: '/o/1' },
      { seller: 'Zepto', price: 68, title: 'Milk 1 L', url: '/o/2' },
    ]},
    { name: 'bread', qty: 1, found: true, unitPrices: [
      { seller: 'Blinkit', price: 45, title: 'Bread 400g', url: '/o/3' },
      { seller: 'JioMart', price: 40, title: 'Bread 400g', url: '/o/4' },
    ]},
  ];
  const c = computeStoreTotals(items as any);
  // Blinkit carries both: 66*2 + 45 = 177. Zepto/JioMart are partial.
  assert.ok(c.best, 'a complete store exists');
  assert.equal(c.best!.seller, 'Blinkit');
  assert.equal(c.best!.total, 177);
  assert.equal(c.best!.complete, true);
  const partial = c.stores.filter((s) => !s.complete);
  assert.equal(partial.length, 2);
  assert.ok(partial.every((s) => s.missing.length === 1));
  // No other complete store -> no savings number invented
  assert.equal(c.savingsVsWorst, undefined);
});

test('computeStoreTotals: partial stores never beat a full basket', () => {
  const items = [
    { name: 'a', qty: 1, found: true, unitPrices: [{ seller: 'CheapMart', price: 10, title: 'A', url: '/o/1' }, { seller: 'FullMart', price: 20, title: 'A', url: '/o/2' }] },
    { name: 'b', qty: 1, found: true, unitPrices: [{ seller: 'FullMart', price: 20, title: 'B', url: '/o/3' }] },
  ];
  const c = computeStoreTotals(items as any);
  assert.equal(c.best?.seller, 'FullMart');
  assert.ok(c.stores[0].complete, 'complete stores are ranked before partial ones');
  assert.ok(!c.stores[c.stores.length - 1].complete);
});

test('computeStoreTotals: missing items are reported honestly', () => {
  const items = [
    { name: 'unicorn milk', qty: 1, found: false, unitPrices: [] },
    { name: 'bread', qty: 1, found: true, unitPrices: [{ seller: 'Blinkit', price: 45, title: 'Bread', url: '/o/1' }] },
  ];
  const c = computeStoreTotals(items as any);
  assert.deepEqual(c.notFound, ['unicorn milk']);
  assert.ok(!c.best, 'no full basket when an item is nowhere');
  assert.equal(c.stores.length, 1);
});
