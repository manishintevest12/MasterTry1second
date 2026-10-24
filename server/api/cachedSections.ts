/**
 * 24-hour in-process cache for the home page's curated sections (owner 23 Oct:
 * "home page pr jo data aata hai usko v cache mai 24 hours rkho, quick app,
 * reward section ko v jiss se ye jaldi or fast result dein").
 *
 * Scope: /api/quick-apps, /api/home/showcase, /api/home/hero-banners,
 * /api/home-banners, /api/rewards/top-picks — payloads assembled from MySQL
 * reads + live-catalogue composition that are effectively static for a day.
 * A 24h cache makes every home-screen load a sub-millisecond in-process hit
 * for both web and the Flutter app.
 *
 * Honesty/instant-update rule: admin mutations (banners, top picks, custom
 * quick apps) call purgeSectionCache() so an owner edit is live on the very
 * next request — never hidden behind the 24h TTL. After a Node restart the
 * cache is empty and the first hit recomputes once (normal path).
 */
type Entry = { expiresAt: number; value: unknown };

const CACHE = new Map<string, Entry>();
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Serve a section payload from cache; build + cache it on miss. Never throws on its own. */
export async function cachedSection<T>(key: string, build: () => Promise<T>, ttlMs: number = DEFAULT_TTL_MS): Promise<T> {
  const hit = CACHE.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;
  const value = await build();
  CACHE.set(key, { expiresAt: Date.now() + ttlMs, value });
  return value;
}

/** Invalidate cached sections. No prefix = purge everything (admin edit safety). */
export function purgeSectionCache(prefix?: string): void {
  if (!prefix) { CACHE.clear(); return; }
  for (const k of CACHE.keys()) if (k.startsWith(prefix)) CACHE.delete(k);
}

export function sectionCacheStats(): { keys: number; entries: Array<{ key: string; expiresAt: number }> } {
  return { keys: CACHE.size, entries: [...CACHE.entries()].map(([key, e]) => ({ key, expiresAt: e.expiresAt })) };
}
