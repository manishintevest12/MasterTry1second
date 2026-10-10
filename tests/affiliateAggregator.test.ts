import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dedupOffers } from '../server/affiliate/aggregator';
import { AdmitadProvider } from '../server/affiliate/providers/admitad';
import type { UnifiedAffiliateOffer } from '../server/affiliate/types';

const mk = (over: Partial<UnifiedAffiliateOffer>): UnifiedAffiliateOffer => ({
  network_source: 'admitad', network_offer_id: '1', merchant_name: 'M', title: 'T',
  categories: [], status: 'active', ...over,
});

test('smart dedup: same coupon across networks keeps higher commission', () => {
  const offers = [
    mk({ network_source: 'admitad', network_offer_id: 'a1', merchant_name: 'Nike', coupon_code: 'SAVE10', commission: 5 }),
    mk({ network_source: 'vcommission', network_offer_id: 'v1', merchant_name: 'Nike', coupon_code: 'SAVE10', commission: 8 }),
  ];
  const out = dedupOffers(offers);
  assert.equal(out.length, 1);
  assert.equal(out[0].network_source, 'vcommission');
});

test('dedup is compound-key safe: same offer id in two networks is NOT a duplicate', () => {
  const offers = [
    mk({ network_source: 'admitad', network_offer_id: 'x' }),
    mk({ network_source: 'cuelinks', network_offer_id: 'x' }),
  ];
  assert.equal(dedupOffers(offers).length, 2);
});

test('Admitad normalizer maps a coupon fixture into the unified shape', () => {
  const p = new AdmitadProvider();
  const o = p.normalize({
    id: 77, name: '20% off electronics', campaign: { name: 'Sony', id: 5, rate: '7%' },
    date_start: '2026-10-01 00:00:00', date_end: '2099-01-01 00:00:00',
    frames: [{ discount: 20, type: 'percent' }],
    goto: 'https://ad.admitad.com/g/abc/', code: 'SONY20',
    categories: [{ name: 'Electronics' }],
  });
  assert.equal(o.network_source, 'admitad');
  assert.equal(o.network_offer_id, '77');
  assert.equal(o.merchant_name, 'Sony');
  assert.equal(o.discount_value, 20);
  assert.equal(o.discount_type, 'percentage');
  assert.equal(o.coupon_code, 'SONY20');
  assert.equal(o.status, 'active');
  assert.ok(o.categories.includes('electronics'));
});

test('Admitad normalizer flags past-expiry offers as expired', () => {
  const p = new AdmitadProvider();
  const o = p.normalize({ id: 9, name: 'old deal', campaign: { name: 'X' }, date_end: '2020-01-01 00:00:00' });
  assert.equal(o.status, 'expired');
});

test('unconfigured Admitad reports honestly instead of fabricating', async () => {
  const p = new AdmitadProvider();
  const res = await p.fetchOffers();
  assert.equal(res.offers.length, 0);
  assert.ok(res.warnings.length > 0);
});
