/**
 * Live FX rates for honest currency conversion (no fabricated data).
 * Free, keyless endpoints with fallback chain; 60-min in-memory cache so a
 * search burst does not hammer the rate source. If every source fails we
 * return null and the caller must keep the original listed currency.
 */
import { cffiFetch } from './curlCffiFetch';

interface RateCacheEntry { rate: number; source: string; fetchedAt: number }
let cache: RateCacheEntry | null = null;
const TTL_MS = 60 * 60 * 1000;

async function fetchRateFrom(source: string): Promise<number | null> {
  try {
    const r = await cffiFetch(source, { timeoutMs: 12_000, headers: { Accept: 'application/json' } });
    if (r.status !== 200) return null;
    const d = JSON.parse(r.body);
    const inr = Number(d?.rates?.INR);
    return Number.isFinite(inr) && inr > 20 && inr < 200 ? inr : null; // sanity band USD/INR
  } catch {
    return null;
  }
}

/** Live USD->INR rate (cached 1h). Null = all sources failed: keep original currency. */
export async function usdToInrRate(): Promise<{ rate: number; source: string } | null> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return { rate: cache.rate, source: cache.source };
  const sources = [
    'https://open.er-api.com/v6/latest/USD',
    'https://api.exchangerate-api.com/v4/latest/USD',
  ];
  for (const src of sources) {
    const rate = await fetchRateFrom(src);
    if (rate) {
      cache = { rate, source: new URL(src).host, fetchedAt: Date.now() };
      return { rate, source: cache.source };
    }
  }
  return null;
}
