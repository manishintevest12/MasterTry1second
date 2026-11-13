/**
 * NEARBY & LOCAL DISCOVERY (owner 13 Nov).
 *
 * Goal: take the user's coordinates (or a city), and answer with real places around them - restaurants,
 * cafes, hotels, stays, cabs and local stores - as clean comparison cards.
 *
 * HONESTY RULES this module follows, because a fabricated rating is worse than no card:
 *  - Google Places supplies name, rating, review count, price level, address, photo and website, but only
 *    when GOOGLE_PLACES_API_KEY exists. Unset is reported, never guessed.
 *  - OpenStreetMap/Overpass needs no key and is the always-on source: it gives name, address, coords and a
 *    category. It has NO ratings and NO price level, so those stay null and the card says so.
 *  - Our own MySQL catalogue contributes priced hotel rows for the city where a real price exists.
 *  - Nothing is invented, and "no rows" is answered as "no rows" with the reason.
 *
 * Every outward link is a signed /api/out pointer, so a booking click keeps the existing monetisation flow
 * (vertical travel/groMo/Cuelinks layers) instead of leaving from the browser directly.
 */
import { getStore } from '../common/db';
import { log } from '../common/logger';
import { createMaskingPointer } from '../affiliate/deeplink';
import { swiggyPlaces, oyoStays, enrichedToRow, photonCoords, ogImage, CATEGORY_TILE } from './enrich';

export type NearbyCategory = 'restaurants' | 'cafes' | 'hotels' | 'stays' | 'cabs' | 'stores' | 'movies' | 'all';

export interface NearbyRow {
  id: string;
  name: string;
  category: NearbyCategory;
  subcategory?: string | null;
  rating: number | null;
  ratingCount: number | null;
  priceLevel: number | null;
  priceLabel: string | null;
  price: number | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  distanceKm: number | null;
  imageUrl: string | null;
  source: 'google' | 'osm' | 'catalogue';
  honesty: string;
  exitUrl: string;
  directionsUrl: string;
  website: string | null;
}

export interface NearbyAnswer {
  ok: boolean;
  category: NearbyCategory;
  location: { lat: number; lng: number; city: string | null; resolvedFrom: 'coords' | 'city' | 'fallback' };
  results: NearbyRow[];
  counts: { google: number; osm: number; catalogue: number };
  notes: string[];
}

const DEFAULT_CITY = 'Pune';
const RADIUS_M = 2500;
const CACHE_TTL_MS = 30 * 60_000;

const CATEGORY_ALIASES: Record<string, NearbyCategory> = {
  all: 'all', restaurant: 'restaurants', restaurants: 'restaurants', food: 'restaurants',
  cafe: 'cafes', cafes: 'cafes', coffee: 'cafes',
  hotel: 'hotels', hotels: 'hotels', stay: 'stays', stays: 'stays', homestay: 'stays',
  cab: 'cabs', cabs: 'cabs', taxi: 'cabs', store: 'stores', stores: 'stores', shop: 'stores',
  movie: 'movies', movies: 'movies', cinema: 'movies', cinemas: 'movies', theatre: 'movies', theater: 'movies', theatres: 'movies', theaters: 'movies',
};

export function normalizeNearbyCategory(raw: unknown): NearbyCategory {
  const key = String(raw || '').trim().toLowerCase();
  return CATEGORY_ALIASES[key] || 'all';
}

/** Great-circle distance in km, used for the "1.2 km away" label. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(s))) * 10) / 10;
}

function mapsSearch(name: string, lat: number | null, lng: number | null): string {
  if (lat !== null && lng !== null) return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
}

function pointer(url: string, category: NearbyCategory): string {
  const dest = /^https?:\/\//i.test(url) ? url : '';
  if (!dest) return '';
  return createMaskingPointer(dest, { vertical: category === 'hotels' || category === 'stays' ? 'hotels' : category === 'cabs' ? 'cab' : 'nearby', trusted: true });
}

function norm(name: string): string {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/* ------------------------------------------------------------------ location */

export async function resolveNearbyLocation(lat?: number | null, lng?: number | null, city?: string | null):
Promise<{ lat: number; lng: number; city: string | null; resolvedFrom: 'coords' | 'city' | 'fallback' }> {
  if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180) {
    return { lat: Number(lat), lng: Number(lng), city: city ? String(city) : null, resolvedFrom: 'coords' };
  }
  const wanted = String(city || '').trim();
  if (wanted) {
    const geocoded = await geocodeCity(wanted);
    if (geocoded) return { ...geocoded, city: wanted, resolvedFrom: 'city' };
  }
  const fallback = await geocodeCity(DEFAULT_CITY);
  return fallback
    ? { ...fallback, city: DEFAULT_CITY, resolvedFrom: 'fallback' }
    : { lat: 18.5204, lng: 73.8567, city: DEFAULT_CITY, resolvedFrom: 'fallback' };
}

