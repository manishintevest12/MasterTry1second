import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsonStringMemo, jsonMemoStats } from '../server/common/jsonMemo';
import { merchantDeepLink, _resetDeepLinkMemo } from '../server/affiliate/merchantLinks';
import { gateTravelDateResponse } from '../server/search/searchOrchestrator';

// OWNER 4 Nov: "wo sb cheez add kro jo cpu ke usage ko km kre bina site or app ke process and
// results ko impact kiye". Each cache below is a pure memo: same input, same output, less work.

test('a polled response body is serialised once, byte-identically', () => {
  const body = { results: Array.from({ length: 400 }, (_, i) => ({ id: i, title: `row ${i}`, price: 100 + i })), state: { pendingRefresh: false } };
  const first = jsonStringMemo(body);
  const second = jsonStringMemo(body);
  assert.equal(second, first, 'the memo must return the SAME json');
  assert.equal(first, JSON.stringify(body), 'and it must equal what express would have written');
  const stats = jsonMemoStats();
  assert.ok(stats.servedFromMemo >= 1, 'the second call must be served from the memo');
});

test('primitives and unserialisable bodies are never memoised', () => {
  assert.equal(jsonStringMemo('text'), null);
  assert.equal(jsonStringMemo(42), null);
  assert.equal(jsonStringMemo(null), null);
  const circular: any = { a: 1 };
  circular.self = circular;
  assert.equal(jsonStringMemo(circular), null, 'a circular body must fall through to express, never throw');
});

test('exit links are minted once per identical input and can never go stale in a different way', () => {
  _resetDeepLinkMemo();
  const ctx = { city: 'Indore', date: '2026-11-20', return: '2026-11-22' };
  const a = merchantDeepLink('OYO', 'hotels in Indore', 'hotels', ctx);
  const b = merchantDeepLink('OYO', 'hotels in Indore', 'hotels', ctx);
  assert.equal(a, b);
  assert.match(a, /hotels-in-indore/);
  // A different request must NOT be answered from the memo.
  const other = merchantDeepLink('OYO', 'hotels in Goa', 'hotels', { city: 'Goa', date: '2026-12-01', return: '2026-12-03' });
  assert.notEqual(a, other);
  assert.match(other, /hotels-in-goa/);
  // And a different merchant stays different.
  assert.match(merchantDeepLink('Yatra', 'hotels in Indore', 'hotels', ctx), /yatra\.com/);
});

test('an already-gated answer is not re-gated on the next poll, but a new request still gates', () => {
  const wrongDate = [{ vertical: 'flights', title: 'old flight', prices: { effectivePrice: 4000 }, travel: { date: '2026-11-03' } }];
  const input: any = { vertical: 'flights', query: 'Indore to Delhi', travelDates: { depart: '2026-11-27' } };
  const response: any = { results: [...wrongDate], state: {}, query: {} };
  const once = gateTravelDateResponse(input, response);
  assert.equal(once.results.length, 0, 'a wrong-dated row must be dropped');
  // Poll again with the SAME object and SAME request: the memo short-circuits, so a row injected
  // afterwards stays (proof that the expensive pass did not run again).
  once.results.push({ vertical: 'flights', title: 'injected', prices: { effectivePrice: 5000 }, travel: { date: '2026-11-27' } } as any);
  const twice = gateTravelDateResponse(input, once);
  assert.equal(twice.results.length, 1, 'the identical poll is served without re-running the gate');
  // A DIFFERENT requested date must gate for real.
  const other = gateTravelDateResponse({ ...input, travelDates: { depart: '2026-11-30' } }, once);
  assert.equal(other.results.length, 0, 'a new request always runs the gate');
});
