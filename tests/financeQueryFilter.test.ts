import test from 'node:test';
import assert from 'node:assert';
// Regression (17 Oct owner report: only 1 company visible in loans/insurance/credit):
// filterByQueryEntity dropped every finance summary row whose title is a rate/premium
// rather than a product name — the product category lives in categorical attributes.
// These tests import the engine module without running any network worker.

import { getVerticalEngine } from '../server/verticals/verticalEngine';

const mk = (over: Record<string, unknown> = {}): any => ({
  vertical: 'loans',
  title: '11.1–16.15% p.a.',
  vendor: 'Paisabazaar',
  seller: 'Paisabazaar',
  attributes: { loan_type: 'personal loan', interest_rate: '11.1', rate_type: 'indicative' },
  prices: { currency: 'INR' },
  location: {},
  ...over,
});

test('loans summary row survives a "personal loan" query via loan_type attribute', async () => {
  const engine = getVerticalEngine('loans');
  const out = await engine.execute([mk()], { vertical: 'loans', entityName: 'personal loan', intent: 'compare' } as any);
  assert.equal(out.length, 1, 'summary rate row must not be dropped by the query filter');
});

test('row with no categorical or title overlap is still filtered out', async () => {
  const engine = getVerticalEngine('loans');
  // Note: a 2-token query only requires half the tokens to hit by design, so any
  // *loan* category shares the 'loan' token and legitimately passes (ranking then
  // sorts relevance). What must NOT pass is a row sharing zero tokens.
  const row = mk({ attributes: { card_type: 'travel credit card' } });
  const out = await engine.execute([row], { vertical: 'loans', entityName: 'personal loan', intent: 'compare' } as any);
  assert.equal(out.length, 0, 'a row sharing zero query tokens must stay filtered out');
});

test('insurance plan row survives via insurance_type attribute', async () => {
  const engine = getVerticalEngine('insurance');
  const row = mk({ vertical: 'insurance', title: '₹5L cover · from ₹240/mo', vendor: 'Acko', seller: 'Acko',
    attributes: { insurance_type: 'term insurance', quote_type: 'indicative' } });
  const out = await engine.execute([row], { vertical: 'insurance', entityName: 'term insurance', intent: 'compare' } as any);
  assert.equal(out.length, 1);
});

test('credit card row still matches on title as before', async () => {
  const engine = getVerticalEngine('creditcards');
  const row = mk({ vertical: 'creditcards', title: 'HDFC Bank Regalia Credit Card', vendor: 'HDFC Bank', seller: 'CardInsider',
    attributes: { annual_fee: '2500', quote_type: 'published_terms' } });
  const out = await engine.execute([row], { vertical: 'creditcards', entityName: 'credit card', intent: 'compare' } as any);
  assert.equal(out.length, 1);
});
