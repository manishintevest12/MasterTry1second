/**
 * Source health monitor + circuit breakers (Sections 4, 14).
 * - Failure classification, bounded circuit opening, health-aware selection
 * - A source is only HEALTHY after observed successful responses (no optimistic recovery)
 * - State is kept in memory and persisted to source_health for observability
 */
import type { FailureClass, SourceHealth, SourceHealthState } from '../types';
import { log } from '../common/logger';

const CIRCUIT_THRESHOLD = 3; // consecutive failures before opening circuit
const CIRCUIT_COOLDOWN_MS = 60_000;
// ACCESS_CHALLENGE (Akamai "Bot or Not?" sampling, WAF 403/429) is IP-reputation
// based: it only clears after the source sees QUIET time (observed 30-60 min on
// expedia.com). A flat 60s cooldown + warm-cycle retries every few minutes keeps
// re-triggering the sample, so the source never recovers (this is why Expedia/
// Hotels.com offers were missing on production). Challenges now back off
// exponentially: 1min -> 5min -> 25min -> 60min (cap), resetting on the first success.
const CHALLENGE_COOLDOWN_STEPS_MS = [60_000, 5 * 60_000, 25 * 60_000, 60 * 60_000];
const challengeOpenings = new Map<string, number>();
// SELF-DETECTING PROBES (owner rule 21 Oct: strictly-mandated sources must stay
// visible and self-heal). These sources attempt the real acquisition flow by
// design — a gated response IS their honest per-search result.
// UPDATE 21 Oct evening: the flat-60s every-search probe cadence kept the
// Hostinger IP permanently re-sampled by Akamai (4 days, no recovery), while the
// same gates recovered on Expedia/Hotels.com once the ladder gave the IP quiet
// time. Probes now climb the SAME ACCESS_CHALLENGE ladder (1->5->25->60 min,
// full reset on first success) — still self-detecting within at most 60 min of
// the gate lifting, but no longer preventing the recovery they wait for.
const PROBE_SOURCES = new Set(['w_hotels_goibibo', 'w_hotels_mmt', 'w_flights_makemytrip', 'w_food_zomato']);

const health = new Map<string, SourceHealth>();

/** Test-only: wipe in-memory health so presence/circuit tests are deterministic. */
export function resetHealthForTests(): void {
  health.clear();
}

function blank(sourceId: string): SourceHealth {
  return {
    sourceId,
    state: 'UNVERIFIED',
    consecutiveFailures: 0,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastFailureClass: null,
    lastFailureMessage: null,
    circuitOpenUntil: null,
    totalAttempts: 0,
    totalSuccesses: 0,
    avgLatencyMs: null,
  };
}

export function getHealth(sourceId: string): SourceHealth {
  return health.get(sourceId) || blank(sourceId);
}

export function getAllHealth(): SourceHealth[] {
  return [...health.values()];
}

export function canAttempt(sourceId: string, now = Date.now()): boolean {
  const h = getHealth(sourceId);
  if (h.state === 'CIRCUIT_OPEN' && h.circuitOpenUntil) {
    if (now < new Date(h.circuitOpenUntil).getTime()) return false;
    // Half-open probe: allow a single attempt to check recovery
    const updated = { ...h, state: 'DEGRADED' as SourceHealthState, circuitOpenUntil: null };
    health.set(sourceId, updated);
    log.info('Health', `Circuit half-open for ${sourceId}, probing`);
    return true;
  }
  return true;
}

export function recordAttempt(sourceId: string, latencyMs: number): void {
  const h = getHealth(sourceId);
  h.totalAttempts += 1;
  h.avgLatencyMs = h.avgLatencyMs === null ? latencyMs : Math.round(0.7 * h.avgLatencyMs + 0.3 * latencyMs);
  health.set(sourceId, h);
}

export function recordSuccess(sourceId: string, latencyMs: number): void {
  challengeOpenings.delete(sourceId); // a single success ends the challenge backoff ladder
  const h = getHealth(sourceId);
  h.totalAttempts += 1;
  h.totalSuccesses += 1;
  h.consecutiveFailures = 0;
  h.lastSuccessAt = new Date().toISOString();
  h.circuitOpenUntil = null;
  // Recovery is only claimed after a successful, validated response (Section 14)
  h.state = h.totalSuccesses >= 2 ? 'HEALTHY' : 'DEGRADED';
  h.avgLatencyMs = h.avgLatencyMs === null ? latencyMs : Math.round(0.7 * h.avgLatencyMs + 0.3 * latencyMs);
  health.set(sourceId, h);
  void persist(h);
}

