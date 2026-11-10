import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gromoLinkFor, gromoClickUrl, isGromoUrl, isFinanceDomain, isAggregatorDomain, gromoCoverage, gromoAdvisorLink } from '../server/affiliate/gromo';
import { buildSecureDeeplink, affiliateNetworkFor } from '../server/affiliate/deeplink';

/**
 * OWNER 10 Nov: "gromo ke saare products add kr do, wahi link jo diya tha - ussi mein mera id hint hai".
 * The advisor code (sales.gromo.in/ac/CCiv1ofkx2) is the owner's ID, so ONE link serves every GroMo product;
 * measured that the URL answers the same shell for a valid and an invalid code, i.e. the advisor is resolved
 * client-side. So the rule is: every banking/insurance/broker row exits through the advisor link, a lead
 * aggregator (a competitor) never does, and no travel or ecommerce row is touched.
 */
const ADVISOR = 'https://sales.gromo.in/ac/CCiv1ofkx2';

test('the advisor link is the universal finance exit (card, loan, savings, insurance, broking)', async () => {
  const cases: [string, string][] = [
    ['https://www.axisbank.com/retail/cards/credit-card/neo', 'axis'],
    ['https://www.axisbank.com/retail/loans/personal-loan', 'axis'],
    ['https://www.hdfcbank.com/personal/pay/cards/credit-cards', 'hdfc'],
    ['https://www.icicibank.com/personal-banking/loans', 'icici'],
    ['https://www.kotak.com/en/personal-banking/cards.html', 'kotak'],
    ['https://www.idfcfirstbank.com/credit-card', 'idfc'],
    ['https://www.aubank.in/savings-account', 'au'],
    ['https://www.hdfcergo.com/health-insurance', 'hdfcergo'],
    ['https://www.groww.in/demat-account', 'groww'],
  ];
  for (const [url, slug] of cases) {
    const r = await buildSecureDeeplink(url, { companySlug: slug });
    assert.equal(r.network, 'gromo', `${url} must exit through GroMo`);
    assert.equal(r.trackingUrl, ADVISOR);
  }
  for (const d of ['axisbank.com', 'hdfcbank.com', 'icicibank.com', 'sbicard.com', 'bajajfinserv.in', 'zerodha.com']) {
    assert.equal(affiliateNetworkFor(d), 'gromo', d);
  }
});

test('a lead aggregator keeps its own route: GroMo never takes a competitor row', async () => {
  for (const d of ['policybazaar.com', 'paisabazaar.com', 'bankbazaar.com', 'coverfox.com', 'insurancedekho.com', 'cardinsider.com']) {
    assert.equal(isAggregatorDomain(d), true, d);
    assert.equal(gromoLinkFor(d, d), null, d);
    assert.notEqual(affiliateNetworkFor(d), 'gromo', d);
  }
});

test('travel and ecommerce rows are untouched', async () => {
  for (const d of ['makemytrip.com', 'myntra.com', 'flipkart.com', 'agoda.com', 'cleartrip.com', 'swiggy.com']) {
    assert.notEqual(affiliateNetworkFor(d), 'gromo', d);
  }
  assert.equal(isFinanceDomain('swiggy.com'), false);
});

test('a GroMo link must be https on gromo.in, and env wins over the built-in advisor code', () => {
  assert.equal(isGromoUrl(ADVISOR), true);
  assert.equal(isGromoUrl('http://sales.gromo.in/ac/x'), false);
  assert.equal(isGromoUrl('https://evil.example/ac/x'), false);
  assert.equal(gromoAdvisorLink(), ADVISOR);
  process.env.GROMO_ADVISOR_LINK = 'https://sales.gromo.in/ac/NEWID123';
  try {
    assert.equal(gromoAdvisorLink(), 'https://sales.gromo.in/ac/NEWID123');
    assert.equal(gromoLinkFor('hdfc', 'hdfcbank.com'), 'https://sales.gromo.in/ac/NEWID123');
    // a bad override is ignored instead of shipping a dead exit
    process.env.GROMO_ADVISOR_LINK = 'http://not-secure/ac/x';
    assert.equal(gromoAdvisorLink(), ADVISOR);
  } finally { delete process.env.GROMO_ADVISOR_LINK; }
});

test('a per-product code can still be pinned per merchant', () => {
  process.env.GROMO_LINKS = '{"kotak":"https://sales.gromo.in/ac/KOTAKCODE"}'.replace(/"https/g, '"https');
  try {
    assert.equal(gromoLinkFor('kotak', 'kotak.com'), 'https://sales.gromo.in/ac/KOTAKCODE');
    assert.equal(gromoLinkFor('hdfc', 'hdfcbank.com'), ADVISOR);
  } finally { delete process.env.GROMO_LINKS; }
});

test('no query parameter is invented on an advisor click', () => {
  assert.equal(gromoClickUrl(ADVISOR, 'axis'), ADVISOR);
  process.env.GROMO_SUBID_PARAM = 'utm_source';
  try { assert.match(gromoClickUrl(ADVISOR, 'try1second'), /utm_source=try1second/); }
  finally { delete process.env.GROMO_SUBID_PARAM; }
});

test('coverage surfaces the advisor link for the admin view', () => {
  const c = gromoCoverage();
  assert.equal(c.advisorLink, ADVISOR);
  assert.ok(c.financeDomains > 20);
});
