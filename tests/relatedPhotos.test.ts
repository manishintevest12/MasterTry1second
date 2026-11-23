import test from 'node:test';
import assert from 'node:assert/strict';
import { extractOgImage, isPhotoMatch, tokenScore } from '../server/lens/productImage';

/**
 * OWNER 23 Nov (screenshot of the related grid, every card an orange "S" logo): "ab logo dikh raha hai muje bhai real
 * photo chaiye isko fix kro kitni baar bolu".
 *
 * Two rules come out of that, and both are pinned here:
 *   1. a card only ever shows a REAL product photo — a site logo / share placeholder is refused;
 *   2. a product we already have a photo for is actually found, instead of failing because one stray word of the title
 *      did not appear in the catalogue row.
 */

const PRODUCT_PAGE = `<!doctype html><html><head>
<meta property="og:image" content="https://assets.myntassets.com/assets/images/2026/11/23/shoe-1.jpg" />
<meta name="twitter:image" content="https://assets.myntassets.com/assets/images/2026/11/23/shoe-1.jpg" />
</head><body></body></html>`;

test('a product page yields its own product photo', () => {
  assert.equal(extractOgImage(PRODUCT_PAGE), 'https://assets.myntassets.com/assets/images/2026/11/23/shoe-1.jpg');
});

test('content-before-property markup works too (many merchants write it that way)', () => {
  const html = '<meta content="https://cdn.example.com/p/oppo-reno16c.jpg" property="og:image">';
  assert.equal(extractOgImage(html), 'https://cdn.example.com/p/oppo-reno16c.jpg');
});

test('a site logo or share placeholder is never accepted as a product photo', () => {
  for (const logo of [
    'https://constant.myntassets.com/www/data/portal/mlogo.png',
    'https://www.example.com/favicon.ico',
    'https://cdn.example.com/assets/placeholder.png',
    'https://cdn.example.com/og-default-image.jpg',
    'https://cdn.example.com/brand-logo.png',
  ]) {
    const html = `<meta property="og:image" content="${logo}" />`;
    assert.equal(extractOgImage(html), null, logo);
  }
});

test('no og:image, a relative url, or empty html gives nothing (the row is dropped, never faked)', () => {
  assert.equal(extractOgImage('<html><head><title>Shop</title></head></html>'), null);
  assert.equal(extractOgImage('<meta property="og:image" content="/images/x.jpg">'), null);
  assert.equal(extractOgImage(''), null);
  assert.equal(extractOgImage(undefined as unknown as string), null);
});

test('a fallback share image is skipped in favour of a real product one', () => {
  const html = `
    <meta property="og:image" content="https://cdn.example.com/logo.png">
    <meta property="og:image" content="https://cdn.example.com/products/kalenji-t-shirt.jpg">`;
  assert.equal(extractOgImage(html), 'https://cdn.example.com/products/kalenji-t-shirt.jpg');
});

test('the catalogue match no longer needs every word of a long title', () => {
  const tokens = ['you', 'bella', 'jewellery'];
  // the row that used to fail: four extra words in the title
  assert.equal(isPhotoMatch("You Bella Women's and Girl's Jewellery Gift Set", tokens), true);
  assert.equal(tokenScore("You Bella Women's and Girl's Jewellery Gift Set", tokens), 3);
  // a genuinely different product must not borrow that photo
  assert.equal(isPhotoMatch('Samsung Galaxy A26 5G 8GB', tokens), false);
  // one long, distinctive token is enough on its own
  assert.equal(isPhotoMatch('Decathlon Kalenji Women Running T-Shirt', ['kalenji']), true);
  assert.equal(isPhotoMatch('Decathlon Domyos Men T-Shirt', ['kalenji']), false);
  // nothing in common: no photo, no guess
  assert.equal(isPhotoMatch('', tokens), false);
  assert.equal(isPhotoMatch('Any Title', []), false);
});
