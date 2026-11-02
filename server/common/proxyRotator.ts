/**
 * Egress rotation pool (owner 31 Oct: "inko rotational proxy v bna do jiss se ye finish v naa
 * ho kabhi").
 *
 * WHY
 * The scrape pipeline dies "finished" in one of two ways: a source starts gating our single
 * Hostinger IP, or one relay leg stops answering. Both are IP/reputation problems, so the cure
 * is never a smarter parser — it is trying the same honest request from a different door.
 *
 * WHAT THIS POOLS
 *  - `T1S_PROXY_LIST`: real proxies, comma/space separated, any of
 *      http://user:pass@host:port   https://user:pass@host:port   socks5://host:port
 *    They are handed to curl_cffi (pyfetch.py `proxy`), so TLS impersonation is preserved —
 *    this is the leg that actually beats IP gating.
 *  - The existing relay legs (AWS Lambda, Cloudflare Worker) stay where they are in
 *    sources/edgeRelay.ts; this pool is tried BEFORE them, because a browser-TLS proxy is
 *    strictly more capable than a relay that loses the fingerprint.
 *
 * HOW IT ROTATES (never "finish")
 *  - Round-robin order, so load and reputation spread instead of hammering one exit.
 *  - Every leg is scored: a gate (403/429/challenge) or transport failure parks it with a
 *    growing cool-down (60s -> 5m -> 20m); one success resets the score. A leg that never
 *    worked parks for an hour rather than poisoning every request.
 *  - Selection skips parked legs, so a request always goes somewhere healthy; when every leg
 *    is parked the oldest-parked one is used anyway (better a bad exit than no answer).
 *  - Health is exposed at /api/admin/proxy-pool (admin-only) so the owner can see the pool.
 *
 * Kill switch: T1S_PROXY_DISABLE=1 -> rotation off, behaviour is exactly as before this file.
 * Tuning: T1S_PROXY_TRIES (default 2) rotated retries per request on a gate.
 */

import fs from 'fs';
import path from 'path';
export interface ProxyLeg {
  url: string;
  /** Password masked, for logs and the admin view. */
  label: string;
  ok: number;
  fails: number;
  /** Consecutive failures, drives the cool-down ladder. */
  streak: number;
  /** Epoch ms until which this leg is skipped. */
  parkedUntil: number;
  usedAt: number;
  lastError: string;
  lastStatus: number;
  /** EWMA of measured round-trip ms through this exit (0 = never measured). */
  latencyMs: number;
  /** How many real attempts fed latencyMs. */
  samples: number;
  /** Attempts whose measured time missed the budget (kept for the admin view). */
  slow: number;
}

/**
 * OWNER 1 Nov ("aisa proxy dhoondo jo 500ms se kam de, phir uska rotation banao"):
 * a leg is only preferred when its measured round-trip is inside this budget.
 * Measurement comes from REAL traffic (self-healing, no probe traffic); legs that
 * never answered fast are still usable as a last resort so a slow pool can never
 * turn a working source into zero rows.
 */
const LATENCY_BUDGET_MS = Math.max(120, Number(process.env.T1S_PROXY_MAX_LATENCY_MS || 500));
const EWMA_ALPHA = 0.4;

const PARK_LADDER_MS = [60_000, 300_000, 1_200_000];
const HOPELESS_PARK_MS = 3_600_000;
const HOPELESS_FAILS = 5;
const MAX_LEGS = 24;

function maskProxy(url: string): string {
  try {
    const u = new URL(url);
    if (u.username || u.password) {
      u.username = u.username ? `${u.username.slice(0, 2)}***` : '';
      u.password = u.password ? '***' : '';
    }
    return u.toString().replace(/\/$/, '');
  } catch {
    return url.replace(/\/\/[^@/]*@/, '//***@');
  }
}

function normalize(entry: string): string | null {
  const raw = entry.trim();
  if (!raw) return null;
  // Accept host:port (assume http), and reject anything that is not a proxy URL.
  const withScheme = /^[a-z0-9+.-]+:\/\//i.test(raw) ? raw : `http://${raw}`;
  try {
    const u = new URL(withScheme);
    if (!u.hostname || !u.port) return null;
    if (!/^(https?|socks5h?|socks4a?):$/.test(u.protocol)) return null;
    return withScheme;
  } catch {
    return null;
  }
}

