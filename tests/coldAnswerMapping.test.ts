import test from 'node:test';
import assert from 'node:assert/strict';
import { offerToComparisonItem } from '../server/api/routes';

// OWNER 9 Nov ("abhi no matching option found aane lga"): the FIRST (cold) answer served 24 Kiwi rows
// whose price and day were lost in mapping, so the app suppressed every card as price-less and showed
// "No matching options found" while /api/search answered 181 priced rows for the same minute. A worker
// row puts its money on `price` and its day on travel.date - both must survive the mapping.
test('a raw worker row keeps its price and its journey date through the mapping', () => {
  const item: any = offerToComparisonItem({
    id: 'x1', vertical: 'flights', title: 'IndiGo Airlines 6E6184 · Indore → Mumbai', brand: 'IndiGo',
    price: 4999, currency: 'INR', seller: 'Kiwi.com',
    travel: { route: 'Indore → Mumbai', date: '2026-11-25' },
    attributes: { flight_number: '6E6184', departure: '07:15', arrival: '08:45' },
  }, { date: '2026-11-25' });
  assert.ok(Number(item.primaryPrice) > 0, 'price must not be lost');
  assert.equal(item.primaryPrice, 4999);
  assert.equal(item.specs['travel date'], '2026-11-25');
  assert.equal(item.specs['flight number'], '6E6184');
});

test('an already-answer-shaped row keeps its own specs and price', () => {
  const item: any = offerToComparisonItem({
    id: 'off_1', vertical: 'flights', title: 'IndiGo 6E6598 · Indore → Mumbai',
    primaryPrice: 6400, specs: { 'travel date': '2026-11-25', 'flight number': '6E6598' },
  }, {});
  assert.equal(item.primaryPrice, 6400);
  assert.equal(item.specs['travel date'], '2026-11-25');
  assert.equal(item.specs['flight number'], '6E6598');
});
