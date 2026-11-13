/**
 * Keyless RATINGS, PRICES and PHOTOS for the Nearby vertical (owner 13 Nov: "google places api key ke bina ...
 * reverse engineering ye sb use kr ke ye data lana hai").
 *
 * Reverse-engineered and MEASURED from this egress today (no Google key anywhere):
 *   Swiggy  GET /dapi/restaurants/list/v5?lat&lng  -> 200, 131 KB, 28 rated restaurants/cafes for Pune:
 *           name, avgRating, totalRatingsString, costForTwo ("₹1000 for two"), cuisines, areaName,
 *           cloudinaryImageId (a real photo URL). This is the restaurant/cafe layer.
 *   OYO     GET /hotels-in-<city>/                  -> 200, 767 KB, hotels[] JSON embedded in the HTML with
 *           name, address, rating{value,count}, pricing.bookingPrice, hotel_images[], url. Hotel/stay layer.
 * Measured and NOT usable: Google local pack (200 but ratings are rendered client-side), Justdial 403,
 * Zomato 403, MMT/Goibibo 6-8 byte stubs, Agoda search is client-rendered (only i18n strings in the HTML),
 * Booking.com 202 wall. So no scraping key, no browser, no Google key is needed for the two layers below.
 */
import { log } from '../common/logger';
import { cffiFetch } from '../common/curlCffiFetch';

export type NearbyKind = 'restaurants' | 'cafes' | 'hotels' | 'stays';

/** OWNER 13 Nov: "image compulsory hai" - a category tile is the honest last resort, never a fake photo. */
export const CATEGORY_TILE: Record<string, string> = {
  restaurants: '/nearby/restaurants.jpg',
  cafes: '/nearby/cafes.jpg',
  hotels: '/nearby/hotels.jpg',
  stays: '/nearby/stays.jpg',
  cabs: '/nearby/cabs.jpg',
  stores: '/nearby/stores.jpg',
  movies: '/nearby/movies.jpg',
  all: '/nearby/all.jpg',
};

export interface EnrichedPlace {
  name: string;
  category: NearbyKind;
  rating: number | null;
  ratingCount: number | null;
  price: number | null;
  priceLabel: string | null;
  priceBasis: string | null;
  address: string | null;
  subcategory: string | null;
  imageUrl: string | null;
  website: string | null;
  source: 'swiggy' | 'oyo';
  honesty: string;
}

