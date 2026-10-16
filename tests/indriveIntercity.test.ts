import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndriveOffers, type InDriveCity } from '../server/workers/parsers/indriveIntercity';

const delhi: InDriveCity = { id: 5233, name: 'Delhi NCR', sub_name: 'Delhi, India', currency_code: 'INR' };
const jaipur: InDriveCity = { id: 5250, name: 'Jaipur', sub_name: 'Rajasthan, India', currency_code: 'INR' };
const rows = [
  { min_price: 1600, max_price: 5600, order_type: 'private' },
  { min_price: 100, max_price: 5600, order_type: 'parcel' },
  { min_price: 1000, max_price: 5600, order_type: 'pool' },
];

test('buildIndriveOffers: emits private + pool (never parcel), price = min of band, sorted', () => {
  const src: any = { id: 'w_cab_indrive', name: 'indrive' };
  const items = buildIndriveOffers(src, 'delhi', 'jaipur', delhi, jaipur, rows);
  assert.equal(items.length, 2);
  assert.equal(items[0].price, 1000); // pool cheaper, sorted first
  assert.equal(items[1].price, 1600);
  assert.ok(items[0].title.includes('pool'));
  assert.ok(items[1].title.includes('private car'));
  assert.ok(!items.some((i: any) => i.title.includes('parcel')));
  // range carried in the honest price basis
  assert.ok(String(items[1].attributes.price_basis).includes('₹1600–₹5600'));
  assert.ok(String(items[1].attributes.data_note).includes('name-your-price'));
  assert.equal(items[1].currency, 'INR');
  assert.equal(items[1].seller, 'InDrive');
  assert.equal(items[1].identifiers.sku, 'indrive-ic-5233-5250-private');
});

test('buildIndriveOffers: flat band (min==max) labels a single published price', () => {
  const src: any = { id: 'w_cab_indrive', name: 'indrive' };
  const items = buildIndriveOffers(src, 'mumbai', 'pune', delhi, jaipur, [{ min_price: 500, max_price: 500, order_type: 'private' }]);
  assert.equal(items.length, 1);
  assert.ok(String(items[0].attributes.price_basis).includes('published price ₹500'));
});

test('buildIndriveOffers: zero/unknown rows are dropped, empty result is empty', () => {
  const src: any = { id: 'w_cab_indrive', name: 'indrive' };
  assert.equal(buildIndriveOffers(src, 'a', 'b', delhi, jaipur, []).length, 0);
  assert.equal(buildIndriveOffers(src, 'a', 'b', delhi, jaipur, [{ min_price: 0, max_price: 0, order_type: 'private' }, { min_price: 10, max_price: 20, order_type: 'mystery' }]).length, 0);
});
