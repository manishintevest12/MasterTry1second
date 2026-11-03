import test from 'node:test';
import assert from 'node:assert/strict';

import { pickSlowRetries } from '../server/sources/orchestrator';

/** OWNER 3 Nov (third report): "hotels, flight mai kuch website ka hi price aata hai sb ka ni aata".
 * Measured on prod: cleartrip/starair/srilankan hit their own ceilings and expedia/qatar/emirates/
 * cathay were DEADLINE_CUT while still fetching - slow, not blocked, so their prices never reached
 * the feed. pickSlowRetries gives exactly those a short second chance, and never past the wall. */
test('only slow sources are retried, with a bounded budget', () => {
  const sources = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  const failed = [
    { sourceId: 'a', failureClass: 'TIMEOUT' },
    { sourceId: 'b', failureClass: 'DEADLINE_CUT' },
    { sourceId: 'c', failureClass: 'ACCESS_CHALLENGE' }, // blocked: a retry cannot help
    { sourceId: 'd', failureClass: 'EMPTY_RESPONSE' },    // honest empties are not retried
  ];
  const now = 1_000_000;
  const out = pickSlowRetries(failed, sources, { deadlineAt: now + 20_000, now, perRetryMs: 7000 });
  assert.deepEqual(out.map((r) => r.sourceId), ['a', 'b']);
  assert.equal(out.every((r) => r.budgetMs <= 7000), true);
});

test('the retry never runs past the wall and skips when there is no time left', () => {
  const now = 1_000_000;
  // 8s left: 3s reserve leaves 5s, so the retry budget shrinks below the 7s default.
  const tight = pickSlowRetries([{ sourceId: 'a', failureClass: 'TIMEOUT' }], [{ id: 'a' }], { deadlineAt: now + 8_000, now });
  assert.equal(tight.length, 1);
  assert.ok(tight[0].budgetMs <= 5000, `budget ${tight[0].budgetMs} must respect the reserve`);
  // 4s left: reserve + minimum retry no longer fit -> no retry at all.
  assert.deepEqual(pickSlowRetries([{ sourceId: 'a', failureClass: 'TIMEOUT' }], [{ id: 'a' }], { deadlineAt: now + 4_000, now }), []);
  // No deadline (background pass): default budget, still capped.
  const bg = pickSlowRetries([{ sourceId: 'a', failureClass: 'TIMEOUT' }], [{ id: 'a' }], { now });
  assert.equal(bg[0]?.budgetMs, 7000);
});

test('the retry set is capped and deduplicated', () => {
  const sources = Array.from({ length: 12 }, (_, i) => ({ id: `s${i}` }));
  const failed = sources.flatMap((s) => [{ sourceId: s.id, failureClass: 'TIMEOUT' }, { sourceId: s.id, failureClass: 'TIMEOUT' }]);
  const out = pickSlowRetries(failed, sources, { deadlineAt: Date.now() + 30_000, maxSources: 6 });
  assert.equal(out.length, 6, 'never retries more than the cap');
  assert.equal(new Set(out.map((r) => r.sourceId)).size, 6, 'each source retried once');
});
