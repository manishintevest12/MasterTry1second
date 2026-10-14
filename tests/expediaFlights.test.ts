/**
 * Expedia flights parser (flights-shopping-pwa GraphQL).
 * Fixture = REAL response captured live on 14 Oct 2026 (Indore→Delhi, 21 Oct 2026,
 * FlightsSearchResultsLoadedQuery; includes AI2516 $89 2:15pm→3:55pm etc.).
 * Policy: no fabricated prices; parser drops any listing without a real price.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseExpediaFlights } from '../server/workers/parsers/expediaFlights.ts';

const src: any = { id: 'w_flights_expedia', name: 'Expedia', vertical: 'flights', method: 'direct_http' };
const fixture = readFileSync(new URL('./fixtures/expediaFlights-idr-del-2026-10-21.json', import.meta.url), 'utf8');
const route = { from: 'Indore', to: 'Delhi', fromCode: 'IDR', toCode: 'DEL' };
const srp = 'https://www.expedia.com/Flights-Search?flight-type=oneway&from-date=2026-10-21&from=Indore%20(IDR)&to=Delhi%20(DEL)&search-type=arsed&mode=search';

test('expedia flights: parses real fixture offers with flight number, times, converted INR', () => {
  const fx = { rate: 95.32, source: 'open.er-api.com' };
  const items = parseExpediaFlights(fixture, src, route, '2026-10-21', srp, fx);
  assert.ok(items.length >= 2, 'expected at least two priced flights in the fixture');
  const o: any = items[0];
  assert.ok(o.title.includes('AI2516') || /6E\d+|IX\d+|AI\d+/.test(o.title), 'flight number in title');
  assert.ok(o.title.includes('Indore → Delhi'), 'route in title');
  assert.ok(o.price > 0, 'converted INR price required');
  assert.equal(o.currency, 'INR');
  assert.equal(o.seller, 'Expedia', 'Expedia is the price-owning OTA');
  assert.ok(o.sellerUrl.startsWith('https://www.expedia.com/Flights-Search'), 'deeplink to expedia.com SRP');
  assert.ok(/\d{1,2}:\d{2}(am|pm)/i.test(String(o.attributes.departure)), 'departure time');
  assert.ok(/\d{1,2}:\d{2}(am|pm)/i.test(String(o.attributes.arrival)), 'arrival time');
  assert.ok(String(o.attributes.airports).includes('IDR'), 'origin airport');
  assert.ok(String(o.attributes.airports).includes('DEL'), 'destination airport');
  assert.ok(String(o.attributes.image_url).startsWith('https://'), 'airline logo url');
  assert.ok(String(o.attributes.data_note).includes('listed on expedia.com'), 'honest USD attribution note');
  assert.equal(o.attributes.travel_date, '2026-10-21');
});

test('expedia flights: keeps USD (never a guessed rate) when FX is unavailable', () => {
  const items = parseExpediaFlights(fixture, src, route, '2026-10-21', srp, null);
  assert.ok(items.length >= 2);
  const o: any = items[0];
  assert.equal(o.currency, 'USD');
  assert.ok(String(o.attributes.data_note).includes('unconverted'), 'unconverted note');
});

test('expedia flights: drops the section-header listing and unpriced entries', () => {
  const items = parseExpediaFlights(fixture, src, route, '2026-10-21', srp, { rate: 95.32, source: 't' });
  for (const it of items) assert.ok((it as any).price > 0, 'no fabricated prices');
  assert.ok(!items.some((i: any) => /Departing flights/i.test(i.title)), 'UI header not offered');
});

test('expedia flights: empty/garbage body yields zero items, never throws', () => {
  assert.equal(parseExpediaFlights('', src, route, '2026-10-21', srp).length, 0);
  assert.equal(parseExpediaFlights('{"data":null}', src, route, '2026-10-21', srp).length, 0);
  assert.equal(parseExpediaFlights('not json', src, route, '2026-10-21', srp).length, 0);
});
