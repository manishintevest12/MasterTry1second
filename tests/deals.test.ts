import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDeal, merchantKeyOf, saveDeal, listPublicDeals, dealsForSeller, deleteDeal, listAllDeals } from '../server/marketing/deals';
import { resolveMaskingPointer } from '../server/affiliate/deeplink';

const tag = `T${Date.now() % 100000}`;
const base = { merchant_key: 'flipkart', merchant_name: 'Flipkart', kind: 'coupon', title: `Extra 10% ${tag}`, code: 'save10', dest_url: 'https://www.flipkart.com/offers-store' };

test('deals: merchant key maps seller names to one key', () => {
  assert.equal(merchantKeyOf('Flipkart Minutes'), 'flipkart');
  assert.equal(merchantKeyOf('Amazon.in'), 'amazon');
  assert.equal(merchantKeyOf('Tata CLiQ'), 'tatacliq');
  assert.equal(merchantKeyOf('BookMyShow'), 'bookmyshow');
});

test('deals: validation is honest (https only, coupon needs a code, real kinds)', () => {
  assert.equal(validateDeal({ ...base }).ok, true);
  assert.equal(validateDeal({ ...base, dest_url: 'http://x.com/a' }).ok, false);
  assert.equal(validateDeal({ ...base, dest_url: 'javascript:alert(1)' }).ok, false);
  assert.equal(validateDeal({ ...base, code: '' }).ok, false);
  assert.equal(validateDeal({ ...base, kind: 'banana' }).ok, false);
  assert.equal(validateDeal({ ...base, valid_till: '31-12-2026' }).ok, false);
  assert.equal(validateDeal({ ...base, kind: 'bank_offer', code: '' }).ok, true);
  assert.equal(validateDeal({ ...base }).clean.code, 'SAVE10');
});

test('deals: public list hides inactive + expired, and never exposes the raw destination or affiliate id', async () => {
  const live = await saveDeal({ ...base, title: `Live ${tag}` });
  const expired = await saveDeal({ ...base, title: `Old ${tag}`, valid_till: '2020-01-01' });
  const off = await saveDeal({ ...base, title: `Off ${tag}`, is_active: false });
  assert.ok(live.ok && expired.ok && off.ok);
  const pub = await listPublicDeals({ merchant: 'Flipkart' });
  const titles = pub.map((d) => d.title);
  assert.ok(titles.includes(`Live ${tag}`));
  assert.ok(!titles.includes(`Old ${tag}`));
  assert.ok(!titles.includes(`Off ${tag}`));
  const d = pub.find((x) => x.title === `Live ${tag}`)!;
  assert.match(d.goUrl, /^\/api\/out\?t=/);
  assert.ok(!JSON.stringify(d).includes('flipkart.com/offers-store'), 'raw destination must not leak');
  const ptr = resolveMaskingPointer(d.goUrl.split('t=')[1]);
  assert.equal(ptr?.destination, 'https://www.flipkart.com/offers-store');
  for (const id of [live.id, expired.id, off.id]) await deleteDeal(Number(id));
});

test('deals: seller lookup ranks coupons first and matches by seller name', async () => {
  const a = await saveDeal({ ...base, kind: 'sale', code: '', title: `Sale ${tag}` });
  const b = await saveDeal({ ...base, title: `Code ${tag}` });
  const got = await dealsForSeller('Flipkart Minutes', 6);
  const mine = got.filter((d) => d.title.endsWith(tag));
  assert.equal(mine[0].kind, 'coupon');
  assert.equal((await dealsForSeller('Myntra')).filter((d) => d.title.endsWith(tag)).length, 0);
  await deleteDeal(Number(a.id)); await deleteDeal(Number(b.id));
});

test('deals: update keeps one row, delete removes it', async () => {
  const r = await saveDeal({ ...base, title: `Upd ${tag}` });
  const u = await saveDeal({ ...base, id: r.id, title: `Upd2 ${tag}`, code: 'NEW20' });
  assert.equal(u.id, r.id);
  const all = (await listAllDeals()).filter((d) => d.title.endsWith(tag));
  assert.equal(all.length, 1); assert.equal(all[0].code, 'NEW20');
  await deleteDeal(Number(r.id));
  assert.equal((await listAllDeals()).filter((d) => d.title.endsWith(tag)).length, 0);
});

