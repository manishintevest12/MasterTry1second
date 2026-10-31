/**
 * LOAD GOVERNOR (owner 30 Oct)
 *
 * "aisa system bnao ki cpu usage limit ka 50% tk hi use kre ... Limit concurrent
 * /api/scrape/live requests, timeouts and cancellation, prevent duplicate mobile
 * requests, queue scraping jobs, cache repeated searches ... website and app ka flow
 * khrb naa ho yaa results time impact naa ho"
 *
 * One place that decides how much live scraping work this process may run at once.
 * Everything here is a GATE, never a rewrite: the orchestrator's own cache, coalescing
 * and deadlines are untouched, so warm searches stay instant and a cold search still
 * gets its rows inside the normal deadline.
 *
 * Guarantees:
 *  1. CPU ceiling. A rolling sampler measures this process's own CPU (process.cpuUsage).
 *     Above T1S_CPU_TARGET_PCT (default 50) the live concurrency ceiling shrinks in
 *     proportion, down to a floor of T1S_LIVE_MIN_CONCURRENCY (default 2) slots, so the
 *     box never sits pegged. Below target the full T1S_LIVE_MAX_CONCURRENCY (16) runs.
 *  2. Bounded queue. Excess live searches wait in a FIFO queue capped at
 *     T1S_LIVE_QUEUE_MAX (40). Overflow is answered immediately from the caller's own
 *     cached rows - a request is never parked indefinitely.
 *  3. Duplicate suppression. Identical concurrent searches (double-tap, two app widgets,
 *     web + app at once) share ONE job.
 *  4. Timeouts and cancellation. A queued waiter waits at most waitMs, and a closed
 *     client socket abandons its waiter. A job that has not started and has no waiters
 *     left is dropped instead of burning CPU for nobody. A job already running keeps
 *     going to fill the cache (that is what makes the NEXT request fast).
 */

import { resourceSnapshot } from './resourceGuard';

export type GateOutcome<T> =
  | { status: 'ok'; value: T; coalesced: boolean; waitedMs: number }
  | { status: 'timeout'; waitedMs: number }
  | { status: 'busy'; waitedMs: number }
  | { status: 'cancelled'; waitedMs: number }
  | { status: 'failed'; waitedMs: number };

interface Waiter<T> {
  resolve: (outcome: GateOutcome<T>) => void;
  timer: NodeJS.Timeout | null;
  settled: boolean;
}

interface Job<T = unknown> {
  key: string;
  enqueuedAt: number;
  startedAt: number;
  runner: () => Promise<T>;
  promise: Promise<T> | null;
  waiters: Waiter<T>[];
}

const envNum = (name: string, fallback: number): number => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const liveMaxConcurrency = (): number => Math.max(1, Math.floor(envNum('T1S_LIVE_MAX_CONCURRENCY', 16)));
export const liveQueueMax = (): number => Math.max(1, Math.floor(envNum('T1S_LIVE_QUEUE_MAX', 40)));
export const cpuTargetPercent = (): number => envNum('T1S_CPU_TARGET_PCT', 50);
const liveFloor = (): number => Math.max(1, Math.floor(envNum('T1S_LIVE_MIN_CONCURRENCY', 2)));
const defaultWaitMs = (): number => envNum('T1S_LIVE_QUEUE_WAIT_MS', 2500);

/** Rolling CPU percentage of THIS process (100 = one full core). */
let cpuPct = 0;
let lastUsage = process.cpuUsage();
let lastSampleAt = Date.now();
let sampler: NodeJS.Timeout | null = null;

export const cpuPercent = (): number => cpuPct;

/** Sample now (tests call this so they never depend on the timer). */
export function sampleCpu(now: number = Date.now()): number {
  const usage = process.cpuUsage(lastUsage);
  const wallMs = Math.max(1, now - lastSampleAt);
  const instant = ((usage.user + usage.system) / (wallMs * 1000)) * 100;
  cpuPct = cpuPct ? cpuPct * 0.6 + instant * 0.4 : instant;
  lastUsage = process.cpuUsage();
  lastSampleAt = now;
  return cpuPct;
}

