import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSmartFilter, matchSmartFilter } from '../src/utils/smartFilter';

test('smart filter parses English price + rating + tokens', () => {
  const f = parseSmartFilter('ac under 30000 with 4+ star rating');
  assert.equal(f.maxPrice, 30000);
  assert.equal(f.minRating, 4);
  assert.deepEqual(f.tokens, ['ac']);
  assert.equal(f.sortHint, undefined);
});

test('smart filter parses Hinglish: sabse sasta veg pizza 5k se kam', () => {
  const f = parseSmartFilter('sabse sasta veg pizza 5k se kam');
  assert.equal(f.maxPrice, 5000);
  assert.equal(f.sortHint, 'cheapest');
  assert.equal(f.veg, true);
  assert.ok(f.tokens.includes('pizza'));
});

test('smart filter parses between X and Y, free cancellation, top rated', () => {
  const f = parseSmartFilter('hotels between 2000 and 4500 with free cancellation, top rated');
  assert.equal(f.minPrice, 2000);
  assert.equal(f.maxPrice, 4500);
  assert.equal(f.freeCancellation, true);
  assert.equal(f.sortHint, 'highest_rated');
});

test('smart filter parses lakh amounts and above', () => {
  const f = parseSmartFilter('cars above 1.5 lakh non-stop');
  assert.equal(f.minPrice, 150000);
  assert.equal(f.direct, true);
});

const item = (o: any) => ({
  title: 'Veg Pizza Margherita',
  subtitle: 'Domino\'s',
  category: 'Pizza',
  provider: 'Zomato',
  features: [],
  specs: {},
  ...o,
});

test('matcher: price/rating/veg logic honest', () => {
  const cheap = item({ primaryPrice: 2500, rating: 4.5 });
  assert.ok(matchSmartFilter(cheap, parseSmartFilter('veg pizza under 3000 with 4+ rating')));
  assert.equal(matchSmartFilter(cheap, parseSmartFilter('veg pizza under 2000')), false);

  const chicken = item({ title: 'Chicken Biryani', primaryPrice: 300, rating: 4.2, specs: { veg: 'false' } });
  assert.equal(matchSmartFilter(chicken, parseSmartFilter('veg biryani')), false);
  assert.ok(matchSmartFilter(chicken, parseSmartFilter('biryani under 500')));

  const lowRated = item({ primaryPrice: 100, rating: 3.1 });
  assert.equal(matchSmartFilter(lowRated, parseSmartFilter('pizza with 4 star and above')), false);
});
