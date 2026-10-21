import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseBankBazaarSavings, parseBankBazaarCurrent, parseBankBazaarDemat,
  parsePaisabazaarSavings, parseZerodhaCharges, parseGrowwCharges,
} from '../server/workers/parsers/bankbazaarAccounts';
import { accountTypeOf } from '../server/workers/verticals/account';
import type { SourceConfig } from '../server/types';

const src = { id: 'w_account_test', name: 'test', method: 'direct_http', verticals: ['banking'], enabled: true } as unknown as SourceConfig;

// Real page shapes captured live 21 Oct 2026 (structure, trimmed to the rate tables).
const bbSavings = `<html><body><table>
<tr><td><p class="text-base "><a href="https://www.bankbazaar.com/savings-account/sbi-savings-account.html">State Bank of India</a></p></td><td><p class="text-base ">2.50% p.a. across&#160;all account balances</p></td></tr>
<tr><td><p class="text-base "><a href="/savings-account/bank-of-india-savings-account.html">Bank of India</a></p></td><td><p class="text-base ">2.50% p.a. to 4.85% p.a.</p></td></tr>
<tr><td><p class="text-base ">Interest Rate</p></td><td><p class="text-base ">savings rate table intro</p></td></tr>
<tr><td><p class="text-base ">RBL Bank</p></td><td><p class="text-base ">No published slab here</p></td></tr>
</table></body></html>`;

const bbCurrent = `<html><body><table>
<tr><td>Bank</td><td>Monthly Average Balance (MAB)</td><td>Free deposit limits</td></tr>
<tr><td><p class="text-base ">HDFC Bank</p></td><td><p class="text-base ">Rs.75,000</p></td><td><p class="text-base ">10 times the MAB</p></td></tr>
<tr><td><p class="text-base ">Canara Bank</p></td><td><p class="text-base ">Rs.1 lakh (quarterly)</p></td><td><p class="text-base ">Up to Rs.5 lakhs per day</p></td></tr>
</table></body></html>`;

const bbDemat = `<html><body><table>
<tr><td><p class="text-base ">Account</p></td><td><p class="text-base ">Purpose</p></td><td><p class="text-base ">Regulated By</p></td></tr>
<tr><td><p class="text-base ">Demat Account</p></td><td><p class="text-base ">Holds shares</p></td><td><p class="text-base ">SEBI</p></td></tr>
</table><table>
<tr><td><p class="text-base ">Charge Type</p></td><td><p class="text-base ">Typical Range</p></td><td><p class="text-base ">Notes</p></td></tr>
<tr><td><p class="text-base ">Account Opening Fee</p></td><td><p class="text-base ">Rs. 0 (most brokers)</p></td><td><p class="text-base ">Discount brokers offer free account opening</p></td></tr>
<tr><td><p class="text-base ">Annual Maintenance Charge (AMC)</p></td><td><p class="text-base ">Rs. 0 to Rs. 750 per year</p></td><td><p class="text-base ">BSDA: Rs. 0 if holdings under Rs. 2 lakh</p></td></tr>
<tr><td><p class="text-base ">Transaction charge on sell</p></td><td><p class="text-base ">Rs. 13 to Rs. 13.5 per ISIN</p></td><td><p class="text-base ">Levied by NSDL or CDSL</p></td></tr>
</table></body></html>`;

const pisaSavings = `<html><body><table>
<tr><td><strong>Bank Name</strong></td><td><strong>Highest Interest Rate (p.a.)</strong></td><td><strong>Amount Requirements</strong></td></tr>
<tr><td><a class="in-cell-link" href="https://www.paisabazaar.com/bank-of-india/savings-account/">Bank of India</a></td><td>4.85%</td><td>Above Rs. 2500 Crore</td></tr>
<tr><td><a href="https://www.paisabazaar.com/bank-of-baroda/savings-account/">Bank of Baroda</a></td><td>4.75%</td><td>Above Rs. 2500 Crore and above</td></tr>
</table></body></html>`;

