import test from 'node:test';
import assert from 'node:assert/strict';
import {
  __setLagForTest, currentLagMs, lagLimitMs, loadShedSnapshot,
  shouldShedExpensive, startLoopMonitor, stopLoopMonitor,
} from '../server/common/loadShed';

/**
 * OWNER 25 Nov ("isko fix kro, app performance improve kro"): the production log showed 503s with response times of
 * 83 s and 8,356 s on endpoints that do nothing (/api/notifications, /api/track, /api/home/showcase) next to
 * /api/scrape/live. A request that sits for two hours is a process that stopped answering, so the live search now
 * refuses to START when the event loop is already blocked, and answers with the pendingRefresh payload the clients
 * poll. These tests pin the decision, not the timing.
 */

test('a quiet loop never sheds', () => {
  __setLagForTest(0);
  assert.equal(currentLagMs(), 0);
  assert.equal(shouldShedExpensive(), false);
});

test('a blocked loop sheds new expensive work', () => {
  __setLagForTest(lagLimitMs() + 1);
  assert.equal(shouldShedExpensive(), true);
  __setLagForTest(0);
  assert.equal(shouldShedExpensive(), false);
});

test('the limit is a real number and can be tuned by env', () => {
  const before = lagLimitMs();
  assert.ok(Number.isFinite(before) && before >= 250, 'limit must be a sane millisecond value');
  process.env.T1S_SHED_LAG_MS = '900';
  assert.equal(lagLimitMs(), 900);
  delete process.env.T1S_SHED_LAG_MS;
  assert.equal(lagLimitMs(), before);
});

test('just under the limit still runs', () => {
  __setLagForTest(lagLimitMs() - 1);
  assert.equal(shouldShedExpensive(), false);
  __setLagForTest(0);
});

test('the monitor starts once and stops cleanly', () => {
  startLoopMonitor(50);
  const a = loadShedSnapshot();
  assert.equal(a.started, true);
  startLoopMonitor(50); // second call is a no-op, never a second timer
  assert.equal(loadShedSnapshot().started, true);
  stopLoopMonitor();
  assert.equal(loadShedSnapshot().started, false);
});

test('the snapshot reports the lag it measured, never a guess', () => {
  __setLagForTest(1234);
  const snap = loadShedSnapshot();
  assert.equal(snap.lagMs, 1234);
  assert.equal(snap.lagLimitMs, lagLimitMs());
  assert.equal(typeof snap.shedSignals, 'number');
  __setLagForTest(0);
});
