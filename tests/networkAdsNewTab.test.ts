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

// OWNER 9 Nov: "popunder ko aisa fix kro ki wo new window mai khule, tab pr ni ... user ko humesa apna
// site dikhe jb tk ki wo khud ni jata". The network popunder is deleted, not merely disabled: its
// script (abscloud) binds the first click and navigates the CURRENT tab, so no switch can make it safe.
test('the network popunder is gone from the web bundle source', async () => {
  const fs = await import('node:fs');
  // Comments explain the history ("the popunder is gone"); only CODE must be clean.
  const raw = fs.readFileSync('src/components/NetworkAdTags.tsx', 'utf8');
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.equal(/abscloud\.org/.test(src), false, 'no popunder script URL');
  assert.equal(/Popunder_1|useSitePopunder|POPUNDER_SCRIPT|VITE_T1S_POPUNDER/.test(src), false, 'no popunder loader');
  const app = fs.readFileSync('src/App.tsx', 'utf8');
  assert.equal(/useSitePopunder/.test(app), false, 'the popunder hook is not mounted');
  assert.equal(/useNewTabAd\s*\(/.test(app), true, 'the controlled new-tab ad is mounted');
});

test('the only ad hop opens a BACKGROUND tab and never navigates the current one', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync('src/components/NetworkAdTags.tsx', 'utf8');
  assert.match(src, /window\.open\(SMARTLINK_URL, '_blank'\)/, 'opens in a new tab/window');
  assert.equal(/window\.location\s*=|location\.href\s*=/.test(src), false, 'never touches our own URL');
  assert.equal(/preventDefault\(/.test(src), false, 'never swallows the click it rides on');
});
