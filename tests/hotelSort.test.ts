import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareHotelGroupsDefault, type HotelGroup } from '../src/utils/hotelGroups';

const g = (key: string, price: number, rows: number, rating10 = 8): HotelGroup => ({
  key, name: key, gallery: [], amenities: [],
  rows: Array.from({ length: rows }, (_, i) => ({ item: { id: key + i } as any, site: 's' + i, price, dealUrlItem: { id: key + i } as any })),
  best: { item: { id: key } as any, site: 's', price, dealUrlItem: { id: key } as any },
  rating10,
});

test('default order: multi-site comparison cards first, cheapest among them wins', () => {
  const single = [g('single-cheap', 1000, 1), g('single-mid', 2000, 1)];
  const multi = [g('multi-2k', 2000, 2), g('multi-1.5k', 1500, 3), g('multi-3k', 3000, 2)];
  const feed = [...single, ...multi].sort(compareHotelGroupsDefault);
  // all multi-site cards come before any single
  assert.ok(feed.slice(0, 3).every((x) => x.rows.length >= 2));
  assert.ok(feed.slice(3).every((x) => x.rows.length === 1));
  // multi cards are cheapest-first
  assert.deepEqual(feed.map((x) => x.key), ['multi-1.5k', 'multi-2k', 'multi-3k', 'single-cheap', 'single-mid']);
});

test('default order: singles follow cheapest-first; rating breaks price ties', () => {
  const feed = [g('s-b', 2000, 1, 7.0), g('s-a', 2000, 1, 9.0)].sort(compareHotelGroupsDefault);
  assert.equal(feed[0].key, 's-a'); // same price, higher rating first
});

test('a 2-company card beats a cheaper single hotel by default (comparison cards lead)', () => {
  const feed = [g('cheap-single', 800, 1), g('pricey-compare', 5000, 2)].sort(compareHotelGroupsDefault);
  assert.equal(feed[0].key, 'pricey-compare');
});
