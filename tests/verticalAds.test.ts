import test from 'node:test';
import assert from 'node:assert/strict';

import { dealsVerticalFor } from '../server/marketing/deals';

/** OWNER 3 Nov: "ad humesa vertical ke hisab se hoga ... naa ki aisa real vs fake girl type".
 * The ad slot is resolved per vertical, so the vertical id the feed sends must map onto the deals
 * registry's own spelling. A silent mismatch would empty the slot (or fill it with the wrong
 * vertical's offers), which is how irrelevant creatives ended up under Flights. */
test('feed vertical ids map onto the deals registry verticals', () => {
  assert.equal(dealsVerticalFor('flights'), 'flights');
  assert.equal(dealsVerticalFor('hotels'), 'hotels');
  assert.equal(dealsVerticalFor('bus'), 'bus');
  assert.equal(dealsVerticalFor('movie'), 'movies');   // feed says movie, registry says movies
  assert.equal(dealsVerticalFor('movies'), 'movies');
  assert.equal(dealsVerticalFor('cab'), 'cab');
  assert.equal(dealsVerticalFor('ecommerce'), 'ecommerce');
  assert.equal(dealsVerticalFor('grocery'), 'grocery');
  assert.equal(dealsVerticalFor('food'), 'food');
  assert.equal(dealsVerticalFor('creditcards'), 'credit_cards');
  assert.equal(dealsVerticalFor('account'), 'banking');
  assert.equal(dealsVerticalFor('  Flights  '), 'flights', 'case and padding are normalised');
  // Unknown verticals pass through untouched (never guessed into another vertical's offers).
  assert.equal(dealsVerticalFor('insurance'), 'insurance');
  assert.equal(dealsVerticalFor('something_new'), 'something_new');
});
