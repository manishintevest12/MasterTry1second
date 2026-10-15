/**
 * Ecommerce multi-image regression (15 Oct): Ajio's search API moved to a flat
 * images[].url shape plus extraImages[] model shots, and Tata CLiQ's BFF exposes
 * productImages[] on search. Both parsers must emit image_urls so every product
 * card can show a real gallery (owner requirement: multiple images per product).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAjio } from '../server/workers/parsers/ajio.ts';
import { parseTataCliq } from '../server/workers/parsers/tatacliq.ts';

const src: any = { id: 't_ecom', name: 'T', method: 'http', verticals: ['ecommerce'], enabled: true, priority: 5, config: {}, rateLimit: { maxRequestsPerMinute: 10, maxConcurrency: 2 }, freshnessPolicy: {} };

test('ajio: 2026 flat image shape + extraImages model shots -> multi-image gallery', () => {
  const body = JSON.stringify({
    products: [{
      code: 'C1', name: 'Court Borough Low Shoes', url: '/p/c1',
      price: { value: 3499 }, wasPriceData: { value: 5999 }, discountPercent: 41,
      fnlColorVariantData: { brandName: 'NIKE', outfitPictureURL: 'http://assets.ajio.com/medias/outfit.jpg' },
      images: [
        { altText: 'front', imageType: 'PRIMARY', url: 'https://assets.ajio.com/medias/front.jpg' },
        { altText: 'back', imageType: 'SECONDARY', url: 'https://assets.ajio.com/medias/back.jpg' },
      ],
      extraImages: [
        { model: 'model1', images: [{ format: 'product', url: 'https://assets.ajio.com/medias/m1.jpg' }] },
        { model: 'model2', images: [{ format: 'product', url: 'https://assets.ajio.com/medias/m2.jpg' }] },
      ],
    }, {
      // legacy nested media shape must keep working
      code: 'C2', name: 'Legacy Shape Shoe', url: '/p/c2',
      price: { value: 1999 },
      images: [{ media: [{ mediumImageUrl: 'http://assets.ajio.com/medias/legacy1.jpg' }, { imageUrl: 'https://assets.ajio.com/medias/legacy2.jpg' }] }],
    }],
  });
  const items = parseAjio(body, src, 'https://www.ajio.com/api/search');
  assert.equal(items.length, 2);
  const first: any = items[0];
  const urls = String(first.attributes.image_urls || '').split('|').filter(Boolean);
  assert.ok(urls.length >= 4, `expected >=4 gallery images, got ${urls.length}`);
  assert.ok(urls.includes('https://assets.ajio.com/medias/front.jpg'));
  assert.ok(urls.includes('https://assets.ajio.com/medias/m2.jpg'));
  assert.equal(first.attributes.image, 'https://assets.ajio.com/medias/outfit.jpg'); // http upgraded + outfit preferred
  const second: any = items[1];
  assert.equal(second.attributes.image, 'https://assets.ajio.com/medias/legacy1.jpg'); // legacy media[0]
  assert.ok(String(second.attributes.image_urls || '').includes('legacy2.jpg'));
});

test('tatacliq: productImages[] -> multi-image gallery, protocol-relative URLs upgraded', () => {
  const body = JSON.stringify({
    response: [{
      product_search_page: {
        search_result: [{
          ussid: 'U1', productId: 'P1', productname: 'Air Zoom Pegasus', brandname: 'Nike',
          webURL: '/p/pegasus', imageURL: '//img.tatacliq.com/images/i32/437Wx649H/peg_1.jpeg',
          inStockFlag: true, averageRating: 4.3, totalNoOfReviews: 214,
          price: { sellingPrice: { doubleValue: 5499 }, mrpPrice: { doubleValue: 7999 } },
          productImages: [
            '//img.tatacliq.com/images/i32/437Wx649H/peg_1.jpeg',
            '//img.tatacliq.com/images/i32/437Wx649H/peg_2.jpeg',
            '//img.tatacliq.com/images/i32/437Wx649H/peg_3.jpeg',
          ],
        }],
      },
    }],
  });
  const items = parseTataCliq(body, src, 'https://searchbff.tatacliq.com/');
  assert.equal(items.length, 1);
  const it: any = items[0];
  const urls = String(it.attributes.image_urls || '').split('|').filter(Boolean);
  assert.equal(urls.length, 3);
  assert.ok(urls.every((u: string) => u.startsWith('https://')));
  assert.equal(it.attributes.image, 'https://img.tatacliq.com/images/i32/437Wx649H/peg_1.jpeg');
});
