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

test('every merchant the owner has applied for is wrapped, and the deep path survives', async () => {
  const { cuelinksMerchantUrl } = await import('../server/affiliate/deeplink');
  // approved today (pays now)
  for (const dest of [
    'https://www.cleartrip.com/hotels/india/indore-hotels',
    'https://www.makemytrip.com/flights/',
    'https://www.goibibo.com/hotels/',
    'https://www.easemytrip.com/hotels/',
    'https://www.nykaa.com/skin/c/8377',
    'https://www.croma.com/mobiles/c/1',
  ]) {
    const u = cuelinksMerchantUrl(dest, 'approved');
    assert.ok(u && u.includes(encodeURIComponent(dest)), `${dest} must be wrapped on the approved tier`);
  }
  // applied/pending (owner 10 Nov: "ajio, myntra wagera tho hai cuelinks pr") - wrapped on the broad tier,
  // which measured as a pure pass-through that keeps the exact deep path
  for (const dest of [
    'https://www.myntra.com/men-tshirts',
    'https://www.ajio.com/s/men-tshirts',
    'https://www.flipkart.com/search?q=shoes',
    'https://www.redbus.in/bus-tickets/indore-to-bhopal',
    'https://in.bookmyshow.com/explore/movies-bengaluru',
    'https://www.bankbazaar.com/personal-loan.html',
  ]) {
    const u = cuelinksMerchantUrl(dest, 'all');
    assert.ok(u && u.includes(encodeURIComponent(dest)), `${dest} must be wrapped with its deep path`);
    assert.equal(cuelinksMerchantUrl(dest, 'approved'), null, `${dest} is not approved yet`);
  }
  // an approved merchant is claimed by the approved tier so a confirmed flat payout is never handed to LinkInR
  assert.ok(cuelinksMerchantUrl('https://www.cleartrip.com/flights', 'approved'));
  // a domain we never applied for stays direct
  assert.equal(cuelinksMerchantUrl('https://www.somedomain-not-joined.com/x', 'all'), null);
});

test('CUELINKS_ONLY_JOINED=1 falls back to the strict approved-only allow-list', async () => {
  const { cuelinksMerchantUrl } = await import('../server/affiliate/deeplink');
  process.env.CUELINKS_ONLY_JOINED = '1';
  try {
    assert.equal(cuelinksMerchantUrl('https://www.myntra.com/men-tshirts', 'all'), null, 'pending merchant skipped in strict mode');
    assert.ok(cuelinksMerchantUrl('https://www.cleartrip.com/hotels', 'all'), 'approved merchant still wrapped');
  } finally {
    delete process.env.CUELINKS_ONLY_JOINED;
  }
});
