import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSwiggyDishes } from '../server/workers/parsers/swiggy';

const source: any = { id: 'w_food_swiggy', method: 'direct_http', vertical: 'food' };

const sample = JSON.stringify({ data: { cards: [{}, { groupedCard: { cardGroupMap: { DISH: { cards: [
  { card: { card: {
    restaurant: { info: { id: '51510', name: 'Biryani By Kilo', areaName: 'Connaught Place', avgRating: 4.2,
      cuisines: ['Biryani', 'North Indian'], sla: { slaString: '35-45 MINS' },
      slugs: { restaurant: 'biryani-by-kilo', city: 'delhi' }, availability: { opened: true } } },
    dishes: [
      { info: { id: '1', name: 'Chicken Biryani', price: 34900, inStock: 1, imageId: 'FOOD/a.jpg',
        description: 'Juicy chicken', ratings: { aggregatedRating: { rating: '4.6', ratingCountV2: '990' } } } },
      { info: { id: '2', name: 'No price dish', price: 0, inStock: 1 } },
      { info: { id: '3', name: 'Sold out', price: 10000, inStock: 0 } },
    ] } } },
] } } } }] } });

test('swiggy: parses real dish, price in rupees, image, restaurant; skips price-less dishes', () => {
  const out = parseSwiggyDishes(sample, source, 'https://x', 'New Delhi');
  assert.equal(out.length, 2);
  assert.equal(out[0].title, 'Chicken Biryani');
  assert.equal(out[0].price, 349);
  assert.match(String(out[0].attributes!.image_url), /^https:\/\/media-assets\.swiggy\.com\/.*FOOD\/a\.jpg$/);
  assert.equal(out[0].seller, 'Swiggy');
  assert.equal(out[0].attributes!.restaurant, 'Biryani By Kilo');
  assert.equal(out[0].attributes!.area, 'Connaught Place');
  assert.equal(out[0].attributes!.rating, '4.6');
  assert.equal(out[0].availability, 'in_stock');
  assert.equal(out[1].availability, 'out_of_stock');
});

test('swiggy: malformed or empty JSON yields no items (never invented)', () => {
  assert.deepEqual(parseSwiggyDishes('not json', source, 'u', 'c'), []);
  assert.deepEqual(parseSwiggyDishes('{"data":{}}', source, 'u', 'c'), []);
});