export function startLoadGovernor(): void {
  if (sampler) return;
  lastUsage = process.cpuUsage();
  lastSampleAt = Date.now();
  sampler = setInterval(() => { try { sampleCpu(); } catch { /* ignore */ } }, 1000);
  sampler.unref?.();
}

export function stopLoadGovernor(): void {
  if (sampler) { clearInterval(sampler); sampler = null; }
}

/** How many live searches may run right now, given measured CPU. */
export function liveConcurrencyLimit(cpu: number = cpuPct): number {
  const base = liveMaxConcurrency();
  const target = cpuTargetPercent();
  const floor = Math.min(base, liveFloor());
  if (cpu <= target) return base;
  const scaled = Math.floor(base * (target / cpu));
  return Math.max(floor, Math.min(base, scaled));
}

const jobs = new Map<string, Job<any>>();
const counters = { abandonedJobs: 0, coalescedRequests: 0, timedOutRequests: 0, busyRequests: 0, failedJobs: 0, completedJobs: 0 };

export interface GovernorStats {
  active: number;
  queued: number;
  cpuPercent: number;
  limit: number;
  targetCpuPercent: number;
  maxConcurrency: number;
  queueMax: number;
  abandonedJobs: number;
  coalescedRequests: number;
  timedOutRequests: number;
  busyRequests: number;
  failedJobs: number;
  completedJobs: number;
}

export function governorStats(): GovernorStats {
  let active = 0;
  let queued = 0;
  for (const j of jobs.values()) { if (j.promise) active += 1; else queued += 1; }
  return {
    active, queued,
    cpuPercent: Math.round(cpuPct * 10) / 10,
    limit: liveConcurrencyLimit(),
    targetCpuPercent: cpuTargetPercent(),
    maxConcurrency: liveMaxConcurrency(),
    queueMax: liveQueueMax(),
    ...counters,
  };
}

function settle<T>(waiter: Waiter<T>, outcome: GateOutcome<T>): void {
  if (waiter.settled) return;
  waiter.settled = true;
  if (waiter.timer) { clearTimeout(waiter.timer); waiter.timer = null; }
  waiter.resolve(outcome);
}

function activeCount(): number {
  let n = 0;
  for (const j of jobs.values()) if (j.promise) n += 1;
  return n;
}

function queuedJobs(): Job<any>[] {
  return [...jobs.values()].filter((j) => !j.promise).sort((a, b) => a.enqueuedAt - b.enqueuedAt);
}

/** Drop a queued job nobody is waiting for any more (frees a slot, saves CPU). */
function dropIfUnwanted(job: Job<any>): boolean {
  if (job.promise) return false;
  if (job.waiters.some((w) => !w.settled)) return false;
  jobs.delete(job.key);
  counters.abandonedJobs += 1;
  return true;
}

function startJob(job: Job<any>): void {
  if (job.promise) return;
  job.startedAt = Date.now();
  job.promise = (async () => {
    try {
      return await job.runner();
    } finally {
      if (jobs.get(job.key) === job) jobs.delete(job.key);
    }
  })();
  job.promise.then(
    () => { counters.completedJobs += 1; pump(); },
    () => { counters.failedJobs += 1; pump(); },
  );
  for (const w of job.waiters) {
    job.promise.then(
      (value) => settle(w, { status: 'ok', value, coalesced: true, waitedMs: Date.now() - job.enqueuedAt }),
      () => settle(w, { status: 'failed', waitedMs: Date.now() - job.enqueuedAt }),
    );
  }
}

/** Start queued jobs while capacity allows. */
function pump(): void {
  for (let guard = 0; guard < 500; guard++) {
    if (activeCount() >= liveConcurrencyLimit()) return;
    const next = queuedJobs()[0];
    if (!next) return;
    if (!next.waiters.some((w) => !w.settled)) { if (dropIfUnwanted(next)) continue; }
    startJob(next);
  }
}

