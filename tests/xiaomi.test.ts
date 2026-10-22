/**
 * Xiaomi India (mi.com) parser regression (22 Oct): the storefront SPA's search
 * BFF (in-go.buy.mi.com/in/v2/search/result, cracked from SPPS chunk 33572)
 * returns data.data_provider.data.product_list[] with product{name,
 * price_min_num, market_price_min_num, image, item_link, has_store,
 * categories} + commodity[] variants, each with its own image.
 * The parser must emit real prices, the mi.com PDP deeplink, stock state,
 * the category path, and a multi-image gallery from distinct variant shots.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseXiaomiSearch } from '../server/workers/parsers/xiaomi.ts';

const src: any = { id: 'w_ecom_xiaomi', name: 'Xiaomi', method: 'http', verticals: ['ecommerce'], enabled: true, priority: 18, config: {}, rateLimit: { maxRequestsPerMinute: 8, maxConcurrency: 2 }, freshnessPolicy: {} };

function xiaomiBody(products: any[]) {
  return JSON.stringify({
    errno: 0,
    data: {
      keyword: 'phone',
      data_provider: {
        product_total_count: products.length,
        data: { product_list: products },
      },
    },
  });
}

test('xiaomi: product_list parses with price, mrp, PDP link, stock, category and variant gallery', () => {
  const body = xiaomiBody([
    {
      product: {
        id: 6901,
        name: 'REDMI Note 17 5G',
        price_min_num: 16999,
        price_max_num: 18999,
        market_price_min_num: 21999,
        image: 'https://i03.appmifile.com/228_item_in/17/04/2026/hero.png',
        item_link: 'https://www.mi.com/in/product/redmi-note-17-5g/',
        spu_id: 'SPU1021261',
        is_sale: 1,
        has_store: 1,
        is_new: 0,
        categories: [
          { title: 'Phones', category_tag: 'phone' },
          { title: 'Redmi Phones', category_tag: 'redmi' },
        ],
      },
      commodity: [
        { id: 3224101550, name: 'REDMI Note 17 5G Arctic Blue', image: 'https://i03.appmifile.com/228_item_in/17/04/2026/blue.png', sales_price: '16999' },
        { id: 3224101551, name: 'REDMI Note 17 5G Dark Night', image: 'https://i03.appmifile.com/228_item_in/17/04/2026/night.png', sales_price: '16999' },
        { id: 3224101552, name: 'REDMI Note 17 5G Purple', image: 'https://i03.appmifile.com/228_item_in/17/04/2026/blue.png', sales_price: '16999' },
      ],
    },
  ]);
  const items = parseXiaomiSearch(body, src, 'https://in-go.buy.mi.com/in/v2/search/result?word=phone');
  assert.equal(items.length, 1);
  const it = items[0];
  assert.equal(it.title, 'REDMI Note 17 5G');
  assert.equal(it.price, 16999);
  assert.equal(it.listPrice, 21999);
  assert.equal(it.currency, 'INR');
  assert.equal(it.seller, 'Xiaomi (mi.com)');
  assert.equal(it.sellerUrl, 'https://www.mi.com/in/product/redmi-note-17-5g/');
  assert.equal(it.identifiers?.sku, '6901');
  assert.equal(it.availability, 'in_stock');
  assert.equal(it.attributes?.brand, 'Redmi');
  assert.equal(it.attributes?.category, 'Phones > Redmi Phones');
  // gallery: hero + distinct variant shots only (blue.png deduped)
  const imgs = String(it.attributes?.image_urls || '').split('|').filter(Boolean);
  assert.deepEqual(imgs, [
    'https://i03.appmifile.com/228_item_in/17/04/2026/hero.png',
    'https://i03.appmifile.com/228_item_in/17/04/2026/blue.png',
    'https://i03.appmifile.com/228_item_in/17/04/2026/night.png',
  ]);
  assert.equal(it.attributes?.image, 'https://i03.appmifile.com/228_item_in/17/04/2026/hero.png');
});

test('xiaomi: dedupes by product id, skips unpriced entries, caps at 30, survives junk', () => {
  const mk = (id: number, name: string, price?: number) => ({
    product: { id, name, price_min_num: price, image: '', item_link: 'https://www.mi.com/in/x', has_store: 0 },
    commodity: [],
  });
  const products: any[] = [
    mk(1, 'Redmi TV 43', 24999),
    mk(1, 'Redmi TV 43 (dupe)', 24999), // dedup by id
    mk(2, 'Mystery Box'), // no price -> skipped
    ...Array.from({ length: 35 }, (_, i) => mk(100 + i, `Redmi ${i}`, 9999 + i)),
  ];
  const items = parseXiaomiSearch(xiaomiBody(products), src, 'url');
  assert.equal(items.length, 30);
  assert.ok(items.every((x) => Number.isFinite(x.price) && x.price > 0));
  const ids = items.map((x) => x.identifiers?.sku);
  assert.equal(new Set(ids).size, 30);
  // out-of-stock flag respected
  assert.equal(items[0].availability, 'out_of_stock');
  // junk bodies
  assert.deepEqual(parseXiaomiSearch('<html>blocked</html>', src, 'u'), []);
  assert.deepEqual(parseXiaomiSearch('{"errno":1}', src, 'u'), []);
});

test('xiaomi: falls back to commodity sales_price when the SPU hides its own', () => {
  const body = xiaomiBody([
    {
      product: { id: 55, name: 'Xiaomi Smart Band', image: 'https://i03.appmifile.com/b.png', item_link: 'https://www.mi.com/in/band', has_store: 1 },
      commodity: [{ id: 9, name: 'Band Black', image: 'https://i03.appmifile.com/b.png', sales_price: '2499' }],
    },
  ]);
  const items = parseXiaomiSearch(body, src, 'u');
  assert.equal(items.length, 1);
  assert.equal(items[0].price, 2499);
  assert.equal(items[0].attributes?.brand, 'Xiaomi');
});
