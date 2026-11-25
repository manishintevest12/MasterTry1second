import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDeliveryPoint } from '../server/common/deliveryLocation';

/**
 * OWNER 25 Nov: "biryani search mai aata hai pr redirect kr ke swiggy pr jata hoon tho wo mere area mai delivery ni
 * krta ... same issue 10-min grocery mai v". A delivery-zone source (Swiggy, Blinkit, Zepto, Instamart) prices one
 * point, so the point we ask about IS the answer. These pin the three-step rule and the refusal to borrow a city.
 */

const TABLE: Record<string, [number, number]> = {
  indore: [22.7196, 75.8577],
  bengaluru: [12.9716, 77.5946],
  bangalore: [12.9716, 77.5946],
  mumbai: [19.076, 72.8777],
};

test('the shopper\'s own GPS fix wins over any city table', () => {
  const p = resolveDeliveryPoint({ lat: 22.7533, lng: 75.8937, city: 'Indore', locality: 'Vijay Nagar' }, TABLE);
  assert.equal(p?.lat, 22.7533);
  assert.equal(p?.lng, 75.8937);
  assert.equal(p?.exact, true);
  assert.equal(p?.label, 'Vijay Nagar');
});

test('a typed city falls back to that city\'s own point, labelled as the city', () => {
  const p = resolveDeliveryPoint({ city: 'Indore' }, TABLE);
  assert.deepEqual([p?.lat, p?.lng], TABLE.indore);
  assert.equal(p?.exact, false);
  assert.equal(p?.label, 'Indore');
});

test('an unknown area gets NO point instead of another city\'s prices', () => {
  assert.equal(resolveDeliveryPoint({ city: 'Ujjain' }, TABLE), null);
  assert.equal(resolveDeliveryPoint({}, TABLE), null);
  assert.equal(resolveDeliveryPoint(undefined, TABLE), null);
});

test('a 0/0 "no fix" placeholder is not treated as a location', () => {
  assert.equal(resolveDeliveryPoint({ lat: 0, lng: 0, city: 'Ujjain' }, TABLE), null);
  assert.deepEqual([resolveDeliveryPoint({ lat: 0, lng: 0, city: 'Indore' }, TABLE)?.lat], [TABLE.indore[0]]);
});

test('city spelling variants still resolve to the same point', () => {
  const a = resolveDeliveryPoint({ city: 'Bengaluru' }, TABLE);
  const b = resolveDeliveryPoint({ city: 'bangalore' }, TABLE);
  assert.deepEqual([a?.lat, a?.lng], [b?.lat, b?.lng]);
  const partial = resolveDeliveryPoint({ city: 'Bangalore Rural' }, TABLE);
  assert.ok(partial, 'a decorated city name must still find its city point');
  assert.equal(partial?.exact, false);
});
