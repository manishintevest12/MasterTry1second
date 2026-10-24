/**
 * Air India Express low-fare calendar regression (24 Oct 2026):
 * api.airindiaexpress.com/b2c-flightsearch/v2/lowFares is the browserless
 * AIX fares source (public web subscription key, no auth chain; the v4/fsa
 * per-flight search stays auth-gated). Fixture recorded LIVE from the
 * sandbox 24 Oct 2026: DEL-BOM 31 per-date entries, e.g. 28 Oct 2026
 * price 6677, taxesAndFees 1798, available 37. Guards: ISO date+price
 * parsing, noFlights/soldOut dates never become offers, exact-date-first
 * item build, honest cheapest-upcoming fallback, and the SRP redirect URL.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseAixLowFares, aixDayFareItems, aixSearchUrl, aixLowFaresBody } from '../server/workers/parsers/aixLowFares.ts';

const src: any = { id: 't_flights_aix', name: 'Air India Express', method: 'http', verticals: ['flights'], enabled: true, priority: 14, config: {}, rateLimit: { maxRequestsPerMinute: 4, maxConcurrency: 1 }, freshnessPolicy: {} };

const FIX = JSON.parse(readFileSync(new URL('./fixtures/aix_lowfares_del_bom.json', import.meta.url), 'utf8'));
const LIVE = JSON.stringify(FIX.response);

const SYN = JSON.stringify({
  lowFares: [
    { date: '2026-10-28T00:00:00', price: 6677, taxesAndFees: 1798, available: 37, noFlights: false, soldOut: false },
    { date: '2026-10-29T00:00:00', price: 5999, taxesAndFees: 1700, available: 20, noFlights: false, soldOut: false },
    { date: '2026-10-30T00:00:00', price: 4999, taxesAndFees: 1700, available: 10, noFlights: true, soldOut: false },   // not flyable
    { date: '2026-10-31T00:00:00', price: 3999, taxesAndFees: 1700, available: 10, noFlights: false, soldOut: true },   // sold out
    { date: 'garbage', price: 100, noFlights: false, soldOut: false },                                                  // bad date -> dropped
    { date: '2026-11-01T00:00:00', price: 0, noFlights: false, soldOut: false },                                        // zero fare -> dropped
  ],
});

test('parseAixLowFares decodes the live DEL-BOM fixture', () => {
  const fares = parseAixLowFares(LIVE);
  assert.ok(fares.length >= 20, `expected a real calendar, got ${fares.length}`);
  const byDt = Object.fromEntries(fares.map((f) => [f.dt, f]));
  const f28 = byDt['2026-10-28'];
  assert.ok(f28, '28 Oct entry present');
  assert.equal(f28.pr, 6677);
  assert.equal(f28.taxes, 1798);
  assert.equal(f28.available, 37);
  assert.equal(f28.noFlights, false);
  assert.equal(f28.soldOut, false);
});

test('parseAixLowFares drops bad rows and keeps sellability flags', () => {
  const fares = parseAixLowFares(SYN);
  // garbage date and zero price are dropped; noFlights/soldOut rows STAY with flags
  assert.equal(fares.length, 4);
  assert.equal(fares[0].dt, '2026-10-28');
  const byDt = Object.fromEntries(fares.map((f) => [f.dt, f]));
  assert.equal(byDt['2026-10-30'].noFlights, true);
  assert.equal(byDt['2026-10-31'].soldOut, true);
  assert.equal(byDt['2026-10-28'].noFlights, false);
});

test('aixDayFareItems: exact date wins, seller and airline both Air India Express', () => {
  const fares = parseAixLowFares(SYN);
  const items = aixDayFareItems(fares, src, 'Delhi', 'Mumbai', 'DEL', 'BOM', '2026-10-28');
  assert.equal(items.length, 1);
  const it: any = items[0];
  assert.equal(it.price, 6677);
  assert.equal(it.currency, 'INR');
  assert.equal(it.seller, 'Air India Express');
  assert.match(it.title, /Air India Express Delhi → Mumbai on 2026-10-28/);
  assert.equal(it.attributes.airline, 'Air India Express');
  assert.equal(it.attributes.departure_date, '2026-10-28');
  assert.equal(it.travel.date, '2026-10-28');
  assert.equal(it.sellerUrl, aixSearchUrl('DEL', 'BOM', '2026-10-28'));
});

test('aixDayFareItems: sold-out/no-flight dates never become offers', () => {
  const fares = parseAixLowFares(SYN);
  const items = aixDayFareItems(fares, src, 'Delhi', 'Mumbai', 'DEL', 'BOM', '2026-10-30');
  assert.equal(items.length, 1);
  // 30 Oct is noFlights, 31 Oct is soldOut -> cheapest UPCOMING sellable is 29 Oct (5999)
  const it: any = items[0];
  assert.equal(it.price, 5999);
  assert.equal(it.attributes.departure_date, '2026-10-29');
  assert.match(it.title, /cheapest upcoming/);
});

test('aixDayFareItems: empty calendar emits nothing (honest empty)', () => {
  assert.equal(aixDayFareItems([], src, 'Delhi', 'Mumbai', 'DEL', 'BOM', '2026-10-28').length, 0);
});

test('aixSearchUrl is the AIX SRP deeplink pattern from the bundle', () => {
  const u = aixSearchUrl('DEL', 'BOM', '2026-10-28');
  assert.equal(u, 'https://www.airindiaexpress.com/search-results?origin=DEL&destination=BOM&triptype=OneWay&departureDate=2026-10-28');
});

test('aixLowFaresBody matches the verified Navitaire payload shape', () => {
  const b = JSON.parse(aixLowFaresBody('DEL', 'BOM', '2026-10-24', '2026-11-23'));
  assert.deepEqual(b, {
    startDate: '2026-10-24', endDate: '2026-11-23', origin: 'DEL', destination: 'BOM',
    currencyCode: 'INR', includeTaxesAndFees: true, numberOfPassengers: 1, fareType: 'None',
  });
});