function attach<T>(job: Job<T>, opts: GateOptions, enqueuedAt: number): Promise<GateOutcome<T>> {
  return new Promise<GateOutcome<T>>((resolve) => {
    const waiter: Waiter<T> = { resolve, timer: null, settled: false };
    job.waiters.push(waiter);
    const finish = (outcome: GateOutcome<T>) => { settle(waiter, outcome); if (dropIfUnwanted(job as Job<any>)) pump(); };
    if (opts.signal?.aborted) return finish({ status: 'cancelled', waitedMs: 0 });
    // A waiter may walk away even when the job it joined is already running: the work
    // continues for the remaining waiters (and fills the cache), this caller just stops
    // waiting for it.
    opts.signal?.addEventListener('abort', () => finish({ status: 'cancelled', waitedMs: Date.now() - enqueuedAt }), { once: true });
    if (job.promise) {
      job.promise.then(
        (value) => settle(waiter, { status: 'ok', value, coalesced: true, waitedMs: Date.now() - enqueuedAt }),
        () => settle(waiter, { status: 'failed', waitedMs: Date.now() - enqueuedAt }),
      );
      return;
    }
    const waitMs = Math.max(50, opts.waitMs ?? defaultWaitMs());
    waiter.timer = setTimeout(() => {
      counters.timedOutRequests += 1;
      finish({ status: 'timeout', waitedMs: Date.now() - enqueuedAt });
    }, waitMs);
    waiter.timer.unref?.();
    opts.signal?.addEventListener('abort', () => finish({ status: 'cancelled', waitedMs: Date.now() - enqueuedAt }), { once: true });
  });
}

export interface GateOptions {
  /** How long a queued request may wait before answering from its own cache. */
  waitMs?: number;
  /** Client socket closed -> abandon this waiter (other waiters keep the work). */
  signal?: AbortSignal;
}

/**
 * Run `work` under the governor. `key` identifies the search: identical concurrent
 * calls share a single job.
 */
export async function runGated<T>(key: string, work: () => Promise<T>, opts: GateOptions = {}): Promise<GateOutcome<T>> {
  const enqueuedAt = Date.now();

  const existing = jobs.get(key) as Job<T> | undefined;
  if (existing) {
    counters.coalescedRequests += 1;
    if (existing.promise) return attach(existing, opts, enqueuedAt);
    return attach(existing, opts, enqueuedAt);
  }

  const job: Job<T> = { key, enqueuedAt, startedAt: 0, runner: work, promise: null, waiters: [] };

  if (activeCount() < liveConcurrencyLimit()) {
    jobs.set(key, job as Job<any>);
    startJob(job as Job<any>);
    try {
      const value = await job.promise!;
      return { status: 'ok', value, coalesced: false, waitedMs: Date.now() - enqueuedAt };
    } catch {
      return { status: 'failed', waitedMs: Date.now() - enqueuedAt };
    }
  }

  if (queuedJobs().length >= liveQueueMax()) {
    counters.busyRequests += 1;
    return { status: 'busy', waitedMs: 0 };
  }

  jobs.set(key, job as Job<any>);
  const waiting = attach(job, opts, enqueuedAt);
  pump();
  return waiting;
}

/** Test/ops hook: clear all state (does not touch already-running work). */
export function resetLoadGovernor(): void {
  for (const job of jobs.values()) for (const w of job.waiters) settle(w, { status: 'cancelled', waitedMs: 0 });
  jobs.clear();
  cpuPct = 0;
  lastUsage = process.cpuUsage();
  lastSampleAt = Date.now();
  counters.abandonedJobs = 0; counters.coalescedRequests = 0; counters.timedOutRequests = 0;
  counters.busyRequests = 0; counters.failedJobs = 0; counters.completedJobs = 0;
}

/** One pressure number (0-100) for callers that want a single verdict. */
export function pressurePercent(): number {
  const snap: any = resourceSnapshot();
  const cpu = Math.max(cpuPct, Number(snap?.cpuPercent) || 0);
  return Math.min(100, Math.round(cpu));
}
