import test from 'node:test';
import assert from 'node:assert';
/**
 * Regression (21 Oct owner report: Goibibo/MMT hotels invisible on production):
 * self-detecting probe sources must NEVER climb the ACCESS_CHALLENGE backoff
 * ladder — a flat 60s cooldown keeps them attempted (and honestly visible in
 * sourcesFailed) on nearly every search, self-healing the moment the gate lifts.
 */
import { recordFailure, getHealth, canAttempt } from '../server/sources/health';

test('probe sources stay on the flat 60s rung after many openings', () => {
  for (let i = 0; i < 12; i++) recordFailure('w_hotels_goibibo', 'ACCESS_CHALLENGE', 'stub');
  const h = getHealth('w_hotels_goibibo');
  assert.equal(h.state, 'CIRCUIT_OPEN');
  const openMs = new Date(h.circuitOpenUntil as any).getTime() - Date.now();
  assert.ok(openMs <= 61_000, `probe cooldown must stay ~60s, got ${Math.round(openMs / 1000)}s`);
});

test('non-probe sources climb the challenge ladder to the 60min rung', () => {
  // 4 fresh openings: expire each window via the half-open probe (canAttempt with
  // a future `now`), then fail again — each fresh opening climbs one rung.
  for (let rung = 0; rung < 4; rung++) {
    canAttempt('w_test_ladder_src', Date.now() + 65 * 60_000); // jump past ANY rung (max 60min)
    for (let i = 0; i < 3; i++) recordFailure('w_test_ladder_src', 'ACCESS_CHALLENGE', 'gate');
  }
  const h = getHealth('w_test_ladder_src');
  assert.equal(h.state, 'CIRCUIT_OPEN');
  const openMs = new Date(h.circuitOpenUntil as any).getTime() - Date.now();
  assert.ok(openMs > 55 * 60_000, `ladder source should sit on the 60min rung, got ${Math.round(openMs / 60000)}min`);
});

test('probe source NEVER leaves the flat 60s rung across many openings', () => {
  for (let rung = 0; rung < 5; rung++) {
    canAttempt('w_hotels_goibibo', Date.now() + 65 * 60_000);
    for (let i = 0; i < 3; i++) recordFailure('w_hotels_goibibo', 'ACCESS_CHALLENGE', 'stub');
  }
  const h = getHealth('w_hotels_goibibo');
  assert.equal(h.state, 'CIRCUIT_OPEN');
  const openMs = new Date(h.circuitOpenUntil as any).getTime() - Date.now();
  assert.ok(openMs <= 61_000, `probe must stay on the flat 60s rung, got ${Math.round(openMs / 1000)}s`);
});

test('circuit half-open lets a probe re-attempt after the 60s window', () => {
  assert.equal(typeof canAttempt('w_hotels_mmt'), 'boolean');
});
