/**
 * "This link couldn't be verified" regression (owner 28 Oct, screenshot of the exit page:
 * "redirection ke baad jaha v aisa aa raha hai, usko fix kro").
 *
 * The exit interstitial re-ran the *untrusted destination* heuristic on a signature-verified
 * token, so our own affiliate hops (CJ/Myntra `?url=`, LinkInR, EarnKaro) were refused after
 * the redirect. These tests pin both halves: trusted network hops open, untrusted ones don't.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDestination } from '../server/affiliate/affiliateNetwork';
import { createInterstitialPointer, resolveInterstitialMeta } from '../server/redirect/interstitial';

const myntraCJ = 'https://www.dpbolvw.net/click-101523230-17095162?url=https%3A%2F%2Fwww.myntra.com%2Fshoes';
const cuelinks = 'https://linksredirect.com/?cid=123&subid=abc&url=https%3A%2F%2Fwww.flipkart.com%2Fp%2Fitm';
const unverified = 'https://random-shop.example/phish?url=https%3A%2F%2Fevil.example%2Fsteal';

test('our own CJ / Myntra click hop is not refused any more', () => {
  const check = validateDestination(myntraCJ);
  assert.equal(check.valid, true, check.reason);
});

test('every converter we mint ourselves is exempt from the embedded-redirect rule', () => {
  for (const url of [
    myntraCJ,
    cuelinks,
    'https://www.tkqlhce.com/click-1-2?url=https%3A%2F%2Fwww.ajio.com%2Fp%2F1',
    'https://www.anrdoezrs.net/click-1-2?url=https%3A%2F%2Fx.com',
    'https://linkinr.com/abc?url=https%3A%2F%2Fwww.jiomart.com%2Fp',
    'https://fktr.in/xyz',
    'https://myntr.it/abc',
  ]) {
    assert.equal(validateDestination(url).valid, true, url);
  }
});

test('a destination we do NOT own still cannot smuggle an off-host redirect', () => {
  const check = validateDestination(unverified);
  assert.equal(check.valid, false);
  assert.match(String(check.reason), /embedded redirect/i);
});

test('scheme and host sanity are untouched by the fix', () => {
  assert.equal(validateDestination('javascript:alert(1)').valid, false);
  assert.equal(validateDestination('file:///etc/passwd').valid, false);
  assert.equal(validateDestination('https://localhost/x').valid, false);
  assert.equal(validateDestination('not a url').valid, false);
});

test('the signed interstitial token carries the converter URL through verification', () => {
  const token = createInterstitialPointer(myntraCJ, 'myntra.com', null);
  const meta = resolveInterstitialMeta(token);
  assert.ok(meta, 'token must verify');
  assert.equal(meta!.url, myntraCJ);
  // What /redirect now does: the token is ours, so only schemes/hosts are re-checked.
  assert.equal(validateDestination(meta!.url, { allowEmbeddedRedirect: true }).valid, true);
});

test('an unsigned/tampered token is still rejected outright', () => {
  const token = createInterstitialPointer(myntraCJ, 'myntra.com', null);
  const tampered = token.slice(0, -4) + 'AAAA';
  assert.equal(resolveInterstitialMeta(tampered), null);
});
