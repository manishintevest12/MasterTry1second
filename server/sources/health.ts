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

const health = new Map<string, SourceHealth>();

function blank(sourceId: string): SourceHealth {
  return {
    sourceId,
    state: 'UNVERIFIED',
    consecutiveFailures: 0,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastFailureClass: null,
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

export function recordFailure(sourceId: string, failureClass: FailureClass, _error: string): void {
  const h = getHealth(sourceId);
  h.totalAttempts += 1;
  h.consecutiveFailures += 1;
  h.lastFailureAt = new Date().toISOString();
  h.lastFailureClass = failureClass;
  h.state = h.consecutiveFailures >= CIRCUIT_THRESHOLD ? 'CIRCUIT_OPEN' : 'DEGRADED';
  if (h.state === 'CIRCUIT_OPEN') {
    h.circuitOpenUntil = new Date(Date.now() + CIRCUIT_COOLDOWN_MS).toISOString();
    log.warn('Health', `Circuit OPEN for ${sourceId} after ${h.consecutiveFailures} failures (${failureClass})`);
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
