import test from 'node:test';
import assert from 'node:assert/strict';
import { FINANCE_FIELDS, applyFinanceFields, fieldsForVertical, financeNumber } from '../server/marketing/financeFields';
import { validateFinanceOffer } from '../server/marketing/financeOffers';

/**
 * OWNER 18 Nov: "Loans / Credit Cards / Insurance / Accounts, ye sb mai ek hi column hai jb ki website pr …
 * dekh kya field chaiye uss hisab se backend bnao jiss se hum wo field daal ske aur live kr ske."
 *
 * The site renders a DIFFERENT card per vertical, and server/api/routes.ts maps every attribute key to a
 * specs key with spaces (`joining_fee` -> `joining fee`). These tests pin each card's real vocabulary so a
 * field can never be dropped between the admin form and the live card.
 */
const specsKey = (k: string) => k.replace(/_/g, ' ');

test('every key the credit-card card reads exists in the creditcards field set', () => {
  const keys = new Set(FINANCE_FIELDS.creditcards.map((f) => specsKey(f.key)));
  for (const k of [
    'bank', 'network', 'joining fee', 'annual fee', 'annual fee inr', 'reward rate', 'apr',
    'forex markup', 'domestic lounge', 'international lounge', 'best for', 'welcome benefit',
    'fuel surcharge waiver', 'rating',
  ]) {
    assert.ok(keys.has(k), `CreditCardCard reads "${k}" but the form cannot supply it`);
  }
});

test('loans ask for the loan card vocabulary', () => {
  const keys = new Set(FINANCE_FIELDS.loans.map((f) => specsKey(f.key)));
  for (const k of ['loan type', 'interest rate', 'interest rate min', 'processing fee', 'tenure or amount']) {
    assert.ok(keys.has(k), `loan card/lead form uses "${k}"`);
  }
});

test('insurance and accounts ask for their own card vocabulary', () => {
  const ins = new Set(FINANCE_FIELDS.insurance.map((f) => specsKey(f.key)));
  for (const k of ['insurance type', 'claim settlement ratio', 'premium', 'sum insured', 'network', 'waiting period']) {
    assert.ok(ins.has(k), `insurance card uses "${k}"`);
  }
  const acc = new Set(FINANCE_FIELDS.account.map((f) => specsKey(f.key)));
  for (const k of ['account type', 'interest rate', 'interest rate max', 'monthly average balance']) {
    assert.ok(acc.has(k), `bank-account card uses "${k}"`);
  }
});

test('the four verticals do NOT share one field list (the owner\'s complaint)', () => {
  const sig = (v: keyof typeof FINANCE_FIELDS) => FINANCE_FIELDS[v].map((f) => f.key).join(',');
  const all = new Set([sig('loans'), sig('creditcards'), sig('insurance'), sig('account')]);
  assert.equal(all.size, 4);
  assert.equal(fieldsForVertical('creditcards').some((f) => f.key === 'loan_type'), false);
});

test('only the vertical\'s own keys are accepted — a card field can never leak into a loan row', () => {
  const r = applyFinanceFields('loans', { loan_type: 'personal loan', interest_rate: '10.25% p.a.', interest_rate_min: '10.25', annual_fee_inr: '99' });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.extras.annual_fee_inr, undefined);
  assert.equal(r.price, 10.25);
  assert.equal(r.unit, '10.25% p.a.');
});

test('required fields are enforced per vertical, with the field name in the error', () => {
  const card = applyFinanceFields('creditcards', { joining_fee: '₹99' });
  assert.equal(card.ok, false);
  assert.match(String(card.error), /Card issuer|Annual/);
  const ins = applyFinanceFields('insurance', { insurance_type: 'health insurance' });
  assert.equal(ins.ok, false);
  assert.match(String(ins.error), /Claim settlement ratio/);
});

test('the credit-card issuer falls back to the seller so the tile never renders blank', () => {
  const r = applyFinanceFields('creditcards', { joining_fee: '₹0', annual_fee: 'Lifetime Free', annual_fee_inr: '0' }, { seller: 'Axis Bank' });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.extras.bank, 'Axis Bank');
  assert.equal(r.price, 0);
});

test('numbers accept what an owner types (₹, %, commas) and junk is refused', () => {
  assert.equal(financeNumber('₹1,999'), 1999);
  assert.equal(financeNumber('10.25% p.a.'), 10.25);
  assert.equal(financeNumber(''), null);
  const bad = applyFinanceFields('loans', { loan_type: 'personal loan', interest_rate: 'x', interest_rate_min: 'cheap' });
  assert.equal(bad.ok, false);
  assert.match(String(bad.error), /sirf number/);
});

test('selects accept either casing and refuse an unknown value', () => {
  const ok = applyFinanceFields('insurance', { insurance_type: 'HEALTH INSURANCE', claim_settlement_ratio: '98', premium: 'from ₹499/mo' });
  assert.equal(ok.ok, true, ok.error);
  assert.equal(ok.extras.insurance_type, 'health insurance');
  const no = applyFinanceFields('insurance', { insurance_type: 'pet insurance', claim_settlement_ratio: '98', premium: 'from ₹499/mo' });
  assert.equal(no.ok, false);
});

test('a saved entry carries the fields into attributes with the card\'s own keys and price', () => {
  const v = validateFinanceOffer({
    vertical: 'Credit Cards', title: 'HDFC Millennia', seller: 'HDFC Bank', url: 'https://hdfcbank.com/card',
    fields: { network: 'Visa', joining_fee: '₹1,000 + GST', annual_fee: '₹1,000 + GST', annual_fee_inr: '1000', reward_rate: '5%', apr: '43.2%', rating: '4.5' },
  });
  assert.equal(v.ok, true, v.error);
  assert.equal(v.clean!.price, 1000);            // annual_fee_inr supplies the number the feed sorts on
  assert.equal(v.clean!.fields.bank, 'HDFC Bank'); // issuer filled from the seller
  assert.equal(v.clean!.fields.network, 'Visa');
  assert.equal(v.clean!.fields.rating, '4.5');
  assert.equal(v.clean!.rate_label, '₹1,000 + GST'); // annual fee label feeds the admin list
});

test('an entry saved without its vertical\'s fields is refused (that is what kept cards half-empty)', () => {
  const r = validateFinanceOffer({ vertical: 'loans', title: 'HDFC Personal Loan', url: 'https://hdfcbank.com/loan' });
  assert.equal(r.ok, false);
  assert.match(String(r.error), /Loan type|Interest rate/);
});
