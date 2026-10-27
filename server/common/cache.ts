/**
 * Three-tier cache (Section 8):
 *   L1: in-process memory (cache-aside, request coalescing, stampede protection)
 *   L2: Redis — ioredis/TCP via REDIS_URL (KVM4), or Upstash REST over HTTPS via
 *       UPSTASH_REDIS_REST_URL/_TOKEN (works on Hostinger shared hosting). Skipped otherwise.
 *   L3: MySQL catalogue (owned by catalogueService, not this module)
 *
 * Redis is NEVER the permanent source of truth — only TTL'd derived data lives here.
 */
import crypto from 'crypto';
import { settings } from './settings';
import { log } from './logger';

interface L1Entry { value: unknown; expiresAt: number; staleUntil: number }

const l1 = new Map<string, L1Entry>();
const inflight = new Map<string, Promise<unknown>>();
const locks = new Set<string>();

// ---- Optional Redis (dynamic import so missing module/URL never breaks the app) ----
let redis: any = null;
let redisTried = false;

async function getRedis(): Promise<any> {
  if (redisTried) return redis;
  redisTried = true;
  if (!settings.redisUrl) return null;
  try {
    const mod = await import('ioredis');
    const Redis = (mod as any).default;
    redis = new Redis(settings.redisUrl, { maxRetriesPerRequest: 2, lazyConnect: false });
    redis.on('error', (e: Error) => log.warn('Cache', 'Redis error', { error: e.message }));
    log.info('Cache', 'L2 Redis connected');
  } catch (e: any) {
    log.warn('Cache', 'L2 Redis unavailable, running with L1 only', { error: e.message });
    redis = null;
  }
  return redis;
}

// ---- Upstash REST L2 (HTTPS — the only Redis that works on shared hosting) ----
const MAX_L2_BYTES = 900 * 1024; // keep very large responses L1-only (Upstash entry limits)

async function restGet(key: string): Promise<string | null> {
  if (!settings.redisRestUrl) return null;
  try {
    const r = await fetch(`${settings.redisRestUrl}/get/${encodeURIComponent(key)}`, {
      headers: settings.redisRestToken ? { Authorization: `Bearer ${settings.redisRestToken}` } : {},
    });
    if (!r.ok) return null;
    const j = await r.json();
    return typeof j?.result === 'string' ? j.result : null;
  } catch { return null; }
}

async function restSet(key: string, value: string, ttlSec: number): Promise<void> {
  if (!settings.redisRestUrl) return;
  try {
    await fetch(settings.redisRestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(settings.redisRestToken ? { Authorization: `Bearer ${settings.redisRestToken}` } : {}),
      },
      body: JSON.stringify(['SET', key, value, 'EX', Math.max(60, ttlSec)]),
    });
  } catch { /* non-fatal */ }
}

/** The single read path L2 uses: TCP Redis first, then REST, else null. */
async function l2Get(key: string): Promise<string | null> {
  const r = await getRedis();
  if (r) {
    try { const v = await r.get(`t1s:${key}`); if (v) return v as string; } catch { /* fall through */ }
  }
  return restGet(`t1s:${key}`);
}

/** The single write path L2 uses: writes to whichever backend(s) are configured. */
async function l2Del(key: string): Promise<void> {
  const r = await getRedis();
  if (r) { try { await r.del(`t1s:${key}`); } catch { /* non-fatal */ } }
  if (settings.redisRestUrl) {
    try {
      await fetch(`${settings.redisRestUrl}/del/${encodeURIComponent(`t1s:${key}`)}`, {
        headers: settings.redisRestToken ? { Authorization: `Bearer ${settings.redisRestToken}` } : {},
      });
    } catch { /* non-fatal */ }
  }
}

async function l2Set(key: string, value: string, ttlSec: number): Promise<void> {
  if (value.length > MAX_L2_BYTES) return; // L1 still holds it; skip oversized L2 payloads
  const r = await getRedis();
  if (r) { try { await r.set(`t1s:${key}`, value, 'EX', ttlSec); } catch { /* non-fatal */ } }
  if (!r || settings.redisRestUrl) await restSet(`t1s:${key}`, value, ttlSec);
}

/** Cache-aside read WITHOUT a loader (search responses are written by cachePut after acquisition). */
export async function cacheGet<T>(key: string): Promise<{ value: T | null; fresh: boolean; stale: boolean }> {
  const now = Date.now();
  const l1e = l1.get(key);
  if (l1e && l1e.expiresAt > now) return { value: l1e.value as T, fresh: true, stale: false };
  if (l1e && l1e.staleUntil > now) return { value: l1e.value as T, fresh: false, stale: true };
  // L2 promotion into L1 (caller supplies TTL via cachePut on the next refresh)
  const raw = await l2Get(key);
  if (raw) {
    try { return { value: JSON.parse(raw) as T, fresh: false, stale: true }; } catch { return { value: null, fresh: false, stale: false }; }
  }
  return { value: null, fresh: false, stale: false };
}

/** Explicit cache write (L1 + L2). staleSec defaults to 3x TTL. */
export function cachePut(key: string, value: unknown, ttlSec: number, staleSec?: number) {
  const stale = (staleSec ?? ttlSec * 3) * 1000;
  l1.set(key, { value, expiresAt: Date.now() + ttlSec * 1000, staleUntil: Date.now() + stale });
  const payload = JSON.stringify(value);
  void l2Set(key, payload, ttlSec);
}

