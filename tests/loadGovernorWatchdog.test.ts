import test from 'node:test';
import assert from 'node:assert/strict';
import { runGated, governorStats, resetLoadGovernor, stuckJobMaxMs, liveMaxConcurrency } from '../server/common/loadGovernor';

/**
 * OWNER 22 Nov ("goibibo, booking.com q ni hai hotels, flight vertical mai"): measured on production, every live
 * search answered from the catalogue with `sourcesAttempted: []`, which is what the governor returns when its
 * concurrency slots are held by jobs that never settle. One hung pipeline must not freeze live search forever.
 */
test('a job that never settles releases its slot when the wall passes', async () => {
  process.env.T1S_LIVE_JOB_MAX_MS = '5000';
  process.env.T1S_LIVE_MAX_CONCURRENCY = '1';
  resetLoadGovernor();

  const hang = runGated('hang-key', () => new Promise<never>(() => { /* never resolves */ }));
  // It is running (and holding the only slot).
  assert.equal(governorStats().active, 1);

  const stuck = await hang;
  assert.equal(stuck.status, 'timeout', 'the waiter is told honestly instead of hanging');
  assert.ok(governorStats().stuckJobs >= 1, 'the stuck job is counted');
  assert.equal(governorStats().active, 0, 'the slot is free again');

  // Live search works again: the next job runs normally.
  const ok = await runGated('next-key', async () => 'rows');
  assert.equal(ok.status, 'ok');
  resetLoadGovernor();
  delete process.env.T1S_LIVE_JOB_MAX_MS;
  delete process.env.T1S_LIVE_MAX_CONCURRENCY;
});

test('the wall is well above a legitimate cold search and configurable', () => {
  assert.ok(stuckJobMaxMs() >= 5_000);
  assert.ok(liveMaxConcurrency() >= 1);
});