const geocodeCache = new Map<string, { lat: number; lng: number }>();

/** Nominatim (OpenStreetMap) geocoding - no key, low volume, cached in-process and in MySQL. */
async function geocodeCity(city: string): Promise<{ lat: number; lng: number } | null> {
  const key = city.toLowerCase();
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;
  const store = getStore();
  try {
    const cached = await store.query<any>('SELECT lat, lng FROM nearby_geocode WHERE city_key = ?', [key]).catch(() => []);
    if (cached.length) {
      const hit = { lat: Number(cached[0].lat), lng: Number(cached[0].lng) };
      geocodeCache.set(key, hit);
      return hit;
    }
  } catch { /* table may not exist yet */ }
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city + ', India')}&format=json&limit=1`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'user-agent': 'Try1Second/1.0 (https://www.try1second.com; nearby geocoding)' },
    }).finally(() => clearTimeout(timer));
    if (!res.ok) return null;
    const rows = (await res.json()) as any[];
    if (!Array.isArray(rows) || !rows.length) return null;
    const hit = { lat: Number(rows[0].lat), lng: Number(rows[0].lon) };
    if (!Number.isFinite(hit.lat) || !Number.isFinite(hit.lng)) return null;
    geocodeCache.set(key, hit);
    await store.execute('CREATE TABLE IF NOT EXISTS nearby_geocode (city_key VARCHAR(120) PRIMARY KEY, lat DECIMAL(10,6), lng DECIMAL(10,6), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)').catch(() => {});
    await store.execute('INSERT INTO nearby_geocode (city_key, lat, lng) VALUES (?,?,?) ON DUPLICATE KEY UPDATE lat=VALUES(lat), lng=VALUES(lng)', [key, hit.lat, hit.lng]).catch(() => {});
    return hit;
  } catch (e: any) {
    log.warn('Nearby', 'geocode failed', { city, error: String(e?.message || e).slice(0, 80) });
    return null;
  }
}

/* ------------------------------------------------------------------ providers */

const GOOGLE_TYPE: Record<string, string[]> = {
  restaurants: ['restaurant'],
  cafes: ['cafe'],
  hotels: ['lodging'],
  stays: ['lodging'],
  cabs: ['taxi_stand'],
  stores: ['store'],
  movies: ['movie_theater'],
  all: ['restaurant', 'cafe', 'lodging', 'store', 'movie_theater'],
};

async function googleNearby(
  lat: number, lng: number, category: NearbyCategory,
): Promise<{ rows: NearbyRow[]; note?: string }> {
  const key = String(process.env.GOOGLE_PLACES_API_KEY || '').trim();
  if (!key) return { rows: [], note: 'Google Places key not configured, so ratings and price levels come from nowhere else - they are shown as unknown.' };
  try {
    const includedTypes = GOOGLE_TYPE[category] || GOOGLE_TYPE.all;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.userRatingCount,places.priceLevel,places.formattedAddress,places.location,places.photos,places.websiteUri,places.primaryType',
      },
      body: JSON.stringify({ includedTypes, maxResultCount: 20, locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: RADIUS_M } } }),
    }).finally(() => clearTimeout(timer));
    if (!res.ok) {
      const text = (await res.text()).slice(0, 160);
      return { rows: [], note: `Google Places answered ${res.status}: ${text}` };
    }
    const data: any = await res.json();
    const places: any[] = Array.isArray(data.places) ? data.places : [];
    const rows = places.map((p) => {
      const plat = Number(p.location?.latitude); const plng = Number(p.location?.longitude);
      const photo = p.photos?.[0]?.name ? `/api/nearby/photo?ref=${encodeURIComponent(p.photos[0].name)}` : null;
      const website = p.websiteUri ? String(p.websiteUri) : null;
      const cat = category === 'all' ? mapGoogleType(p.primaryType) : category;
      return {
        id: `g-${p.id}`,
        name: String(p.displayName?.text || 'Unnamed place'),
        category: cat,
        subcategory: p.primaryType ? String(p.primaryType).replace(/_/g, ' ') : null,
        rating: Number.isFinite(Number(p.rating)) ? Number(p.rating) : null,
        ratingCount: Number.isFinite(Number(p.userRatingCount)) ? Number(p.userRatingCount) : null,
        priceLevel: priceLevelToNumber(p.priceLevel),
        priceLabel: priceLevelLabel(p.priceLevel),
        price: null,
        address: p.formattedAddress ? String(p.formattedAddress) : null,
        lat: Number.isFinite(plat) ? plat : null,
        lng: Number.isFinite(plng) ? plng : null,
        distanceKm: Number.isFinite(plat) ? distanceKm({ lat, lng }, { lat: plat, lng: plng }) : null,
        imageUrl: photo,
        source: 'google' as const,
        honesty: 'Rating and reviews from Google Places, live.',
        exitUrl: website ? pointer(website, cat) : '',
        directionsUrl: mapsSearch(String(p.displayName?.text || ''), Number.isFinite(plat) ? plat : null, Number.isFinite(plng) ? plng : null),
        website,
      };
    });
    return { rows };
  } catch (e: any) {
    return { rows: [], note: `Google Places unreachable: ${String(e?.message || e).slice(0, 80)}` };
  }
}

function priceLevelToNumber(level: unknown): number | null {
  const map: Record<string, number> = {
    PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  const v = map[String(level || '')];
  return v === undefined ? null : v;
}

function priceLevelLabel(level: unknown): string | null {
  const n = priceLevelToNumber(level);
  return n === null ? null : '₹'.repeat(Math.max(1, n + 1));
}

function mapGoogleType(primary: unknown): NearbyCategory {
  const t = String(primary || '');
  if (t.includes('restaurant') || t.includes('meal')) return 'restaurants';
  if (t.includes('cafe') || t.includes('coffee') || t.includes('bakery')) return 'cafes';
  if (t.includes('lodging') || t.includes('hotel')) return 'hotels';
  if (t.includes('taxi')) return 'cabs';
  if (t.includes('movie') || t.includes('cinema')) return 'movies';
  return 'stores';
}

/**
 * Keyless map data. Overpass is the richest but was measured unreachable from our egress on 13 Nov
 * (overpass-api.de and overpass.kumi.systems both abort at 25s, overpass.osm.ch answers in 0.5s because it
 * only carries Swiss data), so the chain starts with the two endpoints that actually answer:
 *   1. Photon (komoot) - fast, structured name/city/street, ~0.5s
 *   2. Nominatim search inside a viewbox around the point - ~0.4s
 *   3. Overpass mirrors - last, short deadline
 * None of them carry ratings or price levels: OSM has no such fields, so those stay null on the card.
 */
async function osmNearby(lat: number, lng: number, category: NearbyCategory):
Promise<{ rows: NearbyRow[]; note?: string }> {
  const term: Record<NearbyCategory, string> = {
    restaurants: 'restaurant', cafes: 'cafe', hotels: 'hotel', stays: 'guest house', cabs: 'taxi', stores: 'shop', movies: 'cinema', all: 'restaurant',
  };
  const want = term[category] || 'restaurant';
  const attempts: string[] = [];

  const photon = await photonNearby(lat, lng, want, category);
  if (photon.rows.length) return photon;
  if (photon.note) attempts.push(photon.note);

  const nominatim = await nominatimNearby(lat, lng, want, category);
  if (nominatim.rows.length) return nominatim;
  if (nominatim.note) attempts.push(nominatim.note);

  const overpass = await overpassNearby(lat, lng, category);
  if (overpass.rows.length) return overpass;
  if (overpass.note) attempts.push(overpass.note);

  return { rows: [], note: `Map data unavailable: ${attempts.join('; ').slice(0, 220)}` };
}

async function photonNearby(lat: number, lng: number, term: string, category: NearbyCategory):
Promise<{ rows: NearbyRow[]; note?: string }> {
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(term)}&lat=${lat}&lon=${lng}&limit=30&lang=en`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': 'Try1Second/1.0 (nearby)' } }).finally(() => clearTimeout(timer));
    if (!res.ok) return { rows: [], note: `Photon answered ${res.status}` };
    const data: any = await res.json();
    const feats: any[] = Array.isArray(data.features) ? data.features : [];
    const rows: NearbyRow[] = [];
    for (const f of feats) {
      const p = f.properties || {};
      const coords = f.geometry?.coordinates || [];
      const plng = Number(coords[0]); const plat = Number(coords[1]);
      if (!p.name || !Number.isFinite(plat) || !Number.isFinite(plng)) continue;
      const cat = osmCategory({ amenity: p.osm_key === 'amenity' ? p.osm_value : '', tourism: p.osm_key === 'tourism' ? p.osm_value : '', shop: p.osm_key === 'shop' ? p.shop || 'yes' : '' });
      if (category !== 'all' && cat !== category) continue;
      const addr = [p.housenumber, p.street, p.district, p.city].filter(Boolean).join(', ') || null;
      rows.push(baseOsmRow({ name: String(p.name), cat, plat, plng, lat, lng, addr, sub: p.osm_value ? String(p.osm_value).replace(/_/g, ' ') : null, osmId: `ph-${p.osm_id || p.name}` }));
    }
    return rows.length ? { rows } : { rows: [], note: 'Photon returned no matching places' };
  } catch (e: any) {
    return { rows: [], note: `Photon unreachable: ${String(e?.message || e).slice(0, 60)}` };
  }
}

