/**
 * Air India fare-calendar regression (24 Oct 2026): api.airindia.com/
 * airline-fares/v1/search is the browserless Air India fares source
 * (public APIM subscription key only). Fixture recorded LIVE from the
 * sandbox 24 Oct 2026 (DEL-BOM one-way calendar, departure 28 Oct):
 * 61 daily one-way fares, 28 Oct total 7205 (tripInfo.duration null). Guards: ISO date + total
 * parsing, exact-date-first item build, honest cheapest-upcoming
 * fallback, and the IBE redirect URL.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseAirIndiaFares, airIndiaDayFareItems, airIndiaSearchUrl, airIndiaFaresBody, airIndiaFaresHeaders } from '../server/workers/parsers/airIndiaFares.ts';

const src: any = { id: 't_flights_airindia', name: 'Air India', method: 'http', verticals: ['flights'], enabled: true, priority: 14, config: {}, rateLimit: { maxRequestsPerMinute: 4, maxConcurrency: 1 }, freshnessPolicy: {} };

const FIX = JSON.parse(readFileSync(new URL('./fixtures/airindia_lowfare_del_bom.json', import.meta.url), 'utf8'));
const LIVE = JSON.stringify(FIX.response);

const SYN = JSON.stringify({
  data: {
    fares: [
      { departureDate: '2026-10-28T00:00:00', totalPrice: { base: '4364', tax: '2841', total: '7205', currency: 'INR' } },
      { departureDate: '2026-10-29T00:00:00', totalPrice: { base: '4761', tax: '2865', total: '7626', currency: 'INR' } },
      { departureDate: '2026-10-31T00:00:00', totalPrice: { base: '4364', tax: '2841', total: '7205', currency: 'INR' } },
      { departureDate: 'garbage', totalPrice: { base: '100', tax: '10', total: '110', currency: 'INR' } },                                  // bad date -> dropped
      { departureDate: '2026-11-01T00:00:00', totalPrice: { base: '0', tax: '0', total: '0', currency: 'INR' } },                            // zero fare -> dropped
    ],
  },
});

test('parseAirIndiaFares decodes the live DEL-BOM one-way calendar', () => {
  const fares = parseAirIndiaFares(LIVE);
  assert.ok(fares.length >= 55, `expected a real ~61-day calendar, got ${fares.length}`);
  const byDt = Object.fromEntries(fares.map((f) => [f.dt, f]));
  const f28 = byDt['2026-10-28'];
  assert.ok(f28, '28 Oct entry present');
  assert.ok(f28.pr > 3000 && f28.pr < 12000, `28 Oct one-way total realistic, got ${f28.pr}`);
});

test('parseAirIndiaFares drops bad dates and zero totals', () => {
  const fares = parseAirIndiaFares(SYN);
  assert.equal(fares.length, 3);
  assert.equal(fares[0].dt, '2026-10-28');
  assert.equal(fares[0].pr, 7205);
});

test('airIndiaDayFareItems: exact date wins, seller and airline both Air India', () => {
  const fares = parseAirIndiaFares(SYN);
  const items = airIndiaDayFareItems(fares, src, 'Delhi', 'Mumbai', 'DEL', 'BOM', '2026-10-28');
  assert.equal(items.length, 1);
  const it: any = items[0];
  assert.equal(it.price, 7205);
  assert.equal(it.currency, 'INR');
  assert.equal(it.seller, 'Air India');
  assert.match(it.title, /Air India Delhi → Mumbai on 2026-10-28/);
  assert.equal(it.attributes.airline, 'Air India');
  assert.equal(it.attributes.departure_date, '2026-10-28');
  assert.equal(it.travel.date, '2026-10-28');
  assert.equal(it.sellerUrl, airIndiaSearchUrl('DEL', 'BOM', '2026-10-28'));
});

test('airIndiaDayFareItems: cheapest upcoming fallback is labelled', () => {
  const fares = parseAirIndiaFares(SYN);
  const items = airIndiaDayFareItems(fares, src, 'Delhi', 'Mumbai', 'DEL', 'BOM', '2026-12-24');
  assert.equal(items.length, 1);
  const it: any = items[0];
  // cheapest of {7205 (28 Oct), 7626 (29 Oct), 7205 (31 Oct)} is 28 Oct
  assert.equal(it.price, 7205);
  assert.equal(it.attributes.departure_date, '2026-10-28');
  assert.match(it.title, /cheapest upcoming/);
});

test('airIndiaDayFareItems: empty calendar emits nothing (honest empty)', () => {
  assert.equal(airIndiaDayFareItems([], src, 'Delhi', 'Mumbai', 'DEL', 'BOM', '2026-10-28').length, 0);
});

test('airIndiaSearchUrl is the IBE booking deeplink the widget opens', () => {
  const u = airIndiaSearchUrl('DEL', 'BOM', '2026-10-28');
  assert.equal(u, 'https://www.airindia.com/in/en/ibe/booking.html?origin=DEL&destination=BOM&departDate=2026-10-28#/availability/departure');
});

test('airIndiaFaresBody matches the captured one-way widget XHR shape', () => {
  const b = JSON.parse(airIndiaFaresBody('DEL', 'BOM', '2026-10-28'));
  assert.deepEqual(b, {
    classType: 'ECONOMY', concessionType: null,
    itinerary: { origin: 'DEL', destination: 'BOM', departureDate: '2026-10-28', returnDate: null, originCountryCode: 'IN' },
    tripInfo: { duration: null, range: 60, durationFlexibility: null },
  });
});

test('airIndiaFaresHeaders carries the public APIM subscription key', () => {
  const h = airIndiaFaresHeaders();
  assert.match(h['Ocp-Apim-Subscription-Key'], /^[0-9a-f]{32}$/);
  assert.equal(h['Origin'], 'https://www.airindia.com');
});
