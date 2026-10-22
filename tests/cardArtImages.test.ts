import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { withCardArt, stripCardLogoStandIns, withBrandImages, brandImageFor } from '../server/pipeline/brandImage.ts';

const card = (title: string, imageUrl?: string, extra: Record<string, unknown> = {}) => ({
  id: `c-${title}`, vertical: 'creditcards', title, seller: 'HDFC Bank', vendor: '',
  prices: { price: 499, mandatoryTotal: 499 }, attributes: { ...(imageUrl ? { image_url: imageUrl } : {}), ...extra },
} as any);

test('FD-variant rows borrow real art from the same card family (owner 22 Oct screenshot)', () => {
  const rows = [
    card('Tata Neu Plus HDFC Bank Credit Card', 'https://cardinsider.com/wp-content/uploads/2022/08/tata-neu-plus.webp'),
    card('Tata Neu Plus HDFC Bank FD Credit Card'), // screenshot row: no art of its own
  ];
  const out = withCardArt(rows);
  assert.equal(out[1].attributes.image_url, 'https://cardinsider.com/wp-content/uploads/2022/08/tata-neu-plus.webp');
  assert.notEqual(out[1].attributes.image_is_brand_logo, 'true');
  // the art owner keeps its own image untouched
  assert.equal(out[0].attributes.image_url, 'https://cardinsider.com/wp-content/uploads/2022/08/tata-neu-plus.webp');
});

test('bank logos no longer masquerade as card art — stand-ins are purged', () => {
  const rows = [card('HDFC Regalia Gold Credit Card', 'https://commons.wikimedia.org/wiki/Special:FilePath/HDFC-Bank-Logo.svg?width=256', { image_is_brand_logo: 'true' })];
  const out = stripCardLogoStandIns(rows);
  assert.equal(out[0].attributes.image_url, undefined);
  assert.equal(out[0].attributes.image_is_brand_logo, undefined);
});

test('card families with no art anywhere stay empty (honest placeholder, never a bank logo)', () => {
  const out = withBrandImages([card('HDFC Freedom Credit Card')]);
  assert.equal(out[0].attributes.image_url, undefined, 'withBrandImages must skip creditcards');
  assert.equal(brandImageFor(out[0]), undefined, 'no lender favicon for creditcards either');
  // and card-art borrowing finds nothing to invent
  const healed = withCardArt([card('HDFC Freedom Credit Card'), card('Swiggy HDFC Bank Credit Card')]);
  assert.equal(healed[0].attributes.image_url, undefined);
});

test('loans/insurance keep the lender-logo fallback (unchanged behaviour)', () => {
  const loan = { id: 'l1', vertical: 'loans', title: 'HDFC Bank Personal Loan', seller: 'BankBazaar', vendor: '', prices: { price: 1, mandatoryTotal: 1 }, attributes: {} } as any;
  const out = withBrandImages([loan]);
  assert.ok(String(out[0].attributes.image_url || '').includes('favicons'), 'loan rows still get the lender favicon');
});