let legs: ProxyLeg[] = [];
let cursor = 0;
let signature = '';

/**
 * Owner 1 Nov: a validated pool written by proxyDiscovery (exits measured under the
 * latency budget) is used when T1S_PROXY_LIST is not set, so the sub-500ms sweep has
 * an effect without the owner editing any env var. Read locally (no import) to keep
 * the rotator free of a cycle: discovery -> cffiFetch -> rotator.
 */
function discoveredLegs(): Array<{ url: string; ms: number }> {
  try {
    const file = path.join(process.cwd(), 'data', 'proxy-pool.json');
    if (!fs.existsSync(file)) return [];
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    const budget = Number(process.env.T1S_PROXY_MAX_LATENCY_MS || 500);
    const rows = Array.isArray(raw?.proxies) ? raw.proxies : [];
    return rows
      .map((r: any) => ({ url: normalize(String(r?.url || '')), ms: Number(r?.ms || 0) }))
      .filter((r: { url: string; ms: number }) => !!r.url && Number.isFinite(r.ms) && r.ms > 0 && r.ms <= budget);
  } catch {
    return [];
  }
}

function loadLegs(): ProxyLeg[] {
  const envRaw = process.env.T1S_PROXY_LIST || '';
  const fromFile = envRaw ? [] : discoveredLegs();
  const raw = envRaw || fromFile.map((f) => f.url).join(',');
  if (raw === signature) return legs;
  signature = raw;
  const seen = new Set<string>();
  const next: ProxyLeg[] = [];
  for (const part of raw.split(/[\s,;]+/)) {
    const url = normalize(part);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const existing = legs.find((l) => l.url === url);
    const preset = fromFile.find((f) => f.url === url);
    next.push(existing ?? {
      url,
      label: maskProxy(url),
      ok: 0,
      fails: 0,
      streak: 0,
      parkedUntil: 0,
      usedAt: 0,
      lastError: '',
      lastStatus: 0,
      // A discovered leg starts with the latency the sweep actually measured.
      latencyMs: preset ? Math.round(preset.ms) : 0,
      samples: preset ? 1 : 0,
      slow: 0,
    });
    if (next.length >= MAX_LEGS) break;
  }
  legs = next;
  cursor = 0;
  return legs;
}

export function rotationDisabled(): boolean {
  return /^(1|true|yes|on)$/i.test(process.env.T1S_PROXY_DISABLE || '');
}

export function rotationTries(): number {
  const n = Number(process.env.T1S_PROXY_TRIES);
  if (!Number.isFinite(n)) return 2;
  return Math.max(0, Math.min(6, Math.floor(n)));
}

export function rotationPoolSize(): number {
  return loadLegs().length;
}

export function rotationEnabled(): boolean {
  return !rotationDisabled() && rotationPoolSize() > 0;
}

/**
 * Next leg to try. `skip` holds legs already attempted for this request. Parked legs are
 * skipped while any healthy one remains; if every leg is parked the longest-parked is reused.
 */
export function proxyLatencyBudgetMs(): number {
  return LATENCY_BUDGET_MS;
}

/** True when a leg has been measured at or under the budget. */
export function withinBudget(leg: ProxyLeg): boolean {
  return leg.samples > 0 && leg.latencyMs > 0 && leg.latencyMs <= LATENCY_BUDGET_MS;
}

