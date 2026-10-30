/**
 * SOURCE RECOVERY SCANNER (owner 24 Oct: "ek baar Zomato ka data aana shuru ho
 * gaya ya kisi bhi company ka, to wo kabhi band na ho — system automatically
 * usko dhoondh kar active kar de").
 *
 * Before this: a gated/broken source only re-armed when a USER search happened
 * to hit its vertical (half-open circuit probe) or the 12-min keep-warm cycle
 * ran. If a source recovered while nobody searched that vertical, nobody
 * noticed — it stayed hidden until the next user query.
 *
 * Now: a background scanner walks ALL enabled sources every 10 minutes and,
 * for each one that looks DOWN (circuit-open past its cooldown, degraded with
 * a gating failure class, never-verified, or quietly stale), runs the source's
 * REAL acquisition task with a seed query for its vertical — the exact same
 * code path a user search takes. The moment the upstream starts serving data
 * again (Zomato's Akamai gate lifts, an IP ban expires, a site comes back):
 *   1. recordSuccess flips the source HEALTHY and resets the challenge ladder
 *      (the circuit can never stay open again — bounded cooldowns, 60min cap),
 *   2. the recovery is LOUDLY logged + persisted to source_recovery_log,
 *   3. the vertical's seed queries are re-warmed immediately so the recovered
 *      source's rows land in cache and search results without any user action.
 *
 * Honesty rules preserved: probes respect the ACCESS_CHALLENGE backoff ladder
 * (never probe inside a cooldown window — quiet time is what lets an IP-gate
 * lift), admin-DISABLED sources stay off (deliberate), and a probe that still
 * fails just records the same failure a user search would. Nothing invented.
 */
import type { FailureClass, ParsedQuery, SourceConfig, SourceHealth, VerticalId } from '../types';
import { log } from '../common/logger';
import { backgroundAllowed, resourceSnapshot } from '../common/resourceGuard';
import { withLock } from '../common/cache';
import { recordAttempt, recordFailure, recordSuccess, getAllHealth } from './health';
import { getSources } from './registry';
import { getAdapter } from './orchestrator';
import { understandQuery } from '../query/queryUnderstanding';

/** Failure classes that mean "this source is DOWN/gated" (probing can recover it). */
const DOWN_CLASSES = new Set<string>(['ACCESS_CHALLENGE', 'TIMEOUT', 'SERVER_ERROR', 'MALFORMED_RESPONSE', 'UNKNOWN', 'DEADLINE_CUT', 'EXPIRED_CREDENTIALS']);
/** A healthy source that has not succeeded in 24h gets one probe/day (quiet staleness). */
const STALE_AFTER_MS = 24 * 3600_000;
/** A degraded source is probed at most every 10 min (aligned with the scan cadence). */
const DEGRADED_REPROBE_GAP_MS = 10 * 60_000;
/** Hard cap per pass: shared-hosting budget, never a probe storm. */
const MAX_PROBES_PER_PASS = 3;
/** Per-probe budget (task's own timeout usually ends first). */
const PROBE_BUDGET_MS = 35_000;

