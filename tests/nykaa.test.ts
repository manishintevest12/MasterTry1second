/**
 * Nykaa parser regression (17 Oct): Nykaa search SSR embeds the full result set
 * in <script id="__PRELOADED_STATE__"> at listingV2.products[] with
 * title (brand) + subTitle (product name), discountedPrice (selling), price (MRP),
 * plp_pdp_bridge.images[] gallery, and PDP anchors (/slug/p/<id>) in the HTML.
 * The parser must emit joined names, real prices, the PDP deeplink, multi-image
 * galleries and sku+vendorProductId identifiers (identity rule needs them).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNykaa } from '../server/workers/parsers/nykaa.ts';

const src: any = { id: 't_ecom_nykaa', name: 'Nykaa', method: 'http', verticals: ['ecommerce'], enabled: true, priority: 5, config: {}, rateLimit: { maxRequestsPerMinute: 10, maxConcurrency: 2 }, freshnessPolicy: {} };

function nykaaHtml(products: any[], anchors: string[] = []) {
  const pre = { listingV2: { products } };
  return `<html><body>${anchors.join('')}
<script id="__PRELOADED_STATE__" type="application/json">${JSON.stringify(pre)}</script>
</body></html>`;
}

test('nykaa: listingV2 products parse with price, mrp, PDP deeplink, gallery and identifiers', () => {
  const html = nykaaHtml(
    [{
      id: '26355138',
      sku: 'NIKEX00086194',
      price: 4895,
      discountedPrice: 2937,
      discount: 40,
      imageUrl: 'http://adn-static1.nykaa.com/nykdesignstudio-images/pub/media/catalog/product/d/7/p1.jpg',
      title: 'Nike',
      subTitle: "Men's Downshifter 14 Running Shoes",
      isOutOfStock: false,
      plp_pdp_bridge: { images: [
        { url: 'https://adn-static1.nykaa.com/nykdesignstudio-images/pub/media/catalog/product/d/7/p1.jpg' },
        { url: 'https://adn-static1.nykaa.com/nykdesignstudio-images/pub/media/catalog/product/d/7/p2.jpg' },
        { url: 'https://adn-static1.nykaa.com/nykdesignstudio-images/pub/media/catalog/product/d/7/p1.jpg' },
      ] },
    }],
    ['<a href="/nike-downshifter-14-men-s-road-running-shoe/p/26355138?searchQuery=nike">x</a>']
  );
  const items = parseNykaa(html, src, 'https://www.nykaa.com/search/result/?q=nike%20shoes');
  assert.equal(items.length, 1);
  const it = items[0];
  assert.equal(it.title, "Nike Men's Downshifter 14 Running Shoes");
  assert.equal(it.price, 2937);
  assert.equal(it.listPrice, 4895);
  assert.equal(it.seller, 'Nykaa');
  assert.equal(it.sellerUrl, 'https://www.nykaa.com/nike-downshifter-14-men-s-road-running-shoe/p/26355138');
  assert.equal(it.identifiers?.sku, 'NIKEX00086194');
  assert.equal(it.identifiers?.vendorProductId, '26355138');
  assert.equal(it.availability, 'in_stock');
  // gallery: https-only, deduped
  const imgs = (it.attributes?.image_urls || '').split('|');
  assert.equal(imgs.length, 2);
  assert.ok(imgs.every((u: string) => u.startsWith('https://')));
  // http image is upgraded
  assert.ok(String(it.attributes?.image).startsWith('https://'));
  assert.equal(it.attributes?.discount, '40');
});

test('nykaa: missing PDP anchor falls back to search page, zero-price rows dropped, oos flagged', () => {
  const html = nykaaHtml([
    { id: '100', title: 'Lakme', subTitle: 'Kajal', price: 0, discountedPrice: 0, isOutOfStock: true },
    { id: '101', title: 'Maybelline', subTitle: 'Lipstick', price: 599, discountedPrice: 499, isOutOfStock: true },
  ]);
  const items = parseNykaa(html, src, 'https://www.nykaa.com/search/result/?q=kajal');
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Maybelline Lipstick');
  assert.equal(items[0].price, 499);
  assert.equal(items[0].sellerUrl, 'https://www.nykaa.com');
  assert.equal(items[0].availability, 'out_of_stock');
  // no MRP above selling price -> no listPrice
  assert.equal(items[0].listPrice, 599);
});

test('nykaa: preloaded state absent -> empty (never fabricate)', () => {
  assert.equal(parseNykaa('<html><body>shell only</body></html>', src, 'x').length, 0);
});
