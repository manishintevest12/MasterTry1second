/**
 * JioMart parser regression (17 Oct): JioMart (Fynd/JCP) catalog
 * /api/service/application/catalog/v1.0/products/ returns { items[], page, ... }
 * where items carry name, slug, uid, item_code, brand.name, price.effective.min
 * (selling), price.marked.min (MRP), medias[{url,type}], sellable. The parser must
 * emit real prices, PDP deeplinks (/p/<slug>), https-only deduped galleries (owner
 * multi-image rule), computed discount, and sku+vendorProductId identifiers.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJiomart } from '../server/workers/parsers/jiomart.ts';

const src: any = { id: 't_ecom_jiomart', name: 'JioMart', method: 'http', verticals: ['ecommerce'], enabled: true, priority: 5, config: {}, rateLimit: { maxRequestsPerMinute: 10, maxConcurrency: 2 }, freshnessPolicy: {} };

const URL = 'https://www.jiomart.com/api/service/application/catalog/v1.0/products/?q=nike%20shoes&page_no=1&page_size=40&pincode=400070';

function item(overrides: any = {}) {
  return {
    name: 'NIKE Men Air Max 270 Sneakers',
    slug: 'air-max-270-lace-up-casual-shoes-mkmad5-72278673',
    uid: 72278673,
    item_code: '469434637_blackgrey',
    sku_code: '469434637_blackgrey',
    brand: { uid: 718, name: 'Nike' },
    price: { effective: { min: 13995, max: 13995 }, marked: { min: 16999, max: 16999 }, currency_code: 'INR' },
    sellable: true,
    medias: [
      { url: 'https://cdn1.jiomartjcp.com/v2/catalog-cloud/ajiopr/original/medias/p1.jpg', type: 'image' },
      { url: 'https://cdn1.jiomartjcp.com/v2/catalog-cloud/ajiopr/original/medias/p2.jpg', type: 'image' },
      { url: 'http://cdn1.jiomartjcp.com/v2/catalog-cloud/ajiopr/original/medias/p1.jpg', type: 'image' }, // dup + http
      { url: 'https://cdn1.jiomartjcp.com/v2/catalog-cloud/ajiopr/original/medias/video.mp4', type: 'video' }, // non-image ignored
    ],
    ...overrides,
  };
}

test('jiomart: items parse with price, mrp, discount, PDP deeplink, gallery, identifiers', () => {
  const body = JSON.stringify({ filters: [], items: [item()], page: { item_total: 1 } });
  const items = parseJiomart(body, src, URL);
  assert.equal(items.length, 1);
  const it = items[0];
  assert.equal(it.title, 'NIKE Men Air Max 270 Sneakers');
  assert.equal(it.price, 13995);
  assert.equal(it.listPrice, 16999);
  assert.equal(it.seller, 'JioMart');
  assert.equal(it.sellerUrl, 'https://www.jiomart.com/p/air-max-270-lace-up-casual-shoes-mkmad5-72278673');
  assert.equal(it.currency, 'INR');
  assert.equal(it.availability, 'in_stock');
  assert.equal(it.attributes?.brand, 'Nike');
  // discount computed from marked vs effective
  assert.equal(it.attributes?.discount, '18');
  assert.equal(it.identifiers?.sku, '469434637_blackgrey');
  assert.equal(it.identifiers?.vendorProductId, '72278673');
  // gallery: https-only, deduped, images-only
  const imgs = (it.attributes?.image_urls || '').split('|');
  assert.equal(imgs.length, 2);
  assert.ok(imgs.every((u: string) => u.startsWith('https://')));
  assert.ok(String(it.attributes?.image).startsWith('https://'));
  assert.ok(it.evidence?.extractedFields?.includes('price.effective.min'));
});

test('jiomart: out-of-stock flag, no-discount items, and junk filtering', () => {
  const body = JSON.stringify({
    items: [
      item({ sellable: false, price: { effective: { min: 249 }, marked: { min: 249 }, currency_code: 'INR' }, name: 'Aashirvaad Atta 5kg', slug: 'aashirvaad-shudh-whole-wheat-chakki-atta-5-kg-mr0m' }),
      item({ name: '', slug: 'no-name' }), // dropped: no title
      item({ price: { effective: { min: 0 }, marked: { min: 0 } } }), // dropped: no price
    ],
  });
  const items = parseJiomart(body, src, URL);
  assert.equal(items.length, 1);
  const it = items[0];
  assert.equal(it.availability, 'out_of_stock');
  assert.equal(it.price, 249);
  assert.equal(it.listPrice, undefined); // marked == effective: no MRP
  assert.equal(it.attributes?.discount, undefined);
});

test('jiomart: malformed JSON and empty envelopes return empty arrays, never throw', () => {
  assert.deepEqual(parseJiomart('not json', src, URL), []);
  assert.deepEqual(parseJiomart(JSON.stringify({ filters: [] }), src, URL), []);
  assert.deepEqual(parseJiomart(JSON.stringify({ items: [] }), src, URL), []);
});
