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
