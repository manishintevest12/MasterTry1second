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
}

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

function loadLegs(): ProxyLeg[] {
  const raw = process.env.T1S_PROXY_LIST || '';
  if (raw === signature) return legs;
  signature = raw;
  const seen = new Set<string>();
  const next: ProxyLeg[] = [];
  for (const part of raw.split(/[\s,;]+/)) {
    const url = normalize(part);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const existing = legs.find((l) => l.url === url);
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
export function nextProxy(skip: Set<string> = new Set()): ProxyLeg | null {
  const pool = loadLegs().filter((l) => !skip.has(l.url));
  if (!pool.length) return null;
  const now = Date.now();
  const healthy = pool.filter((l) => l.parkedUntil <= now);
  const ordered = (healthy.length ? healthy : pool.slice().sort((a, b) => a.parkedUntil - b.parkedUntil));
  const leg = ordered[cursor % ordered.length];
  cursor = (cursor + 1) % Math.max(1, loadLegs().length);
  return leg || null;
}

export function noteProxyResult(url: string, result: { ok: boolean; status?: number; gated?: boolean; error?: string }): void {
  const leg = loadLegs().find((l) => l.url === url);
  if (!leg) return;
  leg.usedAt = Date.now();
  leg.lastStatus = result.status || 0;
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
  }>;
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
    legs: legs.map((l) => ({
      label: l.label,
      ok: l.ok,
      fails: l.fails,
      streak: l.streak,
      parkedForSec: l.parkedUntil > now ? Math.ceil((l.parkedUntil - now) / 1000) : 0,
      lastStatus: l.lastStatus,
      lastError: l.lastError,
      usedSecAgo: l.usedAt ? Math.round((now - l.usedAt) / 1000) : null,
    })),
  };
}

/** Test seam: drop all state (pool is rebuilt from env on next use). */
export function resetRotationForTests(): void {
  legs = [];
  cursor = 0;
  signature = '';
}
