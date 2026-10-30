/**
 * RESOURCE GOVERNOR (owner 29 Oct: Hostinger put the whole ACCOUNT into its
 * protective reCAPTCHA/CPU mode — "excessive CPU, memory or process usage" — so
 * every mobile request was 403'd or TCP-reset, for every vertical. Hostinger
 * clears that state on its own only after the usage returns to normal, so the app
 * itself must never be the thing that burns the account down.)
 *
 * Two jobs:
 *
 * 1. BACKGROUND THROTTLE. Warm passes, recovery probes, pruning and affiliate
 *    sync are all optional comfort work: if the box is already hot, skipping one
 *    cycle costs nothing (searches still serve from cache and live acquisition
 *    still runs for real users) and it is exactly what keeps the account out of
 *    Hostinger's penalty box. User requests are NEVER gated here.
 *
 * 2. RESTART-STORM GUARD. The event-loop watchdog exits the process to force an
 *    hPanel auto-restart when the loop wedges. If the wedge is caused by boot
 *    warm itself, that becomes an endless restart storm — the classic "runaway
 *    Node process" signal. Boots are counted in a small file; when the app is
 *    restarting too often it boots QUIET (serves traffic, runs no background
 *    work) until the clock calms down.
 *
 * Emergency switches the owner can set in hPanel and restart with:
 *   T1S_BACKGROUND=off   -> no background warmers/probes at all (site still serves)
 *   T1S_QUIET=1          -> same thing
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import v8 from 'node:v8';
import { settings, dataDir } from './settings';
import { log } from './logger';

export interface ResourceSnapshot {
  cpuPct: number;          // this process, % of ONE core, smoothed
  loadPerCore: number;     // 1-min load average / vCPU
  heapPct: number;         // JS heap used / limit
  rssMb: number;
  pressure: 'ok' | 'high' | 'critical';
  backgroundAllowed: boolean;
  reason: string;
}

const SAMPLE_MS = 15_000;
const CPU_HIGH = 70;        // % of one core, this process only
const CPU_CRITICAL = 88;
const LOAD_HIGH = 1.5;      // per vCPU
const LOAD_CRITICAL = 3;
const HEAP_HIGH = 0.85;

let cpuPct = 0;
let pressure: ResourceSnapshot['pressure'] = 'ok';
let sampling = false;
let lastCpu = process.cpuUsage();
let lastCpuAt = Date.now();
let lastReason = 'not sampled yet';

const envOff = (): boolean => {
  const v = String(process.env.T1S_BACKGROUND || process.env.T1S_QUIET || '').trim().toLowerCase();
  return v === 'off' || v === '0' || v === 'false' || v === '1' || v === 'on';
};

const heapPct = (): number => {
  const m = process.memoryUsage();
  const limit = (v8.getHeapStatistics?.().heap_size_limit as number) || 0;
  return limit > 0 ? m.heapUsed / limit : 0;
};

function sample(): void {
  const now = Date.now();
  const usage = process.cpuUsage(lastCpu);
  const elapsedMs = Math.max(1, now - lastCpuAt);
  const instant = ((usage.user + usage.system) / 1000 / elapsedMs) * 100;
  // Smooth so one heavy search does not flap the governor.
  cpuPct = cpuPct === 0 ? instant : cpuPct * 0.6 + instant * 0.4;
  lastCpu = process.cpuUsage();
  lastCpuAt = now;

  const cores = Math.max(1, os.cpus().length);
  const loadPerCore = os.loadavg()[0] / cores;
  const heap = heapPct();

  if (cpuPct >= CPU_CRITICAL || loadPerCore >= LOAD_CRITICAL || heap >= HEAP_HIGH) {
    pressure = 'critical';
    lastReason = `cpu ${cpuPct.toFixed(0)}% load/core ${loadPerCore.toFixed(2)} heap ${(heap * 100).toFixed(0)}%`;
  } else if (cpuPct >= CPU_HIGH || loadPerCore >= LOAD_HIGH) {
    pressure = 'high';
    lastReason = `cpu ${cpuPct.toFixed(0)}% load/core ${loadPerCore.toFixed(2)} heap ${(heap * 100).toFixed(0)}%`;
  } else {
    pressure = 'ok';
    lastReason = `cpu ${cpuPct.toFixed(0)}% load/core ${loadPerCore.toFixed(2)} heap ${(heap * 100).toFixed(0)}%`;
  }
}

/** Start sampling once (cheap, unref'd, safe in every worker). */
export function startResourceGovernor(): void {
  if (sampling) return;
  sampling = true;
  setInterval(sample, SAMPLE_MS).unref();
  log.info('Governor', 'Resource governor armed (background work yields above 70% CPU / 1.5 load-per-core)');
}

