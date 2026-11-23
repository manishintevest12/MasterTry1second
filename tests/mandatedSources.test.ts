import test from 'node:test';
import assert from 'node:assert/strict';
import { isMandatedSource, selectSources } from '../server/sources/registry';
import { recordFailure, mandatedProbeDue, getHealth } from '../server/sources/health';

/**
 * OWNER 22 Nov ("ye dono dikhane chaiye"): measured on production, a hotels search attempted nine sources and
 * w_hotels_goibibo / w_hotels_booking were not among them — a mandated partner sat dark behind an open circuit
 * (60 min for a challenge, up to 6 h for a re-open streak) while the feed looked healthy.
 */
test('goibibo and booking are mandated in both verticals', () => {
  for (const id of ['w_hotels_goibibo', 'w_hotels_booking', 'w_flights_goibibo', 'w_flights_booking']) {
    assert.equal(isMandatedSource(id), true, id);
  }
  assert.equal(isMandatedSource('w_hotels_oyo'), false);
});

test('a mandated source is still selected while its circuit is open, on its own probe clock', () => {
  process.env.T1S_MANDATED_PROBE_MS = '1';
  // w_flights_booking is mandated and probe-only; the slow hotel partners are now warmer-only (see slowSourceCache).
  for (let i = 0; i < 4; i += 1) recordFailure('w_flights_booking', 'ACCESS_CHALLENGE', 'HTTP 403');
  assert.equal(getHealth('w_flights_booking').state, 'CIRCUIT_OPEN');

  const flights = selectSources({ vertical: 'flights' } as any).map((s) => s.id);
  assert.ok(flights.includes('w_flights_booking'), 'the mandated partner must still be probed');

  // A non-mandated source that is circuit-open stays out of the attempt list.
  for (let i = 0; i < 4; i += 1) recordFailure('w_flights_yatra', 'ACCESS_CHALLENGE', 'HTTP 403');
  const again = selectSources({ vertical: 'flights' } as any).map((s) => s.id);
  assert.equal(again.includes('w_flights_yatra'), false, 'the breaker still protects the answer for others');
  delete process.env.T1S_MANDATED_PROBE_MS;
});

test('the probe clock is a real clock, not every call', () => {
  process.env.T1S_MANDATED_PROBE_MS = '600000';
  const first = mandatedProbeDue('w_flights_goibibo');
  const second = mandatedProbeDue('w_flights_goibibo');
  assert.equal(first, true);
  assert.equal(second, false, 'a second search seconds later must not re-probe');
  delete process.env.T1S_MANDATED_PROBE_MS;
});
