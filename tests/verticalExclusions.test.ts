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

/**
 * OWNER 22 Nov ("digihaat.in ... abhi v 10 min grocery mai aa raha hai"): the first version only read
 * vendor/seller/site/provider/merchant/sourceId, so a row that named the merchant in its TITLE, its URL or a
 * per-seller quote walked straight past the filter. Every one of those is caught now.
 */
const groceryRow = (over: Record<string, any> = {}) => ({
  title: 'Amul Taaza Milk 500 ml',
  provider: 'BigBasket',
  sourceId: 'w_grocery_bb',
  ...over,
});

test('a grocery row is dropped however it names DigiHaat', () => {
  const shapes = [
    groceryRow({ provider: 'DigiHaat' }),
    groceryRow({ title: 'Amul Taaza Milk 500 ml - DigiHaat' }),
    groceryRow({ url: 'https://digihaat.in/en/product/123' }),
    groceryRow({ sellerQuotes: [{ sellerName: 'DigiHaat', price: 54 }] }),
    groceryRow({ provider: 'Digi Haat' }),
  ];
  for (const r of shapes) {
    assert.equal(dropExcludedOffers('grocery', [r]).length, 0, JSON.stringify(r).slice(0, 80));
  }
});

test('clean grocery rows and every e-commerce row survive untouched', () => {
  const clean = groceryRow();
  assert.equal(dropExcludedOffers('grocery', [clean]).length, 1);
  assert.deepEqual(dropExcludedOffers('grocery', [clean])[0], clean);
  const ecom = groceryRow({ provider: 'DigiHaat' });
  assert.equal(dropExcludedOffers('ecommerce', [ecom]).length, 1);
});