export function nextProxy(skip: Set<string> = new Set()): ProxyLeg | null {
  const pool = loadLegs().filter((l) => !skip.has(l.url));
  if (!pool.length) return null;
  const now = Date.now();
  const healthy = pool.filter((l) => l.parkedUntil <= now);
  const usable = healthy.length ? healthy : pool.slice().sort((a, b) => a.parkedUntil - b.parkedUntil);
  // Fast lane first: measured-in-budget legs ordered fastest-first with a rotating
  // cursor so we still spread load across them; unmeasured legs next (they get their
  // first sample from real traffic); slow legs only as the last resort.
  const fast = usable.filter((l) => withinBudget(l)).sort((a, b) => a.latencyMs - b.latencyMs);
  const unmeasured = usable.filter((l) => l.samples === 0);
  const slow = usable.filter((l) => l.samples > 0 && !withinBudget(l));
  const ring = (arr: ProxyLeg[]): ProxyLeg[] => (arr.length ? arr.slice(cursor % arr.length).concat(arr.slice(0, cursor % arr.length)) : []);
  const ordered = [...ring(fast), ...ring(unmeasured), ...ring(slow)];
  const leg = ordered[0] || null;
  cursor = (cursor + 1) % Math.max(1, loadLegs().length);
  return leg;
}

export function noteProxyResult(
  url: string,
  result: { ok: boolean; status?: number; gated?: boolean; error?: string; ms?: number },
): void {
  const leg = loadLegs().find((l) => l.url === url);
  if (!leg) return;
  leg.usedAt = Date.now();
  leg.lastStatus = result.status || 0;
  // Latency is measured on REAL requests only: a fast exit is proven by the traffic
  // it actually carried, and a gated/timeout answer never counts as a fast sample.
  const ms = Number(result.ms);
  if (Number.isFinite(ms) && ms > 0) {
    if (leg.latencyMs > 0) leg.latencyMs = Math.round(leg.latencyMs * (1 - EWMA_ALPHA) + ms * EWMA_ALPHA);
    else leg.latencyMs = Math.round(ms);
    leg.samples += 1;
    if (ms > LATENCY_BUDGET_MS) leg.slow += 1;
  }
  if (result.ok && !result.gated) {
    leg.ok += 1;
    leg.streak = 0;
    leg.parkedUntil = 0;
    leg.lastError = '';
    return;
  }
  leg.fails += 1;
  leg.streak += 1;
  leg.lastError = (result.error || (result.gated ? `gated ${result.status || ''}` : `status ${result.status || ''}`)).slice(0, 160);
  if (leg.ok === 0 && leg.streak >= HOPELESS_FAILS) {
    leg.parkedUntil = Date.now() + HOPELESS_PARK_MS;
    return;
  }
  const step = PARK_LADDER_MS[Math.min(leg.streak - 1, PARK_LADDER_MS.length - 1)];
  leg.parkedUntil = Date.now() + step;
}

export interface ProxyPoolView {
  enabled: boolean;
  tries: number;
  size: number;
  healthy: number;
  parked: number;
  legs: Array<{
    label: string;
    ok: number;
    fails: number;
    streak: number;
    parkedForSec: number;
    lastStatus: number;
    lastError: string;
    usedSecAgo: number | null;
    latencyMs: number;
    samples: number;
    withinBudgetMs: boolean;
    slow: number;
  }>;
  latencyBudgetMs: number;
  fast: number;
}

export function proxyPoolStatus(): ProxyPoolView {
  loadLegs();
  const now = Date.now();
  return {
    enabled: rotationEnabled(),
    tries: rotationTries(),
    size: legs.length,
    healthy: legs.filter((l) => l.parkedUntil <= now).length,
    parked: legs.filter((l) => l.parkedUntil > now).length,
    latencyBudgetMs: LATENCY_BUDGET_MS,
    fast: legs.filter((l) => l.parkedUntil <= now && withinBudget(l)).length,
    legs: legs.map((l) => ({
      label: l.label,
      ok: l.ok,
      fails: l.fails,
      streak: l.streak,
      parkedForSec: l.parkedUntil > now ? Math.ceil((l.parkedUntil - now) / 1000) : 0,
      lastStatus: l.lastStatus,
      lastError: l.lastError,
      usedSecAgo: l.usedAt ? Math.round((now - l.usedAt) / 1000) : null,
      latencyMs: l.latencyMs,
      samples: l.samples,
      withinBudgetMs: withinBudget(l),
      slow: l.slow,
    })),
  };
}

/** Test seam: drop all state (pool is rebuilt from env on next use). */
export function resetRotationForTests(): void {
  legs = [];
  cursor = 0;
  signature = '';
}