async function nominatimNearby(lat: number, lng: number, term: string, category: NearbyCategory):
Promise<{ rows: NearbyRow[]; note?: string }> {
  try {
    const d = 0.06; // ~6 km box
    const viewbox = `${(lng - d).toFixed(4)},${(lat + d).toFixed(4)},${(lng + d).toFixed(4)},${(lat - d).toFixed(4)}`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(term)}&viewbox=${viewbox}&bounded=1&format=jsonv2&limit=30`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': 'Try1Second/1.0 (https://www.try1second.com; nearby)' } }).finally(() => clearTimeout(timer));
    if (!res.ok) return { rows: [], note: `Nominatim answered ${res.status}` };
    const data: any[] = (await res.json()) as any[];
    const rows: NearbyRow[] = [];
    for (const r of Array.isArray(data) ? data : []) {
      const plat = Number(r.lat); const plng = Number(r.lon);
      const name = String(r.name || (r.display_name || '').split(',')[0] || '').trim();
      if (!name || !Number.isFinite(plat) || !Number.isFinite(plng)) continue;
      const rt = String(r.type || '');
      const cat = osmCategory({
        amenity: r.class === 'amenity' || ['cinema','restaurant','cafe','fast_food','taxi'].includes(rt) ? rt : '',
        tourism: r.class === 'tourism' || ['hotel','guest_house','apartment','hostel','motel'].includes(rt) ? rt : '',
        shop: r.class === 'shop' || rt === 'shop' ? 'yes' : '',
      });
      if (category !== 'all' && cat !== category) continue;
      rows.push(baseOsmRow({ name, cat, plat, plng, lat, lng, addr: r.display_name ? String(r.display_name) : null, sub: r.type ? String(r.type).replace(/_/g, ' ') : null, osmId: `nm-${r.osm_id || r.place_id}` }));
    }
    return rows.length ? { rows } : { rows: [], note: 'Nominatim returned no matching places' };
  } catch (e: any) {
    return { rows: [], note: `Nominatim unreachable: ${String(e?.message || e).slice(0, 60)}` };
  }
}

async function overpassNearby(lat: number, lng: number, category: NearbyCategory):
Promise<{ rows: NearbyRow[]; note?: string }> {
  const filters: Record<NearbyCategory, string[]> = {
    restaurants: ['node["amenity"="restaurant"]'],
    cafes: ['node["amenity"="cafe"]'],
    hotels: ['node["tourism"="hotel"]'],
    stays: ['node["tourism"="guest_house"]'],
    cabs: ['node["amenity"="taxi"]'],
    stores: ['node["shop"]'],
    movies: ['node["amenity"="cinema"]'],
    all: ['node["amenity"="restaurant"]'],
  };
  const body = filters[category].map((f) => `${f}(around:${RADIUS_M},${lat},${lng});`).join('\n');
  const query = `[out:json][timeout:12];(\n${body}\n);out body 30;`;
  for (const host of ['overpass-api.de', 'overpass.kumi.systems']) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(`https://${host}/api/interpreter`, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'Try1Second/1.0 (nearby)' },
        body: `data=${encodeURIComponent(query)}`,
      }).finally(() => clearTimeout(timer));
      if (!res.ok) continue;
      const data: any = await res.json();
      const rows: NearbyRow[] = (Array.isArray(data.elements) ? data.elements : [])
        .filter((e: any) => e?.tags?.name && Number.isFinite(Number(e.lat)))
        .map((e: any) => {
          const plat = Number(e.lat); const plng = Number(e.lon);
          const cat = osmCategory(e.tags);
          return baseOsmRow({
            name: String(e.tags.name), cat, plat, plng, lat, lng,
            addr: [e.tags['addr:housenumber'], e.tags['addr:street'], e.tags['addr:suburb'], e.tags['addr:city']].filter(Boolean).join(', ') || null,
            sub: e.tags.cuisine ? String(e.tags.cuisine).replace(/[_;]/g, ' ') : (e.tags.tourism || e.tags.shop || e.tags.amenity || null),
            osmId: `op-${e.id}`, website: e.tags.website ? String(e.tags.website) : null,
          });
        });
      if (rows.length) return { rows };
    } catch { continue; }
  }
  return { rows: [], note: 'Overpass mirrors unreachable' };
}

