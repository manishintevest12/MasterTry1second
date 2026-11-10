/**
 * OWNER 10 Nov: "ab maine env mai cuelink update kr diya". The allow-list must follow the environment,
 * not a code deploy, otherwise joining an advertiser in the Cuelinks dashboard still pays ₹0.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { cuelinksMerchantUrl, cuelinksKnownMerchants } from '../server/affiliate/deeplink';

const DEST = (d: string) => `https://${d}/flights/search?x=1`;

test('base allow-list is tracked and everything else goes direct', () => {
  delete process.env.CUELINKS_EXTRA_MERCHANTS;
  delete process.env.CUELINKS_ALL_MERCHANTS;
  for (const d of ['makemytrip.com', 'goibibo.com', 'shopsy.in']) {
    const url = cuelinksMerchantUrl(DEST(d));
    assert.ok(url && url.startsWith('https://linksredirect.com/?cid='), `${d} must be wrapped`);
  }
  assert.equal(cuelinksMerchantUrl(DEST('in.flightnetwork.com')), null, 'unjoined merchant stays direct');
});

test('CUELINKS_EXTRA_MERCHANTS adds a merchant without a code change', () => {
  process.env.CUELINKS_EXTRA_MERCHANTS = 'www.Cleartrip.com, redbus.in,';
  try {
    assert.ok(cuelinksKnownMerchants().includes('cleartrip.com'), 'www stripped, lowercased');
    assert.ok(cuelinksKnownMerchants().includes('redbus.in'));
    const url = cuelinksMerchantUrl(DEST('cleartrip.com'));
    assert.ok(url && url.startsWith('https://linksredirect.com/?cid='), 'newly joined merchant must be wrapped');
    assert.ok(url!.includes('url=https%3A%2F%2Fcleartrip.com'), 'destination is carried encoded');
  } finally {
    delete process.env.CUELINKS_EXTRA_MERCHANTS;
  }
});

test('CUELINKS_ALL_MERCHANTS wraps any https merchant, still nothing for garbage', () => {
  process.env.CUELINKS_ALL_MERCHANTS = '1';
  try {
    assert.ok(cuelinksMerchantUrl(DEST('in.flightnetwork.com'))?.includes('linksredirect.com'), 'opted-in wrap-all');
    assert.equal(cuelinksMerchantUrl('not-a-url'), null, 'invalid destination is still refused');
  } finally {
    delete process.env.CUELINKS_ALL_MERCHANTS;
  }
});
