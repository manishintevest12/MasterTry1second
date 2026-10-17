/**
 * Nominatim geo proxy (owner request 17 Oct: Uber-style drag-and-drop map pinpoint
 * for Cab & Ride). The browser must not call Nominatim directly (usage policy: proper
 * User-Agent, max 1 req/s, caching) — so the backend proxies both directions:
 *   GET /api/geo/search?q=...   forward geocoding (India-bounded, 6 results)
 *   GET /api/geo/reverse?lat=&lng=   reverse geocoding for a dropped pin
 * In-memory TTL cache (24h, capped) + a 1.1s min-interval throttle keep us polite.
 * Open data (ODbL) — no API keys, no third-party aggregator, nothing fabricated:
 * what Nominatim does not know is returned as-is (nulls included).
 */
import { log } from './logger';

const UA = 'Try1secondBot/1.0 (https://www.try1second.com; independent metasearch)';
const NOMINATIM = 'https://nominatim.openstreetmap.org';

interface CacheEntry { at: number; value: any }
const cache = new Map<string, CacheEntry>();
const CACHE_MS = 24 * 60 * 60_000;
const CACHE_MAX = 800;

let lastCallAt = 0;
const MIN_INTERVAL_MS = 1_100; // Nominatim policy: absolute max 1 request/second

async function throttledNominatim(path: string): Promise<any | null> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
  try {
    const r = await fetch(`${NOMINATIM}${path}`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!r.ok) { log.warn('GeoProxy', `Nominatim HTTP ${r.status} for ${path.slice(0, 60)}`); return null; }
    const value = await r.json();
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    cache.set(path, { at: Date.now(), value });
    return value;
  } catch (e: any) {
    log.warn('GeoProxy', `Nominatim unreachable: ${String(e?.message || e).slice(0, 80)}`);
    return null;
  }
}

export interface GeoPlace {
  lat: number;
  lng: number;
  label: string; // full display name
}

/** Forward geocode an address/hotspot name (India only) into candidate places. */
export async function geoSearch(q: string, limit = 6): Promise<GeoPlace[]> {
  const clean = q.trim().slice(0, 120);
  if (clean.length < 2) return [];
  const path = `/search?q=${encodeURIComponent(clean)}&countrycodes=in&format=jsonv2&limit=${limit}&addressdetails=0`;
  const rows = await throttledNominatim(path);
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r: any) => r.lat && r.lon)
    .map((r: any) => ({ lat: Number(r.lat), lng: Number(r.lon), label: String(r.display_name || '').slice(0, 200) }));
}

export interface GeoReverse {
  lat: number;
  lng: number;
  address: string; // full display name
  locality: string; // street/suburb-level label for the UI chip
  city: string;
  state?: string;
  pincode?: string;
}

/** Reverse geocode a dropped pin into address parts the app already understands. */
export async function geoReverse(lat: number, lng: number): Promise<GeoReverse | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const la = lat.toFixed(6), lo = lng.toFixed(6);
  const path = `/reverse?lat=${la}&lon=${lo}&format=jsonv2&zoom=18&addressdetails=1`;
  const row = await throttledNominatim(path);
  const a = row?.address;
  if (!row || !a) return null;
  const locality = a.road || a.pedestrian || a.neighbourhood || a.suburb || a.hamlet || a.quarter || '';
  const city = a.city || a.town || a.village || a.county || a.state_district || '';
  return {
    lat, lng,
    address: String(row.display_name || `${locality} ${city}`.trim()).slice(0, 220),
    locality: String(locality).slice(0, 80),
    city: String(city).slice(0, 60),
    state: a.state ? String(a.state).slice(0, 60) : undefined,
    pincode: /^\d{6}$/.test(String(a.postcode || '')) ? String(a.postcode) : undefined,
  };
}
