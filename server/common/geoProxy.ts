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

// ---- Photon autocomplete (owner 24 Oct: colony/street-level address entry) ----
// Nominatim /search is a geocoder, not a typeahead: 1 req/s + POI-poor spelling
// meant "apna sw" never resolved to a street/colony address. Photon
// (photon.komoot.io, the OSM autocomplete front-end — open data, no keys,
// typeahead-rated) returns structured parts: street, housenumber, district,
// locality, city, state, postcode. Still proxied server-side (UA + light
// throttle + cache) so clients never hammer it and stay policy-compliant.

const PHOTON = 'https://photon.komoot.io/api/';

export interface GeoSuggestPlace {
  name: string; // POI / street / colony name ("Apna Sweets")
  address: string; // granular address WITHOUT the name (secondary grey line)
  street?: string;
  colony?: string; // colony / neighbourhood / district ("Scheme No 54", "Vijay Nagar")
  city?: string;
  state?: string;
  pincode?: string;
  lat: number;
  lng: number;
  kind: string; // photon type: house / amenity / street / suburb...
  distanceKm?: number; // from the user's own coordinates when supplied
}

let lastPhotonAt = 0;
const PHOTON_MIN_INTERVAL_MS = 120; // fair-use throttle (Photon allows typeahead rates)

async function throttledPhoton(path: string): Promise<any | null> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const wait = lastPhotonAt + PHOTON_MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastPhotonAt = Date.now();
  try {
    const r = await fetch(`${PHOTON}${path}`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(6_000),
    });
    if (!r.ok) { log.warn('GeoProxy', `Photon HTTP ${r.status} for ${path.slice(0, 60)}`); return null; }
    const value = await r.json();
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    cache.set(`photon:${path}`, { at: Date.now(), value });
    return value;
  } catch (e: any) {
    log.warn('GeoProxy', `Photon unreachable: ${String(e?.message || e).slice(0, 80)}`);
    return null;
  }
}

/** Pure mapper (unit-tested): one Photon GeoJSON feature → normalized place. */
export function photonFeatureToPlace(f: any, near?: { lat: number; lng: number }): GeoSuggestPlace | null {
  const c = Array.isArray(f?.geometry?.coordinates) ? f.geometry.coordinates : [];
  if (c.length < 2) return null;
  const p = f.properties || {};
  const name = String(p.name || '').trim();
  const street = String(p.street || '').trim() || undefined;
  const colony =
    String(p.district || '').trim() ||
    String(p.locality || '').trim() ||
    String(p.suburb || '').trim() ||
    String(p.neighbourhood || '').trim() ||
    undefined;
  const city = String(p.city || p.county || '').trim() || undefined;
  const state = String(p.state || '').trim() || undefined;
  const pincode = /^\d{6}$/.test(String(p.postcode || '')) ? String(p.postcode) : undefined;
  const hn = String(p.housenumber || '').trim();

  // Granular secondary line, name excluded, parts de-duplicated in display order.
  const parts: string[] = [];
  const push = (v?: string) => {
    const t = String(v || '').trim();
    if (t && !parts.some((x) => x.toLowerCase() === t.toLowerCase())) parts.push(t);
  };
  if (hn && street) push(`${hn}, ${street}`); else push(hn || street);
  push(colony);
  push(city);
  push(state);

  const lat = Number(c[1]);
  const lng = Number(c[0]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const place: GeoSuggestPlace = {
    name: name || street || colony || city || 'Unnamed place',
    address: parts.join(', ').slice(0, 240),
    street,
    colony,
    city,
    state,
    pincode,
    lat,
    lng,
    kind: String(p.type || p.osm_value || '').slice(0, 40),
  };
  if (near && Number.isFinite(near.lat) && Number.isFinite(near.lng)) {
    const R = 6371;
    const dLat = ((lat - near.lat) * Math.PI) / 180;
    const dLng = ((lng - near.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((near.lat * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    place.distanceKm = Math.round(R * 2 * Math.asin(Math.sqrt(a)) * 10) / 10;
  }
  return place;
}

/** Typeahead address search (colony/street/POI level), biased near the user when known. */
export async function geoSuggest(
  q: string,
  opts: { lat?: number; lng?: number; limit?: number } = {},
): Promise<GeoSuggestPlace[]> {
  const clean = q.trim().slice(0, 120);
  if (clean.length < 2) return [];
  const limit = Math.min(Math.max(opts.limit ?? 8, 1), 10);
  const bias =
    Number.isFinite(opts.lat) && Number.isFinite(opts.lng) && Math.abs(opts.lat as number) <= 90
      ? `&lat=${(opts.lat as number).toFixed(5)}&lon=${(opts.lng as number).toFixed(5)}`
      : '';
  const data = await throttledPhoton(`?q=${encodeURIComponent(clean)}&limit=${limit}&lang=en${bias}`);
  const feats = Array.isArray(data?.features) ? data.features : [];
  const near = Number.isFinite(opts.lat) && Number.isFinite(opts.lng) ? { lat: opts.lat!, lng: opts.lng! } : undefined;
  return feats
    .map((f: any) => photonFeatureToPlace(f, near))
    .filter((p: GeoSuggestPlace | null): p is GeoSuggestPlace => p !== null)
    .slice(0, limit);
}