import { validateProfile, saveProfile, deleteProfile, listProfiles } from '../server/affiliate/profiles';
import { buildSecureDeeplink } from '../server/affiliate/deeplink';

test('affiliate profiles: template must carry {url} and be https', () => {
  const ok = { slug: 'Flipkart', company_domain: 'https://www.flipkart.com/x', network: 'cuelinks', template: 'https://linksredirect.com/?aff={subid}&url={url}' };
  assert.equal(validateProfile(ok).ok, true);
  assert.equal(validateProfile(ok).clean.company_domain, 'flipkart.com');
  assert.equal(validateProfile({ ...ok, template: 'https://x.com/?aff=1' }).ok, false);
  assert.equal(validateProfile({ ...ok, template: 'http://x.com/?u={url}' }).ok, false);
  assert.equal(validateProfile({ ...ok, network: 'madeup' }).ok, false);
});

test('affiliate profiles: saved profile is applied server-side to a merchant URL, removed profile goes direct', async () => {
  const slug = `tst${Date.now() % 100000}`;
  const domain = `${slug}.example.com`;
  assert.equal((await saveProfile({ slug, company_domain: domain, network: 'direct', template: 'https://track.example.net/c?pub=MYID&sub={subid}&u={url}' })).ok, true);
  const dl = await buildSecureDeeplink(`https://www.${domain}/p/1?a=b`);
  assert.match(dl.trackingUrl, /^https:\/\/track\.example\.net\/c\?pub=MYID&sub=/);
  assert.ok(dl.trackingUrl.includes(encodeURIComponent(`https://www.${domain}/p/1?a=b`)));
  assert.equal(dl.matchedProfile, 'affiliate_configs');
  assert.ok((await listProfiles()).some((p) => p.slug === slug));
  await deleteProfile(slug);
  assert.equal((await buildSecureDeeplink(`https://www.${domain}/p/1`)).matchedProfile === 'affiliate_configs', false);
});

// ---- Deals auto-acquisition pure parsers (cffi acquisition engine) ----
import {
  extractMyxDeals, extractTatacliqDeals, extractAmazonCardDeals, extractAmazonBankOffers,
} from '../server/deals/acquisition';

test('acquisition: extractMyxDeals keeps only real discounted products with landing links', () => {
  const root = {
    searchData: { results: { products: [
      { productId: 1, productName: 'Sangria Kurta', brand: 'Sangria', price: 808, mrp: 2600, discountDisplayLabel: '(69% OFF)', landingPageUrl: 'kurta-sets/sangria/x' },
      { productId: 2, productName: 'No Discount Item', price: 500, landingPageUrl: 'a/b' },
      { productId: 3, productName: 'Zero price', price: 0, discountDisplayLabel: '(50% OFF)', landingPageUrl: 'a/c' },
      { productId: 4, productName: 'No link', price: 900, discountDisplayLabel: '(40% OFF)' },
    ] } },
  };
  const deals = extractMyxDeals(root as any);
  assert.equal(deals.length, 1);
  assert.ok(deals[0].title.includes('Sangria'));
  assert.equal(deals[0].discount_text, '69% OFF');
  assert.ok(deals[0].dest_url.startsWith('https://www.myntra.com/kurta-sets'));
  assert.equal(deals[0].dedupe_key, 'myntra|1');
});

test('acquisition: extractTatacliqDeals keeps only 40%+ discounts on tatacliq.com links', () => {
  const body = JSON.stringify({ response: [{ product_search_page: { search_result: [
    { ussid: 'u1', productTitle: 'Running Shoes', brandname: 'Nike', discountPercent: 55, webURL: 'https://www.tatacliq.com/p/x', price: { sellingPrice: { doubleValue: 1999 }, mrpPrice: { doubleValue: 4400 } }, imageURL: 'productimage' },
    { ussid: 'u2', productTitle: 'Tiny discount', discountPercent: 10, webURL: 'https://www.tatacliq.com/p/y', price: { sellingPrice: { doubleValue: 900 } } },
    { ussid: 'u3', productTitle: 'Off-domain link', discountPercent: 70, webURL: 'https://evil.example.com/p', price: { sellingPrice: { doubleValue: 100 } } },
  ] } }] });
  const deals = extractTatacliqDeals(body);
  assert.equal(deals.length, 1);
  assert.equal(deals[0].title, 'Nike Running Shoes');
  assert.equal(deals[0].discount_text, '55% OFF');
  assert.ok(deals[0].dest_url.includes('tatacliq.com'));
});

