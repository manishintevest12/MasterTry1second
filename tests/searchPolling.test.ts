import assert from 'node:assert/strict';
import test from 'node:test';
import { pollDecision } from '../src/lib/searchPolling';

test('a live chain keeps polling and keeps the panel up', () => {
  assert.deepEqual(pollDecision(true, 2, 10, 0), {
    keepPolling: true, exhaustedWithoutRows: false, keepPendingFlag: true, nextPollCount: 3,
  });
});

// OWNER 18 Nov (flights "2-3 baar search krne pr results sahi aata hai, kabhi ek baar mai hi"):
// measured on production, flights land priced rows 15-28s in. A chain that is still ADDING rows must
// never be cut by the poll budget, and its counter must reset so the next round is not the last one.
test('a chain that is still growing rows ignores the exhausted budget', () => {
  const d = pollDecision(true, 40, 40, 61, 40);
  assert.equal(d.keepPolling, true, 'rows grew: the sweep is still filling in');
  assert.equal(d.keepPendingFlag, true);
  assert.equal(d.nextPollCount, 1, 'the count resets so growth is never cut off mid-sweep');
});

test('an exhausted chain that stopped growing still releases the panel', () => {
  const d = pollDecision(true, 40, 40, 61, 61);
  assert.equal(d.keepPolling, false);
  assert.equal(d.exhaustedWithoutRows, false);
  assert.equal(d.nextPollCount, 41);
});

test('a fresh chain below the budget counts up normally', () => {
  assert.equal(pollDecision(true, 3, 40, 12, 12).nextPollCount, 4);
});

test('an exhausted chain with rows releases the panel to the rows', () => {
  const d = pollDecision(true, 10, 10, 12);
  assert.equal(d.keepPolling, false);
  assert.equal(d.exhaustedWithoutRows, false);
  assert.equal(d.keepPendingFlag, true);
});

test('an exhausted chain with NO rows must not leave a permanent loader', () => {
  const d = pollDecision(true, 10, 10, 0);
  assert.equal(d.keepPolling, false);
  assert.equal(d.exhaustedWithoutRows, true);
  assert.equal(d.keepPendingFlag, false, 'this flag is what glued the loader open forever');
});

test('a settled answer never keeps the panel', () => {
  assert.equal(pollDecision(false, 0, 10, 0).keepPendingFlag, false);
  assert.equal(pollDecision(false, 0, 10, 5).keepPolling, false);
});