export const resourceSnapshot = (): ResourceSnapshot => {
  if (lastReason === 'not sampled yet') {
    // A snapshot asked for before the first tick must still tell the truth.
    try { sample(); } catch { /* keep the defaults */ }
  }
  return {
    cpuPct: Math.round(cpuPct),
    loadPerCore: Math.round((os.loadavg()[0] / Math.max(1, os.cpus().length)) * 100) / 100,
    heapPct: Math.round(heapPct() * 100),
    rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    pressure,
    backgroundAllowed: backgroundAllowed(),
    reason: lastReason,
  };
};

/**
 * May this process run OPTIONAL background work right now?
 * User-facing acquisition never asks this question.
 */
export function backgroundAllowed(): boolean {
  if (envOff()) return false;
  if (quietBoot()) return false;
  if (deleteHoldActive()) return false;
  return pressure !== 'critical';
}

/**
 * Run optional background work only when the box can afford it.
 * Returns true when the work actually ran (so callers can skip their own logging).
 */
export async function guardBackground<T>(
  name: string,
  fn: () => T | Promise<T>,
): Promise<{ ran: boolean; value?: T }> {
  if (!backgroundAllowed()) {
    log.info('Governor', `Background "${name}" skipped — ${envOff() ? 'T1S_BACKGROUND=off' : quietBoot() ? 'quiet boot (restart storm)' : lastReason}`);
    return { ran: false };
  }
  return { ran: true, value: await fn() };
}

// ---------------------------------------------------------------------------
// Restart-storm guard
// ---------------------------------------------------------------------------

const BOOT_FILE = () => path.join(dataDir, 'boots.json');
const STORM_WINDOW_MS = 30 * 60_000;
const STORM_BOOTS = 4;
const QUIET_HOLD_MS = 30 * 60_000;

interface BootLog { boots: number[]; quietUntil?: number }

function readBoots(): BootLog {
  try {
    const raw = JSON.parse(fs.readFileSync(BOOT_FILE(), 'utf8'));
    return { boots: Array.isArray(raw?.boots) ? raw.boots.filter((n: any) => Number.isFinite(n)) : [], quietUntil: Number(raw?.quietUntil) || undefined };
  } catch { return { boots: [] }; }
}

function writeBoots(logged: BootLog): void {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(BOOT_FILE(), JSON.stringify(logged));
  } catch { /* non-fatal: the guard degrades to off */ }
}

/** Is this process in quiet boot (too many restarts recently)? */
export function quietBoot(now: number = Date.now()): boolean {
  const logged = readBoots();
  return Boolean(logged.quietUntil && now < logged.quietUntil);
}

/**
 * Record this boot. If the app restarted STORM_BOOTS times inside
 * STORM_WINDOW_MS, enter quiet boot: serve traffic, run no background work, so a
 * restart loop can never look like a runaway process to the host.
 */
export function noteBoot(now: number = Date.now()): { quiet: boolean; boots: number } {
  const logged = readBoots();
  logged.boots = logged.boots.filter((t) => now - t < STORM_WINDOW_MS);
  logged.boots.push(now);
  const storm = logged.boots.length >= STORM_BOOTS;
  if (storm) logged.quietUntil = now + QUIET_HOLD_MS;
  writeBoots(logged);
  if (storm) {
    log.error('Governor', `RESTART STORM: ${logged.boots.length} boots in ${STORM_WINDOW_MS / 60_000} min — background duties OFF for ${QUIET_HOLD_MS / 60_000} min so the host stops seeing a runaway process`);
  }
  return { quiet: storm, boots: logged.boots.length };
}

// ---------------------------------------------------------------------------
// Delete-hold (owner pressing "delete/stop" or a shrink in progress)
// ---------------------------------------------------------------------------

const HOLD_FILE = () => path.join(dataDir, 'background-hold.json');

export function startDeleteHold(ms: number, why = 'owner stop'): void {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(HOLD_FILE(), JSON.stringify({ until: Date.now() + ms, why }));
    log.warn('Governor', `Background duties paused for ${Math.round(ms / 60_000)} min (${why})`);
  } catch { /* ignore */ }
}

export function deleteHoldActive(now: number = Date.now()): boolean {
  try {
    const raw = JSON.parse(fs.readFileSync(HOLD_FILE(), 'utf8'));
    return Number(raw?.until) > now;
  } catch { return false; }
}

export function clearDeleteHold(): void {
  try { fs.unlinkSync(HOLD_FILE()); } catch { /* already gone */ }
}

/** True when MySQL is configured (the lease below needs it). */
export const hasSharedDb = (): boolean => Boolean(settings.mysqlUrl);