/** Drop one entry from L1 and L2 (used to evict poisoned snapshots immediately). */
export function cacheDel(key: string): void {
  l1.delete(key);
  inflight.delete(key);
  void l2Del(key);
}

/**
 * Stale-while-revalidate for cacheGet/cachePut users: refresh at most once per key
 * concurrently (process-local inflight map + optional Redis lock), fire-and-forget.
 * Never throws into the request path.
 */
export function revalidateInBackground(key: string, ttlSec: number, refresh: () => Promise<unknown>) {
  if (inflight.has(key)) return;
  const p = (async () => {
    const done = await withLock(`swr:${key}`, async () => {
      const v = await refresh();
      if (v !== undefined && v !== null) cachePut(key, v, ttlSec);
      return true;
    });
    return done;
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  p.catch(() => undefined); // swallow background errors
}

export async function initCache() {
  await getRedis();
  if (settings.redisRestUrl && !settings.redisUrl) log.info('Cache', 'L2 Upstash REST connected (shared-hosting mode)');
}

// ---- Cache key builder (Section 8: keys include every offer-affecting dimension) ----
export function buildCacheKey(parts: Record<string, string | number | undefined>): string {
  const normalized = Object.keys(parts).sort().map((k) => `${k}=${parts[k] ?? ''}`).join('|');
  return crypto.createHash('sha1').update(normalized).digest('hex').slice(0, 32);
}

/**
 * Cache-aside get with stale-while-revalidate + request coalescing (stampede protection).
 * `loader` runs at most once per key concurrently; other callers await the same promise.
 */
export async function cached<T>(
  key: string,
  ttlSec: number,
  loader: () => Promise<T>,
  opts: { staleWhileRevalidateSec?: number; allowStale?: boolean } = {},
): Promise<{ value: T | null; fresh: boolean; stale: boolean }> {
  const now = Date.now();
  const l1e = l1.get(key);

  if (l1e && l1e.expiresAt > now) {
    return { value: l1e.value as T, fresh: true, stale: false };
  }
  if (l1e && opts.allowStale !== false && l1e.staleUntil > now) {
    // stale-while-revalidate: serve stale, refresh in background
    if (!inflight.has(key)) {
      inflight.set(key, loader().then((v) => {
        l1.set(key, { value: v, expiresAt: Date.now() + ttlSec * 1000, staleUntil: Date.now() + (opts.staleWhileRevalidateSec ?? ttlSec * 3) * 1000 });
        return v;
      }).finally(() => inflight.delete(key)));
    }
    return { value: l1e.value as T, fresh: false, stale: true };
  }

  // Coalesce concurrent loads
  if (inflight.has(key)) {
    const v = (await inflight.get(key)) as T;
    return { value: v, fresh: true, stale: false };
  }

  const p = (async () => {
    // L2 check
    const r = await getRedis();
    if (r) {
      try {
        const raw = await r.get(`t1s:${key}`);
        if (raw) {
          const value = JSON.parse(raw);
          l1.set(key, { value, expiresAt: now + ttlSec * 1000, staleUntil: now + (opts.staleWhileRevalidateSec ?? ttlSec * 3) * 1000 });
          return value as T;
        }
      } catch { /* fall through to loader */ }
    }
    const value = await loader();
    l1.set(key, { value, expiresAt: Date.now() + ttlSec * 1000, staleUntil: Date.now() + (opts.staleWhileRevalidateSec ?? ttlSec * 3) * 1000 });
    if (r) {
      try { await r.set(`t1s:${key}`, JSON.stringify(value), 'EX', ttlSec); } catch { /* non-fatal */ }
    }
    return value;
  })();

  inflight.set(key, p);
  try {
    const v = (await p) as T;
    return { value: v, fresh: true, stale: false };
  } finally {
    inflight.delete(key);
  }
}

export function invalidate(key: string) {
  l1.delete(key);
  void (async () => {
    const r = await getRedis();
    if (r) { try { await r.del(`t1s:${key}`); } catch { /* non-fatal */ } }
  })();
}

/** Distributed lock (spin-safe, single attempt + short retry loop) for refresh coordination. */
export async function withLock<T>(name: string, fn: () => Promise<T>, opts: { ttlMs?: number } = {}): Promise<T | null> {
  if (locks.has(name)) return null;
  const r = await getRedis();
  if (r) {
    const token = crypto.randomUUID();
    const ok = await r.set(`lock:${name}`, token, 'PX', opts.ttlMs ?? 30000, 'NX');
    if (!ok) return null;
    locks.add(name);
    try {
      return await fn();
    } finally {
      locks.delete(name);
      await r.eval("if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end", 1, `lock:${name}`, token).catch(() => undefined);
    }
  }
  locks.add(name);
  try {
    return await fn();
  } finally {
    locks.delete(name);
  }
}

export function cacheStats() {
  const l2 = settings.redisUrl ? 'redis' : (settings.redisRestUrl ? 'redis-rest' : 'disabled');
  return { l1Entries: l1.size, l1MaxAgeMs: 10 * 60 * 1000, inflight: inflight.size, l2 };
}