test('BankBazaar savings: one honest offer per bank, highest slab is the comparable', () => {
  const items = parseBankBazaarSavings(bbSavings, src, 'https://www.bankbazaar.com/savings-account.html');
  assert.equal(items.length, 2); // SBI + BoI; rateless rows never invented
  const sbi = items.find((i) => i.title.includes('State Bank'));
  assert.equal(sbi?.price, 2.5);
  const boi = items.find((i) => i.title.startsWith('Bank of India'));
  assert.equal(boi?.price, 4.85); // highest published slab
  assert.equal((boi as any).attributes.interest_rate_min, '2.5');
  assert.equal((boi as any).attributes.interest_rate_max, '4.85');
  assert.equal((boi as any).attributes.account_type, 'savings');
  assert.match(String((boi as any).attributes.price_unit), /% p\.a\./);
  assert.match(String(boi?.sellerUrl), /bankbazaar\.com\/savings-account\/bank-of-india/);
});

test('BankBazaar current: MAB is the comparable rupee value', () => {
  const items = parseBankBazaarCurrent(bbCurrent, src, 'https://www.bankbazaar.com/current-account.html');
  const hdfc = items.find((i) => i.title.includes('HDFC'));
  assert.equal(hdfc?.price, 75000);
  const canara = items.find((i) => i.title.includes('Canara'));
  assert.equal(canara?.price, 100000); // "Rs.1 lakh" parsed to rupees
  assert.equal((hdfc as any).attributes.price_unit, 'monthly average balance');
});

test('BankBazaar demat: one summary row with published charges only', () => {
  const items = parseBankBazaarDemat(bbDemat, src, 'https://www.bankbazaar.com/demat-account.html');
  assert.equal(items.length, 1);
  const attrs = (items[0] as any).attributes;
  assert.match(String(attrs.account_opening_fee), /0 \(most brokers\)/);
  assert.equal(attrs.amc, 'Rs. 0 to Rs. 750 per year'); // exact range cell, never a BSDA-sentence mis-capture
  assert.match(String(attrs.bsda_note), /BSDA/);
  assert.match(String(attrs.transaction_charge), /13\.5 per ISIN/);
  assert.equal(items[0].price, undefined); // no single comparable price: never invented
});

test('Paisabazaar savings: highest rate + balance requirement carried', () => {
  const items = parsePaisabazaarSavings(pisaSavings, src, 'https://www.paisabazaar.com/savings-account/');
  assert.equal(items.length, 2);
  const boi = items.find((i) => i.title.startsWith('Bank of India'));
  assert.equal(boi?.price, 4.85);
  assert.equal((boi as any).attributes.balance_requirement, 'Above Rs. 2500 Crore');
  assert.equal((boi as any).attributes.interest_rate_max, '4.85');
});

test('Zerodha charges: AMC from the broker own page, free-first-year noted', () => {
  const html = `<html><body>Partnership accounts &#8377; 500 Demat AMC (Annual Maintenance Charge) Free for first year* From second year onwards, for BSDA the charges vary.</body></html>`;
  const items = parseZerodhaCharges(html, src, 'https://zerodha.com/charges');
  assert.equal(items.length, 1);
  assert.equal(items[0].price, 500);
  assert.match(String((items[0] as any).attributes.amc), /free first year/);
  // No publishable charge -> nothing invented
  assert.equal(parseZerodhaCharges('<html>nothing here</html>', src, 'x').length, 0);
});

test('Groww pricing: zero AMC stays honest zero, brokerage carried', () => {
  const html = `<html><body>demat opening Account Maintenance Charges ₹ 0 maintenance charges Equity Brokerage ₹ 20 0.1% per executed order whichever is lower</body></html>`;
  const items = parseGrowwCharges(html, src, 'https://groww.in/pricing');
  assert.equal(items.length, 1);
  assert.equal(items[0].price, 0); // genuinely ₹0 — never padded to look priced
  assert.match(String((items[0] as any).attributes.amc), /₹0 per year/);
  assert.match(String((items[0] as any).attributes.brokerage), /0\.1%/);
});

test('account type routing: demat/current/savings from the query', () => {
  assert.equal(accountTypeOf({ query: { rawQuery: 'best demat account for trading' } } as any), 'demat');
  assert.equal(accountTypeOf({ query: { rawQuery: 'current account for msme' } } as any), 'current');
  assert.equal(accountTypeOf({ query: { rawQuery: 'zero balance savings account' } } as any), 'savings');
  assert.equal(accountTypeOf({ query: { rawQuery: '' } } as any), 'savings'); // default
});
