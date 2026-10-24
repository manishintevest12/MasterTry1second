import { test } from 'node:test';
import assert from 'node:assert/strict';
import { merchantSearchFallback } from '../server/affiliate/deeplink';

// Owner 24 Oct: rows without a product URL must deeplink to the merchant's own
// SEARCH page for the exact item (never blank, never an invented product URL).
test('merchantSearchFallback: known merchants get an honest search deeplink', () => {
  assert.equal(merchantSearchFallback('Amazon', 'iPhone 15'), 'https://www.amazon.in/s?k=iPhone%2015');
  assert.equal(merchantSearchFallback('Flipkart Retail', 'redmi note 13'), 'https://www.flipkart.com/search?q=redmi%20note%2013');
  assert.equal(merchantSearchFallback('Swiggy Instamart', 'milk'), 'https://www.swiggy.com/instamart/search?query=milk');
  assert.equal(merchantSearchFallback('Blinkit', 'bread'), 'https://blinkit.com/s/?q=bread');
  assert.equal(merchantSearchFallback('BookMyShow', 'Leo'), 'https://in.bookmyshow.com/explore/movies');
});

test('merchantSearchFallback: myntra gets a slug search, long titles are capped', () => {
  assert.match(merchantSearchFallback('Myntra', 'Nike Revolution  Running Shoes'), /^https:\/\/www\.myntra\.com\/[a-z0-9-]+$/);
  const long = merchantSearchFallback('Amazon', 'x'.repeat(300));
  assert.ok(new URL(long).searchParams.get('k')!.length <= 80);
});

test('merchantSearchFallback: unknown vendor or empty title -> empty (no invention)', () => {
  assert.equal(merchantSearchFallback('', 'iPhone'), '');
  assert.equal(merchantSearchFallback('Amazon', '  '), '');
  assert.equal(merchantSearchFallback('TotallyUnknownShop', 'iPhone 15'), '');
});

// Owner 24 Oct evening ("payment-page deeplinks"): travel merchants get the
// ROUTE-PREFILLED SRP from the offer's own travel block, never their homepage.
test('merchantSearchFallback: MMT flights gets a route+date SRP when travel info is present', () => {
  const url = merchantSearchFallback('MakeMyTrip', 'indore to delhi flight', 'flights', { route: 'indore to delhi', date: '2026-10-28' });
  assert.equal(url, 'https://www.makemytrip.com/flight/search?itinerary=IDR-DEL-28%2F10%2F2026&tripType=O&paxType=1-A-C&intl=false&cabinClass=E&cc=INR');
});

test('merchantSearchFallback: MMT bus gets a from/to/date SRP', () => {
  const url = merchantSearchFallback('MakeMyTrip', 'indore to bhopal bus', 'bus', { route: 'indore to bhopal', date: '2026-10-25' });
  assert.equal(url, 'https://www.makemytrip.com/bus/search/indore/bhopal/25-10-2026');
});

test('merchantSearchFallback: MMT without resolvable route stays honest (no invented SRP)', () => {
  assert.equal(merchantSearchFallback('MakeMyTrip', 'flights', 'flights', {}), 'https://www.makemytrip.com/flights/');
  assert.equal(merchantSearchFallback('MakeMyTrip', 'flights', 'flights', { route: 'mars to venus', date: '2026-10-28' }), 'https://www.makemytrip.com/flights/');
});
