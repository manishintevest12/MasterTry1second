import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  parseEtraveliFlights,
  etraveliFlightFare,
  etraveliSearchBody,
  etraveliSearchUrl,
  etraveliFlightsItems,
  GOTOGATE_IN,
  FLIGHTNETWORK_IN,
} from '../server/workers/parsers/etraveliFlights';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(here, 'fixtures', 'etraveliFlightsSearch.json'), 'utf8'));

const source = { id: 'w_flights_gotogate', name: 'Gotogate', vertical: 'flights' } as any;

test('etraveliSearchUrl targets the brand graphql endpoint', () => {
  assert.equal(etraveliSearchUrl(GOTOGATE_IN.host), 'https://in.gotogate.com/graphql/SearchOnResultPage');
  assert.equal(etraveliSearchUrl(FLIGHTNETWORK_IN.host), 'https://in.flightnetwork.com/graphql/SearchOnResultPage');
});

test('etraveliSearchBody builds the one-way INR search payload', () => {
  const b = etraveliSearchBody(GOTOGATE_IN, 'DEL', 'BOM', '2026-10-28', 0) as any;
  assert.equal(b.operationName, 'SearchOnResultPage');
  assert.equal(b.variables.adults, 1);
  assert.equal(b.variables.cabinClass, 'ECONOMY');
  assert.deepEqual(b.variables.routes, [{ origin: 'DEL', destination: 'BOM', departureDate: '2026-10-28' }]);
  assert.equal(b.variables.offset, undefined); // page 0 omits offset
  assert.match(b.query, /^query SearchOnResultPage\(/);
  const b2 = etraveliSearchBody(FLIGHTNETWORK_IN, 'DEL', 'BOM', '2026-10-28', 20) as any;
  assert.equal(b2.variables.offset, 20);
});

test('parseEtraveliFlights reads flights, count and searchPath; tolerates junk', () => {
  const { flights, flightsCount, searchPath, error } = parseEtraveliFlights(fixture);
  assert.equal(error, undefined);
  assert.equal(flights.length, 10);
  assert.equal(flightsCount, 78);
  assert.match(String(searchPath), /^\/air\/DELBOM28OCT/);
  // shape tolerance
  const nul = parseEtraveliFlights(null);
  assert.equal(nul.flights.length, 0);
  assert.equal(nul.flightsCount, 0);
  assert.match(String(nul.error), /no data\.search/);
  const nodata = parseEtraveliFlights({ data: {} });
  assert.equal(nodata.flights.length, 0);
  assert.equal(nodata.flightsCount, 0);
  const err = parseEtraveliFlights({ errors: [{ message: 'boom' }] });
  assert.equal(err.flights.length, 0);
  assert.match(String(err.error), /boom/);
});

test('etraveliFlightFare converts minor units to rupees, rejects non-INR', () => {
  const { fare, currency } = etraveliFlightFare(parseEtraveliFlights(fixture).flights[0]);
  assert.equal(currency, 'INR');
  assert.equal(fare, 7833); // 783300 paise -> Rs 7,833
  const usd = etraveliFlightFare({ travelerPrices: [{ price: { price: { value: 9805, currency: { code: 'USD' } } } }] });
  assert.equal(usd.currency, 'USD'); // caller filters non-INR
  assert.ok(Number.isNaN(etraveliFlightFare({}).fare));
  assert.ok(Number.isNaN(etraveliFlightFare({ travelerPrices: [{ price: { price: { value: 0, currency: { code: 'INR' } } } }] }).fare));
});

test('etraveliFlightsItems emits honest rows with shareableUrl deeplinks', () => {
  const { flights, searchPath } = parseEtraveliFlights(fixture);
  const items = etraveliFlightsItems(flights, GOTOGATE_IN, source, { from: 'Delhi', to: 'Mumbai' }, 'DEL', 'BOM', '2026-10-28', searchPath);
  assert.ok(items.length >= 5, `expected >=5 rows, got ${items.length}`);
  const first: any = items[0];
  assert.equal(first.seller, 'Gotogate');
  assert.equal(first.currency, 'INR');
  assert.match(first.title, /QP1805|Akasa/);
  assert.match(first.sellerUrl, /^https:\/\/in\.gotogate\.com\/from\/sharedurl\//); // live per-itinerary deeplink
  assert.equal(first.attributes.route, 'Delhi → Mumbai');
  assert.equal(first.attributes.travel_date, '2026-10-28');
  assert.ok(Number(first.price) >= 500 && Number(first.price) <= 500000);
  // dedupe: same flight+time twice collapses
  const dup = etraveliFlightsItems([...flights, ...flights], GOTOGATE_IN, source, { from: 'Delhi', to: 'Mumbai' }, 'DEL', 'BOM', '2026-10-28', searchPath);
  assert.equal(dup.length, items.length);
});

test('etraveliFlightsItems drops wrong-route, wrong-day, non-INR and insane fares', () => {
  const { flights } = parseEtraveliFlights(fixture);
  const good: any = flights[0];
  const mk = (over: Record<string, unknown>) => ({ ...good, ...over }) as any;
  const batch = [
    good,
    mk({ bounds: [{ segments: [{ ...good.bounds[0].segments[0], origin: { code: 'BLR', cityCode: 'BLR' } }] }] }), // wrong origin
    mk({ bounds: [{ segments: [{ ...good.bounds[0].segments[0], departuredAt: '2026-11-02T07:10' }] }] }), // wrong day
    mk({ travelerPrices: [{ price: { price: { value: 1000, currency: { code: 'USD' } } } }] }), // non-INR
    mk({ travelerPrices: [{ price: { price: { value: 3, currency: { code: 'INR' } } } }] }), // Rs 0.03 insane
    mk({ bounds: [] }), // no segments
  ];
  const items = etraveliFlightsItems(batch, GOTOGATE_IN, source, { from: 'Delhi', to: 'Mumbai' }, 'DEL', 'BOM', '2026-10-28', '/air/DELBOM28OCT/1/-/-/c:Y');
  assert.equal(items.length, 1); // only the good flight survives
  // fallback deeplink when shareableUrl missing: brand results path
  const noUrl = etraveliFlightsItems([{ ...good, shareableUrl: '' }], FLIGHTNETWORK_IN, source, { from: 'Delhi', to: 'Mumbai' }, 'DEL', 'BOM', '2026-10-28', '/air/DELBOM28OCT/1/-/-/c:Y');
  assert.equal(noUrl[0].sellerUrl, 'https://in.flightnetwork.com/air/DELBOM28OCT/1/-/-/c:Y');
  assert.equal(noUrl[0].seller, 'FlightNetwork');
});
