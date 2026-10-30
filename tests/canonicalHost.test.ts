import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldRedirectApexToWww, canonicalWwwUrl, isVerificationPath } from '../server/common/canonicalHost';

/**
 * OWNER 30 Oct: "code root pe route hai ya nahi, aur apex 200 deta hai ya nahi."
 * These pin the decision our Express layer makes. The live apex redirect is a
 * Hostinger panel rule (proved by the response: no etag/vary, Hostinger 301 HTML),
 * so this file keeps OUR half provably correct for the day that toggle is off.
 */

test('verification files on the apex are served, never redirected', () => {
  assert.equal(shouldRedirectApexToWww('try1second.com', '/.well-known/assetlinks.json'), false);
  assert.equal(shouldRedirectApexToWww('try1second.com', '/.well-known/apple-app-site-association'), false);
  assert.equal(isVerificationPath('/.well-known/assetlinks.json'), true);
});

test('normal apex traffic still moves onto www (PageSpeed canonical)', () => {
  assert.equal(shouldRedirectApexToWww('try1second.com', '/flights'), true);
  assert.equal(shouldRedirectApexToWww('try1second.com:443', '/'), true);
  assert.equal(canonicalWwwUrl('/flights?x=1'), 'https://www.try1second.com/flights?x=1');
});

test('www and other hosts are never redirected (no loops, no third-party bounce)', () => {
  assert.equal(shouldRedirectApexToWww('www.try1second.com', '/flights'), false);
  assert.equal(shouldRedirectApexToWww('try1second.com.evil.test', '/'), false);
  assert.equal(shouldRedirectApexToWww('', '/'), false);
  assert.equal(shouldRedirectApexToWww(undefined, undefined), false);
});