function parseCount(text: unknown): number | null {
  const s = String(text || '').replace(/[^0-9.kK]/g, '');
  if (!s) return null;
  if (/k$/i.test(s)) {
    const n = Number(s.replace(/k$/i, ''));
    return Number.isFinite(n) ? Math.round(n * 1000) : null;
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function rupee(n: number | null): string | null {
  return n === null || !Number.isFinite(n) ? null : `₹${Math.round(n).toLocaleString('en-IN')}`;
}

/** Swiggy's own CDN pattern for a listing photo; the id is real, so the image is real. */
function swiggyImage(id: unknown): string | null {
  const v = String(id || '').trim();
  if (!v) return null;
  return `https://media-assets.swiggy.com/swiggy/image/upload/fl_lossy,f_auto,q_auto,w_400/${v}`;
}

/** Restaurants and cafes with a real rating, cost-for-two and photo. */
export async function swiggyPlaces(lat: number, lng: number): Promise<{ rows: EnrichedPlace[]; note?: string }> {
  const url = `https://www.swiggy.com/dapi/restaurants/list/v5?lat=${lat.toFixed(5)}&lng=${lng.toFixed(5)}&page_type=DESKTOP_WEB_LISTING`;
  try {
    const res = await cffiFetch(url, {
      impersonate: 'chrome',
      timeoutMs: 12000,
      headers: { 'accept-language': 'en-IN,en;q=0.9', accept: 'application/json' },
    });
    if (res.status !== 200) return { rows: [], note: `Swiggy answered ${res.status}` };
    let data: any;
    try { data = JSON.parse(res.body); } catch { return { rows: [], note: 'Swiggy returned a non-JSON body' }; }
    const cards: any[] = [];
    const walk = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (node.avgRating !== undefined && (node.name || node.costForTwo)) cards.push(node);
      for (const v of Object.values(node)) walk(v);
    };
    walk(data);
    const rows: EnrichedPlace[] = [];
    for (const c of cards) {
      const name = String(c.name || '').trim();
      const rating = Number(c.avgRating);
      if (!name || !Number.isFinite(rating) || rating <= 0) continue;
      const costMatch = String(c.costForTwo || '').replace(/,/g, '').match(/(\d{2,6})/);
      const cost = costMatch ? Number(costMatch[1]) : null;
      const cuisines = Array.isArray(c.cuisines) ? c.cuisines.slice(0, 2).join(', ') : null;
      // A cafe is a place whose cuisines/name say so; everything else on Swiggy is a restaurant.
      const isCafe = /cafe|coffee|bakery|dessert/i.test(`${cuisines || ''} ${name}`);
      rows.push({
        name,
        category: isCafe ? 'cafes' : 'restaurants',
        rating,
        ratingCount: parseCount(c.totalRatingsString),
        price: cost,
        priceLabel: cost !== null ? `${rupee(cost)} for two` : null,
        priceBasis: cost !== null ? 'cost for two as listed by the restaurant' : null,
        address: c.areaName ? String(c.areaName) : null,
        subcategory: cuisines,
        imageUrl: swiggyImage(c.cloudinaryImageId),
        website: null,
        source: 'swiggy',
        honesty: cost !== null
          ? 'Rating and cost-for-two are live from Swiggy, photo from the restaurant listing.'
          : 'Rating is live from Swiggy; this restaurant lists no cost for two.',
      });
    }
    return rows.length ? { rows } : { rows: [], note: 'Swiggy returned no rated places for these coordinates' };
  } catch (e: any) {
    return { rows: [], note: `Swiggy unreachable: ${String(e?.message || e).slice(0, 70)}` };
  }
}

/** Hotels and stays with a real guest rating and the nightly price OYO publishes. */
export async function oyoStays(city: string | null, category: 'hotels' | 'stays'): Promise<{ rows: EnrichedPlace[]; note?: string }> {
  const slug = String(city || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!slug) return { rows: [], note: 'No city name, so OYO hotels were not queried' };
  const url = `https://www.oyorooms.com/hotels-in-${slug}/`;
  try {
    const res = await cffiFetch(url, { impersonate: 'chrome', timeoutMs: 14000, headers: { 'accept-language': 'en-IN,en;q=0.9' } });
    if (res.status !== 200) return { rows: [], note: `OYO answered ${res.status} for ${slug}` };
    const body = res.body;
    const marker = body.indexOf('"hotels":[');
    if (marker < 0) return { rows: [], note: 'OYO page carried no hotel list today' };
    const start = body.indexOf('[', marker);
    let depth = 0; let end = -1;
    for (let i = start; i < body.length; i += 1) {
      if (body[i] === '[') depth += 1;
      else if (body[i] === ']') { depth -= 1; if (depth === 0) { end = i + 1; break; } }
    }
    if (end < 0) return { rows: [], note: 'OYO hotel list was truncated' };
    let hotels: any[] = [];
    try { hotels = JSON.parse(body.slice(start, end)); } catch { return { rows: [], note: 'OYO hotel list did not parse' }; }
    const rows: EnrichedPlace[] = [];
    for (const h of Array.isArray(hotels) ? hotels : []) {
      const name = String(h?.name || '').trim();
      if (!name) continue;
      const rating = Number(h?.rating?.value);
      const count = Number(h?.rating?.count);
      const price = Number(h?.pricing?.bookingPrice);
      const img = Array.isArray(h?.hotel_images) && h.hotel_images.length
        ? String(h.hotel_images[0]?.url || h.hotel_images[0] || '')
        : '';
      const link = String(h?.url || h?.external_booking_url || '');
      const website = link ? (link.startsWith('http') ? link : `https://www.oyorooms.com${link}`) : null;
      rows.push({
        name,
        category,
        rating: Number.isFinite(rating) && rating > 0 ? rating : null,
        ratingCount: Number.isFinite(count) && count >= 0 ? count : null,
        price: Number.isFinite(price) && price > 0 ? price : null,
        priceLabel: Number.isFinite(price) && price > 0 ? `${rupee(price)}/night` : null,
        priceBasis: Number.isFinite(price) && price > 0 ? 'nightly price published by OYO' : null,
        address: h?.address ? String(h.address) : null,
        subcategory: h?.rating?.subtext ? String(h.rating.subtext) : null,
        imageUrl: img || null,
        website,
        source: 'oyo',
        honesty: Number.isFinite(price) && price > 0
          ? 'Guest rating, review count and nightly price are live from OYO.'
          : 'Guest rating is live from OYO; no nightly price was published for this stay.',
      });
    }
    return rows.length ? { rows } : { rows: [], note: `OYO had no stays listed for ${slug}` };
  } catch (e: any) {
    log.warn('Nearby', 'oyo enrich failed', { city: slug, error: String(e?.message || e).slice(0, 60) });
    return { rows: [], note: `OYO unreachable: ${String(e?.message || e).slice(0, 70)}` };
  }
}

/** Turn an enriched place into the row shape the API and pages already speak. */
export function enrichedToRow(p: EnrichedPlace, coords: { lat: number; lng: number } | null, distance: number | null): {
  id: string; name: string; category: string; subcategory: string | null;
  rating: number | null; ratingCount: number | null; priceLevel: null; priceLabel: string | null; price: number | null;
  address: string | null; lat: number | null; lng: number | null; distanceKm: number | null; imageUrl: string | null;
  source: 'google' | 'osm' | 'catalogue'; honesty: string; exitUrl: string; directionsUrl: string; website: string | null;
} {
  return {
    id: `${p.source}-${p.category}-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`,
    name: p.name,
    category: p.category,
    subcategory: p.subcategory || p.priceBasis,
    rating: p.rating,
    ratingCount: p.ratingCount,
    priceLevel: null,
    priceLabel: p.priceLabel,
    price: p.price,
    address: p.address,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    distanceKm: distance,
    imageUrl: p.imageUrl,
    source: 'catalogue', // a real, priced/rated partner row - not OSM and not Google
    honesty: p.honesty,
    exitUrl: '',
    directionsUrl: coords
      ? `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} ${p.address || ''}`.trim())}`,
    website: p.website,
  };
}


/**
 * Coordinates for a rated place whose own feed carries no lat/lng (Swiggy and OYO both omit them).
 * Photon answered in ~0.5s for us, so up to 8 lookups run in parallel inside one 6s budget, and a hit is only
 * accepted when it lands within 15 km of the searched point - a same-name place in another city must not
 * become a fake "1.2 km away".
 */
export async function photonCoords(
  name: string, near: { lat: number; lng: number }, maxMeters = 15000,
): Promise<{ lat: number; lng: number; distanceKm: number } | null> {
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(name)}&lat=${near.lat}&lon=${near.lng}&limit=1&lang=en`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5500);
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': 'Try1Second/1.0 (nearby)' } }).finally(() => clearTimeout(timer));
    if (!res.ok) return null;
    const data: any = await res.json();
    const f = (data.features || [])[0];
    const co = f?.geometry?.coordinates || [];
    const lng = Number(co[0]); const lat = Number(co[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const R = 6371000;
    const dLat = ((lat - near.lat) * Math.PI) / 180;
    const dLng = ((lng - near.lng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((near.lat * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    const meters = 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
    if (!Number.isFinite(meters) || meters > maxMeters) return null;
    return { lat, lng, distanceKm: Math.round((meters / 1000) * 10) / 10 };
  } catch { return null; }
}


/**
 * A real photo for a place whose feed carried none: read the business page's own og:image/twitter:image.
 * Only an absolute https image URL is accepted, the page must be on the place's own host, and the result is
 * cached in-process for 30 minutes so a hot city does not re-fetch. No photo is ever invented: when this
 * returns null the caller falls back to a labelled category tile.
 */
const ogCache = new Map<string, { url: string | null; at: number }>();

export async function ogImage(pageUrl: string | null | undefined): Promise<string | null> {
  const url = String(pageUrl || '').trim();
  if (!/^https:\/\//i.test(url)) return null;
  const hit = ogCache.get(url);
  if (hit && Date.now() - hit.at < 30 * 60_000) return hit.url;
  let found: string | null = null;
  try {
    const res = await cffiFetch(url, { impersonate: 'chrome', timeoutMs: 7000, headers: { accept: 'text/html,application/xhtml+xml' } });
    if (res.status === 200 && res.body) {
      const head = res.body.slice(0, 200_000);
      const patterns = [
        /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
        /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
        /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
      ];
      for (const re of patterns) {
        const m = head.match(re);
        const candidate = m ? m[1].trim() : '';
        if (!candidate) continue;
        const abs = candidate.startsWith('//') ? `https:${candidate}` : candidate;
        if (!/^https:\/\//i.test(abs)) continue;
        if (/\.(svg|gif)(\?|$)/i.test(abs)) continue;
        found = abs;
        break;
      }
    }
  } catch { found = null; }
  ogCache.set(url, { url: found, at: Date.now() });
  return found;
}
