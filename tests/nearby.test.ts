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

test('keyless enrichment shapes a card correctly and never wears a Google label', async () => {
  const { enrichedToRow } = await import('../server/nearby/enrich');
  const row = enrichedToRow({
    name: 'Le Plaisir', category: 'restaurants', rating: 4.5, ratingCount: 22000,
    price: 1000, priceLabel: '₹1,000 for two', priceBasis: 'cost for two as listed by the restaurant',
    address: 'Kothrud', subcategory: 'European', imageUrl: 'https://media-assets.swiggy.com/x', website: null,
    source: 'swiggy', honesty: 'Rating and cost-for-two are live from Swiggy.',
  }, { lat: 18.52, lng: 73.85 }, 1.8);
  assert.equal(row.rating, 4.5);
  assert.equal(row.ratingCount, 22000);
  assert.equal(row.price, 1000);
  assert.equal(row.distanceKm, 1.8);
  assert.equal(row.source, 'catalogue', 'a partner-fed row is never labelled google');
  assert.match(row.directionsUrl, /destination=18\.52,73\.85/);
  // Without coordinates the directions link must still be usable, by name+address.
  const noCoords = enrichedToRow({ ...({} as any), name: 'X Hotel', category: 'hotels', rating: null, ratingCount: null, price: null, priceLabel: null, priceBasis: null, address: 'Baner', subcategory: null, imageUrl: null, website: null, source: 'oyo', honesty: 'h' }, null, null);
  assert.match(noCoords.directionsUrl, /query=X%20Hotel%20Baner/);
});

