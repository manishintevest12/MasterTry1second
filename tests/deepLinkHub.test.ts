/**
 * OWNER 10 Nov: "mere paas token ni hai, muje result chaiye, aur ye architecture purane ke upar add kro bina
 * purana break kiye" - the deep-link-first hybrid. These pin the contract that makes it safe:
 * live rows always win, a hub never carries a price, and a catalogue price is used only for the exact
 * partner and the exact travel date that was asked for.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildIntentHubs, sellersPresent, hasPartner, GATED_HUB_MERCHANTS, attachIntentHubs } from '../server/search/deepLinkHub';

const liveBookingRow = [
  { seller: 'Booking.com', primaryPrice: 4800, sellerUrl: 'https://www.booking.com/hotel/in/foo.html' },
];

test('a partner that already answered live never becomes a hub', () => {
  const hubs = buildIntentHubs({ vertical: 'hotels', title: 'hotels in Indore', rows: liveBookingRow, city: 'Indore' });
  assert.equal(hubs.some((h) => h.domain === 'booking.com'), false, 'live Booking row suppresses its hub');
});

test('an unreadable partner is offered as an affiliate-routed hub with no price', () => {
  const hubs = buildIntentHubs({ vertical: 'hotels', title: 'hotels in Indore', rows: [], city: 'Indore' });
  assert.ok(hubs.length >= 1);
  const booking = hubs.find((h) => h.domain === 'booking.com');
  assert.ok(booking, 'booking hub present when it produced no row');
  assert.match(booking!.url, /^https?:\/\//);
  assert.equal('primaryPrice' in booking!, false, 'a hub is not a priced card');
  assert.match(booking!.reason, /202|shell/i);
});

test('the whole market is covered: cleartrip, expedia and the rest get hubs too (owner 10 Nov)', () => {
  const hotels = buildIntentHubs({ vertical: 'hotels', title: 'hotels in Indore', rows: [], city: 'Indore' });
  const hotelSellers = hotels.map((h) => h.seller);
  for (const want of ['Booking.com', 'Expedia', 'Cleartrip']) assert.ok(hotelSellers.includes(want), `${want} hotel hub present`);
  const flights = buildIntentHubs({ vertical: 'flights', title: 'Indore to Delhi', rows: [] });
  const flightSellers = flights.map((h) => h.seller);
  for (const want of ['Expedia', 'Cleartrip', 'MakeMyTrip', 'Goibibo', 'Yatra', 'IndiGo', 'Akasa Air']) assert.ok(flightSellers.includes(want), `${want} flight hub present`);
  const bus = buildIntentHubs({ vertical: 'bus', title: 'Indore to Ujjain', rows: [] });
  assert.equal(bus[0].seller, 'RedBus', 'bus specialists lead the bus hub list');
  assert.ok(bus.some((h) => h.seller === 'AbhiBus'));
  // every hub is a real https exit and none is priced
  for (const list of [hotels, flights, bus]) for (const h of list) {
    assert.match(h.url, /^https:\/\//);
    assert.equal('primaryPrice' in h, false);
  }
});

test('hub list is capped so the feed stays readable, gated partners first', () => {
  const hubs = buildIntentHubs({ vertical: 'hotels', title: 'hotels in Indore', rows: [], city: 'Indore' });
  assert.ok(hubs.length <= 8, `cap respected, got ${hubs.length}`);
  assert.equal(hubs[0].seller, 'Booking.com', 'the measured wall leads');
  const many = buildIntentHubs({ vertical: 'flights', title: 'Indore to Delhi', rows: [] });
  assert.equal(many[0].seller, 'Booking.com Flights', 'gated flight walls lead');
});

test('airline walls get hubs on flights and taxi on cab, hotels do not leak flights hubs', () => {
  const flights = buildIntentHubs({ vertical: 'flights', title: 'Indore to Delhi', rows: [] });
  assert.ok(flights.some((h) => h.domain === 'goindigo.in'));
  assert.ok(flights.some((h) => h.domain === 'akasaair.com'));
  assert.equal(flights.some((h) => h.domain === 'agoda.com'), false);
  const cab = buildIntentHubs({ vertical: 'cab', title: 'Indore to airport', rows: [] });
  assert.ok(cab.some((h) => h.domain === 'booking.com'));
  const ecom = buildIntentHubs({ vertical: 'ecommerce', title: 'iphone', rows: [] });
  assert.equal(ecom.length, 0, 'verticals without gated partners stay untouched');
});

test('subdomains and seller names both count as presence', () => {
  const present = sellersPresent([{ sellerUrl: 'https://hotels.booking.com/x' }]);
  assert.equal(hasPartner(present, { seller: 'Booking.com', domain: 'booking.com', reason: 'x', fallbackUrl: () => '' }), true);
  const byName = sellersPresent([{ seller: 'IndiGo' }]);
  assert.equal(hasPartner(byName, { seller: 'IndiGo', domain: 'goindigo.in', reason: 'x', fallbackUrl: () => '' }), true);
});

test('attach is additive: existing rows and their order are preserved', async () => {
  const rows = [{ id: 'a', seller: 'Agoda', primaryPrice: 3000 }, { id: 'b', seller: 'OYO', primaryPrice: 1200 }];
  const out = await attachIntentHubs({ results: rows, resultsCount: 2, state: { servedFrom: 'live' } }, { vertical: 'hotels', query: 'hotels in Indore', city: 'Indore' });
  assert.equal(out.results.length >= 2, true);
  assert.deepEqual(out.results.slice(-2).map((r: any) => r.id), ['a', 'b'], 'live rows keep their order at the end of prepends');
  assert.equal(out.state.servedFrom, 'live');
  assert.ok(Array.isArray(out.intentHubs));
});

test('the hybrid is layered on, not swapped in: old pipeline entry points are intact', () => {
  const routes = readFileSync('server/api/routes.ts', 'utf8');
  assert.ok(routes.includes('finaliseLiveAnswer(response, String(input.vertical)'), 'old gate still called');
  assert.ok(routes.includes('attachIntentHubs(gatedResponse'), 'hybrid attached after the gate');
  assert.ok(routes.indexOf('finaliseLiveAnswer(response, String(input.vertical)') < routes.indexOf('attachIntentHubs(gatedResponse'), 'gate runs first');
  const orchestrator = readFileSync('server/search/searchOrchestrator.ts', 'utf8');
  assert.ok(orchestrator.includes('awaitSettledAnswer'), 'settled-answer path untouched');
});

test('every hub merchant names why it is gated', () => {
  for (const [vertical, list] of Object.entries(GATED_HUB_MERCHANTS)) {
    for (const m of list) {
      assert.ok(m.reason && m.reason.length > 10, `${vertical}/${m.seller} needs a reason`);
      assert.ok(m.domain.includes('.'), `${vertical}/${m.seller} needs a domain`);
    }
  }
});
