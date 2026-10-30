/**
 * Poll-budget tests: the "still working" flag must expire so a client's poll chain
 * ends by itself instead of hammering the hosting edge (which answers an abusive IP
 * with TCP resets — the app's `Connection reset by peer`, errno 104).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allowPending, forgetPending, pollKey, pendingAgeMs, _resetPollBudget, PENDING_WINDOW_MS,
} from '../server/api/pollBudget.js';

test('a fresh chain may claim "still working"', () => {
  _resetPollBudget();
  const key = pollKey(['1.2.3.4', 'grocery', 'milk', 'Indore']);
  assert.equal(allowPending(key, true, 1_000), true);
  assert.equal(pendingAgeMs(key, 1_000), 0);
});

test('the flag stops after the window, so the client chain ends', () => {
  _resetPollBudget();
  const key = pollKey(['1.2.3.4', 'grocery', 'milk', 'Indore']);
  const t0 = 10_000;
  assert.equal(allowPending(key, true, t0), true);
  assert.equal(allowPending(key, true, t0 + PENDING_WINDOW_MS - 1), true);
  assert.equal(allowPending(key, true, t0 + PENDING_WINDOW_MS + 1), false);
  // and it stays closed for later polls of the same search
  assert.equal(allowPending(key, true, t0 + PENDING_WINDOW_MS + 5_000), false);
});

test('a finished search can never be made to look pending', () => {
  _resetPollBudget();
  const key = pollKey(['ip', 'flights', 'del-bom']);
  assert.equal(allowPending(key, false), false);
  assert.equal(allowPending('', true), true); // no identity keeps legacy behaviour
});

test('a new query, city or date is a new chain with its own window', () => {
  _resetPollBudget();
  const a = pollKey(['ip', 'hotels', 'goa', 'Goa', '', '2026-11-02']);
  const b = pollKey(['ip', 'hotels', 'goa', 'Goa', '', '2026-11-03']);
  const c = pollKey(['ip', 'hotels', 'goa beach', 'Goa', '', '2026-11-02']);
  assert.notEqual(a, b);
  assert.notEqual(a, c);
  const t0 = 1_000;
  allowPending(a, true, t0);
  assert.equal(allowPending(b, true, t0 + PENDING_WINDOW_MS + 10), true, 'different date = fresh chain');
  assert.equal(allowPending(c, true, t0 + PENDING_WINDOW_MS + 10), true, 'different query = fresh chain');
});

test('forgetting a settled chain gives the next search a full window', () => {
  _resetPollBudget();
  const key = pollKey(['ip', 'bus', 'indore-bhopal']);
  allowPending(key, true, 1_000);
  assert.equal(allowPending(key, true, 1_000 + PENDING_WINDOW_MS + 1), false);
  forgetPending(key);
  assert.equal(allowPending(key, true, 1_000 + PENDING_WINDOW_MS + 2), true);
});

test('identity is case and space tolerant, so the same search is one chain', () => {
  _resetPollBudget();
  const a = pollKey(['ip', 'Grocery', ' Milk ', 'indore']);
  const b = pollKey(['IP', 'grocery', 'milk', 'Indore']);
  assert.equal(a, b);
  allowPending(a, true, 5_000);
  assert.equal(pendingAgeMs(b, 6_000), 1_000);
});
