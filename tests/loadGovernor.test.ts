/**
 * LOAD GOVERNOR tests (owner 30 Oct)
 *
 * "cpu usage limit ka 50% tk hi use kre ... Limit concurrent /api/scrape/live requests,
 * Add timeouts and cancellation, Prevent duplicate mobile requests, Queue scraping jobs,
 * Cache repeated searches ... results time impact naa ho"
 *
 * These pin the gate that makes that true without touching the search pipeline:
 *   - concurrency ceiling shrinks as measured CPU passes the 50% target, never below floor
 *   - identical concurrent searches share ONE job (duplicate mobile requests)
 *   - excess searches queue, and a queued waiter times out instead of hanging
 *   - an abandoned waiter drops an unstarted job (no CPU burned for nobody)
 *   - a queue that is full answers "busy" immediately
 *   - the repeat cache only replays responses that actually carry rows
 */
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.T1S_CPU_TARGET_PCT = '50';
process.env.T1S_LIVE_MAX_CONCURRENCY = '4';
process.env.T1S_LIVE_MIN_CONCURRENCY = '2';
process.env.T1S_LIVE_QUEUE_MAX = '2';
process.env.T1S_LIVE_QUEUE_WAIT_MS = '150';

const gov = await import('../server/common/loadGovernor');
const gate = await import('../server/search/liveSearchGate');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('concurrency ceiling follows measured CPU and respects the floor', () => {
  assert.equal(gov.liveMaxConcurrency(), 4);
  assert.equal(gov.liveConcurrencyLimit(10), 4, 'below target -> full pool');
  assert.equal(gov.liveConcurrencyLimit(50), 4, 'at target -> full pool');
  assert.equal(gov.liveConcurrencyLimit(100), 2, '2x target -> half pool');
  assert.equal(gov.liveConcurrencyLimit(400), 2, 'far above target -> never below floor');
});

test('identical concurrent searches share one job (duplicate mobile requests)', async () => {
  gov.resetLoadGovernor();
  let runs = 0;
  const work = async () => { runs += 1; await sleep(60); return 'rows'; };
  const [a, b, c] = await Promise.all([
    gov.runGated('same-key', work),
    gov.runGated('same-key', work),
    gov.runGated('same-key', work),
  ]);
  assert.equal(runs, 1, 'one pipeline for three callers');
  for (const out of [a, b, c]) {
    assert.equal(out.status, 'ok');
    assert.equal((out as any).value, 'rows');
  }
  assert.equal(gov.governorStats().coalescedRequests >= 1, true);
});

test('excess searches queue and a queued waiter times out instead of hanging', async () => {
  gov.resetLoadGovernor();
  const slow = async () => { await sleep(400); return 'slow'; };
  // Fill the pool (max 4) so the next search has to queue.
  const active = [0, 1, 2, 3].map((i) => gov.runGated(`busy-${i}`, slow));
  const queued = await gov.runGated('job-2', async () => 'second', { waitMs: 60 });
  assert.equal(queued.status, 'timeout', 'queued waiter answers on its own timeout');
  const done = await Promise.all(active);
  for (const d of done) assert.equal(d.status, 'ok');
});

test('an abandoned waiter drops an unstarted job (no CPU burned for nobody)', async () => {
  gov.resetLoadGovernor();
  let secondRan = false;
  const first = gov.runGated('hold', async () => { await sleep(250); return 'hold'; });
  // Fill the remaining slots with real work so the next one must queue.
  const fillers = [gov.runGated('f1', async () => { await sleep(250); return 'f1'; }), gov.runGated('f2', async () => { await sleep(250); return 'f2'; }), gov.runGated('f3', async () => { await sleep(250); return 'f3'; })];
  const queued = gov.runGated('unwanted', async () => { secondRan = true; return 'x'; }, { waitMs: 40 });
  const outcome = await queued;
  assert.equal(outcome.status, 'timeout');
  await Promise.all([first, ...fillers]);
  await sleep(80);
  assert.equal(secondRan, false, 'nobody was waiting, so the job never ran');
  assert.equal(gov.governorStats().abandonedJobs >= 1, true);
});

test('a full queue answers busy immediately', async () => {
  gov.resetLoadGovernor();
  const blockers = [0, 1, 2, 3].map((i) => gov.runGated(`b${i}`, async () => { await sleep(300); return i; }));
  const q1 = gov.runGated('q1', async () => 'q1', { waitMs: 500 });
  const q2 = gov.runGated('q2', async () => 'q2', { waitMs: 500 });
  const overflow = await gov.runGated('q3', async () => 'q3');
  assert.equal(overflow.status, 'busy', 'queue max 2 -> third one is refused at once');
  await Promise.all([...blockers, q1, q2]);
});

test('cancellation abandons only the cancelled waiter', async () => {
  gov.resetLoadGovernor();
  const abort = new AbortController();
  const shared = gov.runGated('cancel-key', async () => { await sleep(200); return 'kept'; });
  const second = gov.runGated('cancel-key', async () => 'never', { signal: abort.signal });
  abort.abort();
  const cancelled = await second;
  assert.equal(cancelled.status, 'cancelled');
  const kept = await shared;
  assert.equal(kept.status, 'ok');
  assert.equal((kept as any).value, 'kept');
});

test('repeat cache replays only responses that carry rows', () => {
  gate.clearRepeatCache();
  const key = gate.liveInputKey({ query: 'Hotels in Shimla', vertical: 'hotels', city: 'Shimla' } as any);
  // Same search typed with different case/spacing is the same key.
  assert.equal(key, gate.liveInputKey({ query: '  hotels in shimla ', vertical: 'hotels', city: 'shimla' } as any));

  const empty = { results: [], state: { servedFrom: 'unavailable' } } as any;
  gate.repeatCacheStore(key, empty);
  assert.equal(gate.repeatCacheLookup(key), null, 'an empty scan is never replayed');

  const rows = { results: [{ id: '1', title: 'Hotel' }], state: { servedFrom: 'live' } } as any;
  gate.repeatCacheStore(key, rows);
  const hit = gate.repeatCacheLookup(key);
  assert.ok(hit, 'a real response is replayed');
  assert.equal(hit!.results.length, 1);
  assert.equal((hit!.state as any).servedFrom, 'live');

  process.env.T1S_LIVE_REPEAT_CACHE_MS = '0';
  assert.equal(gate.repeatCacheLookup(key), null, 'TTL 0 disables the replay');
  delete process.env.T1S_LIVE_REPEAT_CACHE_MS;
});
