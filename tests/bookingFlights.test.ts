/**
 * Booking.com flights (BCF) Kayak-family gateway parser tests.
 * The fixture is a SYNTHETIC Kayak-shaped document (the sandbox IP is gated,
 * so no live 200 body exists yet); the full-flow probe validates the real
 * shape on the production Hostinger IP.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBookingFlights, bookingFlightsSrpUrl, bookingFlightsApiUrl } from '../server/workers/parsers/bookingFlights';
import type { SourceConfig } from '../server/types';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'bookingFlightsSearch.json'), 'utf8'));

const source: SourceConfig = {
  id: 'w_flights_bookingcom',
  name: 'Booking.com flights',
  url: 'https://flights.booking.com/',
  vertical: 'flights',
} as unknown as SourceConfig;

test('parseBookingFlights extracts ranked rows with fares, flight numbers and stops', () => {
  const items = parseBookingFlights(fixture, source, 'DEL', 'BOM', 'Delhi', 'Mumbai', '2026-10-28');
  // f1 direct (7082), f2 direct (7228.50 -> 7229 round), f3 one-stop (6540) kept;
  // f4 dup of f1, f5 unpriced, f6 multi-city dropped
  assert.equal(items.length, 3);
  assert.deepEqual(items.map((i) => i.attributes?.flight_number), ['6E5175', 'SG612', '6E5178-6E5179']);
  assert.equal(items[0].price, 7082);
  assert.equal(items[0].seller, 'Booking.com');
  assert.equal(items[0].currency, 'INR');
  assert.equal(items[0].attributes?.airline, 'IndiGo');
  assert.equal(items[0].attributes?.departure, '12:55');
  assert.equal(items[0].attributes?.arrival, '15:10');
  assert.equal(items[0].attributes?.stops, '0');
  assert.equal(items[2].attributes?.stops, '1');
  // honest sold-by basis note
  assert.match(String(items[0].attributes?.price_basis), /Booking\.com's flight search/);
  assert.match(String(items[0].attributes?.data_note), /SOLD by Booking\.com/);
  // deep-link goes straight to the results page, not the home page
  assert.equal(items[0].sellerUrl, 'https://flights.booking.com/airplane-flights/DEL.BOM/2026-10-28?type=ONEWAY&adults=1&cabinClass=ECONOMY');
  // grouping order: cheapest first
  assert.ok((items[0].price ?? 0) <= (items[1].price ?? 0));
});

test('parseBookingFlights drops non-INR storefronts and empty/garbage bodies', () => {
  assert.equal(parseBookingFlights({ ...fixture, currency: 'USD' }, source, 'DEL', 'BOM', 'Delhi', 'Mumbai', '2026-10-28').length, 0);
  assert.equal(parseBookingFlights([], source, 'DEL', 'BOM', 'Delhi', 'Mumbai', '2026-10-28').length, 0);
  assert.equal(parseBookingFlights(null, source, 'DEL', 'BOM', 'Delhi', 'Mumbai', '2026-10-28').length, 0);
  assert.equal(parseBookingFlights({ flights: [] }, source, 'DEL', 'BOM', 'Delhi', 'Mumbai', '2026-10-28').length, 0);
  // gated-empty array (what the edge returns to sandbox IPs today)
  assert.equal(parseBookingFlights([], source, 'DEL', 'BOM', 'Delhi', 'Mumbai', '2026-10-28').length, 0);
});

test('parseBookingFlights caps output at 40 rows and dedups by flight+time', () => {
  // 60 DISTINCT itineraries -> capped at 40
  const distinct = {
    currency: 'INR',
    carriers: [{ id: 'c6E', name: 'IndiGo' }],
    legs: Array.from({ length: 60 }, (_, i) => ({ id: `leg${i}`, carrier: 'c6E', duration: 120, segments: [`seg${i}`] })),
    segments: Array.from({ length: 60 }, (_, i) => ({ id: `seg${i}`, flightNumber: String(5000 + i), carriers: { marketing: ['6E'] }, departureTime: { time: '12:55' } })),
    flights: Array.from({ length: 60 }, (_, i) => ({ id: `f${i}`, legs: [`leg${i}`], priceMajor: 5000 + i, priceMinor: 0 })),
  };
  const items = parseBookingFlights(distinct, source, 'DEL', 'BOM', 'Delhi', 'Mumbai', '2026-10-28');
  assert.equal(items.length, 40);
  // 60 IDENTICAL itineraries -> dedup by flight+time keeps 1
  const same = {
    currency: 'INR',
    carriers: [{ id: 'c6E', name: 'IndiGo' }],
    legs: [{ id: 'leg1', carrier: 'c6E', duration: 120, segments: ['seg1'] }],
    segments: [{ id: 'seg1', flightNumber: '5175', carriers: { marketing: ['6E'] }, departureTime: { time: '12:55' } }],
    flights: Array.from({ length: 60 }, (_, i) => ({ id: `f${i}`, legs: ['leg1'], priceMajor: 5000 + i, priceMinor: 0 })),
  };
  assert.equal(parseBookingFlights(same, source, 'DEL', 'BOM', 'Delhi', 'Mumbai', '2026-10-28').length, 1);
});

test('URL builders produce the captured gateway and SRP recipes', () => {
  const api = bookingFlightsApiUrl('DEL', 'BOM', '2026-10-28');
  assert.match(api, /^https:\/\/flights\.booking\.com\/api\/flights\/\?type=ONEWAY&adults=1&cabinClass=ECONOMY&depart=2026-10-28&from=DEL\.AIRPORT&to=BOM\.AIRPORT&chal_t=\d+/);
  assert.match(api, /search_source=user$/);
  assert.equal(
    bookingFlightsSrpUrl('DEL', 'BOM', '2026-10-28'),
    'https://flights.booking.com/airplane-flights/DEL.BOM/2026-10-28?type=ONEWAY&adults=1&cabinClass=ECONOMY',
  );
});
