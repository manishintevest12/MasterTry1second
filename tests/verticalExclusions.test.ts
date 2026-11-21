import test from 'node:test';
import assert from 'node:assert/strict';
import { excludedMerchantsFor, isExcludedMerchant, dropExcludedOffers } from '../server/registry/verticalExclusions';

/**
 * OWNER 21 Nov: "digihaat.in ko aap food delivery, 10 min grocery se hata do."
 * DigiHaat stays an e-commerce partner, so the rule is per vertical and must not touch e-commerce rows.
 */
test('digihaat is excluded from grocery and food only', () => {
  assert.deepEqual(excludedMerchantsFor('grocery'), ['digihaat', 'digi haat']);
  assert.deepEqual(excludedMerchantsFor('food'), ['digihaat', 'digi haat']);
  assert.deepEqual(excludedMerchantsFor('ecommerce'), []);
  assert.deepEqual(excludedMerchantsFor('hotels'), []);
  assert.deepEqual(excludedMerchantsFor(undefined), []);
});

test('merchant matching reads vendor, seller, site, provider and source id', () => {
  assert.equal(isExcludedMerchant('grocery', 'DigiHaat'), true);
  assert.equal(isExcludedMerchant('food', 'w_food_digihaat'), true);
  assert.equal(isExcludedMerchant('grocery', 'Blinkit Pod, Palasia'), false);
  assert.equal(isExcludedMerchant('ecommerce', 'DigiHaat'), false, 'e-commerce keeps the partner');
});

test('excluded rows are dropped and everything else is untouched', () => {
  const rows = [
    { vendor: 'Zepto', seller: 'Zepto Pod', title: 'Amul Taaza 500 ml', price: 27 },
    { vendor: 'DigiHaat', seller: 'mydailygoods', title: 'Amul Taaza 500 ml', price: 25 },
    { vendor: 'Blinkit', seller: 'Blinkit', title: 'Amul Taaza 500 ml', price: 28 },
  ];
  const kept = dropExcludedOffers('grocery', rows);
  assert.equal(kept.length, 2);
  assert.deepEqual(kept.map((r) => r.vendor), ['Zepto', 'Blinkit']);
  assert.equal(kept[0].price, 27, 'surviving prices are never re-computed');
});

test('e-commerce keeps its digihaat rows', () => {
  const rows = [{ vendor: 'DigiHaat', title: 'boAt Airdopes', price: 1299 }];
  assert.equal(dropExcludedOffers('ecommerce', rows).length, 1);
});
