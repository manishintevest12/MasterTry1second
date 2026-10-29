/**
 * Hourly, per-city refresh of the slow-catalogue verticals.
 *
 * Owner 29 Oct: "movies ecommerce credit card ye sab har samay change ni hote — save kr ke
 * rakho", then the correction the same day: "sorry din mai ek baar ni hr 1 ghunte mai ek baar
 * kro. hr city ke liye check kr naa."
 *
 * Contract pinned here:
 *  - movies / ecommerce / creditcards keep a ONE HOUR search TTL (3h stale-while-revalidate),
 *    not a day, so a user always reads a catalogue refreshed within the hour;
 *  - the keep-warm rotation (every 12 min) walks query x city pairs round-robin, so EVERY city
 *    is covered inside the hour instead of only the default city;
 *  - cities come from real demand first, then a fallback list, bounded so one cycle can never
 *    stampede dozens of live scans.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CATALOGUE_QUERIES, FALLBACK_CITIES, catalogueCities, hourlyCatalogueSeeds } from '../server/cron/warm.ts';

test('the slow-catalogue TTL is one hour, not a day', () => {
  const src = readFileSync('server/search/searchOrchestrator.ts', 'utf8');
  const body = (src.match(/function searchCacheTtl[\s\S]*?\n\}/) || [''])[0];
  assert.ok(body.includes("['movies', 'ecommerce', 'creditcards']"), 'the three verticals share a tier');
  assert.ok(/ttlSec: 3_600/.test(body), 'fresh window = 1 hour');
  assert.ok(/staleSec: 10_800/.test(body), 'stale-serve = 3 hours');
  assert.ok(!/ttlSec: 86_400/.test(body.split("['movies', 'ecommerce', 'creditcards']")[1]?.split('\n')[0] || ''), 'not a day');
  // A fare still cannot be an hour old.
  assert.ok(body.includes("['flights', 'hotels', 'bus', 'cab']"));
});

test('every catalogue query names a vertical and reads naturally per city', () => {
  for (const q of CATALOGUE_QUERIES) {
    assert.ok(['movies', 'ecommerce', 'creditcards'].includes(q.vertical), `${q.query} -> ${q.vertical}`);
    assert.ok(q.query.trim().length > 2);
  }
});

test('the fallback city list covers the metros and always includes the default city first', () => {
  assert.equal(FALLBACK_CITIES[0].city, 'Indore');
  for (const city of ['Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Pune']) {
    assert.ok(FALLBACK_CITIES.some((c) => c.city === city), `${city} present`);
  }
  for (const c of FALLBACK_CITIES) assert.match(c.pincode, /^\d{6}$/, `${c.city} pincode is 6 digits`);
});

test('cities resolve demand-first without duplicates and within the cap', async () => {
  const cities = await catalogueCities(6);
  assert.ok(cities.length <= 6, `capped, got ${cities.length}`);
  assert.equal(new Set(cities.map((c) => c.city.toLowerCase())).size, cities.length, 'no duplicates');
});

test('one cycle warms a bounded, rotating slice that reaches every city over time', async () => {
  const first = await hourlyCatalogueSeeds(5);
  assert.equal(first.length, 5, 'bounded per cycle');
  const second = await hourlyCatalogueSeeds(5);
  assert.notDeepEqual(first, second, 'the cursor advances instead of re-warming the same pairs');

  // Over enough cycles, every city in the set must appear (round-robin coverage).
  const citiesWanted = new Set((await catalogueCities(4)).map((c) => c.city));
  const seen = new Set<string>();
  for (let i = 0; i < 40; i += 1) for (const s of await hourlyCatalogueSeeds(4)) seen.add(s.city);
  for (const city of citiesWanted) assert.ok(seen.has(city), `${city} is refreshed inside the rotation`);
});

test('a per-city pair carries that city and its pincode', async () => {
  for (const s of await hourlyCatalogueSeeds(6)) {
    assert.ok(s.city.length > 1);
    assert.match(s.pincode, /^\d{6}$/);
    assert.ok(['movies', 'ecommerce', 'creditcards'].includes(s.vertical));
  }
});
