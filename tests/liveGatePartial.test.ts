import assert from 'node:assert/strict';
import test from 'node:test';
import { repeatCacheLookup, repeatCacheStore, clearRepeatCache } from '../server/search/liveSearchGate';

/**
 * OWNER 18 Nov ("flight mai 2-3 baar search krne pr results sahi aata hai, kabhi ek baar mai hi aa
 * jata hai"). Cause measured in the code: a still-scanning (partial) answer was replayable from the
 * repeat cache for the whole 15s window, so every poll after the first answered with the exact same
 * frozen rows while the pipeline behind it kept finding sellers. The chain then ended on the partial
 * and only a fresh press (which read the settled cache) showed the complete set.
 *
 * The rule: only a FINISHED answer with rows may be replayed. A pending answer never is, so each
 * poll joins the same in-flight pipeline and returns its newest snapshot.
 */
function answer(rows: number, pendingRefresh: boolean) {
  return {
    results: Array.from({ length: rows }, (_, i) => ({ id: `row-${i}`, title: `row ${i}` })) as any[],
    state: { servedFrom: 'live', pendingRefresh, sourcesAttempted: [], sourcesSucceeded: [], sourcesFailed: [] },
  } as any;
}

test('a still-scanning answer is never replayed', () => {
  clearRepeatCache();
  repeatCacheStore('flights|indore to delhi|2026-11-27', answer(2, true));
  assert.equal(repeatCacheLookup('flights|indore to delhi|2026-11-27'), null, 'a partial froze the answer for 15s');
});

test('a settled answer with rows is replayed', () => {
  clearRepeatCache();
  repeatCacheStore('flights|indore to delhi|2026-11-27', answer(61, false));
  const hit = repeatCacheLookup('flights|indore to delhi|2026-11-27');
  assert.ok(hit, 'the finished answer must be served to the next poll without another scrape');
  assert.equal(hit?.results.length, 61);
});

test('an empty scan is never replayed', () => {
  clearRepeatCache();
  repeatCacheStore('flights|indore to mumbai|2026-11-27', answer(0, false));
  assert.equal(repeatCacheLookup('flights|indore to mumbai|2026-11-27'), null);
});
