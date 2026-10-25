import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  parseAgodaFlights,
  agodaFlightsItems,
  agodaBundleFare,
  agodaSearchBody,
  agodaFlightsSrpUrl,
  AGODA_SEARCH_URL,
} from '../server/workers/parsers/agodaFlights';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(here, 'fixtures', 'agodaFlightsSearch.json'), 'utf8'));

test('search body has the captured shape (client UUIDs, INR storefront)', () => {
  const b = agodaSearchBody('DEL', 'BOM', '2026-10-28', 2) as Record<string, any>;
  assert.equal(b.context.userSettings.currencyCode, 'INR');
  const trip = b.trips[0];
  assert.equal(trip.pagination.number, 2);
  assert.equal(trip.slices[0].origin[0].code, 'DEL');
  assert.equal(trip.slices[0].destination[0].code, 'BOM');
  assert.equal(trip.slices[0].departureDate, '2026-10-28');
  assert.match(String(b.flightsRequestId), /[0-9a-f-]{36}/); // client-generated, non-empty
  assert.equal(AGODA_SEARCH_URL, 'https://www.agoda.com/api/gw/flight/SearchUnbundled?');
});

test('parseAgodaFlights flattens trips[].bundles[]', () => {
  const bundles = parseAgodaFlights(fixture);
  assert.ok(bundles.length >= 3, `expected >=3, got ${bundles.length}`);
  assert.equal(parseAgodaFlights({ trips: [] }).length, 0);
  assert.equal(parseAgodaFlights({}).length, 0);
});

test('agodaFlightsItems maps the fixture to honest INR rows on DEL-BOM only', () => {
  const bundles = parseAgodaFlights(fixture);
  const source = { id: 'w_flights_agodaflights', name: 'Agoda', vertical: 'flights' } as any;
  const items = agodaFlightsItems(bundles, source, { from: 'Delhi', to: 'Mumbai' }, 'DEL', 'BOM', '2026-10-28');
  // fixture: 2 DEL-BOM directs kept; HDO and DXN off-market rows dropped
  assert.equal(items.length, 2);
  for (const it of items as any[]) {
    assert.equal(it.seller, 'Agoda');
    assert.equal(it.currency, 'INR');
    const p = it.prices?.effectivePrice ?? it.price;
    assert.ok(p >= 500 && p <= 500000, 'sane real fare');
    assert.match(it.sellerUrl, /agoda\.com\/flights\/search\?origin=DEL&destination=BOM&departDate=2026-10-28/);
    assert.equal(it.attributes.travel_date, '2026-10-28');
    assert.match(String(it.attributes.flight_number), /^(6E|SG|IX|QP|AI|UK|I5|G8)\d+$/);
    assert.equal(it.attributes.stops, '0');
  }
});

test('agodaFlightsItems drops non-INR, junk-price, multi-city and off-day rows', () => {
  const seg = (org: string, dst: string, fn = '5175') => ({
    originAirport: org, destinationAirport: dst, flightNumber: fn, carrierCode: '6E',
    departDateTime: '2026-10-28T12:55:00', arrivalDateTime: '2026-10-28T14:55:00',
    carrierContent: { carrierName: 'IndiGo' },
  });
  const bp = (currency: string, amount: number) => ({
    price: { [currency]: { display: { perBook: { allInclusive: amount } } } },
  });
  const bundles: any[] = [
    { key: 'ok', bundlePrice: [bp('inr', 7082.17)], outboundSlice: { duration: 120, segments: [seg('DEL', 'BOM')] }, itineraries: [{ itineraryInfo: { id: 'ok-1', ticketingAirline: '6E' } }] },
    // USD bundle must be dropped (never convert)
    { key: 'usd', bundlePrice: [bp('usd', 85.5)], outboundSlice: { duration: 120, segments: [seg('DEL', 'BOM', '5176')] } },
    // junk price
    { key: 'junk', bundlePrice: [bp('inr', 3.5)], outboundSlice: { duration: 120, segments: [seg('DEL', 'BOM', '5177')] } },
    // off-route (multi-city ending elsewhere)
    { key: 'offrt', bundlePrice: [bp('inr', 7082)], outboundSlice: { duration: 200, segments: [seg('DEL', 'GOI', '5178'), seg('GOI', 'BOM', '5179')] } },
    // wrong day
    { key: 'offday', bundlePrice: [bp('inr', 7082)], outboundSlice: { duration: 120, segments: [seg('DEL', 'BOM', '5180')] } },
  ];
  bundles[4].outboundSlice.segments[0].departDateTime = '2026-10-27T12:55:00';
  bundles[4].outboundSlice.segments[0].arrivalDateTime = '2026-10-27T14:55:00';
  const source = { id: 'w_flights_agodaflights', name: 'Agoda', vertical: 'flights' } as any;
  const items = agodaFlightsItems(bundles, source, { from: 'Delhi', to: 'Mumbai' }, 'DEL', 'BOM', '2026-10-28');
  // 'ok' direct kept; 'offrt' DEL-GOI-BOM is a legitimate 1-stop connection, also kept;
  // usd/junk/off-day dropped
  assert.equal(items.length, 2);
  const direct = items.find((i: any) => i.attributes.flight_number === '6E5175') as any;
  assert.ok(direct, 'direct 6E5175 kept');
  assert.equal(Math.round(direct.prices?.effectivePrice ?? direct.price), 7082);
  const conn = items.find((i: any) => i.attributes.flight_number === '6E5178-6E5179') as any;
  assert.ok(conn, 'connection kept');
  assert.equal(conn.attributes.stops, '1');
});

test('agodaBundleFare reads the all-inclusive INR fare and flags other currencies', () => {
  const mk = (cur: string, v: number) => ({ bundlePrice: [{ price: { [cur]: { display: { perBook: { allInclusive: v } } } } }] });
  assert.deepEqual(agodaBundleFare(mk('inr', 7082.17)), { fare: 7082.17, currency: 'INR' });
  assert.equal(agodaBundleFare(mk('usd', 85.5)).currency, 'USD');
  assert.ok(Number.isNaN(agodaBundleFare({}).fare));
});

test('agodaFlightsSrpUrl deeplinks the site search page', () => {
  const u = agodaFlightsSrpUrl('IDR', 'DEL', '2026-10-28');
  assert.match(u, /^https:\/\/www\.agoda\.com\/flights\/search\?origin=IDR&destination=DEL&departDate=2026-10-28&adults=1&cabinType=Economy$/);
});
