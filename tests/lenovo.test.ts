import { test } from 'node:test';
import assert from 'node:assert';
import { parseLenovoSearch, lenovoSearchUrl, lenovoHeaders } from '../server/workers/parsers/lenovo.ts';

const SRC: any = {
  id: 't', name: 't', method: 'http', verticals: ['ecommerce'], enabled: true,
  priority: 1, config: {}, rateLimit: {}, freshnessPolicy: {},
};

const SAMPLE = JSON.stringify({
  status: 200,
  msg: 'operation successful!',
  data: {
    count: 2,
    data: [{
      products: [
        {
          id: '21SYCTO1WWIN1_sid-abc',
          productName: 'ThinkPad E14 Gen 7 21SY - ThinkPad E14 Gen 7_01_IN',
          summary: 'ThinkPad E14 Gen 7',
          productCode: '21SYCTO1WWIN1',
          url: '/p/laptops/thinkpad/thinkpade/thinkpad-e14-gen-7-14-inch-intel/21sycto1wwin1',
          webPrice: '309001.00',
          finalPrice: '163417.00',
          noCouponPrice: '167416.00',
          currencyCode: 'INR',
          inventoryStatus: 1,
          ratingStar: 4.5,
          commentCount: 42,
          media: { gallery: [
            { imageAddress: '//ap-img.static.pub/ss/img/2026/a.jpg', imageAlt: 'Front left side view of ThinkPad E14' },
            { imageAddress: '//ap-img.static.pub/ss/img/2026/b.jpg' },
            { imageAddress: 'https://ap-img.static.pub/ss/img/2026/c.jpg' },
          ] },
          classification: [
            { a: 'Processor', b: 'Intel Core Ultra 7 255H' },
            { a: 'Memory', b: '16 GB DDR5' },
          ],
          categoryPath: ['ROOTPMI', 'laptops', 'thinkpad', 'thinkpade'],
        },
        {
          // duplicate config of the same machine (id differs but productCode same)
          // -> kept: it is a distinct purchasable config with its own price
          id: '21SYCTO1WWIN1_sid-def',
          productName: 'ThinkPad E14 Gen 7 21SY - ThinkPad E14 Gen 7_02_IN',
          summary: 'ThinkPad E14 Gen 7',
          productCode: '21SYCTO1WWIN1',
          url: '/p/laptops/thinkpad/thinkpade/thinkpad-e14-gen-7-14-inch-intel/21sycto1wwin1',
          finalPrice: '189999.00',
          currencyCode: 'INR',
          inventoryStatus: 0,
          media: { gallery: [{ imageAddress: '//ap-img.static.pub/ss/img/2026/a.jpg' }] },
        },
        {
          // unpriced row -> honestly skipped
          id: 'x1', productName: 'Service Part', summary: 'Service Part', finalPrice: '0.00',
          inventoryStatus: 1,
        },
        {
          // no summary, code-only slug -> falls back to productName cleanup
          id: 'x2', productName: 'Legion Pro 5 16ADR10_83LT - Legion Pro 5 16ADR10_01_IN',
          url: '/p/laptops/legion-laptops/legion-pro-series/legion-pro-5-gen-10-16-inch-amd/83ltcto1wwin1',
          finalPrice: '206895.00', currencyCode: 'INR', inventoryStatus: 1,
        },
      ],
    }],
  },
});

test('lenovo search url + critical referer header', () => {
  const u = lenovoSearchUrl('thinkpad x1');
  assert.ok(u.startsWith('https://openapi.lenovo.com/in/en/ofp/search/global/cache/products/get/_tsc?text=thinkpad%20x1&rows=24'));
  assert.ok(u.includes('sort=Recommended'));
  const h = lenovoHeaders('thinkpad x1');
  assert.ok(h.Referer.startsWith('https://www.lenovo.com/in/en/search?text='));
  assert.ok(h.Accept.includes('application/json'));
});

test('lenovo parse: prices, mrp, gallery https-upgrade, stock, specs', () => {
  const items = parseLenovoSearch(SAMPLE, SRC, 'https://openapi.lenovo.com/x');
  assert.equal(items.length, 3);

  const first = items[0];
  assert.equal(first.title, 'ThinkPad E14 Gen 7');
  assert.equal(first.price, 163417);
  assert.equal(first.listPrice, 309001);
  assert.equal(first.currency, 'INR');
  assert.equal(first.availability, 'in_stock');
  assert.equal((first.attributes as any).rating, '4.5');
  assert.equal((first.attributes as any).reviews, '42');
  const imgs = String((first.attributes as any).image_urls).split('|');
  assert.equal(imgs.length, 3);
  assert.ok(imgs.every((i: string) => i.startsWith('https://')));
  assert.ok((first.attributes as any).image.startsWith('https://ap-img.static.pub'));
  const specs = JSON.parse((first.attributes as any).specs);
  assert.equal(specs['Processor'], 'Intel Core Ultra 7 255H');
  assert.equal((first.identifiers as any).sku, '21SYCTO1WWIN1');
  assert.ok(String(first.sellerUrl || '').startsWith('https://www.lenovo.com/p/laptops/'));

  // second config: out of stock, no mrp (webPrice absent), single deduped image
  const second = items[1];
  assert.equal(second.price, 189999);
  assert.equal(second.listPrice, undefined);
  assert.equal(second.availability, 'out_of_stock');
  assert.equal(String((second.attributes as any).image_urls), '');

  // third: no summary + code-only slug -> productName before first underscore
  const third = items[2];
  assert.equal(third.title, 'Legion Pro 5 Gen 10 16 Inch Amd');
});

test('lenovo parse: rejects HTML edge-block page and empty payloads', () => {
  assert.equal(parseLenovoSearch('<html><h1>403 Forbidden</h1></html>', SRC, 'u').length, 0);
  assert.equal(parseLenovoSearch('{}', SRC, 'u').length, 0);
});
