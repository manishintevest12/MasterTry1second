import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  parseFlightsMojoResearch,
  flightsMojoItems,
  flightsMojoSearchBody,
  flightsMojoSrpUrl,
  FLIGHTSMOJO_SEARCH_URL,
} from '../server/workers/parsers/flightsMojo';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(here, 'fixtures', 'flightsMojoSearch.json'), 'utf8'));

test('search body has the captured shape (client IDs, INR storefront)', () => {
  const b = flightsMojoSearchBody('DEL', 'BOM', '2026-10-28') as Record<string, any>;
  assert.equal(b.currencyCode, 'INR');
  assert.equal(b.adults, 1);
  assert.equal(b.tripType, 1);
  assert.equal(b.segment[0].originAirport, 'DEL');
  assert.equal(b.segment[0].destinationAirport, 'BOM');
  assert.equal(b.segment[0].travelDate, '2026-10-28T00:00:00');
  assert.match(String(b.userSessionID), /-/); // client-generated, non-empty
  assert.match(String(b.fareCachingKey), /^DELBOM2810 261001$|^DELBOM2810261001$/);
  assert.match(FLIGHTSMOJO_SEARCH_URL, /flightsmojo\.in\/api\/flight\/search$/);
});

test('parseFlightsMojoResearch extracts itineraries from the res[0] envelope', () => {
  const itins = parseFlightsMojoResearch(fixture);
  assert.ok(itins.length >= 5, `expected >=5, got ${itins.length}`);
});

test('flightsMojoItems maps the fixture to honest INR rows on the requested route', () => {
  const itins = parseFlightsMojoResearch(fixture);
  const source = { id: 'w_flights_flightsmojo', name: 'FlightsMojo', vertical: 'flights' } as any;
  const items = flightsMojoItems(itins, source, { from: 'Delhi', to: 'Mumbai' }, 'DEL', 'BOM', '2026-10-28');
  assert.ok(items.length >= 4, `expected >=4, got ${items.length}`);
  const it0 = items[0] as any;
  assert.equal(it0.seller, 'FlightsMojo');
  assert.equal(it0.currency, 'INR');
  assert.ok((it0.prices?.effectivePrice ?? it0.price) >= 500, 'real fare, never junk');
  assert.match(it0.sellerUrl, /flightsmojo\.in\/flight\/searchflights\?sec1=DEL%7CBOM%7C2026-10-28/);
  assert.equal(it0.attributes.travel_date, '2026-10-28');
  // fixture rows are direct DEL-BOM + 1-stop — flight numbers, stops populated
  const stops = items.map((i: any) => Number(i.attributes.stops));
  assert.ok(stops.includes(0) && stops.includes(1));
  const anyDirect = items.find((i: any) => Number(i.attributes.stops) === 0) as any;
  assert.match(String(anyDirect.title), /DEL → Mumbai|→ Mumbai/);
  assert.match(String(anyDirect.attributes.flight_number), /^(6E|SG|IX|QP|AI|UK|I5|G8)/);
});

test('flightsMojoItems drops off-route, off-date, non-INR and junk-price rows', () => {
  const itins = [
    // wrong destination (research can return nearby-airport itineraries)
    { vc: 'SG', fare: { pf: 5000, cur: 'INR' }, fseg: [{ dur: 130, segs: [{ al: 'SG', fn: '100', org: 'DEL', dst: 'GOI', dt: '2026-10-28T08:00:00', at: '2026-10-28T10:10:00' }] }] },
    // wrong day
    { vc: 'SG', fare: { pf: 5000, cur: 'INR' }, fseg: [{ dur: 130, segs: [{ al: 'SG', fn: '101', org: 'DEL', dst: 'BOM', dt: '2026-10-27T08:00:00', at: '2026-10-27T10:10:00' }] }] },
    // USD row must be dropped (never convert)
    { vc: '6E', fare: { pf: 67.02, cur: 'USD' }, fseg: [{ dur: 120, segs: [{ al: '6E', fn: '5175', org: 'DEL', dst: 'BOM', dt: '2026-10-28T12:55:00', at: '2026-10-28T14:55:00' }] }] },
    // junk price
    { vc: 'IX', fare: { pf: 12, cur: 'INR' }, fseg: [{ dur: 120, segs: [{ al: 'IX', fn: '1080', org: 'DEL', dst: 'BOM', dt: '2026-10-28T05:30:00', at: '2026-10-28T07:45:00' }] }] },
    // good row
    { vc: 'SG', fare: { pf: 5606, cur: 'INR' }, fseg: [{ dur: 140, segs: [{ al: 'SG', fn: '612', org: 'DEL', dst: 'BOM', dt: '2026-10-28T19:20:00', at: '2026-10-28T21:40:00' }] }] },
  ];
  const source = { id: 'w_flights_flightsmojo', name: 'FlightsMojo', vertical: 'flights' } as any;
  const items = flightsMojoItems(itins as any, source, { from: 'Delhi', to: 'Mumbai' }, 'DEL', 'BOM', '2026-10-28');
  assert.equal(items.length, 1);
  const it = items[0] as any;
  assert.equal(it.attributes.flight_number, 'SG612');
  assert.equal(it.prices?.effectivePrice ?? it.price, 5606);
});

test('flightsMojoSrpUrl deeplinks the IN storefront with route+date', () => {
  const u = flightsMojoSrpUrl('IDR', 'DEL', '2026-10-28');
  assert.match(u, /^https:\/\/www\.flightsmojo\.in\/flight\/searchflights\?sec1=IDR%7CDEL%7C2026-10-28/);
  assert.match(u, /currency=INR/);
});

test('empty research envelope yields no items', () => {
  const source = { id: 'w_flights_flightsmojo', name: 'FlightsMojo', vertical: 'flights' } as any;
  assert.deepEqual(flightsMojoItems([], source, { from: 'a', to: 'b' }, 'AAA', 'BBB', '2026-10-28'), []);
  assert.deepEqual(parseFlightsMojoResearch({ rsp: { status: 1 }, res: [] }), []);
});
