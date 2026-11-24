import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groceryProductKey, bestUnitPricesPerStore, computeStoreTotals, basketVerdict } from '../server/smartcart/basket';

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

/**
 * OWNER 24 Nov ("agar maine aloo pyaaz add kiya tho wo bataye cart mai ki sbse sasta blinkit mai hai yaa zepto
 * mai aise"): the cart must ANSWER the question in one sentence, not leave the shopper to read four store cards.
 * The verdict is computed server-side so the website and the app print the same words for the same basket.
 */
const item = (name: string, prices: Record<string, number>) => ({
  name, qty: 1, found: Object.keys(prices).length > 0,
  unitPrices: Object.entries(prices).map(([seller, price]) => ({ seller, price, title: name, url: null })),
});

test('verdict: names the cheapest store for the whole basket and the gap to the runner-up', () => {
  const c = computeStoreTotals([
    item('aloo 1 kg', { Blinkit: 30, Zepto: 42 }),
    item('pyaaz 1 kg', { Blinkit: 35, Zepto: 33 }),
  ]);
  const v = basketVerdict(c);
  assert.equal(v.kind, 'complete');
  assert.equal(v.store, 'Blinkit');       // 65 vs Zepto 75
  assert.equal(v.total, 65);
  assert.equal(v.nextStore, 'Zepto');
  assert.equal(v.savesVsNext, 10);
  assert.match(v.headline, /^Cheapest full basket: Blinkit/);
  assert.match(v.headline, /65/);
  assert.match(v.detail, /10/);
  assert.match(v.detail, /Zepto/);
});

test('verdict: a single store carrying everything says so instead of inventing a comparison', () => {
  const v = basketVerdict(computeStoreTotals([item('aloo 1 kg', { Blinkit: 30 })]));
  assert.equal(v.kind, 'complete');
  assert.equal(v.nextStore, null);
  assert.equal(v.savesVsNext, null);
  assert.match(v.detail, /only store/i);
});

test('verdict: when no store has the whole basket, names the closest and what it is missing', () => {
  const c = computeStoreTotals([
    item('aloo 1 kg', { Blinkit: 30 }),           // potato only at Blinkit
    item('pyaaz 1 kg', { Zepto: 33 }),            // onion only at Zepto
  ]);
  assert.equal(c.best, undefined);                // nobody carries both
  const v = basketVerdict(c);
  assert.equal(v.kind, 'partial');
  assert.equal(v.store, 'Blinkit');               // same coverage, cheaper total
  assert.equal(v.total, 30);
  assert.match(v.headline, /No single store/i);
  assert.match(v.headline, /Blinkit/);
  assert.match(v.headline, /1\/2 items/);
  assert.match(v.detail, /pyaaz 1 kg/);           // says what is still missing
  assert.equal(v.savesVsNext, null);
});

test('verdict: a store that carries both wins outright, even when it is dearer per item', () => {
  const c = computeStoreTotals([
    item('aloo 1 kg', { Blinkit: 30, Zepto: 42 }),
    item('pyaaz 1 kg', { Zepto: 33 }),            // only Zepto has both items
  ]);
  const v = basketVerdict(c);
  assert.equal(v.kind, 'complete');
  assert.equal(v.store, 'Zepto');
  assert.equal(v.total, 75);
  assert.equal(v.nextStore, null);
});

test('verdict: an empty comparison is an honest empty answer, never a made-up winner', () => {
  const v = basketVerdict(computeStoreTotals([item('aloo 1 kg', {})]));
  assert.equal(v.kind, 'empty');
  assert.equal(v.store, null);
  assert.equal(v.total, null);
  assert.match(v.headline, /No store returned/i);
});

test('verdict: identical totals are reported as equal, not as a saving', () => {
  const v = basketVerdict(computeStoreTotals([item('aloo 1 kg', { Blinkit: 30, Zepto: 30 })]));
  assert.equal(v.kind, 'complete');
  assert.equal(v.savesVsNext, null);
  assert.match(v.detail, /same/i);
});
