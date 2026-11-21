import test from 'node:test';
import assert from 'node:assert/strict';
import { fillMoviePricesFromBand, movieAnswerIsUnpricedSnapshot, MOVIE_BAND_SOURCES } from '../server/search/moviesPriceFill';

/**
 * OWNER 21 Nov: "price kabhi app mai movie mai aata hai kabhi ni aata hai".
 *
 * Measured on production (21 Nov, Mumbai, same query twice): the pipeline answered 28 rows with 5
 * priced, then 41 rows with 10 priced. The difference was WHICH sources answered - the priced runs
 * had District and TicketNew in sourcesSucceeded, the price-less one had BookMyShow alone, because
 * BookMyShow publishes no fare at all. So a movie answer with films, no price and no band source is a
 * SNAPSHOT, and every client must keep waiting instead of settling into a price-less feed.
 */

const film = (title: string, price = 0, specs: Record<string, string> = {}) => ({
  title, primaryPrice: price, priceAvailable: price > 0, specs,
});

test('films with no price and no band source is a snapshot, not an answer', () => {
  assert.equal(movieAnswerIsUnpricedSnapshot([film('Dune: Part Three')], ['w_movies_bookmyshow']), true);
  assert.equal(movieAnswerIsUnpricedSnapshot([film('Dune: Part Three')], []), true);
});

test('the snapshot rule ends the moment either band source answers or one film is priced', () => {
  assert.equal(movieAnswerIsUnpricedSnapshot([film('Dune')], ['w_movies_bookmyshow', MOVIE_BAND_SOURCES[0]]), false);
  assert.equal(movieAnswerIsUnpricedSnapshot([film('Dune')], ['w_movies_ticketnew']), false);
  assert.equal(movieAnswerIsUnpricedSnapshot([film('Dune', 250)], ['w_movies_bookmyshow']), false);
});

test('an empty movie answer is not a snapshot: it must release to the honest empty state', () => {
  assert.equal(movieAnswerIsUnpricedSnapshot([], []), false);
  assert.equal(movieAnswerIsUnpricedSnapshot([], ['w_movies_bookmyshow']), false);
});

test('the observed seat band prices a price-less film, and only the identical title', () => {
  const rows = [
    { title: 'Dune: Part Three', primaryPrice: 0, specs: { 'price band': '₹250–₹1050' } },
    { title: 'Dune: Part Three', primaryPrice: 0, specs: {} },
    { title: 'Party Animals', primaryPrice: 0, specs: {} },
  ];
  const out = fillMoviePricesFromBand(rows);
  // Both rows of the SAME film get the band (the banded row included); the other film never does.
  assert.equal(out.filled, 2, 'only the same film borrows the band');
  assert.equal(out.rows[0].primaryPrice, 250);
  assert.equal(out.rows[1].primaryPrice, 250, 'same film, banded row first');
  assert.equal(out.rows[2].primaryPrice, 0, 'a different film never inherits it');
  // The filled row is a real observation, labelled as one.
  assert.equal((out.rows[0].specs as Record<string, string>)['price basis'], 'observed_seat_band');
});
