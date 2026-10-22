/**
 * Realme India parser regression (22 Oct): api.realme.com/in/product/info/search
 * (POST, cracked from NUXT bundle DPzNpKbK.js) returns data.records[] with
 * spuName, skuId, currentPrice, mrpPrice, stockStatus, overviewUrl (hero image).
 * PDP = buy.realme.com/in/goods/<skuId>. Parser must emit real prices/MRP,
 * the goods deeplink, stock flags, rating/reviews into attributes, and skip
 * price-pending rows. Gallery is honestly unavailable (detail API is
 * session-gated) — image_urls stays empty, never fabricated.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRealmeSearch } from '../server/workers/parsers/realme.ts';

const src: any = { id: 'w_ecom_realme', name: 'Realme', method: 'http', verticals: ['ecommerce'], enabled: true, priority: 18, config: {}, rateLimit: { maxRequestsPerMinute: 8, maxConcurrency: 2 }, freshnessPolicy: {} };

function realmeBody(records: any[]) {
  return JSON.stringify({ code: 200, msg: 'ok', data: { recordTotal: records.length, records } });
}

test('realme: records parse with price, mrp, goods deeplink, stock, rating', () => {
  const body = realmeBody([
    {
      spuName: 'realme P4 Power 5G',
      skuId: 35944,
      spuId: 1022,
      currentPrice: 32999.0,
      mrpPrice: 50999.0,
      originalPrice: 50999.0,
      stockStatus: true,
      saleStatus: true,
      productCategoryCode: 'mobile',
      overviewUrl: 'https://image01.realme.net/general/20260701/p4-power.png',
      reviewsScoreAvg: 4.6,
      reviewsTotalNum: 512,
      tag: 'Hot',
    },
  ]);
  const items = parseRealmeSearch(body, src, 'https://api.realme.com/in/product/info/search');
  assert.equal(items.length, 1);
  const it = items[0];
  assert.equal(it.title, 'realme P4 Power 5G');
  assert.equal(it.price, 32999);
  assert.equal(it.listPrice, 50999);
  assert.equal(it.currency, 'INR');
  assert.equal(it.seller, 'Realme (realme.com)');
  assert.equal(it.sellerUrl, 'https://buy.realme.com/in/goods/35944');
  assert.equal(it.identifiers?.sku, '35944');
  assert.equal(it.availability, 'in_stock');
  assert.equal(it.attributes?.brand, 'Realme');
  assert.equal(it.attributes?.rating, '4.6');
  assert.equal(it.attributes?.review_count, '512');
  assert.equal(it.attributes?.badge, 'Hot');
  assert.equal(it.attributes?.image, 'https://image01.realme.net/general/20260701/p4-power.png');
  // honest limit: no fabricated gallery
  assert.equal(it.attributes?.image_urls, '');
});

test('realme: skips price-pending + unpriced, flags out-of-stock, dedupes, survives junk', () => {
  const mk = (sku: number, name: string, price: number | null, stock = true) => ({
    spuName: name, skuId: sku, currentPrice: price, mrpPrice: price ? price * 1.2 : null,
    stockStatus: stock, saleStatus: true, overviewUrl: '',
  });
  const body = realmeBody([
    mk(1, 'realme GT 8 Pro', 72999),
    mk(2, 'Upcoming Phone', null), // unpriced -> skipped
    { spuName: 'Coming Soon', skuId: 3, currentPrice: 9999, isPricePendingDisplay: true }, // pending -> skipped
    mk(4, 'realme 16 Pro 5G', 44999, false), // out of stock
    mk(1, 'realme GT 8 Pro (dupe)', 72999), // duplicate sku
  ]);
  const items = parseRealmeSearch(body, src, 'u');
  assert.equal(items.length, 2);
  assert.deepEqual(items.map((x) => x.identifiers?.sku), ['1', '4']);
  const oos = items.find((x) => x.identifiers?.sku === '4');
  assert.equal(oos?.availability, 'out_of_stock');
  assert.equal(oos?.attributes?.in_stock, 'false');
  // junk bodies
  assert.deepEqual(parseRealmeSearch('<html>blocked</html>', src, 'u'), []);
  assert.deepEqual(parseRealmeSearch('{"code":500,"msg":"err"}', src, 'u'), []);
  assert.deepEqual(parseRealmeSearch('not json', src, 'u'), []);
});

test('realme: Narzo branding + coupon price fallback', () => {
  const body = realmeBody([
    { spuName: 'NARZO Power 5G', skuId: 34222, currentPrice: null, useCouponPrice: 32999, mrpPrice: 35999, stockStatus: true, saleStatus: true, overviewUrl: '' },
  ]);
  const items = parseRealmeSearch(body, src, 'u');
  assert.equal(items.length, 1);
  assert.equal(items[0].price, 32999);
  assert.equal(items[0].listPrice, 35999);
  assert.equal(items[0].attributes?.brand, 'Realme (Narzo)');
});
