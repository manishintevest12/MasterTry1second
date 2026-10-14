/**
 * Reliance Digital parser: real prices from the Fynd-platform SSR
 * window.__INITIAL_STATE__ (live-recon 14 Oct 2026: iPhone 17 256GB = Rs 99,900).
 * Never publishes a product without a real price.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRelianceDigital, extractRelianceState } from '../server/workers/parsers/relianceDigital.ts';

const src: any = { id: 'w_ecom_reliance_digital', name: 'Reliance', vertical: 'ecommerce', method: 'direct_http' };
const item = (name: string, eff: any, marked: any, slug: string) => ({
  type: 'product', name, slug, brand: { name: 'Apple' }, sellable: true,
  price: { effective: { min: eff }, marked: { min: marked } },
  medias: [{ type: 'image', url: 'http://cdn.jiostore.online/a.jpeg' }, { type: 'image', url: 'https://cdn.jiostore.online/b.jpeg' }],
  attributes: { identifier: { ean: ['195950643442'], sku_code: ['494741624'] } }, rating: 0,
});
const page = (items: any[]) =>
  `<html><script>window.__INITIAL_STATE__ = ${JSON.stringify({ productListingPage: { productlists: { items } } })};</script>x {"a":"}"} </html>`;

test('reliance: extracts state with brace matching', () => {
  assert.ok(extractRelianceState(page([])));
  assert.equal(extractRelianceState('<html>nothing</html>'), null);
});

test('reliance: real price, https images, gtin and seller url', () => {
  const out = parseRelianceDigital(page([item('Apple iPhone 17 256 GB, Black', 99900, 99900, 'apple-iphone-17-256-gb-black-mff8ru-9391619')]), src, 'https://www.reliancedigital.in/products?q=iphone');
  assert.equal(out.length, 1);
  const o: any = out[0];
  assert.equal(o.price, 99900);
  assert.equal(o.seller, 'Reliance Digital');
  assert.equal(o.sellerUrl, 'https://www.reliancedigital.in/product/apple-iphone-17-256-gb-black-mff8ru-9391619');
  assert.ok(o.attributes.image.startsWith('https://'));
  assert.equal(o.identifiers.gtin, '195950643442');
});

test('reliance: discount only when marked > effective; unpriced/duplicate items dropped', () => {
  const out: any[] = parseRelianceDigital(page([
    item('A phone', 90000, 100000, 's1'),
    item('No price', 0, 0, 's2'),
    item('Dup', 90000, 100000, 's1'),
  ]), src, 'u');
  assert.equal(out.length, 1);
  assert.equal(out[0].listPrice, 100000);
  assert.equal(out[0].attributes.discount, '10%');
});
