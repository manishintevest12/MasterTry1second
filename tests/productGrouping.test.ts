import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupSameProduct, productKey, sizeTokens } from '../server/pipeline/productGrouping';
import { normalizeAttributes } from '../server/pipeline/normalization';

const mk = (id: string, title: string, seller: string, price: number, imageUrl?: string) => ({
  id, vertical: 'grocery', title, primaryPrice: price, imageUrl,
  sellerQuotes: [{ sellerName: seller, price, isLowest: true }],
});

test('size tokens canonicalise units', () => {
  assert.deepEqual(sizeTokens('Makhana 100 g'), ['100g']);
  assert.deepEqual(sizeTokens('Oil 1 kg'), ['1000g']);
  assert.deepEqual(sizeTokens('Milk 500ml'), ['500ml']);
});

test('same product from two sellers merges into one card with 2 quotes', () => {
  const a = mk('a', 'Happilo Premium All Natural Fox Nuts (Phool Makhana) (100 g)', 'Swiggy Instamart', 140, 'https://x/y.png');
  const b = mk('b', 'Happilo Premium Fox Nuts Phool Makhana 100g', 'Amazon.in', 129);
  const out = groupSameProduct([a, b], () => ({ brand: 'Happilo' }));
  assert.equal(out.length, 1);
  assert.equal(out[0].sellerQuotes.length, 2);
  assert.equal(out[0].sellerQuotes[0].sellerName, 'Amazon.in');
  assert.equal(out[0].primaryPrice, 129);
  assert.equal(out[0].imageUrl, 'https://x/y.png');
});

test('different pack sizes never merge', () => {
  const a = mk('a', 'Happilo Fox Nuts Phool Makhana 100 g', 'Swiggy Instamart', 140);
  const b = mk('b', 'Happilo Fox Nuts Phool Makhana 200 g', 'Amazon.in', 250);
  assert.equal(groupSameProduct([a, b], () => ({ brand: 'Happilo' })).length, 2);
});

test('different brands never merge', () => {
  const a = mk('a', 'Fox Nuts Phool Makhana 100 g', 'Swiggy Instamart', 140);
  const b = mk('b', 'Fox Nuts Phool Makhana 100 g', 'Amazon.in', 129);
  assert.equal(groupSameProduct([a, b], (it: any) => ({ brand: it.id === 'a' ? 'Happilo' : 'Farmley' })).length, 2);
});

test('productKey returns null with too little signal', () => {
  assert.equal(productKey('Milk', 'Amul'), null);
});

test('image aliases are unified into image_url', () => {
  assert.equal(normalizeAttributes({ image: 'http://a/b.jpg' })['image_url'], 'https://a/b.jpg');
  assert.equal(normalizeAttributes({ imageUrl: '//cdn/x.png' })['image_url'], 'https://cdn/x.png');
  assert.equal(normalizeAttributes({ image: '' })['image_url'], undefined);
});