/** Seed queries used to probe (same seeds the keep-warm cycle uses). */
const RECOVERY_SEEDS: Array<{ query: string; vertical: VerticalId; city?: string; pincode?: string }> = [
  { query: 'biryani', vertical: 'food', city: 'Indore', pincode: '452001' },
  { query: 'pizza', vertical: 'food', city: 'Indore', pincode: '452001' },
  { query: 'mobile phone', vertical: 'ecommerce', city: 'Indore', pincode: '452001' },
  { query: 'laptop', vertical: 'ecommerce', city: 'Indore', pincode: '452001' },
  { query: 'milk', vertical: 'grocery', city: 'Indore', pincode: '452001' },
  { query: 'atta', vertical: 'grocery', city: 'Indore', pincode: '452001' },
  { query: 'Indore to Bhopal', vertical: 'bus', city: 'Indore', pincode: '452001' },
  { query: 'delhi to jaipur', vertical: 'bus', city: 'Delhi' },
  { query: 'Indore to Bhopal', vertical: 'cab', city: 'Indore', pincode: '452001' },
  { query: 'Indore (IDR) to Delhi (DEL)', vertical: 'flights', city: 'Indore', pincode: '452001' },
  { query: 'Indore to Mumbai', vertical: 'flights', city: 'Indore', pincode: '452001' },
  { query: 'goa', vertical: 'hotels', city: 'Goa' },
  { query: 'indore', vertical: 'hotels', city: 'Indore' },
  { query: 'movies', vertical: 'movies', city: 'Indore', pincode: '452001' },
  { query: 'personal loan', vertical: 'loans', city: 'Indore', pincode: '452001' },
  { query: 'home loan', vertical: 'loans', city: 'Indore', pincode: '452001' },
  { query: 'health insurance', vertical: 'insurance', city: 'Indore', pincode: '452001' },
  { query: 'hdfc credit card', vertical: 'creditcards', city: 'Indore', pincode: '452001' },
  { query: 'savings account', vertical: 'banking', city: 'Indore', pincode: '452001' },
];

export interface RecoveryCandidate {
  source: SourceConfig;
  seed: { query: string; vertical: VerticalId; city?: string; pincode?: string };
  priorState: string;
  priorFailureClass: string | null;
  reason: 'circuit_half_open' | 'degraded_recent_failure' | 'never_verified' | 'quietly_stale';
}

/** Pure: pick which sources deserve a recovery probe this pass (testable). */
export function selectRecoveryCandidates(
  sources: SourceConfig[],
  healths: Map<string, SourceHealth>,
  opts: {
    now: number;
    lastProbedAt: Map<string, number>;
    seeds?: typeof RECOVERY_SEEDS;
    skipSources?: Set<string>;
  },
): RecoveryCandidate[] {
  const seeds = opts.seeds ?? RECOVERY_SEEDS;
  const bySeed = new Map<VerticalId, typeof seeds[number]>();
  for (const s of seeds) if (!bySeed.has(s.vertical)) bySeed.set(s.vertical, s);
  const out: RecoveryCandidate[] = [];
  for (const source of sources) {
    if (!source.enabled) continue; // admin-disable is deliberate — never override
    if (source.id.includes('#')) continue; // synthetic browser-fallback variants
    if (opts.skipSources?.has(source.id)) continue;
    const seed = bySeed.get(source.verticals?.[0] as VerticalId);
    if (!seed) continue; // no honest probe exists for this vertical
    const h = healths.get(source.id);
    if (!h) {
      out.push({ source, seed, priorState: 'UNVERIFIED', priorFailureClass: null, reason: 'never_verified' });
      continue;
    }
    if (h.state === 'DISABLED') continue;
    if (h.state === 'CIRCUIT_OPEN') {
      // Only probe when the cooldown window (from THIS snapshot) has expired —
      // the probe itself half-opens the circuit in the live health module.
      // Pure: never force through an ACCESS_CHALLENGE backoff (quiet time is
      // what lets an IP gate lift).
      const until = h.circuitOpenUntil ? new Date(h.circuitOpenUntil).getTime() : 0;
      if (until > opts.now) continue;
      out.push({ source, seed, priorState: h.state, priorFailureClass: h.lastFailureClass, reason: 'circuit_half_open' });
      continue;
    }
    if (h.state === 'DEGRADED') {
      const lastFail = h.lastFailureAt ? new Date(h.lastFailureAt).getTime() : 0;
      const lastOk = h.lastSuccessAt ? new Date(h.lastSuccessAt).getTime() : 0;
      const recentGating = h.lastFailureClass != null && DOWN_CLASSES.has(h.lastFailureClass) && opts.now - lastFail < STALE_AFTER_MS;
      const staleSinceOk = h.totalSuccesses > 0 && opts.now - Math.max(lastOk, 0) > STALE_AFTER_MS;
      if (!recentGating && !staleSinceOk) continue;
      // Throttle re-probes of a still-down source: at most every 10 min.
      const lastProbe = opts.lastProbedAt.get(source.id) ?? 0;
      if (opts.now - lastProbe < DEGRADED_REPROBE_GAP_MS) continue;
      out.push({ source, seed, priorState: h.state, priorFailureClass: h.lastFailureClass, reason: 'degraded_recent_failure' });
      continue;
    }
    if (h.state === 'HEALTHY' || h.state === 'UNVERIFIED') {
      // Quiet staleness: a source that succeeded once but went silent >24h ago
      // gets one probe — "kabhi band na ho" includes the sources nobody searches.
      const lastOk = h.lastSuccessAt ? new Date(h.lastSuccessAt).getTime() : 0;
      if (h.state === 'HEALTHY' && lastOk && opts.now - lastOk > STALE_AFTER_MS) {
        const lastProbe = opts.lastProbedAt.get(source.id) ?? 0;
        if (opts.now - lastProbe < STALE_AFTER_MS) continue;
        out.push({ source, seed, priorState: h.state, priorFailureClass: h.lastFailureClass, reason: 'quietly_stale' });
      }
      if (h.state === 'UNVERIFIED' && h.totalAttempts === 0) {
        out.push({ source, seed, priorState: h.state, priorFailureClass: null, reason: 'never_verified' });
      }
    }
  }
  // Circuit half-open probes first (cheapest recovery wins), then degraded.
  const order: Record<string, number> = { circuit_half_open: 0, degraded_recent_failure: 1, never_verified: 2, quietly_stale: 3 };
  out.sort((a, b) => (order[a.reason] ?? 9) - (order[b.reason] ?? 9) || a.source.priority - b.source.priority);
  return out.slice(0, MAX_PROBES_PER_PASS);
}

