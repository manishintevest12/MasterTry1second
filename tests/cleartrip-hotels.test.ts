import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCleartripHotels, parseCleartripOffers } from '../server/workers/parsers/cleartripHotels';

const source: any = { id: 'w_hotels_cleartrip', method: 'direct_http', vertical: 'hotels' };

const card = (id: string, name: string, price: number) => ({
  action: { type: 'NAVIGATE', payload: { type: 'REDIRECT', url: `/hotels/details/x-${id}?c=1|2` } },
  data: {
    name,
    starRating: 4,
    locality: 'Mandrem',
    city: 'Goa',
    clearTripRatingAndReview: { data: { rating: '4.6' } },
    freeCancellation: { available: true },
    freeBreakfast: { available: false },
    imageSlider: { data: { images: [{ data: { url: `cms/3347/${id}/images/a.png` } }] } },
    priceInfo: { data: { price, slashedPrice: price * 2, priceText: '/ night' } },
    ravenTracking: { eventData: { h_hotel_id: id } },
  },
});

const next = {
  props: { pageProps: { initialState: { results: { data: { slotsData: [
    { slotData: { type: 'HOTEL_CARD_LIST', data: { hotelCardList: [card('334724', 'La Cabana Beach Resort', 9625), card('334724', 'La Cabana Beach Resort', 9625)] } } },
    { slotData: { type: 'BREADCRUMB', data: {} } },
    { slotData: { type: 'HOTEL_CARD_LIST', data: { hotelCardList: [card('4686808', 'W Goa', 12500), { data: { name: 'No Price', priceInfo: {} } }] } } },
  ] } } } } },
};

test('cleartrip: parses priced cards, dedupes by hotel id, skips unpriced', () => {
  const hotels = parseCleartripHotels(next);
  assert.equal(hotels.length, 2);
  assert.equal(hotels[0].name, 'La Cabana Beach Resort');
  assert.equal(hotels[0].price, 9625);
  assert.equal(hotels[0].imageUrl, 'https://rukmini-ct.flixcart.com/cms/3347/334724/images/a.png');
  assert.equal(hotels[1].deeplink.startsWith('https://www.cleartrip.com/hotels/details/'), true);
});

test('cleartrip: offers carry real price, image and own-site deeplink', () => {
  const offers = parseCleartripOffers(parseCleartripHotels(next), source);
  assert.equal(offers.length, 2);
  const o = offers[0];
  assert.equal(o.seller, 'Cleartrip');
  assert.equal(o.price, 9625);
  assert.equal(o.attributes!.rating, '4.6');
  assert.equal(o.attributes!.free_cancellation, true);
  assert.equal((o.sellerUrl as string).includes('cleartrip.com'), true);
});

test('cleartrip: missing slotsData -> empty, no crash', () => {
  assert.equal(parseCleartripHotels({ props: {} }).length, 0);
  assert.equal(parseCleartripHotels(null).length, 0);
});
