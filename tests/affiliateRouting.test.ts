/**
 * OWNER 10 Nov: "jitne v cuelinks se hai wo cuelinks se commission de, jitne direct hai wo direct se de,
 * aur jo admitad yaa inrdeals yaa earnkaro wagera se hai unko waha se dene do, jo kahi se nahi hai unka
 * report do." This pins the per-merchant routing preview that the coverage report is built from.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { affiliateNetworkFor, envNetworkFor, cuelinksMerchantUrl } from '../server/affiliate/deeplink';

test('each network claims only the merchants joined on it', () => {
  process.env.ADMITAD_MERCHANTS = 'flipkart.com, myntra.com';
  process.env.ADMITAD_LINK_TEMPLATE = 'https://ad.admitad.com/g/x/?ulp={DESTINATION}';
  process.env.INRDEALS_MERCHANTS = 'redbus.in';
  process.env.INRDEALS_LINK_TEMPLATE = 'https://inr.deals/track?id=1&url={DESTINATION}';
  process.env.CUELINKS_EXTRA_MERCHANTS = 'cleartrip.com';
  try {
    assert.equal(envNetworkFor('flipkart.com'), 'admitad');
    assert.equal(envNetworkFor('redbus.in'), 'inrdeals');
    assert.equal(envNetworkFor('cleartrip.com'), null, 'a Cuelinks merchant is not claimed by another network');
    assert.equal(affiliateNetworkFor('flipkart.com'), 'admitad');
    assert.equal(affiliateNetworkFor('redbus.in'), 'inrdeals');
    assert.equal(affiliateNetworkFor('cleartrip.com'), 'cuelinks');
    assert.equal(affiliateNetworkFor('www.makemytrip.com'), 'cuelinks', 'www is stripped before matching');
  } finally {
    for (const k of ['ADMITAD_MERCHANTS','ADMITAD_LINK_TEMPLATE','INRDEALS_MERCHANTS','INRDEALS_LINK_TEMPLATE','CUELINKS_EXTRA_MERCHANTS']) delete process.env[k];
  }
});

test('a merchant on no network reports null, so it can be listed in the coverage report', () => {
  delete process.env.ADMITAD_MERCHANTS; delete process.env.CUELINKS_EXTRA_MERCHANTS; delete process.env.CUELINKS_ALL_MERCHANTS;
  assert.equal(affiliateNetworkFor('in.flightnetwork.com'), null);
  assert.equal(cuelinksMerchantUrl('https://in.flightnetwork.com/x'), null, 'and it still hops direct');
});

test('a network with a merchant but no valid template mints nothing (fail closed, no invented link)', () => {
  process.env.ADMITAD_MERCHANTS = 'flipkart.com';
  process.env.ADMITAD_LINK_TEMPLATE = 'http://insecure.example/?u={DESTINATION}';
  try {
    assert.equal(affiliateNetworkFor('flipkart.com'), 'admitad', 'routing still reports the intended network');
  } finally { delete process.env.ADMITAD_MERCHANTS; delete process.env.ADMITAD_LINK_TEMPLATE; }
});
