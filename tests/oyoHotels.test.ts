import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  oyoCityPaths, parseOyoPreloadedState, parseOyoHotels, parseOyoOffers, fmtDdMmYyyy,
} from '../server/workers/parsers/oyoHotels';

const source: any = { id: 'w_hotels_oyo', method: 'direct_http', vertical: 'hotels' };

/** A faithful slice of a real OYO PRELOADED_STATE listing page (17 Oct 2026). */
const pageHtml = `<html><body><script>
window.__PRELOADED_STATE__ = {"listing":{"hotels":[
{"id":10179,"name":"Super Collection O Sand Castles Miramar","url":"/10179/","address":"Near Kamat Kinara, Goa","city":"Goa","category":"Classic","oneLinerText":"Close to Miramar Beach","hotel_images":["https://images.oyoroomscdn.com/uploads/hotel_image/10179/a.jpg","https://images.oyoroomscdn.com/uploads/hotel_image/10179/b.jpg"],"rating":{"count":309,"value":4.3},"pricing":{"bookingPrice":"1410","slashedPrice":"8152","discountPercentage":80,"taxInfo":{"total_tax":"149","final_price_with_tax":"1559"}},"geo_location":{"lat":15.48,"lng":73.80},"isSoldOut":false,"status":"Live"},
{"id":300926,"name":"Sold Out Townhouse","url":"/300926/","city":"Indore","rating":{"count":10,"value":3.5},"pricing":{"bookingPrice":"824","taxInfo":{"total_tax":"126","final_price_with_tax":"950"}},"isSoldOut":true},
{"id":40490,"name":"Price-less Listing","url":"/40490/","city":"Goa","rating":{},"pricing":{},"isSoldOut":false}
]}};
</script></body></html>`;

test('oyo: city path candidates from variants', () => {
  assert.equal(oyoCityPaths('Goa')[0], 'hotels-in-goa');
  assert.ok(oyoCityPaths('New Delhi').includes('hotels-in-delhi'));
  assert.ok(oyoCityPaths('Puducherry').includes('hotels-in-pondicherry'));
});

test('oyo: PRELOADED_STATE extracted and JSON-parsed from SSR page', () => {
  const state = parseOyoPreloadedState(pageHtml);
  assert.ok(state);
  assert.equal(state.listing.hotels.length, 3);
  assert.equal(parseOyoPreloadedState('<html>no state</html>'), null);
});

test('oyo: hotels normalized with real prices, images, ratings', () => {
  const hotels = parseOyoHotels(parseOyoPreloadedState(pageHtml)!);
  assert.equal(hotels.length, 3);
  const h = hotels[0];
  assert.equal(h.name, 'Super Collection O Sand Castles Miramar');
  assert.equal(h.pricePerNight, 1410);
  assert.equal(h.tax, 149);
  assert.equal(h.priceInclusive, 1559);
  assert.equal(h.slashedPrice, 8152);
  assert.equal(h.rating, 4.3);
  assert.equal(h.ratingCount, 309);
  assert.equal(h.imageUrl, 'https://images.oyoroomscdn.com/uploads/hotel_image/10179/a.jpg');
  assert.equal(h.images.length, 2);
  assert.equal(h.soldOut, false);
  assert.equal(hotels[1].soldOut, true);
  assert.equal(hotels[2].pricePerNight, null);
});

test('oyo: offers — sold-out and price-less hotels never published', () => {
  const hotels = parseOyoHotels(parseOyoPreloadedState(pageHtml)!);
  const offers = parseOyoOffers(hotels, source, 'Goa', { checkin: '2026-10-25', checkout: '2026-10-26', path: 'hotels-in-goa' });
  assert.equal(offers.length, 1); // sold-out + price-less dropped
  const o = offers[0];
  assert.equal(o.title, 'Super Collection O Sand Castles Miramar');
  assert.equal(o.price, 1410);
  assert.equal(o.currency, 'INR');
  assert.equal(o.listPrice, 8152);
  assert.equal(o.seller, 'OYO');
  assert.equal(o.sellerUrl, 'https://www.oyorooms.com/10179/'); // deeplink to the price owner
  assert.ok(o.attributes!.price_basis.includes('total ₹1559'));
  assert.equal(o.attributes!.rating, '4.3');
  assert.ok(o.attributes!.images.includes('|'));
  assert.ok(String(o.evidence.sourceUrl).includes('checkin=25/10/2026'));
});

test('oyo: date formatting dd/mm/yyyy for URL params', () => {
  assert.equal(fmtDdMmYyyy('2026-10-25'), '25/10/2026');
  assert.equal(fmtDdMmYyyy(''), '');
});
