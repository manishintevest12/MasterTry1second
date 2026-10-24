/**
 * Owner 24 Oct: "flight number, aur time match krta hai tho compare kro" —
 * the SAME flight sold by different sellers must land on ONE comparison card
 * keyed by flight number + date + departure time. Sellers emit dates in
 * different formats (ISO from EMT/Cleartrip, Ixigo's legacy DD-MM-YYYY), so
 * the grouping key normalizes dates before comparing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { groupOffers, offerKey } from '../src/utils/offerGroups';
import type { ComparisonItem } from '../src/types';

const mk = (id: string, provider: string, price: number, specs: Record<string, string>): ComparisonItem => ({
  id,
  vertical: 'flights',
  title: 'IndiGo 6E6627 · Indore → Delhi',
  provider,
  primaryPrice: price,
  priceAvailable: true,
  specs,
} as unknown as ComparisonItem);

test('offerKey: same flight groups across ISO and DD-MM-YYYY date formats', () => {
  const emt = mk('e1', 'EaseMyTrip', 7400, { 'flight number': '6E6627', 'departure date': '2026-10-25', 'departure time': '07:15' });
  const ix = mk('i1', 'Ixigo', 7509, { 'flight number': '6E6627', 'departure date': '25-10-2026', 'departure time': '07:15' });
  const otherDay = mk('o1', 'EaseMyTrip', 8000, { 'flight number': '6E6627', 'departure date': '2026-10-31', 'departure time': '07:15' });
  assert.equal(offerKey(emt), offerKey(ix), 'ISO vs DD-MM-YYYY same date must be the same key');
  assert.notEqual(offerKey(emt), offerKey(otherDay), 'a different date is a different flight offering');
});

test('groupOffers: one card with two seller rows, cheapest first', () => {
  const emt = mk('e1', 'EaseMyTrip', 7400, { 'flight number': '6E6627', 'departure date': '2026-10-25', 'departure time': '07:15' });
  const ix = mk('i1', 'Ixigo', 7509, { 'flight number': '6E6627', 'departure date': '25-10-2026', 'departure time': '07:15' });
  const groups = groupOffers([emt, ix] as any);
  assert.equal(groups.length, 1, 'same flight + date + time = ONE comparison card');
  assert.equal(groups[0].rows.length, 2, 'both sellers are rows on the card');
  assert.equal(groups[0].best.price, 7400, 'cheapest seller wins the card');
});

test('offerKey: missing flight number falls back to title-keyed route summaries', () => {
  const mmt = mk('m1', 'MakeMyTrip', 6879, { 'departure date': '2026-10-31' });
  const key = offerKey(mmt);
  assert.ok(key.startsWith('f|'), 'route-level fare-calendar rows still key by provider/route/title');
});

test('offerKey: same flight merges across "6E974" / "6E 974" / "AI 2566" / "AI2566" spellings', () => {
  const ct = mk('c1', 'Cleartrip', 7824, { 'flight number': '6E974', 'departure date': '2026-10-24', 'departure time': '23:15' });
  const via = mk('v1', 'Via.com', 7824, { 'flight number': '6E 974', 'departure date': '2026-10-24', 'departure time': '2026-10-24 23:15' });
  assert.equal(offerKey(ct), offerKey(via), 'spelled differently but SAME flight = ONE card');

  const emtAi = mk('e2', 'EaseMyTrip', 17786, { 'flight number': 'AI2566', 'departure date': '2026-10-24', 'departure time': '21:00' });
  const viaAi = mk('v2', 'Via.com', 17787, { 'flight number': 'AI 2566', 'departure date': '2026-10-24', 'departure time': '2026-10-24 21:00' });
  assert.equal(offerKey(emtAi), offerKey(viaAi), 'AI2566 vs "AI 2566" must be the same key');
});

test('offerKey: connecting itineraries merge on first leg across sellers', () => {
  const emt = mk('e3', 'EaseMyTrip', 10333, { 'flight number': '6E7168-2384', 'departure date': '2026-10-24', 'departure time': '21:50' });
  const via = mk('v3', 'Via.com', 10333, { 'flight number': '6E 7168 + 6E 2384', 'departure date': '2026-10-24', 'departure time': '2026-10-24 21:50' });
  assert.equal(offerKey(emt), offerKey(via), 'same first-leg departure compares as one itinerary');
});

test('offerKey: different flights never merge despite same date/time', () => {
  const a = mk('a1', 'Via.com', 7824, { 'flight number': '6E 974', 'departure date': '2026-10-24', 'departure time': '23:15' });
  const b = mk('b1', 'Via.com', 10333, { 'flight number': '6E 7168 + 6E 2384', 'departure date': '2026-10-24', 'departure time': '21:50' });
  assert.notEqual(offerKey(a), offerKey(b));
});

test('groupOffers: live indore-delhi scenario — Cleartrip+EMT+Via same flight = ONE card', () => {
  const rows = [
    mk('c1', 'Cleartrip', 7824, { 'flight number': '6E974', 'departure date': '2026-10-24', 'departure time': '23:15' }),
    mk('e1', 'EaseMyTrip', 7824, { 'flight number': '6E974', 'departure date': '2026-10-24', 'departure time': '23:15' }),
    mk('v1', 'Via.com', 7824, { 'flight number': '6E 974', 'departure date': '2026-10-24', 'departure time': '2026-10-24 23:15' }),
    mk('v2', 'Via.com', 8244, { 'flight number': '6E 974', 'departure date': '2026-10-24', 'departure time': '2026-10-24 23:15' }),
  ];
  const groups = groupOffers(rows as any);
  assert.equal(groups.length, 1, 'all four rows are the SAME departure');
  // One row per site: Via's second (pricier) fare for the same flight is a
  // duplicate listing and keeps only the cheaper one, per groupOffers policy.
  assert.equal(groups[0].rows.length, 3, 'one row per site, cheapest kept');
  assert.equal(groups[0].best.price, 7824);
  assert.ok(groups[0].rows.every((r) => r.site.length > 0), 'every row shows its selling site');
});
