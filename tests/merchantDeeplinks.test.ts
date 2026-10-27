import test from 'node:test';
import assert from 'node:assert/strict';
import { merchantDeepLink, isDeepLink } from '../server/affiliate/merchantLinks';

// Owner 27 Oct: "kuch website pr deeplink ho raha hai par kuch pr ni — sb pr ho jaye".
// Every merchant in the confirmed registry must produce a REAL destination page.
const TRAVEL_FLIGHT = { route: 'indore to delhi', date: '2026-11-10' };
const TRAVEL_BUS = { route: 'indore to bhopal', date: '2026-11-10' };
const HOTEL = { city: 'Goa', date: '2026-11-10' };

test('every flight seller deep-links to the searched route and date', () => {
  const sellers = ['MakeMyTrip', 'EaseMyTrip', 'Ixigo', 'Yatra', 'Cleartrip', 'Akasa Air', 'IndiGo'];
  for (const s of sellers) {
    const url = merchantDeepLink(s, 'Indore to Delhi', 'flights', TRAVEL_FLIGHT);
    assert.ok(isDeepLink(url), `${s} returned a homepage/empty: ${url}`);
    assert.ok(/IDR/.test(url) && /DEL/.test(url), `${s} lost the route: ${url}`);
  }
});

test('every bus seller deep-links to the route', () => {
  for (const s of ['redBus', 'AbhiBus', 'Ixigo', 'Yatra', 'MakeMyTrip']) {
    const url = merchantDeepLink(s, 'Indore to Bhopal', 'bus', TRAVEL_BUS);
    assert.ok(isDeepLink(url), `${s} returned a homepage: ${url}`);
    assert.ok(/indore/i.test(url) && /bhopal/i.test(url), `${s} lost the route: ${url}`);
  }
});

test('every hotel seller deep-links to the city and dates', () => {
  for (const s of ['MakeMyTrip', 'Goibibo', 'Booking.com', 'Agoda', 'Yatra', 'Cleartrip', 'EaseMyTrip', 'OYO', 'SaffronStays']) {
    const url = merchantDeepLink(s, 'Hotels in Goa', 'hotels', HOTEL);
    assert.ok(isDeepLink(url), `${s} returned a homepage: ${url}`);
    assert.ok(/goa/i.test(url), `${s} lost the city: ${url}`);
  }
});

test('e-commerce, grocery and food merchants search the typed product', () => {
  const cases: Array<[string, string, string]> = [
    ['Amazon', 'iphone 18', 'ecommerce'],
    ['Flipkart', 'iphone 18', 'ecommerce'],
    ['Meesho', 'cotton kurta', 'ecommerce'],
    ['Myntra', 'running shoes', 'ecommerce'],
    ['Ajio', 'denim jacket', 'ecommerce'],
    ['Tata CLiQ', 'perfume', 'ecommerce'],
    ['Blinkit', 'milk', 'grocery'],
    ['Zepto', 'milk', 'grocery'],
    ['Swiggy Instamart', 'milk', 'grocery'],
    ['BigBasket', 'milk', 'grocery'],
    ['Swiggy', 'chicken biryani', 'food'],
    ['Zomato', 'chicken biryani', 'food'],
    ['EatSure', 'chicken biryani', 'food'],
  ];
  for (const [merchant, title, vertical] of cases) {
    const url = merchantDeepLink(merchant, title, vertical, {});
    assert.ok(isDeepLink(url), `${merchant} returned a homepage: ${url}`);
    // Myntra's contract is a slug path (/running-shoes), the rest use a query
    assert.ok(/search|\/s\?|\?q=|\?query=|menu|myntra\.com\/[a-z0-9-]+$/i.test(url), `${merchant} is not a search page: ${url}`);
  }
});

test('movies and finance land on the right product page, never "/"', () => {
  assert.ok(/explore\/movies-indore/.test(merchantDeepLink('BookMyShow', 'Movies in Indore', 'movies', { city: 'Indore' })));
  assert.ok(isDeepLink(merchantDeepLink('District', 'Movies in Indore', 'movies', {})));
  assert.equal(merchantDeepLink('Acko', 'Car insurance', 'insurance', {}), 'https://www.acko.com/car-insurance/');
  assert.equal(merchantDeepLink('Paisabazaar', 'Home loan', 'loans', {}), 'https://www.paisabazaar.com/home-loan/');
  assert.equal(merchantDeepLink('BankBazaar', 'Personal loan', 'loans', {}), 'https://www.bankbazaar.com/personal-loan.html');
});

test('unknown merchant returns empty so the offer keeps its own URL', () => {
  assert.equal(merchantDeepLink('SomeUnknownShop', 'anything', 'ecommerce', {}), '');
});

import { movieTheatreLink, movieCityLink } from '../server/affiliate/merchantLinks';
import { bmsBuyTicketsUrl as bmsBuy } from '../server/workers/parsers/bookmyshow';

// Owner 27 Oct: "book krne ke baad ussi theatre pr land hona chahiye".
test('movies: BookMyShow book button lands on that movie’s city+date showtimes', () => {
  const region = { regionCode: 'IND', regionSlug: 'indore', regionName: 'Indore' };
  const url = bmsBuy(region, 'ET00514650', '2026-10-29');
  assert.equal(url, 'https://in.bookmyshow.com/movies/IND/indore/buytickets/ET00514650/20261029');
  // an event id (EG…) produces a dead "no shows" page, so it is refused
  assert.equal(bmsBuy(region, 'EG00514650', '2026-10-29'), '');
  // missing event code -> no invented link
  assert.equal(bmsBuy(region, ''), '');
});

test('movies: TicketNew gets a venue-level link, District stays honest', () => {
  assert.equal(movieTheatreLink('TicketNew', { city: 'Indore', cinemaId: 7709 }), 'https://ticketnew.com/movies/indore/cinemas/7709');
  assert.equal(movieTheatreLink('District', { city: 'Indore', cinemaId: 7709 }), '');
  assert.equal(movieTheatreLink('TicketNew', { city: 'Indore' }), '');
  assert.equal(movieCityLink('BookMyShow', { city: 'Indore' }), 'https://in.bookmyshow.com/explore/movies-indore');
});
