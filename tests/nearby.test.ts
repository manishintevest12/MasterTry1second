/**
 * Nearby & local discovery (owner 13 Nov). The invariants that matter: distances are real, a slug that does not
 * exist is not silently served, the sitemap carries the new URLs, and a card never carries a rating or price the
 * source does not have.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { distanceKm, normalizeNearbyCategory } from '../server/nearby/aggregator';
import { resolveNearbyPage, listNearbyPaths, NEARBY_CATEGORIES } from '../server/nearby/seo';
import { listSeoPaths } from '../server/seo/data';

test('distance is great-circle, not a straight-line guess', () => {
  // Pune -> Mumbai is ~120 km; allow the small curvature difference of the haversine.
  const km = distanceKm({ lat: 18.5204, lng: 73.8567 }, { lat: 19.076, lng: 72.8777 });
  assert.ok(km > 115 && km < 125, `expected ~120 km, got ${km}`);
  assert.equal(distanceKm({ lat: 18.5, lng: 73.8 }, { lat: 18.5, lng: 73.8 }), 0);
  // One decimal place is what the card shows, so the value must already be rounded.
  const shown = distanceKm({ lat: 18.5204, lng: 73.8567 }, { lat: 18.53, lng: 73.86 });
  assert.equal(shown, Math.round(shown * 10) / 10, `${shown} must be rounded to one decimal`);
});

test('category aliases map to the six real verticals, junk falls back to all', () => {
  assert.equal(normalizeNearbyCategory('Restaurant'), 'restaurants');
  assert.equal(normalizeNearbyCategory('cafe'), 'cafes');
  assert.equal(normalizeNearbyCategory('stay'), 'stays');
  assert.equal(normalizeNearbyCategory(' taxi '), 'cabs');
  assert.equal(normalizeNearbyCategory('shop'), 'stores');
  assert.equal(normalizeNearbyCategory('nonsense'), 'all');
  assert.equal(normalizeNearbyCategory(undefined), 'all');
});

test('nearby SEO slugs resolve only for real cities and areas', () => {
  assert.deepEqual(resolveNearbyPage('/nearby/restaurants/pune'), { path: '/nearby/restaurants/pune', category: 'restaurants', city: 'Pune', areaLabel: null });
  assert.equal(resolveNearbyPage('/nearby/hotels/goa')?.city, 'Goa');
  assert.equal(resolveNearbyPage('/nearby/restaurants/pune/koregaon-park')?.areaLabel, 'Koregaon Park, Pune');
  assert.equal(resolveNearbyPage('/nearby/restaurants/atlantis'), null, 'unknown city must 404');
  assert.equal(resolveNearbyPage('/nearby/restaurants/pune/narnia'), null, 'unknown area must 404');
  assert.equal(resolveNearbyPage('/nearby/bogus/pune'), null, 'unknown category must 404');
  assert.equal(resolveNearbyPage('/answers/hotels'), null);
});

test('the sitemap carries every nearby URL', () => {
  const nearby = listNearbyPaths();
  assert.ok(nearby.includes('/nearby'));
  for (const c of NEARBY_CATEGORIES) assert.ok(nearby.includes(`/nearby/${c}`), `missing hub ${c}`);
  assert.ok(nearby.includes('/nearby/restaurants/pune'));
  assert.ok(nearby.includes('/nearby/hotels/goa'));
  assert.ok(nearby.includes('/nearby/restaurants/pune/koregaon-park'));
  assert.equal(new Set(nearby).size, nearby.length, 'no duplicates');
  const seo = listSeoPaths();
  for (const p of ['/nearby', '/nearby/restaurants/pune', '/nearby/hotels/goa']) {
    assert.ok(seo.includes(p), `${p} must be in the sitemap`);
  }
});

test('the API answers both /api/nearby and the /api/v1 alias, and the photo proxy keeps the key server-side', () => {
  const src = readFileSync('server/api/routes.ts', 'utf8');
  assert.match(src, /apiRouter\.get\('\/nearby', nearbyHandler\)/);
  assert.match(src, /apiRouter\.get\('\/v1\/nearby', nearbyHandler\)/);
  const photo = src.slice(src.indexOf("'/nearby/photo'"), src.indexOf("'/nearby/photo'") + 900);
  assert.match(photo, /GOOGLE_PLACES_API_KEY/, 'the key stays on the server');
  assert.match(photo, /photos/, 'only Google photo refs are proxied');
});

test('no card can invent a rating or a price', () => {
  const src = readFileSync('server/nearby/aggregator.ts', 'utf8');
  // OSM rows: rating/price explicitly null, and the honesty line says why.
  const osm = src.slice(src.indexOf('function baseOsmRow'), src.indexOf('function baseOsmRow') + 1600);
  assert.match(osm, /rating: null/);
  assert.match(osm, /priceLevel: null/);
  assert.match(osm, /OSM has no rating or price/);
  // Rated fields only ever come from the Google parse, which reads the live payload.
  assert.match(src, /rating: Number\.isFinite\(Number\(p\.rating\)\) \? Number\(p\.rating\) : null/);
  // No Price No Card still holds for our own catalogue rows.
  assert.match(src, /effective_price IS NOT NULL AND effective_price > 0/);
  // Every outward link is a signed pointer, never a raw merchant URL.
  assert.match(src, /createMaskingPointer\(dest/);
});
