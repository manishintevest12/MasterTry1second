import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cachedRead, clearReadCache } from '../server/api/readPathCache';

// OWNER 9 Nov (analytics screenshot): 429 on GET /api/notifications and GET /api/movies/upcoming, 503 on
// POST /. Read rails must never 429/5xx a user, and a burst must never fan out into N upstream fetches.

test('a burst of concurrent misses runs the loader exactly once', async () => {
  clearReadCache();
  let calls = 0;
  const load = async () => { calls += 1; await new Promise((r) => setTimeout(r, 25)); return ['x']; };
  const all = await Promise.all(Array.from({ length: 12 }, () => cachedRead('burst', 60_000, load)));
  assert.equal(calls, 1);
  assert.ok(all.every((v) => v.length === 1));
});

test('a fresh copy is served without touching the loader', async () => {
  clearReadCache();
  let calls = 0;
  const load = async () => { calls += 1; return 'v1'; };
  await cachedRead('fresh', 60_000, load);
  await cachedRead('fresh', 60_000, load);
  assert.equal(calls, 1);
});

test('a stale copy is served immediately while one background refresh runs', async () => {
  clearReadCache();
  let calls = 0;
  const load = async () => { calls += 1; return `v${calls}`; };
  assert.equal(await cachedRead('swr', 5, load), 'v1');
  await new Promise((r) => setTimeout(r, 10));
  const stale = await cachedRead('swr', 5, load);
  assert.equal(stale, 'v1', 'the stale copy is what the user gets');
  await new Promise((r) => setTimeout(r, 10));
  // read with a real TTL so this assertion observes the refreshed value instead of queueing a third refresh
  assert.equal(await cachedRead('swr', 60_000, load), 'v2', 'the refresh landed for the next reader');
});

test('a failing loader never breaks a reader that already has a copy', async () => {
  clearReadCache();
  await cachedRead('keep', 1, async () => ({ movies: [1] }));
  await new Promise((r) => setTimeout(r, 5));
  const out = await cachedRead('keep', 1, async () => { throw new Error('upstream 429'); });
  assert.deepEqual(out, { movies: [1] });
});

test('the read rails use the cache and never answer a 5xx for a missing answer', () => {
  const src = fs.readFileSync('server/api/routes.ts', 'utf8');
  const notif = src.slice(src.indexOf("apiRouter.get('/notifications'"), src.indexOf("apiRouter.get('/notifications'") + 1400);
  assert.match(notif, /cachedRead\(/, 'notifications is cached + single-flight');
  assert.ok(!/status\(500\)/.test(notif), 'notifications cannot answer 500 any more');
  const upcoming = src.slice(src.indexOf("apiRouter.get('/movies/upcoming'"), src.indexOf("apiRouter.get('/movies/upcoming'") + 1200);
  assert.match(upcoming, /cachedRead\(/, 'the upcoming rail single-flights its BookMyShow fetch');
  assert.ok(!/status\(503\)\.json\(\{ ok: false, error: 'search unavailable'/.test(src), 'a missing search answer is no longer a 503');
});