test('the enrichment layer is wired into the aggregator with an honest cache version', () => {
  const src = readFileSync('server/nearby/aggregator.ts', 'utf8');
  assert.match(src, /from '\.\/enrich'/, 'enrichment imported');
  assert.match(src, /swiggyPlaces\(location\.lat, location\.lng\)/, 'restaurants/cafes come from the reverse-engineered Swiggy feed');
  assert.match(src, /oyoStays\(location\.city/, 'hotels/stays come from OYO');
  assert.match(src, /const cacheKey = `v/, 'a provider change bumps the cache version so stale unrated payloads stop being served');
  // Rated/priced rows must rank above map-only rows.
  assert.match(src, /const score = \(r: NearbyRow\) => \(r\.rating !== null \? 2 : 0\)/, 'rated rows rank first');
  // A throttled geocoder may never invent a distance.
  const enrich = readFileSync('server/nearby/enrich.ts', 'utf8');
  assert.match(enrich, /meters > maxMeters\) return null/, 'a same-name place in another city cannot become a fake distance');
});

test('the Nearby tab is reachable where the owner looks: the vertical strip, with a visible label', () => {
  const strip = readFileSync('src/components/VerticalNav.tsx', 'utf8');
  assert.match(strip, /setActiveNavTab\('nearby'\)/, 'the vertical strip carries a Nearby chip');
  assert.match(strip, /<span>Nearby<\/span>/, 'the chip is labelled, not a bare icon');
  const navbar = readFileSync('src/components/Navbar.tsx', 'utf8');
  const btn = navbar.slice(navbar.indexOf("handleNavClick('nearby')"), navbar.indexOf("handleNavClick('nearby')") + 700);
  assert.match(btn, /<span>Nearby<\/span>/, 'the header button label is not hidden below lg any more');
  assert.ok(!/hidden lg:inline">Nearby/.test(btn), 'no breakpoint-gated label');
  const app = readFileSync('src/App.tsx', 'utf8');
  assert.match(app, /activeNavTab === 'nearby' && <NearbyView \/>/, 'the tab renders the view');
});

test('every nearby card ships an image and a tracked exit (owner 13 Nov)', async () => {
  const src = readFileSync('server/nearby/aggregator.ts', 'utf8');
  // photo guarantee: provider photo -> the business's own og:image -> a LABELLED category tile
  assert.match(src, /const withOg = await Promise\.all/, 'og:image pass exists');
  assert.match(src, /CATEGORY_TILE\[row\.category\]/, 'a tile fills any remaining gap');
  assert.match(src, /Photo is a category tile, not this place/, 'a tile is labelled, never passed off as a photo');
  // exit guarantee: partner page, else the provider search page, always through /api/out
  assert.match(src, /row\.exitUrl = pointer\(dest, row\.category\)/, 'rows without an exit get one');
  assert.match(src, /swiggy\.com\/search\?query=/, 'restaurants fall back to the provider search page');
  assert.match(src, /in\.bookmyshow\.com\/explore\/cinemas/, 'cinemas fall back to the cinema listing');
  const { CATEGORY_TILE } = await import('../server/nearby/enrich');
  for (const c of ['restaurants', 'cafes', 'hotels', 'stays', 'cabs', 'stores', 'movies', 'all']) {
    assert.ok(CATEGORY_TILE[c], `tile for ${c}`);
  }
  const { existsSync } = await import('node:fs');
  for (const p of Object.values(CATEGORY_TILE)) {
    assert.ok(existsSync(`public${p}`), `${p} must exist on disk`);
  }
});

test('cinemas are a nearby category, in every layer', () => {
  const agg = readFileSync('server/nearby/aggregator.ts', 'utf8');
  assert.match(agg, /cinema: 'movies'/, 'alias');
  assert.match(agg, /movies: \['movie_theater'\]/, 'google type');
  assert.match(agg, /node\["amenity"="cinema"\]/, 'osm filter');
  assert.match(agg, /if \(a === 'cinema'\) return 'movies';/, 'osm classification');
  const seo = readFileSync('server/nearby/seo.ts', 'utf8');
  assert.match(seo, /'cafes', 'hotels', 'stays', 'cabs', 'stores'\]/, 'seo hub list still complete');
  const web = readFileSync('src/components/NearbyView.tsx', 'utf8');
  assert.match(web, /key: 'movies', label: 'Cinemas'/, 'web pill');
  const app = readFileSync('flutter_app/lib/ui/screens/nearby_screen.dart', 'utf8');
  assert.match(app, /'stores', 'movies'\]/, 'app pill');
});

test('Ask AI answers nearby questions from the local engine', () => {
  const lens = readFileSync('server/lens/assistantAnswer.ts', 'utf8');
  assert.match(lens, /export function nearbyIntentFrom/, 'intent helper exists');
  assert.match(lens, /vertical: 'nearby'/, 'nearby vertical is produced');
  const routes = readFileSync('server/api/routes.ts', 'utf8');
  assert.match(routes, /=== 'nearby'\)/, 'assist route branches on it');
  assert.match(routes, /nearbyAnswer\(\{/, 'and answers from the local discovery engine');
});

test('the admin report reads the nearby ledger, not a guess', () => {
  const agg = readFileSync('server/nearby/aggregator.ts', 'utf8');
  assert.match(agg, /CREATE TABLE IF NOT EXISTS nearby_events/, 'ledger table');
  assert.match(agg, /export async function nearbyReport/, 'report reader');
  assert.match(agg, /photoCoveragePct/, 'photo coverage is reported');
  const admin = readFileSync('server/admin/adminRoutes.ts', 'utf8');
  assert.match(admin, /adminRouter\.get\('\/nearby-report'/, 'admin route');
  const tab = readFileSync('src/components/admin/NearbyReportTab.tsx', 'utf8');
  assert.match(tab, /\/api\/admin\/nearby-report/, 'tab calls the route');
});

test('the nearby report is computed from rows, so it cannot depend on SQL aggregate support', async () => {
  const src = readFileSync('server/nearby/aggregator.ts', 'utf8');
  assert.ok(!/COUNT\(\*\)/.test(src.slice(src.indexOf('export async function nearbyReport'))), 'no COUNT(*) dependency');
  assert.ok(!/GROUP BY/.test(src.slice(src.indexOf('export async function nearbyReport'))), 'no GROUP BY dependency');
  const { nearbyReport } = await import('../server/nearby/aggregator');
  const r = await nearbyReport(7);
  assert.equal(r.ok, true);
  assert.ok(Array.isArray(r.byCategory) && Array.isArray(r.topCities) && Array.isArray(r.daily));
  assert.ok(r.photoCoveragePct >= 0 && r.photoCoveragePct <= 100);
});
