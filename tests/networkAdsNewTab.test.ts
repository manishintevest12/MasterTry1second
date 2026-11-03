import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { isExitClick, qualifiesForNewTabAd } from '../src/components/NetworkAdTags';

// OWNER 3 Nov: "jb kissi v vertical pr click krta hoon tho popunder phle khulta hai phir wapas uss
// vertical pr click krna prta hai" - the ad must never take the click that opens a vertical.
test('a vertical click is never treated as an exit, so the ad cannot swallow it', () => {
  assert.equal(isExitClick({ href: '#', hasExitMarker: false }), false);
  assert.equal(isExitClick({ href: '/flights', hasExitMarker: false }), false);
  assert.equal(isExitClick({ href: '/api/out?t=abc', hasExitMarker: false }), true);
  assert.equal(isExitClick({ href: 'https://try1second.com/redirect?k=abc', hasExitMarker: false }), true);
  assert.equal(isExitClick({ href: '/deals', hasExitMarker: true }), true);
  assert.equal(isExitClick({ href: '', hasExitMarker: false }), false);
});

test('the new-tab ad fires at most once, only in a real browser, never on an exit', () => {
  const base = { pathname: '/flights', href: '/hotels' };
  assert.equal(qualifiesForNewTabAd(base), true);
  assert.equal(qualifiesForNewTabAd({ ...base, alreadyShown: true }), false, 'once per session');
  assert.equal(qualifiesForNewTabAd({ ...base, isAppWebView: true }), false, 'never inside the app');
  assert.equal(qualifiesForNewTabAd({ ...base, href: '/api/out?t=x' }), false, 'never on a paid exit');
  assert.equal(qualifiesForNewTabAd({ ...base, hasExitMarker: true }), false);
  assert.equal(qualifiesForNewTabAd({ ...base, modifiedClick: true }), false, 'cmd/ctrl click is the user own new tab');
  assert.equal(qualifiesForNewTabAd({ ...base, pathname: '/admin/ads' }), false);
  assert.equal(qualifiesForNewTabAd({ ...base, pathname: '/api/search' }), false);
});