const lastProbedAt = new Map<string, number>();

/** One probe: the source's real acquisition path with a seed query. */
async function probeSource(candidate: RecoveryCandidate): Promise<{ recovered: boolean; rows: number; failureClass?: string; error?: string }> {
  const { source, seed } = candidate;
  let parsed: ParsedQuery;
  try {
    parsed = understandQuery(seed.query, { city: seed.city, pincode: seed.pincode } as any);
    parsed.vertical = seed.vertical;
  } catch {
    return { recovered: false, rows: 0, error: 'probe query parse failed' };
  }
  recordAttempt(source.id, 0);
  const adapter = getAdapter(source);
  let budgetTimer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<never>((_, rej) => {
    budgetTimer = setTimeout(() => rej(new Error('probe budget cut')), PROBE_BUDGET_MS);
  });
  budget.catch(() => undefined); // loser of the race must never be an unhandled rejection
  try {
    const result = await Promise.race([adapter.search({ query: parsed, source }), budget] as any);
    if (result?.success && result.rawItems?.length > 0) {
      recordSuccess(source.id, result.latencyMs ?? 0);
      return { recovered: candidate.priorState !== 'HEALTHY', rows: result.rawItems.length };
    }
    const failureClass = String(result?.failureClass || 'EMPTY_RESPONSE') as FailureClass;
    recordFailure(source.id, failureClass, result?.error || 'recovery probe: no items');
    return { recovered: false, rows: 0, failureClass, error: result?.error || 'no items' };
  } catch (e: any) {
    recordFailure(source.id, 'TIMEOUT', String(e?.message || e).slice(0, 120));
    return { recovered: false, rows: 0, failureClass: 'TIMEOUT', error: String(e?.message || e).slice(0, 120) };
  } finally {
    if (budgetTimer) clearTimeout(budgetTimer);
  }
}

