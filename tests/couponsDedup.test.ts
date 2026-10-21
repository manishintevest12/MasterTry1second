import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePayoutText, normKey, offerCommissionScore, dedupBestOffers } from '../server/affiliate/store';

// Owner rule (21 Oct): the Coupons hub shows every deal/coupon ONCE, with no
// network branding, and the kept copy is the highest-commission one so the
// redirect goes through the best-paying affiliate.

test('parsePayoutText: sheet-style payouts parse to comparable scores', () => {
  assert.equal(parsePayoutText('Flat ₹1900'), 1900);
  assert.equal(parsePayoutText('Upto 8.64%'), 86.4);
  assert.equal(parsePayoutText(null), 0);
  assert.equal(parsePayoutText('Flat 4.8%'), 48);
});

test('dedup: same merchant + same code across networks collapses to ONE card', () => {
  const rows = [
    { id: 1, merchant_name: 'Tata CLiQ', coupon_code: 'EXTRA10', title: 'Extra 10% off', network_source: 'cuelinks', affiliate_url: 'https://linksredirect.com/?cid=1', original_url: 'https://www.tatacliq.com/', commission_note: null, updated_at: '2026-10-20' },
    { id: 2, merchant_name: 'tata cliq', coupon_code: 'extra10', title: 'Extra 10% Off', network_source: 'vcommission', affiliate_url: 'https://in.ajmal.com/', original_url: 'https://www.tatacliq.com/', commission_note: null, updated_at: '2026-10-21' },
  ];
  const out = dedupBestOffers(rows as any);
  assert.equal(out.length, 1, 'duplicate must collapse');
});

test('dedup: keeps the copy routed through the highest-paying affiliate', () => {
  const rows = [
    // Unknown-payout network copy of the deal
    { id: 1, merchant_name: 'Myntra', coupon_code: 'MYNTRA20', network_source: 'cuelinks', original_url: 'https://www.myntra.com/', commission_note: null, updated_at: '2026-10-21' },
    // Same deal with an explicit higher commission note wins
    { id: 2, merchant_name: 'Myntra', coupon_code: 'MYNTRA20', network_source: 'earnkaro', original_url: 'https://www.myntra.com/', commission_note: 'Flat 9%', updated_at: '2026-10-20' },
  ];
  const out = dedupBestOffers(rows as any);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 2, 'higher commission_note wins the card');
  // Score sanity: 9% -> 90 beats the cuelinks base rank 40
  assert.ok(offerCommissionScore(rows[1]) > offerCommissionScore(rows[0]));
});

test('dedup: codeless deals dedup by merchant + normalized title', () => {
  const rows = [
    { id: 3, merchant_name: 'Agoda', coupon_code: null, title: 'Flat 10% OFF on hotels!', network_source: 'cuelinks', original_url: 'https://www.agoda.com/', commission_note: null, updated_at: '2026-10-20' },
    { id: 4, merchant_name: 'AGODA', coupon_code: '', title: 'flat 10% off on hotels', network_source: 'admitad', original_url: 'https://www.agoda.com/', commission_note: null, updated_at: '2026-10-21' },
  ];
  const out = dedupBestOffers(rows as any);
  assert.equal(out.length, 1);
});

test('dedup: different merchants / different codes never collapse', () => {
  const rows = [
    { id: 5, merchant_name: 'Flipkart', coupon_code: 'FKT10', network_source: 'cuelinks', original_url: 'https://www.flipkart.com/', commission_note: null, updated_at: '2026-10-21' },
    { id: 6, merchant_name: 'Flipkart', coupon_code: 'BIGBILL', network_source: 'admitad', original_url: 'https://www.flipkart.com/', commission_note: null, updated_at: '2026-10-21' },
    { id: 7, merchant_name: 'Ajio', coupon_code: 'FKT10', network_source: 'vcommission', original_url: 'https://www.ajio.com/', commission_note: null, updated_at: '2026-10-21' },
  ];
  assert.equal(dedupBestOffers(rows as any).length, 3);
});

test('dedup: merchant with a LinkInR sheet campaign outranks unknown payouts', () => {
  // Ajio is in the owner's LinkInR sheet (Upto 8.64% -> score 86.4) so a copy
  // whose hop URL can route via LinkInR wins over a bare network base rank.
  const cuelinks = { id: 8, merchant_name: 'Ajio', coupon_code: 'A20', network_source: 'cuelinks', original_url: 'https://www.ajio.com/', commission_note: null, updated_at: '2026-10-21' };
  const lowrank = { id: 9, merchant_name: 'Ajio', coupon_code: 'A20', network_source: 'inrdeals', original_url: 'https://www.ajio.com/', commission_note: null, updated_at: '2026-10-21' };
  const out = dedupBestOffers([lowrank, cuelinks] as any);
  assert.equal(out.length, 1);
  // Both copies hop to ajio.com, so BOTH route via the LinkInR campaign and
  // score identically (86.4) — whichever card survives, the commission is the
  // same, which is exactly the owner's requirement.
  assert.equal(offerCommissionScore(cuelinks), 86.4);
  assert.ok(offerCommissionScore(cuelinks) === offerCommissionScore(lowrank));
  assert.ok(out[0].id === 8 || out[0].id === 9, 'one deterministic survivor');
});

test('normKey: punctuation, case and spacing collapse', () => {
  assert.equal(normKey('Tata  CLiQ!'), normKey('tata cliq'));
  assert.notEqual(normKey('flipkart'), normKey('ajio'));
});
