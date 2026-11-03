import test from 'node:test';
import assert from 'node:assert/strict';

import { routeKeyOf, dateKeyOf, sellerKeyOf, mergeSellerMemory } from '../server/search/sellerMemory';

/** OWNER 3 Nov: "jo slow hai unka wait kr ke results lao, ek search pr miss ni krna kissi ko v ...
 *  cache aur memory aisa bnao ki ye sb ka data humere paas humesa rahe, sirf new price date wise ke
 *  liye mehnat kre, sb vertical pr". These pin the memory rules that keep a seller from vanishing
 *  between searches and keep the key stable enough to ever hit. */
test('route key ignores phrasing differences on the same corridor', () => {
  const a = routeKeyOf({ query: 'Indore (IDR) to New Delhi (DEL)' });
  const b = routeKeyOf({ query: 'indore  idr  to new delhi del !!' });
  assert.equal(a, b);
});

test('route key keeps city and pincode apart from the corridor', () => {
  assert.notEqual(routeKeyOf({ query: 'hotels in shimla', city: 'shimla' }), routeKeyOf({ query: 'hotels in shimla', city: 'manali' }));
  assert.notEqual(routeKeyOf({ query: 'plumbers', pincode: '452001' }), routeKeyOf({ query: 'plumbers', pincode: '452010' }));
  assert.equal(routeKeyOf({}), 'global');
});

test('date key separates one-way from a range and isolates each day', () => {
  assert.equal(dateKeyOf('2026-11-20'), '2026-11-20');
  assert.equal(dateKeyOf('2026-11-20', '2026-11-22'), '2026-11-20_2026-11-22');
  assert.equal(dateKeyOf(), 'any');
  assert.notEqual(dateKeyOf('2026-11-20'), dateKeyOf('2026-11-21'));
});

test('seller identity falls back from seller to vendor to source, never empty', () => {
  assert.equal(sellerKeyOf({ seller: 'MakeMyTrip' }), 'MakeMyTrip');
  assert.equal(sellerKeyOf({ vendor: 'Yatra' }), 'Yatra');
  assert.equal(sellerKeyOf({ attributes: { merchant: 'OYO' } }), 'OYO');
  assert.equal(sellerKeyOf({ sourceId: 'w_flights_kiwi' }), 'w_flights_kiwi');
});

test('memory restores only the missing sellers and never duplicates a live one', () => {
  const live = [{ seller: 'MakeMyTrip', prices: { effectivePrice: 5200 }, attributes: {} }];
  const snaps = [
    { seller: 'MakeMyTrip', rows: [{ seller: 'MakeMyTrip', prices: { effectivePrice: 1 } }], fetchedAt: new Date(1_000).toISOString() },
    { seller: 'Goibibo', rows: [{ seller: 'Goibibo', prices: { effectivePrice: 4999 }, attributes: { travel_date: '2026-11-20' } }], fetchedAt: new Date(2_000).toISOString() },
  ];
  const { offers, restored } = mergeSellerMemory(live, snaps as any, 62_000);
  assert.deepEqual(restored, ['Goibibo']);
  assert.equal(offers.length, 2, 'a seller already live must not be duplicated from memory');
  const fromMem = offers.find((o) => o.seller === 'Goibibo') as any;
  assert.equal(fromMem.attributes.seller_memory, '1', 'restored rows are flagged, never passed off as fresh');
  assert.equal(fromMem.attributes.memory_age_ms, '60000', 'the age of the remembered quote is carried through');
  assert.equal(fromMem.prices.effectivePrice, 4999, 'price evidence is preserved for the downstream gate');
  assert.equal(fromMem.attributes.travel_date, '2026-11-20', 'the remembered date rides along so the date gate can still judge it');
  assert.equal((offers[0] as any).attributes.seller_memory, undefined, 'live rows are left untouched');
});

test('empty memory changes nothing', () => {
  const live = [{ seller: 'Kiwi' }];
  const out = mergeSellerMemory(live, []);
  assert.equal(out.offers.length, 1);
  assert.deepEqual(out.restored, []);
});
