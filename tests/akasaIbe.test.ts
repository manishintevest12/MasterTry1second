/**
 * OWNER 10 Nov: "IndiGo/Akasa ki fare API capture karo" (continue). The Akasa endpoint and payload were read
 * straight out of their production bundle, so these tests pin the captured contract AND the honesty rule:
 * a sold-out date, a zero price or a missing token never becomes a card.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { akasaConfigured, akasaLowFareUrl, akasaLowFares } from '../server/workers/parsers/akasaIbe';

test('captured endpoint and query contract', () => {
  const url = akasaLowFareUrl({ origin: 'del', destination: 'bom', startDate: '2026-11-20' });
  assert.match(url, /^https:\/\/prod-bl\.qp\.akasaair\.com\/api\/ibe\/availability\/v2\/search\?/);
  assert.match(url, /origin=DEL/);
  assert.match(url, /destination=BOM/);
  assert.match(url, /startDate=2026-11-20/);
  assert.match(url, /endDate=2026-11-20/, 'single-day search stays single-day');
  assert.match(url, /currencyCode=INR/);
  assert.match(url, /numberOfPassengers=1/);
});

test('only priced, open dates survive', () => {
  const fares = akasaLowFares([
    { date: '2026-11-20T00:00:00', price: 5559, taxesAndFees: 1445, available: 185, soldOut: false },
    { date: '2026-11-21T00:00:00', price: 0, available: 10 },
    { date: '2026-11-22T00:00:00', price: 4200, soldOut: true },
    { date: '2026-11-23T00:00:00', price: 5100, noFlights: true },
    { date: 'nonsense', price: 5000 },
    { date: '2026-11-24T00:00:00', price: 6100 },
  ]);
  assert.deepEqual(fares.map((f) => f.date), ['2026-11-20', '2026-11-24']);
  assert.equal(fares[0].price, 5559);
  assert.equal(fares[0].taxesAndFees, 1445);
});

test('payload shapes the site uses are all read', () => {
  assert.equal(akasaLowFares({ data: [{ date: '2026-11-20', price: 100 }] }).length, 1);
  assert.equal(akasaLowFares({ data: { dates: [{ date: '2026-11-20', price: 100 }] } }).length, 1);
  assert.equal(akasaLowFares({}).length, 0);
  assert.equal(akasaLowFares(null).length, 0);
});

test('no token means the source is idle, never a fake fare', () => {
  const saved = process.env.AKASA_BEARER;
  delete process.env.AKASA_BEARER;
  assert.equal(akasaConfigured(), false);
  if (saved) process.env.AKASA_BEARER = saved;
});

test('source is registered and monetises the Akasa click', () => {
  const src = readFileSync('server/workers/verticals/flights.ts', 'utf8');
  assert.ok(src.includes("sourceId: 'w_flights_akasa_ibe'"), 'akasa ibe source registered');
  const deeplink = readFileSync('server/affiliate/deeplink.ts', 'utf8');
  assert.ok(/akasaair/.test(deeplink) || /akasaair/.test(readFileSync('server/affiliate/merchantLinks.ts', 'utf8')), 'akasaair exit is affiliate-routed');
});
