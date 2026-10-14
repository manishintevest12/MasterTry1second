import test from 'node:test';
import assert from 'node:assert/strict';
import { groupHotels } from '../src/utils/hotelGroups';

const mk = (id: string, title: string, price: number, sid: string, city = 'Mumbai'): any => ({
  id, title, primaryPrice: price, priceAvailable: true, specs: { city }, evidence: { sourceId: sid }, sellerQuotes: [{ sellerName: sid }], provider: sid,
});

test('hotelGroups: same hotel on several sites becomes one card with every price', () => {
  const g = groupHotels([
    mk('1', 'The LaLiT Mumbai', 11131, 'w_hotels_agoda'),
    mk('2', 'The Lalit Mumbai', 12000, 'w_hotels_booking'),
    mk('3', 'The Lalit Mumbai', 13600, 'w_hotels_cleartrip'),
  ]);
  assert.equal(g.length, 1);
  assert.equal(g[0].rows.length, 3);
  assert.equal(g[0].best.price, 11131);
});

test('hotelGroups: airport/international wording differences still merge the same hotel', () => {
  const g = groupHotels([
    mk('1', 'Ginger Mumbai Airport', 10500, 'w_hotels_agoda'),
    mk('2', 'Ginger Mumbai International Airport', 9900, 'w_hotels_booking'),
  ]);
  assert.equal(g.length, 1);
});

test('hotelGroups: different branches of the same brand are NOT merged', () => {
  const g = groupHotels([
    mk('1', 'Trident, Bandra Kurla, Mumbai', 19500, 'w_hotels_agoda'),
    mk('2', 'Trident, Nariman Point, Mumbai', 27500, 'w_hotels_booking'),
    mk('3', 'Ginger Mumbai, Andheri (MIDC)', 5933, 'w_hotels_ixigo'),
    mk('4', 'Ginger Mumbai, Goregaon', 8389, 'w_hotels_ixigo'),
  ]);
  assert.equal(g.length, 4);
});

test('hotelGroups: two listings from the same site never merge', () => {
  const g = groupHotels([
    mk('1', 'Hotel Sea Princess', 8000, 'w_hotels_agoda'),
    mk('2', 'Hotel Sea Princess Juhu', 9000, 'w_hotels_agoda'),
  ]);
  assert.equal(g.length, 2);
});

test('hotelGroups: different cities never merge', () => {
  const g = groupHotels([
    mk('1', 'Ginger Hotel', 3000, 'w_hotels_agoda', 'Mumbai'),
    mk('2', 'Ginger Hotel', 3200, 'w_hotels_booking', 'Pune'),
  ]);
  assert.equal(g.length, 2);
});