function baseOsmRow(input: {
  name: string; cat: NearbyCategory; plat: number; plng: number; lat: number; lng: number;
  addr: string | null; sub: string | null; osmId: string; website?: string | null;
}): NearbyRow {
  return {
    id: `osm-${input.cat}-${String(input.osmId).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40)}`,
    name: input.name,
    category: input.cat,
    subcategory: input.sub,
    rating: null,
    ratingCount: null,
    priceLevel: null,
    priceLabel: null,
    price: null,
    address: input.addr,
    lat: input.plat,
    lng: input.plng,
    distanceKm: distanceKm({ lat: input.lat, lng: input.lng }, { lat: input.plat, lng: input.plng }),
    imageUrl: null,
    source: 'osm',
    honesty: 'OpenStreetMap: name, address and distance are real; OSM has no rating or price, so we show none.',
    exitUrl: input.website ? pointer(String(input.website), input.cat) : '',
    directionsUrl: mapsSearch(input.name, input.plat, input.plng),
    website: input.website || null,
  };
}

function osmCategory(tags: any): NearbyCategory {
  const a = String(tags?.amenity || ''); const t = String(tags?.tourism || '');
  if (a === 'restaurant' || a === 'fast_food') return 'restaurants';
  if (a === 'cafe') return 'cafes';
  if (t === 'hotel') return 'hotels';
  if (t === 'guest_house' || t === 'apartment' || t === 'hostel' || t === 'motel') return 'stays';
  if (a === 'taxi') return 'cabs';
  if (a === 'cinema') return 'movies';
  return 'stores';
}

