import test from 'node:test';
import assert from 'node:assert/strict';
import { hotelsWorker, stampStayDates } from '../server/workers/verticals/hotels';

/**
 * OWNER 10 Nov: hotels showed only "kuch websites" (Agoda/OYO/EasyMyTrip) because Ixigo, Airbnb and Expedia
 * returned priced rows with no travel date and the strict date gate dropped every one of them. Their requests are
 * date-scoped, so the workers stamp the requested stay onto the rows they return.
 */
test('date-scoped hotel sellers are wired into the worker', () => {
  for (const id of ['w_hotels_ixigo', 'w_hotels_airbnb', 'w_hotels_expedia', 'w_hotels_cleartrip', 'w_hotels_yatra']) {
    assert.ok(hotelsWorker.tasks.some((t) => t.sourceId === id), `${id} missing from the hotels worker`);
  }
});

test('stamping keeps the observed price and seller, and adds the requested stay', () => {
  const [row] = stampStayDates([{ title: 'Zostel Indore', seller: 'Ixigo', price: 4170, travel: {}, attributes: { city: 'Indore' } }], '2026-11-21', '2026-11-22');
  assert.equal(row.price, 4170, 'a stamp never touches the price');
  assert.equal(row.seller, 'Ixigo');
  assert.equal(row.travel.date, '2026-11-21');
  assert.equal(row.travel.checkOut, '2026-11-22');
  assert.equal(row.attributes.check_in, '2026-11-21');
  assert.equal(row.attributes.city, 'Indore', 'existing attributes survive');
});

test('a row that already carried its own date is not distorted', () => {
  const [row] = stampStayDates([{ price: 900, travel: { date: '2026-11-21', route: 'Indore stay' } }], '2026-11-21', '2026-11-22');
  assert.equal(row.travel.date, '2026-11-21');
  assert.equal(row.travel.route, 'Indore stay');
});
