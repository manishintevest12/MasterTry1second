/**
 * Goibibo hotels SSR regression (21 Oct): www.goibibo.com/hotels/hotels-in-<city>[-ct]/
 * serves the FULL listing state in window.__initial_state__ (Gatsby format,
 * NOT __NEXT_DATA__) — JS-literal sanitization required (new Date("..."),
 * :undefined, trailing statements). Recorded live shape: Goa 20 hotels, Ginger
 * Goa Candolim priceDetail.discountedPrice 5899 (+294 tax), reviewSummaryUgc
 * .hotelRating 4.2, media[0].url "//r1imghtlak..." -> https:, detail deeplink
 * to goibibo hotel-details. Guards: balanced-brace extraction, sanitization,
 * sold-out/unpriced skipping, dedup, tolerant fallback scan, and the honest
 * empty-reducer result for MMT-style gated pages.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractInitialState, parseGoibiboHotelSsrState } from '../server/workers/parsers/goibiboHotelSsr.ts';
import { parseMmtHotelLanding } from '../server/workers/parsers/mmtHotelLanding.ts';

function giPage(stateJs: string): string {
  return `<!DOCTYPE html><html><head><title>Hotels in Goa</title></head><body>
<script>window.__initial_state__=${stateJs}</script>
<script>window.__NON_CACHED__=1;</script></body></html>`;
}

const HOTEL = (name: string, price: number, rating: number, extra: any = {}) => ({
  id: '99', giId: '88', name, propertyType: 'Hotel', starRating: 4,
  soldOut: false, showCallToBook: false,
  locationPersuasion: ['Candolim', 'near beach'],
  media: [{ url: '//r1imghtlak.ibcdn.com/x.jpg?downsize=245:152', mediaType: 'IMAGE' }],
  priceDetail: { price, discountedPrice: price, priceWithTax: price + 294, totalTax: 294, priceSuffix: 'per night' },
  reviewSummaryUgc: { hotelRating: rating, reviewCount: 100 },
  detailDeeplinkUrl: `https://www.goibibo.com/hotels/hotel-details/?checkin=20261123&checkout=20261124&hotelId=${name.length}`,
  ...extra,
});

const STATE = giPage(`{"common":{"country":"IN","checkin":{"date":new Date("2026-11-23T00:00:00.000Z")},"checkout":{"date":new Date("2026-11-24T00:00:00.000Z")},"roomString":"1-2-0"},"srpUnif":{"srpData":{"hotelCount":20,"personalizedSections":{"RECOMMENDED_HOTELS":{"name":"REC","hotels":[${JSON.stringify(HOTEL('Ginger Goa, Candolim', 5899, 4.2))},${JSON.stringify(HOTEL('Windsor Bay Hotel', 3039, 3.8))},${JSON.stringify(HOTEL('Sold Out Inn', 1200, 4, { soldOut: true }))},${JSON.stringify(HOTEL('Zero Priced Lodge', 0, 4, { priceDetail: { price: 0, discountedPrice: 0 } }))}]}}}}};window.__initial_state_extra__=1;`);

test('extractInitialState sanitizes new Date() and undefined literals', () => {
  const d = extractInitialState(STATE);
  assert.ok(d, 'state extracted');
  assert.equal(d.common.checkin.date, '2026-11-23T00:00:00.000Z');
});

test('parseGoibiboHotelSsrState reads prices, ratings, images, deeplinks and page dates', () => {
  const st = parseGoibiboHotelSsrState(STATE);
  assert.equal(st.hotelCount, 20);
  assert.equal(st.checkIn, '2026-11-23');
  assert.equal(st.checkOut, '2026-11-24');
  assert.equal(st.rows.length, 2, 'sold-out and zero-priced rows skipped honestly');
  const ginger = st.rows.find((r) => r.name.startsWith('Ginger'))!;
  assert.equal(ginger.price, 5899);
  assert.equal(ginger.rating, 4.2);
  assert.ok(String(ginger.image).startsWith('https://r1imghtlak'));
  assert.ok(String(ginger.url).startsWith('https://www.goibibo.com/hotels/hotel-details/'));
  assert.equal(ginger.locality, 'Candolim');
});

test('parseGoibiboHotelSsrState is empty for pages without initial state', () => {
  const st = parseGoibiboHotelSsrState('<html><body>200 - OK</body></html>');
  assert.equal(st.rows.length, 0);
});

test('extractInitialState handles escaped quotes and nested braces in strings', () => {
  const tricky = giPage('{"a":{"s":"x \\" {y} z","n":undefined},"b":1}');
  const d = extractInitialState(tricky);
  assert.ok(d);
  assert.equal(d.a.s, 'x " {y} z');
  assert.equal(d.a.n, null);
});

test('MMT landing parser extracts priced hotels from a populated reducer', () => {
  const page = `<html><body><script>$hotelReducerResponse = {"hotels":[{"name":"Taj Mahal Palace","price":"₹ 24,500","rating":4.7,"locality":"Colaba","imageUrl":"//x.mmtcdn.com/t.jpg"},{"name":"No Price Hotel"}]};</script></body></html>`;
  const st = parseMmtHotelLanding(page);
  assert.equal(st.rows.length, 1, 'unpriced row dropped');
  assert.equal(st.rows[0].name, 'Taj Mahal Palace');
  assert.equal(st.rows[0].price, 24500);
  assert.equal(st.rows[0].rating, 4.7);
  assert.equal(st.rows[0].locality, 'Colaba');
  assert.ok(String(st.rows[0].image).startsWith('https://x.mmtcdn.com'));
});

test('MMT landing parser reports an empty reducer honestly (gate holds)', () => {
  const page = `<html><body><script>$hotelReducerResponse = {};</script><div>PWA shell</div></body></html>`;
  const st = parseMmtHotelLanding(page);
  assert.equal(st.rows.length, 0);
  assert.equal(st.reducerEmpty, true);
});