/** Our own priced hotel rows for the city (real catalogue prices, No Price No Card respected). */
async function catalogueNearby(city: string | null, category: NearbyCategory): Promise<NearbyRow[]> {
  if (!city) return [];
  if (!['hotels', 'stays', 'all'].includes(category)) return [];
  try {
    const rows = await getStore().query<any>(
      `SELECT title, seller, seller_url, effective_price, location_city, attributes
         FROM offers
        WHERE vertical IN ('hotels','stays') AND location_city = ?
          AND effective_price IS NOT NULL AND effective_price > 0
        ORDER BY effective_price ASC LIMIT 12`,
      [city],
    ).catch(() => []);
    return rows.map((r: any) => ({
      id: `c-${norm(r.title).replace(/ /g, '-').slice(0, 40)}`,
      name: String(r.title || r.seller),
      category: 'hotels' as NearbyCategory,
      subcategory: 'live catalogue price',
      rating: null,
      ratingCount: null,
      priceLevel: null,
      priceLabel: `₹${Math.round(Number(r.effective_price))}`,
      price: Number(r.effective_price),
      address: r.location_city ? String(r.location_city) : null,
      lat: null,
      lng: null,
      distanceKm: null,
      imageUrl: null,
      source: 'catalogue' as const,
      honesty: 'Price we hold in our own catalogue for this city, live.',
      exitUrl: pointer(String(r.seller_url || ''), 'hotels'),
      directionsUrl: mapsSearch(`${r.title} ${city}`, null, null),
      website: r.seller_url ? String(r.seller_url) : null,
    }));
  } catch { return []; }
}

/* ------------------------------------------------------------------ merge + cache */

function dedupe(rows: NearbyRow[]): NearbyRow[] {
  const kept: NearbyRow[] = [];
  for (const row of rows) {
    const name = norm(row.name);
    const clash = kept.find((k) => {
      if (norm(k.name) !== name) return false;
      if (!k.lat || !row.lat || !k.lng || !row.lng) return true;
      return distanceKm({ lat: k.lat, lng: k.lng }, { lat: row.lat, lng: row.lng }) < 0.2;
    });
    if (clash) {
      // Prefer the row that carries a rating/price, so Google wins over OSM for the same place.
      if ((row.rating ?? -1) > (clash.rating ?? -1)) Object.assign(clash, row);
      continue;
    }
    kept.push(row);
  }
  return kept;
}