test('acquisition: extractAmazonCardDeals builds coupon deals only from cards that carry a coupon', () => {
  const card = (asin: string, coupon: string) => `<div data-asin="${asin}"><span class="a-size-medium">Philips Air Fryer XL</span><span class="a-price"><span class="a-price-whole">5,999</span></span>${coupon}</div>`;
  const html = card('B0TESTAS01', '<span>₹500 coupon applied</span>') + card('B0TESTAS02', '<span>No coupon here</span>') + card('B0TESTAS03', '<span>Save ₹250 with coupon</span>');
  const deals = extractAmazonCardDeals(html);
  assert.equal(deals.length, 2);
  assert.equal(deals[0].kind, 'coupon');
  assert.equal(deals[0].dest_url, 'https://www.amazon.in/dp/B0TESTAS01');
  assert.equal(deals[0].discount_text, 'Save ₹500 with coupon');
  assert.ok(deals[1].dest_url.includes('B0TESTAS03'));
});

test('acquisition: extractAmazonBankOffers pulls deduped bank-offer blocks from a dp page', () => {
  const dp = '<div id="pa">Bank Offer: 10% Instant Discount up to ₹1,500 on HDFC Bank Credit Cards, min txn ₹5,000. T&amp;C apply. Bank Offer: 10% Instant Discount up to ₹1,500 on HDFC Bank Credit Cards, min txn ₹5,000. No Cost EMI on most credit cards</div>';
  const deals = extractAmazonBankOffers(dp, 'B099', 'Some Product');
  assert.ok(deals.length > 0);
  for (const d of deals) {
    assert.equal(d.kind, 'bank_offer');
    assert.equal(d.dest_url, 'https://www.amazon.in/dp/B099');
  }
  assert.equal(new Set(deals.map((d) => d.title)).size, deals.length);
});

// Owner 21 Oct: admin can add finance offers (loan/credit/insurance/account)
// with an explicit vertical override; account merchants auto-map to 'account'.
test('deals: account merchants auto-map to the account vertical', () => {
  const v = validateDeal({ merchant_name: 'Groww', merchant_key: 'groww', kind: 'account', title: 'Groww Savings Account 3.5% p.a.', dest_url: 'https://groww.in/savings-account' });
  if (!v.ok) throw new Error(v.error);
  if (v.clean.vertical !== 'account') throw new Error('groww must auto-map to account, got ' + v.clean.vertical);
  const z = validateDeal({ merchant_name: 'Zerodha', merchant_key: 'zerodha', kind: 'account', title: 'Zerodha Demat ₹0 account opening', dest_url: 'https://zerodha.com/open-account' });
  if (!z.ok || z.clean.vertical !== 'account') throw new Error('zerodha must map to account');
});

test('deals: explicit vertical override wins over merchant auto-map', () => {
  const v = validateDeal({ merchant_name: 'SBI', merchant_key: 'sbi', kind: 'account', vertical: 'account', title: 'SBI Savings Account 2.5% p.a.', dest_url: 'https://sbi.co.in' });
  if (!v.ok) throw new Error(v.error);
  if (v.clean.vertical !== 'account') throw new Error('override lost, got ' + v.clean.vertical);
  const l = validateDeal({ merchant_name: 'SBI', merchant_key: 'sbi', kind: 'loan', vertical: 'loans', title: 'SBI Personal Loan from 10.5%', dest_url: 'https://sbi.co.in/loans' });
  if (!l.ok || l.clean.vertical !== 'loans') throw new Error('loan override lost');
});
