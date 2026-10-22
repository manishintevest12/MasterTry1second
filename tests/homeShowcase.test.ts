/**
 * Home showcase (owner spec 21 Oct): pure builders + honesty guards.
 * Real rows only; no item without a linkable destination ever renders.
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { itemFromOffer, itemFromAffiliate, imageFromAttributes } from '../server/home/showcase';

test('itemFromOffer builds a masked, priced, honest showcase item', () => {
  const item = itemFromOffer({
    id: 7, vertical: 'ecommerce', title: 'boAt Airdopes 141', brand: 'boAt',
    attributes: { image_url: 'https://m.media-amazon.com/i.jpg' },
    vendor: 'Amazon', seller: 'Amazon', seller_url: 'https://www.amazon.in/dp/B0X',
    list_price: 1499, mandatory_total: 766, effective_price: 766, fetched_at: new Date().toISOString(),
  });
  assert.ok(item);
  assert.strictEqual(item!.merchant, 'Amazon');
  assert.strictEqual(item!.price, 766);
  assert.strictEqual(item!.mrp, 1499);
  assert.strictEqual(item!.discountPct, 49);
  assert.ok(item!.url.startsWith('/api/out?t='));
  assert.ok(!item!.url.includes('amazon.in'), 'the destination is masked inside the pointer');
});

test('itemFromOffer is honest: no destination or no price -> no item', () => {
  assert.strictEqual(itemFromOffer({
    id: 8, vertical: 'ecommerce', title: 'x', brand: null, attributes: null,
    vendor: null, seller: null, seller_url: null,
    list_price: null, mandatory_total: null, effective_price: null, fetched_at: new Date().toISOString(),
  }), null);
});

test('itemFromAffiliate masks the tracking URL and surfaces the coupon badge', () => {
  const item = itemFromAffiliate({
    id: 9, network_source: 'cuelinks', network_offer_id: '123', merchant_name: 'Myntra', merchant_logo: 'https://m/logo.png',
    title: 'Flat 20% off on Rs1999+', description: null, coupon_code: 'MYN20', discount_value: 20, discount_type: 'percent',
    affiliate_url: 'https://linksredirect.com/?cid=326794&url=https%3A%2F%2Fmyntra.com', original_url: 'https://www.myntra.com',
    categories: null, commission_note: 'Upto 6%',
  });
  assert.ok(item);
  assert.strictEqual(item!.badge, 'Code: MYN20');
  assert.ok(item!.url.startsWith('/api/out?t='));
});

test('imageFromAttributes reads single and gallery image keys, https only', () => {
  assert.strictEqual(imageFromAttributes({ image_url: 'https://x/y.jpg' }), 'https://x/y.jpg');
  assert.strictEqual(imageFromAttributes({ image_urls: ['http://insecure.jpg', 'https://good.jpg'] }), 'https://good.jpg');
  assert.strictEqual(imageFromAttributes('{"image_url":"https://z.jpg"}'), 'https://z.jpg');
  assert.strictEqual(imageFromAttributes({ image_url: 'http://nope.jpg' }), null);
  assert.strictEqual(imageFromAttributes(null), null);
});
