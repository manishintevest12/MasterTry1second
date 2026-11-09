import test from 'node:test';
import assert from 'node:assert/strict';
import { enforceAccountKind, requestedAccountKind, rowAccountKind } from '../server/search/accountTypeGate';
import { fillMoviePricesFromBand } from '../server/search/moviesPriceFill';

// OWNER 9 Nov, two reports:
//  (a) "account type savings, current, demat ... click krne ke baad uss se related hi data aana chaiye"
//      - production answered the demat query with 12 savings rows out of 15.
//  (b) "bookmyshow, ticketnew website mai price dikha raha hai pr flutter app pr ni"
//      - the publisher with no fare was dropped by No-Price-No-Card on the app while the same film had a
//        real observed seat band from another seller.

const dematAnswer = [
  { title: 'Zerodha Demat Account', provider: 'Zerodha' },
  { title: 'Bank of India Savings Account', provider: 'Bank of India' },
  { title: 'Bank of Baroda Savings Account', provider: 'Bank of Baroda' },
  { title: 'Union Bank of India Savings Account', provider: 'Union Bank' },
  { title: 'Groww Demat Account', provider: 'Groww' },
];

test('the requested account type is read from the query, never guessed', () => {
  assert.equal(requestedAccountKind('demat account'), 'demat');
  assert.equal(requestedAccountKind('HDFC Demat Account'), 'demat');
  assert.equal(requestedAccountKind('current account'), 'current');
  assert.equal(requestedAccountKind('savings account'), 'savings');
  assert.equal(requestedAccountKind('HDFC savings account'), 'savings');
  assert.equal(requestedAccountKind('bank accounts'), '');
});

test('a demat search never answers savings rows (the production 12-of-15 leak)', () => {
  const gate = enforceAccountKind(dematAnswer, 'demat');
  assert.equal(gate.kept.length, 2);
  assert.ok(gate.kept.every((r) => rowAccountKind(r) === 'demat'));
  assert.equal(gate.dropped, 3);
  assert.equal(gate.droppedKinds.savings, 3);
});

test('the other two types scope the same way, and an untyped search is untouched', () => {
  assert.equal(enforceAccountKind(dematAnswer, 'savings').kept.length, 3);
  assert.equal(enforceAccountKind(dematAnswer, 'current').kept.length, 0);
  assert.equal(enforceAccountKind(dematAnswer, '').kept.length, dematAnswer.length);
});

const movieRows = [
  { title: 'Ramayana', provider: 'District by Zomato (Paytm)', primaryPrice: 250, priceAvailable: true, specs: { 'price band': '₹250–₹1050' } },
  { title: 'Ramayana', provider: 'TicketNew', primaryPrice: 0, priceAvailable: false, specs: { 'price band': '₹250–₹1050' } },
  { title: 'Ramayana', provider: 'BookMyShow', primaryPrice: 0, priceAvailable: false, specs: {} },
  { title: 'Pyre', provider: 'BookMyShow', primaryPrice: 0, priceAvailable: false, specs: {} },
];

test('a film the site prices from its observed band is priced on every surface', () => {
  const { rows, filled } = fillMoviePricesFromBand(movieRows);
  assert.equal(filled, 2);
  const bms = rows.find((r) => r.provider === 'BookMyShow' && r.title === 'Ramayana')!;
  assert.equal(bms.primaryPrice, 250);
  assert.equal((bms.specs as any)['price basis'], 'observed_seat_band');
  assert.equal(bms.priceAvailable, true);
});

test('a film nobody observed a price for is left price-less (nothing invented)', () => {
  const { rows } = fillMoviePricesFromBand(movieRows);
  const pyre = rows.find((r) => r.title === 'Pyre')!;
  assert.equal(pyre.primaryPrice, 0);
  assert.equal(pyre.priceAvailable, false);
});
