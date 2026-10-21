/**
 * Regression (owner bug, 21 Oct): 'state bank of india savings account' returned
 * 405 mixed-vertical rows — affiliate feed campaigns (VCommission coupon metadata)
 * leaked into the banking/account results because the affiliate feed sources
 * declared 'banking' in their verticals, so selectSources polled them for account
 * searches. Affiliate campaigns may only serve commerce verticals.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSources, selectSources } from '../server/sources/registry';

const FINANCE_VERTICALS = ['banking', 'loans', 'insurance', 'creditcards'];

test('no affiliate/partner feed source serves a finance vertical', () => {
  for (const s of getSources()) {
    if (s.method === 'affiliate_feed' || s.method === 'partner_feed') {
      for (const v of FINANCE_VERTICALS) {
        assert.ok(!s.verticals.includes(v as any), `${s.id} must not serve ${v} (affiliate leak)`);
      }
    }
  }
});

test('banking search never selects affiliate feed sources', () => {
  const picked = selectSources({ rawQuery: 'sbi savings account', vertical: 'banking' } as any);
  for (const s of picked) {
    assert.notEqual(s.method, 'affiliate_feed', `affiliate feed ${s.id} selected for banking query`);
  }
  // the real account workers remain available (registry-driven, health permitting)
  const ids = picked.map((s) => s.id);
  assert.ok(ids.includes('w_account_bankbazaar') || ids.includes('w_account_paisabazaar')
    || ids.includes('w_account_zerodha') || ids.includes('w_account_groww'),
  'at least one account worker should be selectable for a banking query');
});

test('affiliate feed sources still serve coupons/ecommerce', () => {
  const feeds = getSources().filter((s) => s.method === 'affiliate_feed');
  assert.ok(feeds.length > 0, 'affiliate feed sources must exist');
  for (const s of feeds) {
    assert.ok(s.verticals.includes('coupons') || s.verticals.includes('ecommerce'),
      `${s.id} should still serve commerce verticals`);
  }
});
