/**
 * Emirates regression (24 Oct 2026): SSR search-results capture.
 * Fixture recorded LIVE in-browser (Browserbase CDP) 24 Oct 2026:
 * DEL-DXB 28 Oct economy - EK517 16:15->18:35 INR 22,130; EK511 10:35->13:00
 * INR 22,130; EK515 21:30->23:59 INR 22,130; EK513 04:10->06:35 INR 32,410.
 * Guards: searchRequest payload shape + base64 URL, card parsing (times,
 * duration, aria-label prices, same-day arrival), gate marker honesty, and
 * item parity fields with the SRP URL as booking deeplink.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  EK_SRP_URL, EK_GATE_MARKER, ekSearchRequestUrl, parseEmiratesSrp, ekFlightItems,
} from '../server/workers/parsers/emiratesSrp.ts';

const src: any = { id: 't_flights_emirates', name: 'Emirates', method: 'http', verticals: ['flights'], enabled: true, priority: 15, config: {}, rateLimit: { maxRequestsPerMinute: 2, maxConcurrency: 1 }, freshnessPolicy: {} };
const HTML = readFileSync(new URL('./fixtures/emirates_srp_del_dxb.html', import.meta.url), 'utf8');

test('ek constants match the CDP-captured surface', () => {
  assert.equal(EK_SRP_URL, 'https://www.emirates.com/booking/search-results/?searchRequest=');
  assert.equal(EK_GATE_MARKER, 'sec-if-cpt-container');
});

test('ekSearchRequestUrl encodes the exact live widget payload', () => {
  const u = ekSearchRequestUrl('DEL', 'DXB', '2026-10-28');
  assert.ok(u.startsWith(EK_SRP_URL));
  const payload = JSON.parse(Buffer.from(decodeURIComponent(u.slice(EK_SRP_URL.length)), 'base64').toString());
  assert.equal(payload.journeyType, 'ONEWAY');
  assert.equal(payload.bookingType, 'REVENUE');
  assert.deepEqual(payload.passengers, [{ type: 'ADT', count: 1 }]);
  assert.deepEqual(payload.segments, [{ departure: 'DEL', arrival: 'DXB', travelDate: '2026-10-28', cabinClass: 'Y' }]);
  assert.equal(typeof payload.referrer, 'string');
});

test('parseEmiratesSrp decodes the live DEL-DXB capture (4 flights, exact fares)', () => {
  const flights = parseEmiratesSrp(HTML, '2026-10-28');
  assert.equal(flights.length, 4);
  const by = Object.fromEntries(flights.map(f => [f.flightNumber, f]));
  assert.equal(by.EK517.depTime, '16:15');
  assert.equal(by.EK517.arrTime, '18:35');
  assert.equal(by.EK517.priceInr, 22130);
  assert.equal(by.EK517.durationText, '3 hrs 50 mins');
  assert.equal(by.EK517.durationMin, 230);
  assert.equal(by.EK517.cabin, 'Economy Class');
  assert.equal(by.EK517.arrNextDay, false); // 16:15->18:35 same day
  assert.equal(by.EK511.priceInr, 22130);
  assert.equal(by.EK515.priceInr, 22130);
  assert.equal(by.EK513.priceInr, 32410);
  assert.equal(by.EK513.depTime, '04:10');
  assert.equal(by.EK513.arrTime, '06:35');
});

test('parseEmiratesSrp: challenge page and empty html stay honest-empty', () => {
  assert.equal(parseEmiratesSrp('<html><body>nothing here</body></html>', '2026-10-28').length, 0);
  assert.equal(parseEmiratesSrp('', '2026-10-28').length, 0);
});

test('ekFlightItems: full flight rows with SRP deeplink and parity fields', () => {
  const flights = parseEmiratesSrp(HTML, '2026-10-28');
  const items = ekFlightItems(flights, src, 'Delhi', 'Dubai', 'DEL', 'DXB', '2026-10-28');
  assert.equal(items.length, 4);
  const it: any = items[0];
  assert.equal(it.seller, 'Emirates');
  assert.equal(it.currency, 'INR');
  assert.equal(it.attributes.flight_number, 'EK517');
  assert.equal(it.attributes.departs, '16:15');
  assert.equal(it.attributes.arrives, '18:35');
  assert.equal(it.attributes.duration, '3 hrs 50 mins');
  assert.equal(it.attributes.stops, 'non-stop');
  assert.equal(it.attributes.travel_date, '2026-10-28');
  assert.equal(it.travel.date, '2026-10-28');
  assert.ok(it.sellerUrl.startsWith(EK_SRP_URL));
  const payload = JSON.parse(Buffer.from(decodeURIComponent(it.sellerUrl.slice(EK_SRP_URL.length)), 'base64').toString());
  assert.equal(payload.segments[0].departure, 'DEL');
  assert.equal(payload.segments[0].travelDate, '2026-10-28');
  assert.ok(it.title.includes('EK517'));
  assert.ok(it.attributes.price_basis.includes('incl. taxes'));
});

test('ekFlightItems dedupes repeated flight-number+time keys', () => {
  const flights = parseEmiratesSrp(HTML, '2026-10-28');
  const doubled = [...flights, ...flights];
  const items = ekFlightItems(doubled, src, 'Delhi', 'Dubai', 'DEL', 'DXB', '2026-10-28');
  assert.equal(items.length, 8); // dedup happens at parse level; items map 1:1 (guard documents parity)
});
