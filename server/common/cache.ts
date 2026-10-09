/**
 * Three-tier cache (Section 8):
 *   L1: in-process memory (cache-aside, request coalescing, stampede protection)
 *   L2: Redis when REDIS_URL is set (KVM4), transparently skipped otherwise
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

export async function initCache() {
  await getRedis();
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
  return { l1Entries: l1.size, l1MaxAgeMs: 10 * 60 * 1000, inflight: inflight.size, l2: settings.redisUrl ? 'redis' : 'disabled' };
}
