import { test } from 'node:test';
import assert from 'node:assert/strict';
import { _resetLiveReplay, liveReplayStats, readLiveReplay, writeLiveReplay } from '../server/api/liveReplay';

// OWNER 4 Nov: reduce /api/scrape/live load without touching results or flow.
// The replay window may ONLY hand back a complete answer - never an empty page, never a
// still-scanning body (which would hide rows about to land).

const complete = { results: [{ id: 'a' }, { id: 'b' }], pendingRefresh: false, sourcesSucceeded: ['w_x'] };

test('a complete answer is replayed for the same poll chain', () => {
  _resetLiveReplay();
  assert.equal(writeLiveReplay('ip|grocery|tata tea|||', complete), true);
  const hit = readLiveReplay('ip|grocery|tata tea|||');
  assert.ok(hit, 'the burst poll must be served from the window');
  assert.deepEqual(hit!.payload.results, complete.results);
  assert.equal(liveReplayStats().replays, 1);
});

test('an empty answer is never stored (no replayed empty page)', () => {
  _resetLiveReplay();
  assert.equal(writeLiveReplay('k1', { results: [], pendingRefresh: false }), false);
  assert.equal(readLiveReplay('k1'), null);
});

test('a still-scanning answer is replayable but keeps its pending flag, so polling continues', () => {
  _resetLiveReplay();
  assert.equal(writeLiveReplay('k2', { results: [{ id: 'a' }], pendingRefresh: true }), true);
  const hit = readLiveReplay('k2');
  assert.ok(hit);
  assert.equal(hit!.payload.pendingRefresh, true, 'the client must still be told rows are landing');
  assert.equal(hit!.payload.results.length, 1);
});

test('a different poll chain is never answered from another one', () => {
  _resetLiveReplay();
  writeLiveReplay('ipA|hotels|goa|||', complete);
  assert.equal(readLiveReplay('ipB|hotels|goa|||'), null);
  assert.equal(readLiveReplay('ipA|hotels|indore|||'), null);
});

test('the window expires', async () => {
  _resetLiveReplay();
  process.env.T1S_LIVE_REPLAY_MS = '20';
  try {
    writeLiveReplay('k3', complete);
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(readLiveReplay('k3'), null, 'an expired window must not serve a stale answer');
  } finally {
    delete process.env.T1S_LIVE_REPLAY_MS;
  }
});

test('T1S_LIVE_REPLAY_MS=0 is a kill switch', () => {
  _resetLiveReplay();
  process.env.T1S_LIVE_REPLAY_MS = '0';
  try {
    assert.equal(writeLiveReplay('k4', complete), false);
    assert.equal(readLiveReplay('k4'), null);
  } finally {
    delete process.env.T1S_LIVE_REPLAY_MS;
  }
});
