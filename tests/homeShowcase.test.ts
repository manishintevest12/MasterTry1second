/**
 * Home showcase (owner spec 21 Oct): pure builders + honesty guards.
 * Real rows only; no item without a linkable destination ever renders.
 */
import { test } from 'node:test';
import assert from 'node:assert';

const mk = (id: string, merchant: string): any => ({ id, title: id, merchant, merchantLogo: null, image: 'https://x/i.jpg', price: 1, mrp: null, discountPct: null, rating: null, badge: null, url: '/api/out?t=x' });
import { itemFromOffer, itemFromAffiliate, imageFromAttributes, diversifyByMerchant } from '../server/home/showcase';

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

test('merchant spread: a single-source batch never fills a section (owner 22 Oct)', () => {
  // 30 freshest rows all from Myntra, as production served before the fix.
  const oneMerchant = Array.from({ length: 30 }, (_, i) => mk(`m${i}`, 'Myntra'));
  const spread = diversifyByMerchant(oneMerchant, 3, 12);
  assert.strictEqual(spread.length, 3); // only maxPerMerchant from the sole seller
});

test('merchant spread: round-robins every present seller', () => {
  const pool = [
    ...Array.from({ length: 10 }, (_, i) => mk(`a${i}`, 'Amazon')),
    ...Array.from({ length: 10 }, (_, i) => mk(`f${i}`, 'Flipkart')),
    ...Array.from({ length: 10 }, (_, i) => mk(`n${i}`, 'Nykaa')),
  ];
  // 3 sellers x max 3 each = 9 honest items; never more from one seller
  const spread = diversifyByMerchant(pool, 3, 12);
  assert.strictEqual(spread.length, 9);
  const counts = new Map<string, number>();
  for (const it of spread) counts.set(it.merchant, (counts.get(it.merchant) || 0) + 1);
  assert.strictEqual(counts.get('Amazon'), 3); // every seller gets even slots
  assert.strictEqual(counts.get('Flipkart'), 3);
  assert.strictEqual(counts.get('Nykaa'), 3);
  // and with four sellers the section reaches the full 12 (3 each).
  const pool4 = [...pool, ...Array.from({ length: 10 }, (_, i) => mk(`r${i}`, 'Reliance Digital'))];
  assert.strictEqual(diversifyByMerchant(pool4, 3, 12).length, 12);
});
