import test from 'node:test';
import assert from 'node:assert/strict';
import { initialFor, stepFor, showLoadMore } from '../src/lib/feedPaging';

/**
 * OWNER 20 Nov: "abhi 4 card ke baad hi load more aa raha hai, 12 card ke baad aana chaiye."
 * The web used one 4/+4 constant for every vertical. Grocery is a grid now, and the app has always opened
 * product feeds at 12 (+8); this pins the rule for both.
 */
test('a product grid opens with 12 tiles, not 4', () => {
  assert.equal(initialFor('grocery'), 12);
  assert.equal(initialFor('ecommerce'), 12);
  assert.equal(initialFor('flights'), 12);
  assert.equal(initialFor('unknown-vertical'), 12);
});

test('tall movie cards keep the 4-at-a-time reveal', () => {
  assert.equal(initialFor('movies'), 4);
  assert.equal(initialFor('movie'), 4);
  assert.equal(stepFor('movies'), 4);
});

test('load more adds 8 on product feeds and 4 on movies', () => {
  assert.equal(stepFor('grocery'), 8);
  assert.equal(stepFor('hotels'), 8);
});

test('the pill only appears when there is something behind it', () => {
  assert.equal(showLoadMore(12, 12), false, 'a feed of exactly 12 hides nothing');
  assert.equal(showLoadMore(12, 13), true);
  assert.equal(showLoadMore(0, 0), false);
  assert.equal(showLoadMore(12, 0), false);
});