export function recordFailure(sourceId: string, failureClass: FailureClass, error: string): void {
  const h = getHealth(sourceId);
  h.totalAttempts += 1;
  // RATE_LIMITED is OUR OWN limiter backpressure, not an upstream failure —
  // it must never trip the circuit breaker (which would silently hide a
  // healthy source from searches for a minute).
  //
  // EMPTY_RESPONSE (owner 23 Oct, prod log audit: 224 circuit-OPEN warnings/hour)
  // is an HONEST "no rows for THIS query" outcome, not a source failure:
  // Rapido intercity returns 0 rows by design, OSM/Wikidata reference workers
  // only fire on name-specific queries, OTA flight workers (budgetair/gotogate/
  // happyeasygo) legitimately return nothing for Indian routes. Tripping a
  // 1-minute circuit on it (a) spams the log and (b) HIDES a healthy source
  // from the next user search that WOULD have results — the opposite of the
  // owner's self-healing rule. Sources that return empty because they are
  // actually gated/broken classify as ACCESS_CHALLENGE / SERVER_ERROR /
  // TIMEOUT / MALFORMED_RESPONSE and still trip the breaker as before.
  if (failureClass === 'RATE_LIMITED' || failureClass === 'EMPTY_RESPONSE') {
    h.lastFailureAt = new Date().toISOString();
    h.lastFailureClass = failureClass;
    h.state = h.state === 'CIRCUIT_OPEN' ? h.state : 'DEGRADED';
    health.set(sourceId, h);
    void persist(h);
    return;
  }
  h.consecutiveFailures += 1;
  h.lastFailureAt = new Date().toISOString();
  h.lastFailureClass = failureClass;
  h.lastFailureMessage = String(error || '').slice(0, 300) || null;
  const wasOpen = h.state === 'CIRCUIT_OPEN';
  h.state = h.consecutiveFailures >= CIRCUIT_THRESHOLD ? 'CIRCUIT_OPEN' : 'DEGRADED';
  if (h.state === 'CIRCUIT_OPEN' && !wasOpen) {
    // Fresh opening only: extra failures while already open never extend or
    // shorten the existing cooldown window.
    let cooldownMs = CIRCUIT_COOLDOWN_MS;
    if (failureClass === 'ACCESS_CHALLENGE') {
      // Step the ladder once per circuit OPENING (not per failure).
      const n = (challengeOpenings.get(sourceId) ?? 0) + 1;
      challengeOpenings.set(sourceId, n);
      cooldownMs = CHALLENGE_COOLDOWN_STEPS_MS[Math.min(n - 1, CHALLENGE_COOLDOWN_STEPS_MS.length - 1)];
    }
    h.circuitOpenUntil = new Date(Date.now() + cooldownMs).toISOString();
    log.warn('Health', `Circuit OPEN for ${sourceId} after ${h.consecutiveFailures} failures (${failureClass}), cooldown ${Math.round(cooldownMs / 60_000)}min`);
  }
  health.set(sourceId, h);
  void persist(h);
}

export function markDisabled(sourceId: string): void {
  const h = getHealth(sourceId);
  h.state = 'DISABLED';
  health.set(sourceId, h);
}

async function persist(h: SourceHealth) {
  try {
    const { getStore } = await import('../common/db');
    const store = getStore();
    await store.execute(
      `INSERT INTO source_health (source_id, state, consecutive_failures, last_success_at, last_failure_at, last_failure_class, circuit_open_until, total_attempts, total_successes, avg_latency_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE state=VALUES(state), consecutive_failures=VALUES(consecutive_failures), last_success_at=VALUES(last_success_at), last_failure_at=VALUES(last_failure_at), last_failure_class=VALUES(last_failure_class), circuit_open_until=VALUES(circuit_open_until), total_attempts=VALUES(total_attempts), total_successes=VALUES(total_successes), avg_latency_ms=VALUES(avg_latency_ms)`,
      [h.sourceId, h.state, h.consecutiveFailures, h.lastSuccessAt, h.lastFailureAt, h.lastFailureClass, h.circuitOpenUntil, h.totalAttempts, h.totalSuccesses, h.avgLatencyMs],
    );
  } catch (e: any) {
    log.debug('Health', 'Persist failed (file store / no table)', { error: String(e).slice(0, 120) });
  }
}
