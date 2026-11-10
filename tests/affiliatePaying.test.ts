import { test } from 'node:test';
import assert from 'node:assert/strict';
import { affiliateNetworkFor, cuelinksPaysNow } from '../server/affiliate/deeplink';

/**
 * OWNER 10 Nov: merchants wrapped by Cuelinks but not approved on our publisher account pay nothing, so a
 * merchant that another network we ARE joined on carries must be routed there instead.
 */
test('an unapproved Cuelinks merchant that LinkInR carries goes to LinkInR (it pays)', () => {
  assert.equal(cuelinksPaysNow('myntra.com'), false);
  assert.equal(affiliateNetworkFor('myntra.com'), 'linkinr');
  // ajio is carried by our vCommission account with a {DESTINATION} template, which keeps the deep path:
  // a paying network that preserves the deep link beats both LinkInR and an unapproved Cuelinks wrap.
  assert.equal(affiliateNetworkFor('ajio.com'), 'vcommission');
  assert.equal(affiliateNetworkFor('flipkart.com'), 'linkinr');
  assert.equal(affiliateNetworkFor('agoda.com'), 'linkinr');
});

test('an approved Cuelinks merchant still wins, deep path and all', () => {
  for (const d of ['makemytrip.com', 'goibibo.com', 'cleartrip.com', 'nykaa.com', 'croma.com', 'shopsy.in', 'akasaair.com']) {
    assert.equal(cuelinksPaysNow(d), true, d);
    assert.equal(affiliateNetworkFor(d), 'cuelinks', d);
  }
});

test('CUELINKS_DEEP_FIRST keeps Cuelinks wrapping everywhere for the deep-link-first owner setting', () => {
  process.env.CUELINKS_DEEP_FIRST = '1';
  try {
    assert.equal(affiliateNetworkFor('myntra.com'), 'cuelinks');
  } finally {
    delete process.env.CUELINKS_DEEP_FIRST;
  }
  assert.equal(affiliateNetworkFor('myntra.com'), 'linkinr');
});

test('a merchant no joined network carries is not claimed by anyone', () => {
  assert.equal(affiliateNetworkFor('marriott.com'), null);
  assert.equal(affiliateNetworkFor('olacabs.com'), null);
});
