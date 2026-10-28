/**
 * OWNER 28 Oct (screenshot of the fare-finding panel): "city change karta hoon to aisa nahi aata,
 * sirf shuru me aata hai". The panel was gated on "no rows on screen", so it only ever appeared on
 * a cold feed: changing the city kept the old city's rows and the new search ran invisibly.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { feedProgressGate } from '../src/lib/feedProgressGate';

test('a new search owns the feed even when the previous search still has rows', () => {
  assert.equal(
    feedProgressGate({ rows: 40, liveProgress: true, isNewSearchPending: true }),
    'progress',
    'city change: 40 stale rows must not hide the progress panel',
  );
});

test('first open (no rows, acquiring) shows the panel', () => {
  assert.equal(feedProgressGate({ rows: 0, liveProgress: true, isNewSearchPending: false }), 'progress');
});

test('rows that belong to the current search win once acquisition is over', () => {
  assert.equal(feedProgressGate({ rows: 12, liveProgress: false, isNewSearchPending: false }), 'rows');
});

test('finished chain with nothing to show gets the honest empty state', () => {
  assert.equal(feedProgressGate({ rows: 0, liveProgress: false, isNewSearchPending: false }), 'empty');
});

test('a settled flag with rows still renders rows (no stuck panel)', () => {
  assert.equal(feedProgressGate({ rows: 8, liveProgress: true, isNewSearchPending: false }), 'rows');
});
