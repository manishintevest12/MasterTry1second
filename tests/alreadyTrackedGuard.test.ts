import test from 'node:test';
import assert from 'node:assert/strict';
import { looksAlreadyTracked } from '../server/affiliate/deeplink';

// Owner 27 Oct: a manual finance entry can carry its own affiliate link. Re-converting
// it (Amazon tag / Cuelinks / Ekaro) would double-wrap and lose the apply page.
test('already-monetized tracking hosts are recognised', () => {
  for (const u of [
    'https://linksredirect.com/?cid=1&url=x',
    'https://ekaro-api.affiliaters.in/api/converter',
    'https://links.earnkaro.com/xyz',
    'https://fktr.in/abc',
    'https://myntr.it/abc',
    'https://bitli.in/abc',
    'https://amzn.to/3xyz',
    'https://www.vcommission.com/track?url=x',
    'https://go.redirectingat.com/?id=1',
  ]) assert.equal(looksAlreadyTracked(u), true, u);
});

test('real merchant pages are NOT treated as tracked', () => {
  for (const u of [
    'https://www.hdfcbank.com/personal/loan',
    'https://www.policybazaar.com/health-insurance',
    'https://www.amazon.in/dp/B0ABCDE',
    'https://www.flipkart.com/x',
  ]) assert.equal(looksAlreadyTracked(u), false, u);
});

test('a malformed link never throws', () => {
  assert.equal(looksAlreadyTracked('not a url'), false);
  assert.equal(looksAlreadyTracked(''), false);
});
