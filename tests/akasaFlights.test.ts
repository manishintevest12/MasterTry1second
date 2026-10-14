import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAkasaFareCalendar,
  akasaFareCalendarUrl,
  akasaDayFareItems,
} from '../server/workers/parsers/akasaFlights';
import type { SourceConfig } from '../server/types';

const src = { id: 'w_flights_akasa' } as unknown as SourceConfig;

const SAMPLE = `<APIResponse><data><date>2026-10-21T00:00:00</date><price>6568.00</price><isLowest>true</isLowest><noFlights>false</noFlights><soldOut>false</soldOut></data><data><date>2026-10-22T00:00:00</date><price>6671.00</price><isLowest>false</isLowest><noFlights>false</noFlights><soldOut>false</soldOut></data><data><date>2026-10-23T00:00:00</date><price>0.00</price><isLowest>false</isLowest><noFlights>true</noFlights><soldOut>false</soldOut></data><data><junk/></data></APIResponse>`;

test('akasa: XML fare calendar parses dates, prices and flight-availability flags', () => {
  const fares = parseAkasaFareCalendar(SAMPLE);
  assert.equal(fares.length, 3);
  assert.deepEqual(fares[0], { date: '2026-10-21', price: 6568, isLowest: true, noFlights: false, soldOut: false });
  assert.equal(fares[1].price, 6671);
  assert.equal(fares[2].noFlights, true);
});

test('akasa: malformed XML yields an honest empty, never invented fares', () => {
  assert.deepEqual(parseAkasaFareCalendar('<html><body>Access Denied</body></html>'), []);
  assert.deepEqual(parseAkasaFareCalendar(''), []);
});

test('akasa: calendar URL carries full ISO startDate with +05:30 offset (bare dates are a 400)', () => {
  const url = akasaFareCalendarUrl('DEL', 'BOM', '2026-10-21');
  assert.ok(url.startsWith('https://prod-bl.qp.akasaair.com/api/ibe/availability/v2/search?origin=DEL&destination=BOM'));
  assert.ok(url.includes('startDate=2026-10-21T00:00:00%2B05:30'));
  assert.ok(url.includes('numberOfPassengers=1'));
  assert.ok(url.includes('currencyCode=INR'));
});

test('akasa: exact requested date becomes a real offer (seller = Akasa Air)', () => {
  const fares = parseAkasaFareCalendar(SAMPLE);
  const items = akasaDayFareItems(fares, src, 'Delhi', 'Mumbai', 'DEL', 'BOM', '2026-10-21');
  assert.equal(items.length, 1);
  const it = items[0];
  assert.equal(it.title, 'Akasa Air Delhi → Mumbai on 2026-10-21 from ₹6568');
  assert.equal(it.brand, 'Akasa Air');
  assert.equal(it.seller, 'Akasa Air');
  assert.equal(it.price, 6568);
  assert.equal(it.currency, 'INR');
  assert.equal(it.sellerUrl, 'https://www.akasaair.com/booking');
  assert.equal(it.travel?.date, '2026-10-21');
  assert.ok(it.attributes?.data_note?.includes("Akasa Air's official low-fare calendar"));
});

test('akasa: no-flights dates are skipped; cheapest upcoming day is the fallback', () => {
  const fares = parseAkasaFareCalendar(SAMPLE);
  // requested 2026-10-23 is a noFlights day -> fallback to cheapest bookable (2026-10-21)
  const items = akasaDayFareItems(fares, src, 'Delhi', 'Mumbai', 'DEL', 'BOM', '2026-10-23');
  assert.equal(items.length, 1);
  assert.ok(items[0].title.includes('cheapest upcoming, 2026-10-21'));
});

test('akasa: empty calendar yields an honest empty, never a fabricated fare', () => {
  assert.deepEqual(akasaDayFareItems([], src, 'Delhi', 'Mumbai', 'DEL', 'BOM', '2026-10-21'), []);
});
