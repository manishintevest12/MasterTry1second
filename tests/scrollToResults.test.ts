import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resultsScrollTop, stickyOffsetPx, RESULTS_ANCHOR_ID, AUTO_COLLAPSE_EVENT } from '../src/utils/scrollToResults';

/**
 * Owner 29 Oct ("mobile responsive mai hide ho raha hai ... search button pr click ho jaye tho user
 * results area mai khud navigate kr jaye"): the jump must land on the results, not under the sticky
 * navbar and not at the top of the page. These tests pin the arithmetic that decides where it lands.
 */

test('lands the anchor top just under the sticky header', () => {
  // Page scrolled to 1200, anchor 900px below the viewport top, 56px navbar covering the top.
  assert.equal(resultsScrollTop({ anchorTop: 900, scrollY: 1200, stickyOffset: 56 }), 2044);
  // Before the anchor comes into view (negative rect) the math still holds.
  assert.equal(resultsScrollTop({ anchorTop: -300, scrollY: 100, stickyOffset: 56 }), 0);
});

test('never returns a negative scroll position', () => {
  assert.equal(resultsScrollTop({ anchorTop: 10, scrollY: 0, stickyOffset: 56 }), 0);
  assert.equal(resultsScrollTop({ anchorTop: 0, scrollY: 0, stickyOffset: 0 }), 0);
});

test('sticky offset is clamped so a bad measurement cannot hide the results', () => {
  assert.equal(stickyOffsetPx(() => 56), 56);
  assert.equal(stickyOffsetPx(() => 0), 0);
  assert.equal(stickyOffsetPx(() => -40), 0);
  assert.equal(stickyOffsetPx(() => 4000), 180); // absurd value -> capped
  assert.equal(stickyOffsetPx(() => Number.NaN), 0);
});

test('anchor id and collapse event stay stable (they are a contract with the feed + header)', () => {
  assert.equal(RESULTS_ANCHOR_ID, 't1s-results-top');
  assert.equal(AUTO_COLLAPSE_EVENT, 't1s:auto-collapse-filters');
});