function sortRows(rows: NearbyRow[], category: NearbyCategory): NearbyRow[] {
  const byDistance = (a: NearbyRow, b: NearbyRow) => (a.distanceKm ?? 99) - (b.distanceKm ?? 99);
  // A card that can show a real rating and price earns the top of the list; the map-only rows (name, address,
  // distance) follow, closest first. Before this, a rated Swiggy/OYO row with no coordinates sank to the bottom
  // behind unrated OSM rows, which made the enrichment look broken when it was working.
  const score = (r: NearbyRow) => (r.rating !== null ? 2 : 0) + (r.price !== null ? 1 : 0);
  return [...rows].sort((a, b) => {
    const rank = score(b) - score(a);
    if (rank !== 0) return rank;
    if (a.rating !== null && b.rating !== null && a.rating !== b.rating) return b.rating - a.rating;
    if (category === 'all') return byDistance(a, b);
    return byDistance(a, b);
  });
}

async function readCache(key: string): Promise<NearbyAnswer | null> {
  try {
    const rows = await getStore().query<any>('SELECT payload, fetched_at FROM nearby_cache WHERE cache_key = ?', [key]).catch(() => []);
    if (!rows.length) return null;
    const at = new Date(String(rows[0].fetched_at).replace(' ', 'T')).getTime();
    if (!Number.isFinite(at) || Date.now() - at > CACHE_TTL_MS) return null;
    const payload = typeof rows[0].payload === 'string' ? JSON.parse(rows[0].payload) : rows[0].payload;
    return payload && Array.isArray(payload.results) ? payload : null;
  } catch { return null; }
}

async function writeCache(key: string, answer: NearbyAnswer): Promise<void> {
  try {
    const store = getStore();
    await store.execute('CREATE TABLE IF NOT EXISTS nearby_cache (cache_key VARCHAR(191) PRIMARY KEY, payload MEDIUMTEXT, fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)').catch(() => {});
    await store.execute('INSERT INTO nearby_cache (cache_key, payload) VALUES (?,?) ON DUPLICATE KEY UPDATE payload=VALUES(payload), fetched_at=CURRENT_TIMESTAMP', [key, JSON.stringify(answer)]).catch(() => {});
  } catch { /* cache is an optimisation, never a requirement */ }
}

