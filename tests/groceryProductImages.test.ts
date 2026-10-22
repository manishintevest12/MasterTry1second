import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withBrandImages, stripMerchantLogoFallbacks } from '../server/pipeline/brandImage';

/**
 * Owner 22 Oct: grocery/food PRODUCT cards must never show a merchant logo
 * in place of a product photo (bug: Instamart rows carried the swiggy.com
 * favicon as imageUrl). Two guards: (1) withBrandImages never injects a
 * favicon fallback on grocery/food rows, (2) stripMerchantLogoFallbacks
 * purges logo stand-ins persisted on stale catalogue rows.
 */

const base = (vertical: string, attrs: Record<string, any> = {}): any => ({
  id: `t_${vertical}_${Math.random().toString(36).slice(2, 7)}`,
  vertical,
  title: 'Amul Taaza Toned Milk 200 ml',
  seller: 'Swiggy Instamart',
  sellerUrl: 'https://instamart.swiggy.com/instamart/search?query=milk',
  prices: { effectivePrice: 25, mandatoryTotal: 25 },
  attributes: { ...attrs },
});

test('withBrandImages never injects a favicon fallback on grocery rows', () => {
  const out = withBrandImages([base('grocery')]);
  assert.equal(out[0].attributes.image_url, undefined);
  assert.equal(out[0].attributes.image_is_brand_logo, undefined);
});

test('withBrandImages never injects a favicon fallback on food rows', () => {
  const out = withBrandImages([base('food')]);
  assert.equal(out[0].attributes.image_url, undefined);
});

test('withBrandImages still injects the merchant logo on non-product verticals', () => {
  const out = withBrandImages([base('loans')]);
  assert.ok(out[0].attributes.image_url, 'finance rows keep their lender logo');
  assert.equal(out[0].attributes.image_is_brand_logo, 'true');
});

test('stripMerchantLogoFallbacks purges stale favicons from grocery rows', () => {
  const stale = base('grocery', {
    image_url: 'https://www.google.com/s2/favicons?domain=swiggy.com&sz=128',
    image_is_brand_logo: 'true',
  });
  const out = stripMerchantLogoFallbacks([stale]);
  assert.equal(out[0].attributes.image_url, undefined);
  assert.equal(out[0].attributes.image_is_brand_logo, undefined);
});

test('stripMerchantLogoFallbacks keeps real product photos untouched', () => {
  const real = base('grocery', {
    image_url: 'https://media-assets.swiggy.com/swiggy/image/upload/NI_CATALOG/IMAGES/CIW/2026/x.png',
  });
  const out = stripMerchantLogoFallbacks([real]);
  assert.equal(out[0].attributes.image_url, real.attributes.image_url);
});

test('stripMerchantLogoFallbacks leaves non-product verticals untouched', () => {
  const loan = base('loans', {
    image_url: 'https://www.google.com/s2/favicons?domain=sbi.co.in&sz=128',
    image_is_brand_logo: 'true',
  });
  const out = stripMerchantLogoFallbacks([loan]);
  assert.equal(out[0].attributes.image_url, loan.attributes.image_url);
});

test('stripMerchantLogoFallbacks drops logo-only entries from image_urls galleries', () => {
  const row = base('grocery', {
    image_url: 'https://www.google.com/s2/favicons?domain=blinkit.com&sz=128',
    image_is_brand_logo: 'true',
    image_urls: ['https://www.google.com/s2/favicons?domain=blinkit.com&sz=128', 'https://cdn.grofers.com/p/real.png'],
  });
  const out = stripMerchantLogoFallbacks([row]);
  assert.deepEqual(out[0].attributes.image_urls, ['https://cdn.grofers.com/p/real.png']);
  assert.equal(out[0].attributes.image_url, undefined);
});
