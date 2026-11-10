/**
 * OWNER 10 Nov: "booking.com ka deeplink, evergreen wala link hai isko add kro jiss se booking.com pr
 * deeplink ho ske" - CJ click link https://www.dpbolvw.net/click-101903513-17293139.
 *
 * Verified live before wiring: that URL + ?url=<destination> walks dpbolvw.net -> cj.dotomi.com ->
 * emjcd.com and lands on the exact Booking.com property page with aid=8133105 and
 * label=affnetcj-17293139_pub-8098022_site-101903513. So the template below preserves the deep page,
 * not just the homepage.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { affiliateNetworkFor, cuelinksMerchantUrl } from '../server/affiliate/deeplink';

const SRC = readFileSync(new URL('../server/affiliate/deeplink.ts', import.meta.url), 'utf8');

test('Booking.com and all its subdomains route to CJ (evergreen link)', () => {
  for (const d of ['booking.com', 'www.booking.com', 'hotels.booking.com', 'secure.booking.com']) {
    assert.equal(affiliateNetworkFor(d), 'cj', `${d} must be paid through CJ`);
  }
});

test('look-alike domains never get the CJ link', () => {
  assert.equal(affiliateNetworkFor('notbooking.com'), null);
  assert.equal(affiliateNetworkFor('booking.com.evil.io'), null);
});

test('the CB is the exact owner link with {DESTINATION}, https only', () => {
  assert.match(SRC, /'booking\.com': 'https:\/\/www\.dpbolvw\.net\/click-101903513-17293139\?url=\{DESTINATION\}'/);
  const line = SRC.split('\n').find((l) => l.includes("'booking.com':") && l.includes('dpbolvw.net'))!;
  assert.ok(!line.includes('http://'), 'never plain http');
  assert.ok(line.includes('{DESTINATION}'), 'must carry the destination placeholder');
});

test('Cuelinks no longer claims Booking.com, so the click is attributed once', () => {
  assert.equal(cuelinksMerchantUrl('https://www.booking.com/hotel/in/x.html'), null);
});

test('CJ is its own layer, extendable by env for further CJ merchants', () => {
  assert.match(SRC, /network: 'cj', merchantsEnv: 'CJ_MERCHANTS', templateEnv: 'CJ_LINK_TEMPLATE'/);
});