export async function nearbyAnswer(input: {
  lat?: number | null; lng?: number | null; city?: string | null; category?: unknown; limit?: number;
}): Promise<NearbyAnswer> {
  const category = normalizeNearbyCategory(input.category);
  const location = await resolveNearbyLocation(input.lat ?? null, input.lng ?? null, input.city ?? null);
  // v2: the enrichment layer (Swiggy/OYO ratings, prices, photos) changed what a good answer looks like, so
  // old cached payloads must not keep serving unrated rows for 30 minutes.
  const cacheKey = `v7|${category}|${location.lat.toFixed(3)}|${location.lng.toFixed(3)}|${(location.city || '').toLowerCase()}`;
  const cached = await readCache(cacheKey);
  if (cached) return cached;

  const wantsFood = category === 'all' || category === 'restaurants' || category === 'cafes';
  const wantsStay = category === 'all' || category === 'hotels' || category === 'stays';
  const [google, osm, catalogue, swiggy, oyo] = await Promise.all([
    googleNearby(location.lat, location.lng, category),
    osmNearby(location.lat, location.lng, category),
    catalogueNearby(location.city, category),
    wantsFood ? swiggyPlaces(location.lat, location.lng) : Promise.resolve({ rows: [], note: undefined as string | undefined }),
    wantsStay ? oyoStays(location.city, category === 'stays' ? 'stays' : 'hotels') : Promise.resolve({ rows: [], note: undefined as string | undefined }),
  ]);

  const notes: string[] = [];
  if (google.note) notes.push(google.note);
  if (osm.note) notes.push(osm.note);
  if (swiggy.note) notes.push(`Swiggy: ${swiggy.note}`);
  if (oyo.note) notes.push(`OYO: ${oyo.note}`);

  // Map rows carry the coordinates; ratings/prices/photos come from the reverse-engineered partner feeds.
  // Joining them by name gives a card that has BOTH a real distance and a real rating, which is the whole
  // point: no Google key, no invented numbers.
  const coordBy = new Map<string, { lat: number; lng: number; distance: number | null }>();
  for (const row of [...google.rows, ...osm.rows]) {
    if (row.lat !== null && row.lng !== null) coordBy.set(norm(row.name), { lat: row.lat, lng: row.lng, distance: row.distanceKm });
  }
  const wanted = [...swiggy.rows, ...oyo.rows].filter((p) => category === 'all' || p.category === category);
  // Rated rows first (they are what the owner asked for), then look up coordinates for the ones the map feeds
  // did not already match, so the card can honestly say "1.2 km away" instead of hiding the badge.
  const head = wanted.slice(0, 8);
  // Photon throttles bursts: 8 parallel lookups returned nothing while 3 at a time answered, so the pool below
  // keeps concurrency at 3 and still finishes inside about a second.
  const politePool = async <T,>(items: T[], limit: number, fn: (item: T) => Promise<any>) => {
    const out: any[] = new Array(items.length);
    let cursor = 0;
    const worker = async () => {
      while (cursor < items.length) {
        const i = cursor; cursor += 1;
        out[i] = await fn(items[i]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return out;
  };
  const looked = await politePool(head, 3, async (p) => {
    const hit = coordBy.get(norm(p.name));
    if (hit) return { p, coords: { lat: hit.lat, lng: hit.lng }, distance: hit.distance };
    // Name first; the published address/locality second (OYO brands are too unique for a name lookup, and a
    // Swiggy card only carries an area name).
    let geo = await photonCoords(p.name, { lat: location.lat, lng: location.lng });
    if (!geo && p.address) {
      geo = await photonCoords(`${p.address}, ${location.city || ''}`.trim(), { lat: location.lat, lng: location.lng }, 25000);
    }
    return { p, coords: geo ? { lat: geo.lat, lng: geo.lng } : null, distance: geo ? geo.distanceKm : null };
  });
  const enriched = [
    ...looked.map((l) => enrichedToRow(l.p, l.coords, l.distance) as unknown as NearbyRow),
    ...wanted.slice(8).map((p) => enrichedToRow(p, null, null) as unknown as NearbyRow),
  ];

  // Precision first (rated + priced partner rows), then our catalogue, then the raw map rows.
  const merged = sortRows(dedupe([...enriched, ...catalogue, ...google.rows, ...osm.rows]), category);
  const limit = Math.min(60, Math.max(4, Number(input.limit) || 30));
  const results = merged.slice(0, limit);

  // ---- OWNER 13 Nov: "redirection affiliate ke through hoga agar available hai, warna direct" + "image
  // compulsory hai". Both are applied here, on the final rows, so every surface (API, SEO page, web tab, app)
  // gets the same guarantee:
  //  - exitUrl is always a signed /api/out pointer when the row has anywhere to go: the partner's own page when
  //    the feed gave one, otherwise that provider's search page for the place. /api/out then runs the affiliate
  //    chain and falls back to a direct hop when no network covers the merchant - nothing is ever un-attributed
  //    when a network does cover it.
  //  - imageUrl is never empty: provider photo -> the business page's own og:image -> a LABELLED category tile.
  const needsExit = results.filter((r) => !r.exitUrl);
  for (const row of needsExit) {
    // Every card redirects. Best destination first (the partner's own page or that provider's search page);
    // the map place page last, so a store or a cab stand still has a real destination instead of a dead card.
    const dest = row.website
      || (row.category === 'restaurants' || row.category === 'cafes'
        ? `https://www.swiggy.com/search?query=${encodeURIComponent(row.name)}`
        : row.category === 'movies'
          ? `https://in.bookmyshow.com/explore/cinemas`
          : row.category === 'cabs'
            ? 'https://www.uber.com/in/en/'
            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${row.name} ${row.address || location.city || ''}`.trim())}`);
    if (dest) row.exitUrl = pointer(dest, row.category);
  }

  const noPhoto = results.filter((r) => !r.imageUrl);
  const withOg = await Promise.all(noPhoto.slice(0, 6).map(async (row) => ({ row, url: row.website ? await ogImage(row.website) : null })));
  for (const { row, url } of withOg) {
    if (url) {
      row.imageUrl = url;
      row.honesty = `${row.honesty} Photo is from the business's own page.`.trim();
    }
  }
  for (const row of results) {
    if (!row.imageUrl) {
      row.imageUrl = CATEGORY_TILE[row.category] || CATEGORY_TILE.all;
      row.honesty = `${row.honesty} Photo is a category tile, not this place.`.trim();
    }
  }

  // The admin Nearby report reads this table (owner: "iska report admin mai nearby section mai hoga").
  void logNearbyEvent('search', {
    category, city: location.city, results: results.length,
    withPhoto: results.filter((r) => r.imageUrl).length,
    withExit: results.filter((r) => r.exitUrl).length,
    sources: { google: google.rows.length, osm: osm.rows.length, enriched: enriched.length },
  });

  const answer: NearbyAnswer = {
    ok: true,
    category,
    location,
    results,
    counts: { google: google.rows.length, osm: osm.rows.length, catalogue: catalogue.length + enriched.length },
    notes: results.length ? notes : [...notes, 'No places came back for this location right now, so nothing is shown rather than guesswork.'],
  };
  await writeCache(cacheKey, answer);
  return answer;
}


/** Nearby usage/reporting ledger. Fire-and-forget: a reporting failure must never break a search. */
async function logNearbyEvent(kind: 'search' | 'exit', payload: Record<string, unknown>): Promise<void> {
  try {
    const store = getStore();
    await store.execute(`CREATE TABLE IF NOT EXISTS nearby_events (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      kind VARCHAR(16) NOT NULL,
      category VARCHAR(24) NULL,
      city VARCHAR(120) NULL,
      results INT NOT NULL DEFAULT 0,
      with_photo INT NOT NULL DEFAULT 0,
      with_exit INT NOT NULL DEFAULT 0,
      payload MEDIUMTEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`).catch(() => {});
    await store.execute(
      'INSERT INTO nearby_events (kind, category, city, results, with_photo, with_exit, payload) VALUES (?,?,?,?,?,?,?)',
      [kind, String(payload.category || '').slice(0, 24) || null, String(payload.city || '').slice(0, 120) || null,
        Number(payload.results || 0), Number(payload.withPhoto || 0), Number(payload.withExit || 0),
        JSON.stringify(payload.sources || payload || {})],
    );
  } catch { /* reporting is best effort */ }
}

export async function nearbyReport(days = 7): Promise<{
  ok: boolean; days: number; searches: number; exits: number; rows: number; withPhoto: number; withExit: number;
  photoCoveragePct: number; byCategory: { category: string; searches: number; rows: number }[];
  topCities: { city: string; searches: number }[]; daily: { day: string; searches: number }[];
}> {
  const span = Math.min(90, Math.max(1, Number(days) || 7));
  const base = { ok: true, days: span, searches: 0, exits: 0, rows: 0, withPhoto: 0, withExit: 0, photoCoveragePct: 0, byCategory: [], topCities: [], daily: [] };
  const cutoff = Date.now() - span * 86400_000;
  try {
    // One plain read, aggregated in code: aggregate SQL and a string date comparison are exactly the shapes a
    // light SQL emulator (the file store used in tests and dev) answers with [] instead of rows, so the report
    // must not depend on them to be trustworthy.
    const raw = await getStore().query<any>(
      'SELECT kind, category, city, results, with_photo, with_exit, created_at FROM nearby_events ORDER BY id DESC LIMIT 20000',
    );
    const rows = (raw || []).filter((r) => {
      const t = new Date(String(r.created_at).replace(' ', 'T')).getTime();
      return Number.isFinite(t) ? t >= cutoff : true;
    });
    const unq = (v: unknown) => String(v ?? '').replace(/^'+|'+$/g, '');
    let searches = 0, exits = 0, total = 0, withPhoto = 0, withExit = 0;
    const cats = new Map<string, { searches: number; rows: number }>();
    const cities = new Map<string, number>();
    const byDay = new Map<string, number>();
    for (const r of rows) {
      const kind = unq(r.kind);
      if (kind === 'exit') { exits += 1; continue; }
      if (kind !== 'search') continue;
      searches += 1;
      total += Number(r.results || 0);
      withPhoto += Number(r.with_photo || 0);
      withExit += Number(r.with_exit || 0);
      const cat = unq(r.category) || '(none)';
      const c = cats.get(cat) || { searches: 0, rows: 0 };
      c.searches += 1; c.rows += Number(r.results || 0); cats.set(cat, c);
      const city = unq(r.city) || '(no city)';
      cities.set(city, (cities.get(city) || 0) + 1);
      const rawDay = r.created_at;
      const day = /^\d{10,13}$/.test(String(rawDay)) ? new Date(Number(rawDay) * (String(rawDay).length === 13 ? 1 : 1000)).toISOString().slice(0, 10) : String(rawDay || '').slice(0, 10);
      if (day) byDay.set(day, (byDay.get(day) || 0) + 1);
    }
    return {
      ok: true, days: span, searches, exits, rows: total, withPhoto, withExit,
      photoCoveragePct: total ? Math.round((withPhoto / total) * 100) : 0,
      byCategory: [...cats.entries()].map(([category, v]) => ({ category, ...v })).sort((a, b) => b.searches - a.searches).slice(0, 12),
      topCities: [...cities.entries()].map(([city, n]) => ({ city, searches: n })).sort((a, b) => b.searches - a.searches).slice(0, 12),
      daily: [...byDay.entries()].map(([day, n]) => ({ day, searches: n })).sort((a, b) => a.day.localeCompare(b.day)),
    };
  } catch { return { ...base, days: span }; }
}
