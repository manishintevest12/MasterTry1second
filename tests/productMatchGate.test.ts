import test from 'node:test';
import assert from 'node:assert/strict';
import { gateFeedProductRows, collapseSellerVariants } from '../server/search/productMatchGate';

const priceOf = (r: any) => r.price;

test('accessories of the queried phone are withheld', () => {
  const rows = [
    { title: 'Apple iPhone 18 Pro 256 GB, Burgundy', price: 164900 },
    { title: 'PEEPERLY Tropical Printed iPhone 18 Pro Back Cover', price: 999 },
    { title: 'Luxury Kase Solid Printed iPhone 18 Pro Back Case', price: 599 },
  ];
  const out = gateFeedProductRows(rows, 'iphone 18', priceOf);
  assert.deepEqual(out.kept.map((r) => r.price), [164900]);
  assert.equal(out.dropped.length, 2);
  assert.ok(out.dropped.every((d) => d.reason === 'accessory'));
});

test('a different model number is not this product', () => {
  const out = gateFeedProductRows([
    { title: 'Apple iPhone 18 Pro 256 GB', price: 164900 },
    { title: 'Apple iPhone 17 Pro 256 GB', price: 129900 },
  ], 'iphone 18', priceOf);
  assert.deepEqual(out.kept.map((r) => r.title), ['Apple iPhone 18 Pro 256 GB']);
  assert.equal(out.dropped[0].reason, 'model');
});

test('a knock-off far below the seller band is withheld', () => {
  const out = gateFeedProductRows([
    { title: 'Apple iPhone 18 Pro 256 GB', price: 164900 },
    { title: 'Croma Apple iPhone 18 Pro 256GB', price: 164900 },
    { title: 'CG MOBILE iPhone 18 Pro Pro Max', price: 6999 },
  ], 'iphone 18', priceOf);
  assert.equal(out.kept.length, 2);
  assert.equal(out.dropped[0].reason, 'implausible');
});

test('a generic query stays a browse search (no model gate)', () => {
  const out = gateFeedProductRows([
    { title: 'Samsung Galaxy S24 5G (8GB/128GB)', price: 54999 },
    { title: 'Back Cover for Mobile Phone', price: 199 },
  ], 'mobile phone', priceOf);
  assert.equal(out.kept.length, 1);
  assert.equal(out.kept[0].title, 'Samsung Galaxy S24 5G (8GB/128GB)');
});

test('a lone honest row is never emptied out', () => {
  const out = gateFeedProductRows([{ title: 'Apple iPhone 18 Pro 256 GB', price: 164900 }], 'iphone 18', priceOf);
  assert.equal(out.kept.length, 1);
});

test('colour variants of one seller collapse to the cheapest card', () => {
  const rows = [
    { title: 'Apple iPhone 18 Pro 256 GB, Burgundy', seller: 'Reliance Digital', price: 164900 },
    { title: 'Apple iPhone 18 Pro 256 GB, Black', seller: 'Reliance Digital', price: 166900 },
    { title: 'Apple iPhone 18 Pro 256 GB, Silver', seller: 'Flipkart', price: 164900 },
    { title: 'Apple iPhone 18 Pro 512 GB, Burgundy', seller: 'Reliance Digital', price: 189900 },
  ];
  const out = collapseSellerVariants(rows as any[], priceOf);
  assert.equal(out.length, 3);
  const reliance256 = out.find((r: any) => r.seller === 'Reliance Digital' && /256/.test(r.title)) as any;
  assert.equal(reliance256.price, 164900);
  assert.equal(reliance256.attributes.variantCount, 2);
  assert.ok(out.some((r: any) => /512/.test(r.title)), 'a different capacity is a different product');
});
