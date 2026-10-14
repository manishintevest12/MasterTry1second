import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCardInsiderCard, parseIssuerIndex, feeToInr, rewardRange, detectNetwork } from '../server/workers/parsers/cardInsider';
import { parsePaisabazaarCard, parsePaisabazaarIndex } from '../server/workers/parsers/paisabazaarCards';
import { groupSameProduct } from '../server/pipeline/productGrouping';
import { queryPlan } from '../server/workers/verticals/creditcards';

const ciPage = (rows: string) => `<html><h1>HDFC Bank Millennia Credit Card Review</h1><div>4.8 / 5</div><span>Joining Fee</span><span>₹1,000 + GST</span><span>Renewal Fee</span><span>₹1,000 + GST</span>
<h2>Rewards and</h2><b>Benefits</b>${rows}<h2>Fees and</h2><b>Charges</b><span>Joining Fee</span><span>₹1,000 + GST</span><span>Renewal Fee</span><span>₹1,000 + GST</span><span>Interest Rates</span><span>3.75% Per Month (45% Annually)</span><span>Forex Markup</span><span>3.5% + GST</span>
<nav><a>Cashback</a><a>Fuel Credit Cards</a></nav><img src="https://cardinsider.com/wp-content/uploads/2021/09/HDFC-Millennia.webp"></html>`;

test('fee parsing: rupee, lifetime free, unknown', () => {
  assert.equal(feeToInr('₹1,000 + GST'), 1000);
  assert.equal(feeToInr('Rs. 500 + Taxes'), 500);
  assert.equal(feeToInr('Lifetime Free'), 0);
  assert.equal(feeToInr('First Year Free (Limited Time Offer)'), undefined); // not a stated rupee fee: never invented
  assert.equal(feeToInr(undefined), undefined);
});
test('reward range from stated percentages only', () => {
  assert.equal(rewardRange('5% Cashback at partners. 1% on other spends'), '1–5%');
  assert.equal(rewardRange('3% cashback'), '3%');
  assert.equal(rewardRange('10 RPs/₹100 on PhonePe'), undefined);
});
test('network detection', () => {
  assert.equal(detectNetwork('SBI RuPay Credit Card'), 'RuPay');
  assert.equal(detectNetwork('HDFC Regalia Mastercard'), 'Mastercard');
  assert.equal(detectNetwork('Some Card'), undefined);
});
test('CardInsider card parse: fees, APR, no menu-text lounge leakage', () => {
  const c = parseCardInsiderCard(ciPage('<span>Rewards Rate</span><span>5% Cashback at Amazon. 1% on others</span><span>Domestic Lounge</span><span>N/A</span><span>International Lounge</span><span>N/A</span>'), 'https://cardinsider.com/hdfc-bank/hdfc-bank-millennia-credit-card/')!;
  assert.equal(c.name, 'HDFC Bank Millennia Credit Card');
  assert.equal(c.bank, 'HDFC Bank');
  assert.equal(c.annualFeeInr, 1000);
  assert.equal(c.apr, '45%');
  assert.equal(c.domesticLounge, undefined);
  assert.equal(c.intlLounge, undefined);
  assert.equal(c.rating, 4.8);
  assert.match(c.imageUrl || '', /HDFC-Millennia\.webp/);
});
test('CardInsider: non-card page returns null (never a fabricated card)', () => {
  assert.equal(parseCardInsiderCard('<html><h1>Credit Card Bill Payment Guide</h1><p>no fees</p></html>', 'https://cardinsider.com/hdfc-bank/credit-card-bill-payment/'), null);
});
test('issuer index keeps only card pages', () => {
  const html = ['hdfc-bank-millennia-credit-card', 'best-hdfc-business-credit-cards', 'credit-card-bill-payment', 'hdfc-bank-credit-cards-forex-markup-charges', 'hdfc-regalia-vs-millennia-credit-card', 'swiggy-hdfc-bank-credit-card']
    .map((s) => `<a href="https://cardinsider.com/hdfc-bank/${s}/">x</a>`).join('');
  const l = parseIssuerIndex(html, 'hdfc-bank').map((u) => u.split('/')[4]);
  assert.deepEqual(l.sort(), ['hdfc-bank-millennia-credit-card', 'swiggy-hdfc-bank-credit-card']);
});
test('Paisabazaar card parse and index', () => {
  const page = '<h1>Flipkart Axis Bank Credit Card</h1><h2>Fees &amp; Charges</h2><p>Joining Fee</p><p>Nil - First Year FREE</p><p>Annual Fee</p><p>Rs. 500 + Taxes</p>';
  const c = parsePaisabazaarCard(page, 'https://www.paisabazaar.com/axis-bank/flipkart-axis-bank-credit-card/')!;
  assert.equal(c.annualFeeInr, 500);
  assert.equal(c.bank, 'Axis Bank');
  assert.equal(parsePaisabazaarCard('<h1>Best Credit Cards</h1><p>x</p>', 'https://www.paisabazaar.com/credit-card/best/'), null);
  const idx = parsePaisabazaarIndex('<a href="https://www.paisabazaar.com/axis-bank/ace-credit-card/">a</a><a href="https://www.paisabazaar.com/axis-bank/credit-card-fees-charges/">b</a><a href="https://www.paisabazaar.com/axis-bank/credit-card/">c</a>', 'axis-bank');
  assert.deepEqual(idx, ['https://www.paisabazaar.com/axis-bank/ace-credit-card/']);
});
test('query plan: bank, name tokens and use-case intents', () => {
  const p = queryPlan('best hdfc travel credit card with lounge');
  assert.deepEqual(p.banks, ['hdfc-bank']);
  assert.ok(p.intents.length >= 1);
  assert.deepEqual(queryPlan('regalia gold credit card').tokens.sort(), ['gold', 'regalia']);
  assert.deepEqual(queryPlan('credit cards').banks, []);
});

// ---------------------------------------------------------------------------
// Cross-site card grouping (strict identity): the SAME card from CardInsider and
// Paisabazaar must become ONE card (spec union), while a differently-named card of the
// same bank must NEVER merge into it.
// ---------------------------------------------------------------------------
{
  const cc = (id: string, title: string, specs: Record<string, string>): any => ({
    id, vertical: 'creditcards', title, primaryPrice: 500,
    specs, sellerQuotes: [{ id: `sq-${id}`, sellerName: 'Axis Bank', price: 500, url: '/api/out?t=x' }],
  });
  const out = groupSameProduct([
    cc('a', 'Flipkart Axis Bank Credit Card', { 'annual fee': 'Rs. 500', 'reward rate': '1–7.5%' }),
    cc('b', 'Flipkart Axis Bank Credit Card', { 'annual fee': 'Rs. 500', 'apr': '55.55%' }),
    cc('c', 'Flipkart Axis Bank Super Elite Credit Card', { 'annual fee': 'Rs. 500' }),
  ]);
  assert.equal(out.length, 2, 'same card merges across sites, different card does not');
  const merged = out.find((x: any) => x.title.includes('Credit Card') && !x.title.includes('Super Elite')) as any;
  assert.ok(merged, 'merged card present');
  assert.ok(merged.specs['reward rate'] && merged.specs['apr'], 'spec fields union across sources');
  const elite = out.find((x: any) => x.title.includes('Super Elite')) as any;
  assert.equal(Object.keys(elite.specs).length, 1, 'different card stays separate, keeps its own specs');
}
