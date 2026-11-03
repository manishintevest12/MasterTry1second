import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryKey, boostByReliability, memoryNotice } from '../server/lens/searchMemory';

/** OWNER 3 Nov: "ask try1second ai usme ye feature add kro ki wo yaad rkh ske results jiss se
 *  aage wo aur accurate results dein, self trained type". These pin the parts that keep the
 *  memory honest: it normalises the question, it only REORDERS, and its notice never claims
 *  a live price. */

test('the same question asked differently maps to one memory key', () => {
  const a = memoryKey({ vertical: 'flights', query: 'Indore (IDR) to Delhi (DEL)', city: 'Indore', depart: '2026-11-27' });
  const b = memoryKey({ vertical: 'Flights', query: 'indore   idr  to delhi del', city: 'INDORE', depart: '2026-11-27' });
  assert.equal(a, b);
  // a different travel date is a different question
  assert.notEqual(a, memoryKey({ vertical: 'flights', query: 'Indore (IDR) to Delhi (DEL)', city: 'Indore', depart: '2026-12-03' }));
});

test('reliability only reorders rows - never adds, drops or reprices one', () => {
  const rows = [
    { id: 'a', seller: 'UnknownOTA', prices: { effectivePrice: 5000 } },
    { id: 'b', seller: 'EaseMyTrip', prices: { effectivePrice: 7300 } },
    { id: 'c', seller: 'Ixigo', prices: { effectivePrice: 6900 } },
  ];
  const out = boostByReliability(rows, { EaseMyTrip: 9, Ixigo: 4 });
  assert.deepEqual(out.map((r) => r.id), ['b', 'c', 'a']);
  assert.equal(out.length, rows.length);
  assert.equal(out.find((r) => r.id === 'b')!.prices.effectivePrice, 7300); // price untouched
  // equal scores keep their original order
  const tie = boostByReliability(rows, { EaseMyTrip: 1, Ixigo: 1, UnknownOTA: 1 });
  assert.deepEqual(tie.map((r) => r.id), ['a', 'b', 'c']);
  // no memory at all = input unchanged
  assert.deepEqual(boostByReliability(rows, {}).map((r) => r.id), ['a', 'b', 'c']);
});

test('the memory notice is a last-verified claim, never a live one', () => {
  const notice = memoryNotice({
    key: 'k', vertical: 'flights', query: 'q', city: 'Indore', depart: '2026-11-27',
    sellers: ['EaseMyTrip', 'Ixigo'], rowCount: 40,
    cheapestBySeller: { EaseMyTrip: 7300 }, timesSeen: 3, lastVerifiedAt: Date.UTC(2026, 10, 3, 4, 30),
  })!;
  assert.match(notice, /verified/i);
  assert.match(notice, /40 live rows/);
  assert.match(notice, /re-check prices now/);
  assert.equal(memoryNotice(null), undefined);
});
