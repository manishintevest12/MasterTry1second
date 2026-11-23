import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * OWNER 23 Nov: "goibibo flights add kro" (and: it must show on the website AND in the Flutter app).
 *
 * Goibibo was the one seller in the flights answer with no fare at all, because its only reachable surface was
 * the SEO route page, which is date-blind. flights-cb.goibibo.com/api/fareCalendar is open browserless and
 * publishes the per-date LOWEST INR fare with the cheapest airline named - captured live 23 Nov 2026 for
 * IDR-DEL (327 date keys, 28 Nov 2026 = Rs 7,337 Air India Express). These tests pin the parse and the row we
 * emit from it, because a silent parse break would put Goibibo back to "no price" without any error anywhere.
 */
import {
  parseGoibiboFareCalendar,
  goibiboDayFareItems,
  goibiboFareCalendarUrl,
  goibiboSearchUrl,
} from '../server/workers/parsers/goibiboFareCalendar';
import type { SourceConfig } from '../server/types';

const fixture = readFileSync('tests/fixtures/goibibo-fare-calendar-idr-del.json', 'utf8');

const SOURCE: SourceConfig = {
  id: 'w_flights_goibibo',
  name: 'Goibibo flights',
  method: 'direct_http',
  verticals: ['flights'],
  enabled: true,
  priority: 9,
  config: {},
  rateLimit: { maxRequestsPerMinute: 4, maxConcurrency: 2 },
  freshnessPolicy: { liveVerifiedTtlSec: 900, freshTtlSec: 3600, maxStaleSec: 86400 },
  adapterVersion: '1.0.0',
  parserVersion: '1.0.0',
  requiresAuthorization: false,
  permittedForRetention: true,
};

test('the calendar parses every PRICED date key with a real INR fare', () => {
  const fares = parseGoibiboFareCalendar(fixture);
  // 327 date keys, but only 114 carry a fare; an unpriced date must never become a fake price.
  assert.equal(fares.length, 114);
  const d28 = fares.find((f) => f.dt === '2026-11-28');
  assert.ok(d28, '28 Nov 2026 must be present');
  assert.equal(d28!.pr, 7337);
  assert.equal(d28!.airline, 'Air India Express');
  assert.equal(d28!.label, 'Sat, Nov 28');
});

test('the exact requested date is the fare we publish, and the row is priced', () => {
  const rows = goibiboDayFareItems(
    parseGoibiboFareCalendar(fixture), SOURCE, 'indore', 'delhi', 'IDR', 'DEL', '2026-11-28',
  );
  assert.equal(rows.length, 1);
  const r: any = rows[0];
  assert.equal(r.price, 7337);
  assert.equal(r.currency, 'INR');
  assert.equal(r.seller, 'Goibibo');
  assert.match(String(r.title), /Goibibo.*Indore.*Delhi.*2026-11-28.*7,?337/i);
  assert.equal(r.attributes?.price_basis, 'live_fare');
  // The app and the website both render from this row, so the booking link must be the dated Goibibo search.
  assert.match(String(r.sellerUrl), /goibibo\.com/);
  assert.match(String(r.sellerUrl), /20261128/);
});

test('a date the calendar does not carry falls back to the cheapest upcoming, never to a wrong-day price', () => {
  const fares = parseGoibiboFareCalendar(fixture);
  const rows = goibiboDayFareItems(fares, SOURCE, 'indore', 'delhi', 'IDR', 'DEL', '2029-06-30');
  assert.equal(rows.length, 1);
  const r: any = rows[0];
  assert.notEqual(r.attributes?.price_basis, 'live_fare');
  assert.match(String(r.title), /cheapest upcoming/i);
});

test('a broken or empty payload yields no rows instead of a fake price', () => {
  assert.deepEqual(parseGoibiboFareCalendar('not json'), []);
  assert.deepEqual(parseGoibiboFareCalendar('{"fares":{}}'), []);
  assert.deepEqual(
    goibiboDayFareItems([], SOURCE, 'indore', 'delhi', 'IDR', 'DEL', '2026-11-28'),
    [],
  );
});

test('the API call and the user redirect both carry the date in the format Goibibo accepts', () => {
  const api = goibiboFareCalendarUrl('IDR', 'DEL', '20261128');
  assert.match(api, /^https:\/\/flights-cb\.goibibo\.com\/api\/fareCalendar\?/);
  assert.match(api, /it=IDR-DEL-20261128/);
  // YYYYMMDD, not DDMMYY: the DDMMYY form answers 400 STATUS_MSG_INVALID_DATE (measured 23 Nov 2026).
  assert.ok(!/it=IDR-DEL-281126/.test(api));
  assert.match(goibiboSearchUrl('IDR', 'DEL', '2026-11-28'), /itinerary=IDR-DEL-20261128/);
});
