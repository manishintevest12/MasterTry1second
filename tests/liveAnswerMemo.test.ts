import { test } from 'node:test';
import assert from 'node:assert/strict';
import { _resetLiveAnswerMemo, liveAnswerMemoStats, memoComparisonItem, memoRelevanceHit } from '../server/api/liveAnswerMemo';

// OWNER 4 Nov: reduce /api/scrape/live CPU "bina results aur flow ko delete kiye".
// Both memos must be pure: identical input -> identical value, and nothing may be shared/mutated
// between polls because the route hands these objects to groupSameProduct().

test('relevance is computed once per (query, title) and never changes the value', () => {
  _resetLiveAnswerMemo();
  let calls = 0;
  const compute = () => { calls += 1; return 0.75; };
  const first = memoRelevanceHit('ecommerce|amul milk', 'amul taaza toned milk 500ml', compute);
  const second = memoRelevanceHit('ecommerce|amul milk', 'amul taaza toned milk 500ml', compute);
  assert.equal(first, 0.75);
  assert.equal(second, 0.75, 'the same pair must return the same hit');
  assert.equal(calls, 1, 'the expensive scoring must run once');
  // A different title or a different query must still compute.
  memoRelevanceHit('ecommerce|amul milk', 'amul butter 100g', compute);
  memoRelevanceHit('grocery|amul milk', 'amul taaza toned milk 500ml', compute);
  assert.equal(calls, 3);
  const stats = liveAnswerMemoStats();
  assert.equal(stats.relevance.servedFromMemo, 1);
  assert.equal(stats.relevance.computed, 3);
});

test('a comparison item is built once per (offer, travel context) and returned as an isolated copy', () => {
  _resetLiveAnswerMemo();
  let calls = 0;
  const offer = { id: 'off_1', title: 'Amul Milk 500ml', prices: { effectivePrice: 28 } };
  const build = () => {
    calls += 1;
    return { id: 'off_1', title: 'Amul Milk 500ml', primaryPrice: 28, sellerQuotes: [{ sellerName: 'Blinkit', price: 28 }], specs: { size: '500ml' } };
  };
  const a = memoComparisonItem(offer, '2026-11-20||Indore|', build);
  const b = memoComparisonItem(offer, '2026-11-20||Indore|', build);
  assert.equal(calls, 1, 'the mapping must run once for identical polls');
  assert.deepEqual(b, a, 'and the value must be identical');
  assert.notEqual(b, a, 'but it must be a copy, never the memoised object');
  assert.notEqual(b.sellerQuotes, a.sellerQuotes, 'sellerQuotes must not be shared with the memo');
  // Grouping mutates the item it receives; that must not leak into the next poll.
  (a.sellerQuotes as any[]).push({ sellerName: 'Zepto', price: 30 });
  const c = memoComparisonItem(offer, '2026-11-20||Indore|', build);
  assert.equal((c.sellerQuotes as any[]).length, 1, 'a mutated copy must not poison the memo');
  // A different travel context is a different answer.
  memoComparisonItem(offer, '2026-11-25||Goa|', build);
  assert.equal(calls, 2);
  const stats = liveAnswerMemoStats();
  // b and c were both served from the memo; the new travel context had to be built.
  assert.equal(stats.items.servedFromMemo, 2);
  assert.equal(stats.items.computed, 2);
});

test('a row object that cannot be memoised still maps every time (never a stale item)', () => {
  let calls = 0;
  const item = memoComparisonItem(null, 'sig', () => { calls += 1; return { id: 'x', sellerQuotes: [] }; });
  memoComparisonItem(null, 'sig', () => { calls += 1; return { id: 'x', sellerQuotes: [] }; });
  assert.equal(calls, 2);
  assert.equal(item.id, 'x');
});
