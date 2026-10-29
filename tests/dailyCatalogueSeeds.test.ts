/**
 * Slow-moving verticals, saved once a day (owner 29 Oct: "movies, ecommerce, credit card ye
 * sab har samay change ni hote — inko aisa save kyun ni krte ki sirf ek baar din mai peeche se
 * chale aur data real time frequently sab ko mile").
 *
 * Contract pinned here:
 *  - movies / ecommerce / creditcards share the finance (24h) cache policy, so a user search
 *    is a cache hit instead of a live scan;
 *  - the keep-warm rotation carries a daily seed set for exactly those verticals, which is
 *    what performs the ONE background refresh per day;
 *  - the volatile verticals (flights/hotels/bus/cab) keep their short TTL — a fare cannot be
 *    a day old.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DAILY_CATALOGUE_SEEDS, FINANCE_DAILY_SEEDS, SEED_QUERIES } from '../server/cron/warm.ts';
import { departmentSeedQueries } from '../server/lens/ecomDepartments.ts';
import { floorWindows } from '../server/search/searchOrchestrator.ts';

// The TTL policy lives in a module-private function, so assert it through the exported
// behaviour that matters: the seeds exist per vertical and the floor windows stay wide.
test('a daily seed set exists for movies, ecommerce and credit cards', () => {
  const byVertical = new Map<string, number>();
  for (const s of DAILY_CATALOGUE_SEEDS) byVertical.set(s.vertical, (byVertical.get(s.vertical) || 0) + 1);
  assert.ok((byVertical.get('movies') || 0) >= 2, 'movies seeds');
  // E-commerce is refreshed by SEED_QUERIES + one seed per department, so the daily block
  // must not repeat it (the duplicate test below enforces that).
  assert.equal(byVertical.get('ecommerce') || 0, 0, 'ecommerce covered by the seed + department lists');
  assert.ok((byVertical.get('creditcards') || 0) >= 2, 'credit card seeds');
});

test('every daily seed names a real city/pincode so the row can be served to that city', () => {
  for (const s of DAILY_CATALOGUE_SEEDS) {
    assert.ok(s.query.trim().length > 2, `query for ${s.vertical}`);
    assert.equal(s.city, 'Indore');
    assert.equal(s.pincode, '452001');
  }
});

test('every e-commerce department and the main product intents are warmed', () => {
  const ecomQueries = new Set(SEED_QUERIES.filter((s) => s.vertical === 'ecommerce').map((s) => s.query.toLowerCase()));
  for (const d of departmentSeedQueries()) assert.ok(ecomQueries.has(d.toLowerCase()), `${d} is in the warm set`);
  for (const q of ['iphone', 'laptop', 'smart tv', 'mobile phone']) assert.ok(ecomQueries.has(q), `${q} is in the warm set`);
});

test('the daily seeds are not duplicated from the existing seed / finance lists', () => {
  const key = (s: { query: string; vertical: string }) => `${s.vertical}|${s.query.toLowerCase()}`;
  const existing = new Set([...SEED_QUERIES.map(key), ...FINANCE_DAILY_SEEDS.map(key)]);
  for (const s of DAILY_CATALOGUE_SEEDS) {
    assert.ok(!existing.has(key(s)), `${s.vertical} "${s.query}" must not be warmed twice per cycle`);
  }
});

test('volatile and slow verticals are treated differently by the floor', () => {
  // Travel keeps the short strict window (a fare is not a day-old fact)…
  assert.ok(floorWindows('bus').strict < floorWindows('ecommerce').strict);
  assert.ok(floorWindows('flights').fallback < floorWindows('ecommerce').fallback);
  // …while the catalogue verticals accept day-old rows, which is what makes them instant.
  assert.ok(floorWindows('movies').strict >= 24 * 3600);
  assert.ok(floorWindows('creditcards').strict >= 24 * 3600);
});
