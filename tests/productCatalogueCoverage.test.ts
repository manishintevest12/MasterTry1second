/**
 * OWNER 29 OCT ("iphone 16 mobile daala tho results sirf flipkart ka show kiya, amazon/myntra
 * sab aana chahiye"): the product page read the catalogue vertical-wide (newest 80 rows), so a
 * seller whose row had been verified earlier fell out of the window and disappeared, while a
 * freshly saved seller always showed. These tests pin the query-aware lookup and its fallback.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { findProductCatalogueRows, productCatalogueTerms } from '../server/catalogue/productCatalogue';

const row = (id: string, seller: string, title = 'Apple iPhone 16 (128 GB)') => ({
  id, title, seller, vendor: seller, fetched_at: '2026-10-29T09:00:00.000Z',
  effective_price: 69900, mandatory_total: 69900, availability: 'in_stock',
} as any);

test('product terms keep the distinctive words of the query', () => {
  assert.deepEqual(productCatalogueTerms('Apple iPhone 16 (128 GB)'), ['apple', 'iphone', '128']);
  assert.deepEqual(productCatalogueTerms('iphone 16'), ['iphone'], 'two-letter model numbers are too weak to filter on');
  assert.deepEqual(productCatalogueTerms('  '), []);
});

test('generic shopping words never become a catalogue filter', () => {
  assert.deepEqual(productCatalogueTerms('best price online'), []);
});

test('the term-aware lookup is asked first, with every seller it returns', async () => {
  const calls: Array<{ vertical: string; opts: any }> = [];
  const sellerRows = [row('1', 'Amazon'), row('2', 'Croma'), row('3', 'Reliance Digital')];
  const rows = await findProductCatalogueRows('ecommerce', { query: 'iphone 16', limit: 80 }, (async (vertical: string, opts: any) => {
    calls.push({ vertical, opts });
    return sellerRows;
  }) as any);
  assert.equal(calls.length, 1, 'no plain fallback when the targeted set already covers several sellers');
  assert.deepEqual(calls[0].opts.queryTerms, ['iphone']);
  assert.equal(rows.length, 3);
});

test('a targeted set that names only one seller is merged with the plain lookup', async () => {
  const targeted = [row('1', 'Flipkart'), row('2', 'Flipkart')];
  const plain = [row('1', 'Flipkart'), row('3', 'Amazon'), row('4', 'Myntra')];
  const rows = await findProductCatalogueRows('ecommerce', { query: 'iphone 16', limit: 80 }, (async (_v: string, opts: any) => (
    opts.queryTerms ? targeted : plain
  )) as any);
  assert.deepEqual(rows.map((r) => r.id), ['1', '2', '3', '4'], 'own rows first, plain rows appended without duplicates');
});

test('a query with no usable terms still reads the catalogue', async () => {
  const rows = await findProductCatalogueRows('grocery', { query: 'a', limit: 40 }, (async (_v: string, opts: any) => (
    opts.queryTerms ? [] : [row('9', 'Blinkit')]
  )) as any);
  assert.deepEqual(rows.map((r) => r.id), ['9']);
});

test('a failing lookup degrades to an empty list instead of throwing', async () => {
  const rows = await findProductCatalogueRows('ecommerce', { query: 'iphone 16', limit: 80 }, (async () => {
    throw new Error('store down');
  }) as any);
  assert.deepEqual(rows, []);
});
