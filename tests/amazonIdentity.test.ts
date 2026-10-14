import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateOffer } from '../server/pipeline/validation';
import { normalizeOffer } from '../server/pipeline/normalization';
import { getSource } from '../server/sources/registry';
import type { RawSourceItem } from '../server/types';

// Regression (14 Oct 2026): Amazon.in search items carry only identifiers.vendorProductId
// (the ASIN) — no gtin/sku/brand/model. The ecommerce identity rule used to reject them,
// so every Amazon offer was silently validated INVALID and dropped even though the worker
// succeeded. Identity must accept marketplace product ids (ASIN / vendorProductId).
const src = getSource('w_ecom_amazon_in')!;

const amzRaw: RawSourceItem = {
  sourceId: 'w_ecom_amazon_in',
  title: 'PHILIPS Air Fryer NA120/00, 4.2 Litre',
  price: 4699,
  currency: 'INR',
  identifiers: { vendorProductId: 'B0D14BB5XY' },
  attributes: { rating: '4.4', image_url: 'https://m.media-amazon.com/images/I/51CM1SXLDIL._AC_UY218_.jpg' },
  seller: 'Amazon.in',
  sellerUrl: 'https://www.amazon.in/dp/B0D14BB5XY',
  availability: 'in_stock',
} as unknown as RawSourceItem;

test('ecommerce identity accepts ASIN (vendorProductId) — Amazon offers are never INVALID', () => {
  const offer = normalizeOffer(amzRaw, src, 'ecommerce');
  const v = validateOffer(offer);
  const identity = v.checks.find((c) => c.name === 'identity');
  assert.ok(identity, 'identity check present');
  assert.equal(identity.passed, true, 'ASIN counts as identity');
  // mandatoryTotal is computed by computeEffectivePrice in the orchestrator before
  // validation; assert only that identity is not the blocking failure here.
  const blockingFails = v.checks.filter((c) => !c.passed && c.severity === 'blocking').map((c) => c.name);
  assert.ok(!blockingFails.includes('identity'), 'identity never blocks an ASIN-carrying offer');
});

test('ecommerce identity still rejects offers with no identity at all', () => {
  const bare = { ...amzRaw, identifiers: {}, title: 'Mystery item with no identity' } as unknown as RawSourceItem;
  const offer = normalizeOffer(bare, src, 'ecommerce');
  const v = validateOffer(offer);
  const identity = v.checks.find((c) => c.name === 'identity');
  assert.equal(identity!.passed, false, 'no identifiers/brand/model fails identity');
});
