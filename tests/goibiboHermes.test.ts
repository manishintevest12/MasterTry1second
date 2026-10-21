import test from 'node:test';
import assert from 'node:assert';
/**
 * Goibibo hermes v12 hotel-search parser (21 Oct recipe, self-detecting probe).
 * Shape-tolerant walker: hotel rows are any array of objects with a name-ish and
 * price-ish field. Never invents a fare — unpriced hotels are skipped.
 */
import { parseHermesHotels, collectHermesHotels } from '../server/workers/parsers/goibiboHermes';

const SRC = { id: 'w_hotels_goibibo', name: 'Goibibo' } as any;

test('parses the classic v12 shape (hotelSearchResponse.hotelSearchDetail)', () => {
  const body = JSON.stringify({
    status: 'SUCCESS',
    data: {
      hotelSearchResponse: {
        hotelSearchDetail: [
          { hotelName: 'Beach Resort Goa', fare: 4250, hotelRating: 4.3, locality: 'Candolim', hotelImage: 'https://x/img.jpg' },
          { hotelName: 'Sunset Hostel', fare: 1199 },
          { hotelName: 'No Price Hotel', locality: 'Anjuna' },
        ],
      },
    },
  });
  const items = parseHermesHotels(body, SRC, 'goa', '20261022', '20261023', 'https://hermes.test/x');
  assert.equal(items.length, 2); // the unpriced hotel is dropped, never guessed
  assert.equal(items[0].title, 'Beach Resort Goa');
  assert.equal(items[0].price, 4250);
  assert.equal(items[0].seller, 'Goibibo');
});

test('walks nested alternate shapes and price strings', () => {
  const body = JSON.stringify({ r: { hotels: [
    { nm: 'Blue Bay', op: 'Rs.6,400/night' },
    { nm: 'Green Valley', pricing: { fareDetails: { finalRate: 2100 } } },
    { nm: 'Hill Top', price: 999 },
  ] } });
  const items = parseHermesHotels(body, SRC, 'goa', '20261022', '20261023', 'https://hermes.test/x');
  assert.equal(items.length, 3);
  const names = items.map((i: any) => i.title).sort();
  assert.deepEqual(names, ['Blue Bay', 'Green Valley', 'Hill Top']);
  const byName = Object.fromEntries(items.map((i: any) => [i.title, i.price]));
  assert.equal(byName['Blue Bay'], 6400);   // currency string parsed
  assert.equal(byName['Green Valley'], 2100); // nested money object
  assert.equal(byName['Hill Top'], 999);
});

test('non-JSON and empty bodies yield zero rows (honest, no invention)', () => {
  assert.equal(parseHermesHotels('<html>Access Denied</html>', SRC, 'goa', '1', '2', 'u').length, 0);
  assert.equal(parseHermesHotels('{"status":"EMPTY"}', SRC, 'goa', '1', '2', 'u').length, 0);
  const rows: any[] = [];
  collectHermesHotels({ stray: [{ name: 'x', fare: 1 }] }, rows); // 1 candidate < 3: not a list
  assert.equal(rows.length, 0);
});
