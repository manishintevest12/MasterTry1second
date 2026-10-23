import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  saffronSearchBody, saffronImageUrl, parseSaffronVillas, parseSaffronOffers, SAFFRON_API,
} from '../server/workers/parsers/saffronStays';

const source: any = { id: 'w_hotels_saffronstays', method: 'direct_http', vertical: 'hotels' };

/** Faithful slice of the real search-advance response (17 Oct 2026). */
const data = [
  {
    id: '403tD0DVYG2TS4qE', title: 'Araqila (Sea View King Suites)', location: 'Vengurla, Maharashtra',
    latitude: 15.788894543031558, longitude: 73.65779574232873,
    price_per_night: 28800, per_night_price_after_discount: 28800,
    total_amount_with_tax: 33984, base_price_with_tax: 5184,
    rating: 4.574999809265137, total_reviews: 4, max_capacity: 21, bedrooms: 7,
    signature: 'X-Series', is_available: true,
    images: ['1761931999481804741', '1761931979054902396'],
    seo_url: 'luxury-rooms-in-a-retreat-in-sindhudurg-with-sea-views',
  },
  { id: '2', title: 'Sold Out Villa', price_per_night: 5000, per_night_price_after_discount: 5000, is_available: false, images: ['1'] },
  { id: '3', title: 'Unpriced Villa', is_available: true },
];

test('saffron: search body shape matches captured request', () => {
  const b = saffronSearchBody('Goa');
  assert.equal(b.location, 'Goa');
  assert.equal(b.page, 1);
  assert.equal(b.no_of_guest, 2);
  assert.equal(b.distance, 125);
  assert.equal(b.max_price, 2500000);
  assert.deepEqual(b.suitables, []);
  assert.equal(SAFFRON_API, 'https://ecapi4.saffronstays.com/api/search-advance');
});

test('saffron: imagekit url format', () => {
  assert.equal(saffronImageUrl('1761931999481804741'), 'https://ik.imagekit.io/5tgxhsqev/saffronstays-media/1761931999481804741?tr=w-640,q-75');
});

test('saffron: villas normalized with prices, ratings, galleries', () => {
  const villas = parseSaffronVillas(data);
  assert.equal(villas.length, 3);
  const v = villas[0];
  assert.equal(v.title, 'Araqila (Sea View King Suites)');
  assert.equal(v.pricePerNight, 28800);
  assert.equal(v.totalWithTax, 33984);
  assert.ok(Math.abs(v.rating! - 4.575) < 0.001);
  assert.equal(v.reviews, 4);
  assert.equal(v.capacity, 21);
  assert.equal(v.bedrooms, 7);
  assert.equal(v.signature, 'X-Series');
  assert.equal(v.imageIds.length, 2);
  assert.equal(v.available, true);
  assert.equal(villas[1].available, false);
  assert.equal(villas[2].pricePerNight, null);
});

test('saffron: offers — unavailable and unpriced villas never published', () => {
  const offers = parseSaffronOffers(parseSaffronVillas(data), source, 'Goa');
  assert.equal(offers.length, 1);
  const o = offers[0];
  assert.equal(o.price, 28800);
  assert.equal(o.currency, 'INR');
  assert.equal(o.seller, 'SaffronStays');
  assert.equal(o.sellerUrl, 'https://www.saffronstays.com/villas/luxury-rooms-in-a-retreat-in-sindhudurg-with-sea-views');
  assert.equal(o.attributes!.rating, '4.6');
  assert.ok(o.attributes!.price_basis.includes('total ₹33984'));
  assert.ok(o.attributes!.images.includes('|'));
  assert.equal(o.attributes!.bedrooms, 7);
});
