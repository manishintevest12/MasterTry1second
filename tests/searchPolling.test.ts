import assert from 'node:assert/strict';
import test from 'node:test';
import { pollDecision } from '../src/lib/searchPolling';

test('a live chain keeps polling and keeps the panel up', () => {
  assert.deepEqual(pollDecision(true, 2, 10, 0), { keepPolling: true, exhaustedWithoutRows: false, keepPendingFlag: true });
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
