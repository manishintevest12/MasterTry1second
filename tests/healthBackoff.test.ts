/**
 * Circuit-breaker challenge backoff (server/sources/health.ts).
 *
 * ACCESS_CHALLENGE failures (Akamai "Bot or Not?" 429 sampling, WAF 403) are
 * IP-reputation based and only clear after quiet time. The cooldown ladder
 * steps 1min -> 5min -> 25min -> 60min (cap) on repeated circuit openings and
 * resets on the first success, so warm cycles stop re-triggering the sample.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const sid = () => `t_source_${Math.random().toString(36).slice(2, 9)}`;

async function fresh() {
  const h = await import('../server/sources/health.ts');
  return h as any;
}

function msLeft(openUntil: string | null): number {
  return openUntil ? new Date(openUntil).getTime() - Date.now() : 0;
}

test('health: challenge circuits back off 1min -> 5min -> 25min -> 60min cap', async () => {
  const h = await fresh();
  const id = sid();
  const expected = [60_000, 5 * 60_000, 25 * 60_000, 60 * 60_000, 60 * 60_000];
  for (const want of expected) {
    for (let i = 0; i < 3; i++) h.recordFailure(id, 'ACCESS_CHALLENGE', 'bot challenge');
    const g = h.getHealth(id);
    assert.equal(g.state, 'CIRCUIT_OPEN');
    const left = msLeft(g.circuitOpenUntil);
    assert.ok(Math.abs(left - want) < 5_000, `expected ~${want / 60_000}min cooldown, got ${Math.round(left / 60_000)}min`);
    // simulate the half-open probe succeeding window: expire + reopen for the next rung
    h.canAttempt(id, Date.now() + left + 1_000);
    for (let i = 0; i < 3; i++) h.recordFailure(id, 'ACCESS_CHALLENGE', 'still sampled');
  }
});

test('health: a single success resets the challenge backoff ladder', async () => {
  const h = await fresh();
  const id = sid();
  for (let i = 0; i < 3; i++) h.recordFailure(id, 'ACCESS_CHALLENGE', 'bot challenge');
  let g = h.getHealth(id);
  assert.ok(msLeft(g.circuitOpenUntil) > 50_000, 'first rung ~1min');
  h.recordSuccess(id, 120);
  g = h.getHealth(id);
  assert.equal(g.state, 'DEGRADED'); // half-open probe success -> degraded, healthy after 2nd
  assert.equal(g.circuitOpenUntil, null);
  // next opening starts again at the 1-minute rung
  for (let i = 0; i < 3; i++) h.recordFailure(id, 'ACCESS_CHALLENGE', 'bot challenge again');
  g = h.getHealth(id);
  assert.ok(msLeft(g.circuitOpenUntil) < 65_000 && msLeft(g.circuitOpenUntil) > 50_000, 'ladder reset after success');
});

test('health: a source that keeps reopening escalates 1m -> 5m -> 25m instead of hammering every minute', async () => {
  // OWNER 10 Nov runtime log: amazon_in hit 21 consecutive failures while every reopening still used the flat
  // 1-minute cooldown, i.e. a dead source was probed ~60x/hour forever. The ladder now backs off, and the FIRST
  // opening is still the same 1 minute it always was.
  const h = await fresh();
  const id = sid();
  const want = [60_000, 5 * 60_000, 25 * 60_000];
  for (let round = 0; round < want.length; round++) {
    for (let i = 0; i < 3; i++) h.recordFailure(id, 'CONNECTION_FAILURE', 'flaky');
    const g = h.getHealth(id);
    assert.equal(g.state, 'CIRCUIT_OPEN');
    const left = msLeft(g.circuitOpenUntil);
    assert.ok(Math.abs(left - want[round]) < 5_000, `opening ${round + 1} should wait ${want[round] / 60_000}min, got ${Math.round(left / 1000)}s`);
    h.canAttempt(id, Date.now() + left + 1_000); // half-open probe fails again -> next rung
  }
  // one real success resets the ladder to the first rung
  h.recordSuccess(id, 120);
  for (let i = 0; i < 3; i++) h.recordFailure(id, 'CONNECTION_FAILURE', 'flaky');
  assert.ok(Math.abs(msLeft(h.getHealth(id).circuitOpenUntil) - 60_000) < 5_000, 'ladder reset after a success');
});

test('health: a missing capability parks the circuit for hours, not a minute', async () => {
  // Booking Demand/Apify keys and the Playwright bridge are absent: probing them every minute can never help.
  const h = await fresh();
  const id = sid();
  for (let i = 0; i < 3; i++) h.recordFailure(id, 'CAPABILITY_UNAVAILABLE', 'no credentials');
  const left = msLeft(h.getHealth(id).circuitOpenUntil);
  assert.ok(left > 5.9 * 60 * 60_000, `expected ~6h park, got ${Math.round(left / 60_000)}min`);
});
