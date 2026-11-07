import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepOfferUrl } from '../server/affiliate/merchantLinks';

// OWNER 7 Nov (issue 3): "item click par pehle deep page khulta tha, ab generic page".
// A source's own DEEP url (property / itinerary) must win over the listing rebuilt from request
// dates; a listing-shaped url must keep the rebuilt, date-correct one.
test('hotel city listings are NOT deep (the rebuilt dated listing wins)', () => {
  assert.equal(isDeepOfferUrl('hotels', 'https://www.oyorooms.com/hotels-in-goa/?checkin=2026-11-20'), false);
  assert.equal(isDeepOfferUrl('hotels', 'https://www.easemytrip.com/hotels/hotel-listing/?city=Goa'), false);
  assert.equal(isDeepOfferUrl('hotels', 'https://www.agoda.com/search?city=9028'), false);
});

test('a specific property page IS deep and is kept', () => {
  assert.equal(isDeepOfferUrl('hotels', 'https://www.agoda.com/hotel/lemon-tree-premier-goa/hotel/goa-in.html'), true);
  assert.equal(isDeepOfferUrl('hotels', 'https://www.oyorooms.com/hotel/abc123?checkin=2026-11-20'), true);
  assert.equal(isDeepOfferUrl('hotels', 'https://www.makemytrip.com/hotels/hotel-details/?hotelId=20240101'), true);
});

test('flight itineraries are deep, flight search pages are not', () => {
  assert.equal(isDeepOfferUrl('flights', 'https://www.ixigo.com/flight/booking/IDR-DEL-20Nov26'), true);
  assert.equal(isDeepOfferUrl('flights', 'https://www.makemytrip.com/flights/search?itinerary=IDR-DEL'), false);
  assert.equal(isDeepOfferUrl('flights', 'https://www.kiwi.com/en/booking?fare_id=XYZ'), true);
});

test('bus: ticket pages deep, route search pages not', () => {
  assert.equal(isDeepOfferUrl('bus', 'https://www.redbus.in/bus-tickets/indore-to-bhopal?tripId=123'), true);
  assert.equal(isDeepOfferUrl('bus', 'https://www.abhibus.com/bus_search/Indore/Bhopal/20-11-2026'), false);
});

test('product pages are deep, catalogues are not', () => {
  assert.equal(isDeepOfferUrl('ecommerce', 'https://www.shopsy.in/nokia-105/p/abc'), true);
  assert.equal(isDeepOfferUrl('ecommerce', 'https://www.flipkart.com/search?q=mobile'), false);
  assert.equal(isDeepOfferUrl('ecommerce', ''), false);
});
