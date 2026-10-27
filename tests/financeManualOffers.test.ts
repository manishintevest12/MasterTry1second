import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFinanceOffer, FINANCE_VERTICALS } from '../server/marketing/financeOffers';

// Owner 27 Oct: a manual add option for loans / credit cards / insurance / account.
test('all four finance verticals are accepted, with aliases', () => {
  for (const v of FINANCE_VERTICALS) {
    const r = validateFinanceOffer({ vertical: v, title: 'Test Lender Plan', url: 'https://example.com/apply' });
    assert.equal(r.ok, true, `${v}: ${r.error}`);
    assert.equal(r.clean.vertical, v);
  }
  assert.equal(validateFinanceOffer({ vertical: 'Credit Cards', title: 'X Card', url: 'https://e.com/a' }).clean!.vertical, 'creditcards');
  assert.equal(validateFinanceOffer({ vertical: 'savings', title: 'Y Account', url: 'https://e.com/a' }).clean!.vertical, 'account');
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
  const r = validateFinanceOffer({ vertical: 'insurance', title: 'Acko Term Plan', url: 'https://acko.com/term' });
  assert.equal(r.clean!.seller, 'Acko Term Plan');
});

test('a non-numeric price is rejected rather than silently zeroed', () => {
  const r = validateFinanceOffer({ vertical: 'loans', title: 'X', url: 'https://e.com/a', price: 'cheap' });
  assert.equal(r.ok, false);
});
