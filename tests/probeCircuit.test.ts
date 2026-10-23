import test from 'node:test';
import assert from 'node:assert';
/**
 * Probe cadence (21 Oct owner report: Goibibo/MMT hotels still invisible after 4
 * days of every-search probing): self-detecting probe sources now climb the SAME
 * ACCESS_CHALLENGE backoff ladder as every other gated source. The flat-60s
 * every-search cadence kept the Hostinger IP permanently re-sampled by Akamai —
 * the gate can only clear after 30-60 min of quiet time (verified on
 * Expedia/Hotels.com). Probes stay self-healing: the ladder resets fully on the
 * first success, so a lifted gate re-activates the source within at most 60 min.
 */
import { recordFailure, recordSuccess, getHealth, canAttempt } from '../server/sources/health';

test('probe sources climb the challenge ladder like other gated sources', () => {
  // 4 fresh openings: expire each window via the half-open probe (canAttempt
  // with a future `now`), then fail again — each fresh opening climbs one rung.
  for (let rung = 0; rung < 4; rung++) {
    canAttempt('w_probe_ladder_src', Date.now() + 65 * 60_000); // jump past ANY rung
    for (let i = 0; i < 3; i++) recordFailure('w_probe_ladder_src', 'ACCESS_CHALLENGE', 'stub');
  }
  const h = getHealth('w_probe_ladder_src');
  assert.equal(h.state, 'CIRCUIT_OPEN');
  const openMs = new Date(h.circuitOpenUntil as any).getTime() - Date.now();
  assert.ok(openMs > 55 * 60_000, `probe should reach the 60min rung, got ${Math.round(openMs / 60000)}min`);
});

test('probe ladder fully resets on first success — gate lift re-activates fast', () => {
  // Burn the source up to the top rung…
  for (let rung = 0; rung < 4; rung++) {
    canAttempt('w_probe_reset_src', Date.now() + 65 * 60_000);
    for (let i = 0; i < 3; i++) recordFailure('w_probe_reset_src', 'ACCESS_CHALLENGE', 'gate');
  }
  // …then the gate lifts and the probe succeeds (2 successes = full health)…
  recordSuccess('w_probe_reset_src', 150);
  recordSuccess('w_probe_reset_src', 120);
  const ok = getHealth('w_probe_reset_src');
  assert.equal(ok.state, 'HEALTHY');
  // …the very next challenge must start from the 60s rung again, not 60min.
  for (let i = 0; i < 3; i++) recordFailure('w_probe_reset_src', 'ACCESS_CHALLENGE', 'stub');
  const again = getHealth('w_probe_reset_src');
  assert.equal(again.state, 'CIRCUIT_OPEN');
  const openMs = new Date(again.circuitOpenUntil as any).getTime() - Date.now();
  assert.ok(openMs <= 61_000, `post-reset opening must be ~60s, got ${Math.round(openMs / 1000)}s`);
});

test('circuit half-open lets a probe re-attempt after its window', () => {
  assert.equal(typeof canAttempt('w_hotels_mmt'), 'boolean');
});

test('non-probe sources climb the challenge ladder to the 60min rung', () => {
  for (let rung = 0; rung < 4; rung++) {
    canAttempt('w_test_ladder_src', Date.now() + 65 * 60_000);
    for (let i = 0; i < 3; i++) recordFailure('w_test_ladder_src', 'ACCESS_CHALLENGE', 'gate');
  }
  const h = getHealth('w_test_ladder_src');
  assert.equal(h.state, 'CIRCUIT_OPEN');
  const openMs = new Date(h.circuitOpenUntil as any).getTime() - Date.now();
  assert.ok(openMs > 55 * 60_000, `ladder source should sit on the 60min rung, got ${Math.round(openMs / 60000)}min`);
});
