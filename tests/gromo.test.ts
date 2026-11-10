import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gromoLinkFor, gromoClickUrl, isGromoUrl, isFinanceDomain, gromoCoverage } from '../server/affiliate/gromo';
import { buildSecureDeeplink, affiliateNetworkFor } from '../server/affiliate/deeplink';

/**
 * OWNER 10 Nov: "gromo humera partner hai wo pura banking products deta hai pr waha aise link milta hai",
 * with the Axis credit-card advisor link sales.gromo.in/ac/CCiv1ofkx2. GroMo is a per-product LANDING link,
 * so it must serve finance exits and must never touch travel/ecommerce.
 */
test('the owner Axis GroMo link is used for Axis banking exits', async () => {
  const r = await buildSecureDeeplink('https://www.axisbank.com/retail/cards/credit-card', { companySlug: 'axis' });
  assert.equal(r.network, 'gromo');
  assert.equal(r.matchedProfile, 'gromo_advisor');
  assert.match(r.trackingUrl, /^https:\/\/sales\.gromo\.in\/ac\/CCiv1ofkx2/);
  assert.equal(affiliateNetworkFor('axisbank.com'), 'gromo');
});

test('the Axis credit-card link is never used for an Axis loan or savings row', async () => {
  const loan = await buildSecureDeeplink('https://www.axisbank.com/retail/loans/personal-loan', { companySlug: 'axis' });
  assert.notEqual(loan.network, 'gromo', 'a credit-card advisor link must not take a loan application');
  const card = await buildSecureDeeplink('https://www.axisbank.com/retail/cards/credit-card/neo', { companySlug: 'axis' });
  assert.equal(card.network, 'gromo');
});

test('GroMo never hijacks a travel or ecommerce merchant', async () => {
  for (const d of ['makemytrip.com', 'myntra.com', 'flipkart.com', 'agoda.com', 'cleartrip.com']) {
    assert.notEqual(affiliateNetworkFor(d), 'gromo', d);
  }
  const r = await buildSecureDeeplink('https://www.makemytrip.com/hotels/', {});
  assert.notEqual(r.network, 'gromo');
});

test('a GroMo link must be https and on gromo.in, otherwise it is ignored', () => {
  assert.equal(isGromoUrl('https://sales.gromo.in/ac/CCiv1ofkx2'), true);
  assert.equal(isGromoUrl('http://sales.gromo.in/ac/x'), false);
  assert.equal(isGromoUrl('https://evil.example/ac/x'), false);
  assert.equal(isGromoUrl('not-a-url'), false);
  assert.equal(gromoLinkFor('axis', 'axisbank.com'), 'https://sales.gromo.in/ac/CCiv1ofkx2');
  assert.equal(gromoLinkFor('hdfc', 'hdfcbank.com'), null);
});

test('the default link applies to finance domains only, and subid params are never invented', () => {
  process.env.GROMO_DEFAULT_LINK = 'https://sales.gromo.in/ac/DEFAULT1';
  try {
    assert.equal(gromoLinkFor('kotak', 'kotak.com'), 'https://sales.gromo.in/ac/DEFAULT1');
    assert.equal(gromoLinkFor('someota', 'makemytrip.com'), null);
    assert.equal(isFinanceDomain('hdfcbank.com'), true);
    assert.equal(isFinanceDomain('swiggy.com'), false);
    // no GROMO_SUBID_PARAM set -> the link is returned untouched
    assert.equal(gromoClickUrl('https://sales.gromo.in/ac/CCiv1ofkx2', 'axis'), 'https://sales.gromo.in/ac/CCiv1ofkx2');
    process.env.GROMO_SUBID_PARAM = 'utm_source';
    try {
      assert.match(gromoClickUrl('https://sales.gromo.in/ac/CCiv1ofkx2', 'try1second'), /utm_source=try1second/);
    } finally { delete process.env.GROMO_SUBID_PARAM; }
  } finally { delete process.env.GROMO_DEFAULT_LINK; }
});

test('coverage reports the configured keys so the admin view can show them', () => {
  const c = gromoCoverage();
  assert.ok(c.keys.includes('axis'));
  assert.equal(c.defaultConfigured, false);
  assert.ok(c.financeDomains > 20);
});
