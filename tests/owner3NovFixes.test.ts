import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { DATE_ANSWERING_VERTICALS } from '../server/search/travelDateGate';
import { smartlinkSafe } from '../server/marketing/adSafety';
import { merchantDeepLink } from '../server/affiliate/merchantLinks';

/** OWNER 3 Nov, four reports in one message: movies rowless in the app, a redirect landing on
 *  "Something went wrong", and "hume sb safety measures chaiye" for the ad smartlink. */

test('movies are not date-answering: a requested depart can no longer empty the movie feed', () => {
  // Measured on production: POST /api/scrape/live movies Indore with travelDates.depart = 0 items,
  // without dates = 23 items (7 priced). The app sends dates for movies, so the app saw nothing.
  assert.equal(DATE_ANSWERING_VERTICALS.includes('movies'), false);
  // The fare verticals still are gated - the chosen-date-or-nothing rule stays intact.
  for (const v of ['flights', 'hotels', 'bus']) assert.equal(DATE_ANSWERING_VERTICALS.includes(v), true, v);
});

test('OYO exit goes to the city route that actually loads, not the US-locale /search page', () => {
  const url = merchantDeepLink('OYO Rooms', 'Honeymoon Inn', 'hotels', { city: 'Shimla', date: '2026-11-20', return: '2026-11-22' });
  // Measured: /search?location=Shimla 301s to the "OYO Hotels USA" shell which renders
  // "something went wrong"; /hotels-in-shimla/?checkin= answered 200 with real Shimla hotels.
  assert.ok(!url.includes('/search?location='), `must not use the broken search route: ${url}`);
  assert.ok(url.includes('/hotels-in-shimla/'), url);
  assert.ok(url.includes('checkin=2026-11-20') && url.includes('checkout=2026-11-22'), url);
});

test('EaseMyTrip hotels exit carries the cin/cout pair instead of a bare city (which 404s)', () => {
  const url = merchantDeepLink('EaseMyTrip', 'Hotel Willow Banks', 'hotels', { city: 'Shimla', date: '2026-11-20', return: '2026-11-22' });
  // Measured: ?city=Shimla alone -> hard "404 Error"; with cin/cout -> 200, real listing.
  assert.ok(url.includes('cin=20-11-2026'), url);
  assert.ok(url.includes('cout=22-11-2026'), url);
});

test('smartlink is published only when it is https on a known ad-network host', () => {
  assert.equal(smartlinkSafe('https://araplhn.org/4/d507e5d07b8864a761b95b057aaea9a8').ok, true);
  assert.equal(smartlinkSafe('http://araplhn.org/4/x').ok, false, 'plain http must be refused');
  assert.equal(smartlinkSafe('https://evil.example.com/ad').ok, false, 'unknown host must be refused');
  assert.equal(smartlinkSafe('intent://scan/#Intent;package=com.x;end').ok, false, 'intent:// must be refused');
  assert.equal(smartlinkSafe('').ok, false, 'empty must fail closed');
  assert.equal(smartlinkSafe('not a url').ok, false);
});

test('the ad safety contract keeps the Play-policy flags advertised', () => {
  const safe = smartlinkSafe('https://bauval.org/21/x');
  assert.equal(safe.ok, true);
  assert.ok(safe.allowedHosts.includes('araplhn.org'));
  assert.ok(safe.allowedHosts.includes('bauval.org'));
});

test('the cold ceiling is per vertical so movies can return their enriched set', () => {
  const routes = readFileSync(join(process.cwd(), 'server/api/routes.ts'), 'utf8');
  // Measured: /api/scrape/live movies Bhopal = 22 rows at 3.2s with provider null and 0 priced;
  // POST /api/search the settled 17s answer = 11 rows all priced (District 5 / BMS 3 / TicketNew 3).
  assert.match(routes, /\['movies', 'movie', 'hotels'\]\.includes\(String\(input\.vertical\)\) \? 20_000/, 'movies+hotels wait for their enriched set');
  assert.match(routes, /String\(input\.vertical\) === 'flights' \? 16_000 : 9_000/, 'flights get a middle ceiling, the rest stay fast');
  // The env override still wins when the operator sets it, but it no longer collapses every
  // vertical to one number by default.
  assert.match(routes, /const coldCeilingMs = Number\(process\.env\.T1S_COLD_SEARCH_CEILING_MS \|\| 0\)/, 'operator override still wins');
  // The hard request cap must sit above the longest cold ceiling, or the wait is pointless.
  assert.match(routes, /T1S_HARD_REQUEST_MS \|\| 26_000/, 'hard cap above the 20s ceiling, still under the 55s proxy wall');
});

test('cab is not date-answering: the picker date can no longer blank the cab feed', () => {
  // Measured with the owner's own screenshot query (Chappan Dukan -> River Side Road, Indore):
  // no dates = 7 rows / 6 priced; travelDates.depart = today = 0 rows on both endpoints.
  assert.equal(DATE_ANSWERING_VERTICALS.includes('cab'), false);
});
