import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFinanceOffer, FINANCE_VERTICALS } from '../server/marketing/financeOffers';

// OWNER 18 Nov: each vertical now carries its OWN field set (server/marketing/financeFields.ts), so a
// minimal entry must also carry the fields that vertical's card cannot render without.
const minFields: Record<string, Record<string, string>> = {
  loans: { loan_type: 'personal loan', interest_rate: '10.25% p.a.', interest_rate_min: '10.25' },
  creditcards: { bank: 'HDFC Bank', joining_fee: '₹99 + GST', annual_fee: '₹99 + GST', annual_fee_inr: '99' },
  insurance: { insurance_type: 'health insurance', claim_settlement_ratio: '98', premium: 'from ₹499/mo' },
  account: { account_type: 'savings', interest_rate: '2.5% p.a.', interest_rate_max: '2.5' },
};
const min = (vertical: string) => minFields[vertical];

// Owner 27 Oct: a manual add option for loans / credit cards / insurance / account.
test('all four finance verticals are accepted, with aliases', () => {
  for (const v of FINANCE_VERTICALS) {
    const r = validateFinanceOffer({ vertical: v, title: 'Test Lender Plan', url: 'https://example.com/apply', fields: min(v) });
    assert.equal(r.ok, true, `${v}: ${r.error}`);
    assert.equal(r.clean.vertical, v);
  }
  assert.equal(validateFinanceOffer({ vertical: 'Credit Cards', title: 'X Card', url: 'https://e.com/a', fields: min('creditcards') }).clean!.vertical, 'creditcards');
  assert.equal(validateFinanceOffer({ vertical: 'savings', title: 'Y Account', url: 'https://e.com/a', fields: min('account') }).clean!.vertical, 'account');
});

test('a non-finance vertical is refused instead of silently stored', () => {
  const r = validateFinanceOffer({ vertical: 'flights', title: 'Goa flight', url: 'https://e.com/a' });
  assert.equal(r.ok, false);
  assert.match(String(r.error), /loans, creditcards, insurance or account/i);
});

test('name and an https apply URL are mandatory', () => {
  assert.equal(validateFinanceOffer({ vertical: 'loans', title: '', url: 'https://e.com/a' }).ok, false);
  assert.equal(validateFinanceOffer({ vertical: 'loans', title: 'HDFC Personal Loan', url: '' }).ok, false);
  assert.equal(validateFinanceOffer({ vertical: 'loans', title: 'HDFC Personal Loan', url: 'http://insecure.example' }).ok, false);
  assert.equal(validateFinanceOffer({ vertical: 'loans', title: 'HDFC Personal Loan', url: 'not-a-url' }).ok, false);
});

test('rate label, highlights, city and numeric value are kept for the card', () => {
  const r = validateFinanceOffer({
    vertical: 'creditcards', title: 'HDFC Millennia', seller: 'HDFC Bank',
    rate_label: '₹1,000/yr · 5% cashback', price: '1000', highlights: 'Fee waived on 1L spend', city: 'Indore', url: 'https://hdfcbank.com/card',
    fields: min('creditcards'),
  });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.clean.seller, 'HDFC Bank');
  assert.equal(r.clean.rate_label, '₹1,000/yr · 5% cashback');
  assert.equal(r.clean.price, 1000);
  assert.equal(r.clean.highlights, 'Fee waived on 1L spend');
  assert.equal(r.clean.city, 'Indore');
  assert.equal(r.clean.active, 1);
});

test('seller falls back to the product name so a card never renders blank', () => {
  const r = validateFinanceOffer({ vertical: 'insurance', title: 'Acko Term Plan', url: 'https://acko.com/term', fields: min('insurance') });
  assert.equal(r.clean!.seller, 'Acko Term Plan');
});

test('a non-numeric price is rejected rather than silently zeroed', () => {
  const r = validateFinanceOffer({ vertical: 'loans', title: 'X', url: 'https://e.com/a', price: 'cheap' });
  assert.equal(r.ok, false);
});

// ---- Owner 27 Oct: "photo upload, affiliate link daalne wala option hai?" ----
test('a photo can be an admin upload (/api/logos/<key>) or an https image', () => {
  const up = validateFinanceOffer({ vertical: 'loans', title: 'HDFC Personal Loan', url: 'https://hdfc.com/loan', image_url: '/api/logos/finance-loans-hdfc', fields: min('loans') });
  assert.equal(up.ok, true, up.error);
  assert.equal(up.clean!.image_url, '/api/logos/finance-loans-hdfc');
  const ext = validateFinanceOffer({ vertical: 'loans', title: 'HDFC Personal Loan', url: 'https://hdfc.com/loan', image_url: 'https://cdn.example.com/card.jpg', fields: min('loans') });
  assert.equal(ext.ok, true, ext.error);
  const bad = validateFinanceOffer({ vertical: 'loans', title: 'HDFC Loan', url: 'https://e.com/a', image_url: 'blob:http://localhost/abc', fields: min('loans') });
  assert.equal(bad.ok, false);
});

test('an affiliate link must be https AND carry {url} so the apply page survives', () => {
  const ok = validateFinanceOffer({ vertical: 'creditcards', title: 'HDFC Millennia', url: 'https://hdfcbank.com/card', affiliate_url: 'https://track.network/click?affid=42&url={url}', fields: min('creditcards') });
  assert.equal(ok.ok, true, ok.error);
  assert.equal(ok.clean!.affiliate_url, 'https://track.network/click?affid=42&url={url}');
  const noPlaceholder = validateFinanceOffer({ vertical: 'creditcards', title: 'HDFC Card', url: 'https://e.com/a', affiliate_url: 'https://track.network/click?affid=42', fields: min('creditcards') });
  assert.equal(noPlaceholder.ok, false);
  assert.match(String(noPlaceholder.error), /\{url\}/);
  const insecure = validateFinanceOffer({ vertical: 'creditcards', title: 'HDFC Card', url: 'https://e.com/a', affiliate_url: 'http://track.network/?url={url}', fields: min('creditcards') });
  assert.equal(insecure.ok, false);
});

test('both fields are optional — an entry still saves without photo or affiliate link', () => {
  const r = validateFinanceOffer({ vertical: 'account', title: 'SBI Savings Account', url: 'https://sbi.co.in/savings', fields: min('account') });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.clean!.image_url, null);
  assert.equal(r.clean!.affiliate_url, null);
});