async function persistRecovery(c: RecoveryCandidate, rows: number): Promise<void> {
  try {
    const { getStore } = await import('../common/db');
    await getStore().execute(
      `INSERT INTO source_recovery_log (source_id, source_name, vertical, prior_state, prior_failure_class, probe_query, rows_found)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [c.source.id, c.source.name, c.seed.vertical, c.priorState, c.priorFailureClass, c.seed.query, rows],
    );
  } catch {
    // file-fallback store / table not migrated yet — the log line still tells the story
  }
}

/** Re-warm the recovered source's vertical so its rows land in cache immediately. */
async function warmRecoveredVertical(vertical: VerticalId): Promise<void> {
  try {
    const { runSearchPolled } = await import('../search/searchOrchestrator');
    const seeds = RECOVERY_SEEDS.filter((s) => s.vertical === vertical).slice(0, 2);
    for (const s of seeds) {
      await runSearchPolled({ query: s.query, vertical: s.vertical as any, city: s.city, pincode: s.pincode }, 20_000);
      await new Promise((r) => setImmediate(r)); // shared-host yield
    }
  } catch (e: any) {
    log.debug('Recovery', 'post-recovery warm skipped', { error: String(e?.message || e).slice(0, 100) });
  }
}

/** One scanner pass (exported for tests + manual trigger). */
export async function recoveryScanPass(now = Date.now()): Promise<{ probed: number; recovered: number; recoveredSources: string[] }> {
  const sources = getSources().filter((s) => s.enabled);
  const healths = new Map(getAllHealth().map((h) => [h.sourceId, h]));
  const candidates = selectRecoveryCandidates(sources, healths, { now, lastProbedAt });
  let recovered = 0;
  const recoveredSources: string[] = [];
  for (const c of candidates) {
    lastProbedAt.set(c.source.id, now);
    const wasDown = c.reason === 'circuit_half_open' || c.reason === 'degraded_recent_failure';
    const r = await probeSource(c);
    if (r.recovered && wasDown) {
      // THE moment the owner asked for: data started flowing again, detected and
      // activated with zero user action.
      recovered += 1;
      recoveredSources.push(c.source.id);
      log.info('Recovery', `SOURCE RECOVERED automatically: ${c.source.id} (${c.source.name}) — was ${c.priorState}(${c.priorFailureClass ?? 'n/a'}), probe returned ${r.rows} rows; ladder reset, vertical re-warming`, { vertical: c.seed.vertical });
      await persistRecovery(c, r.rows);
      await warmRecoveredVertical(c.seed.vertical);
    } else if (r.recovered && c.reason === 'quietly_stale') {
      log.info('Recovery', `Source active again after staleness: ${c.source.id} (${r.rows} rows)`);
      await persistRecovery(c, r.rows);
    } else if (!r.recovered && wasDown) {
      log.debug('Recovery', `Recovery probe still down: ${c.source.id} (${r.failureClass ?? 'unknown'})`);
    }
    await new Promise((res) => setImmediate(res));
  }
  if (candidates.length) log.info('Recovery', `Scan pass: ${candidates.length} probed, ${recovered} recovered`);
  return { probed: candidates.length, recovered, recoveredSources };
}

let started = false;

/** Boot the background scanner (called from startWorkers; singleton-safe). */
export function startRecoveryScanner(): void {
  if (started) return;
  started = true;
  const SCAN_MS = 10 * 60_000;
  const timer = setInterval(() => {
    // OWNER 29 Oct (Hostinger protective CPU mode): probing is optional work. When the
    // box is already hot it is skipped outright, so recovery can never be the thing that
    // keeps the account CPU-flat and the app blocked.
    if (!backgroundAllowed()) {
      log.info('Recovery', 'Scan pass skipped (resource governor)', resourceSnapshot() as any);
      return;
    }
    void withLock('recovery-scanner', () => recoveryScanPass()).catch((e: any) => {
      log.warn('Recovery', 'Scan pass failed (will retry next tick)', { error: String(e?.message || e).slice(0, 120) });
    });
  }, SCAN_MS);
  if (timer.unref) timer.unref();
  // One pass shortly after boot: catch sources that recovered while the process was down.
  setTimeout(() => {
    if (!backgroundAllowed()) return;
    void withLock('recovery-scanner', () => recoveryScanPass()).catch(() => undefined);
  }, 90_000).unref?.();
  log.info('Recovery', 'Source recovery scanner armed (10-min cadence, probes respect challenge ladder, admin-disabled stays off)');
}

/** Test hook: reset probe throttles between tests. */
export function resetRecoveryScannerForTests(): void {
  lastProbedAt.clear();
  started = false;
}
