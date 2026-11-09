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
  assert.equal(/<SponsoredSmartlink/.test(app), true, 'the labelled partner link is mounted');
  assert.equal(/useNewTabAd\s*\(/.test(app), false, 'no automatic ad trigger is mounted any more');
});

// OWNER 9 Nov, second round ("popunder hata do aisa lg raha hai jaise malware hai iski jagah smartlink
// rkho"): the background tab fired on the user's FIRST ORDINARY CLICK, which is a popunder from the
// user's side. That trigger is deleted; the smartlink is a labelled <a> the user taps.
test('the smartlink is a labelled link, not a click listener that fires on any click', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync('src/components/NetworkAdTags.tsx', 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.equal(/document\.addEventListener\('click'/.test(code), false, 'no global click hook');
  assert.equal(/window\.open\(/.test(code), false, 'nothing opens a window behind the user');
  assert.equal(/window\.location\s*=|location\.href\s*=/.test(code), false, 'never touches our own URL');
  assert.match(code, /target="_blank"/, 'the user tap opens a new tab');
  assert.match(code, /rel="sponsored noopener noreferrer"/, 'labelled sponsored, opener severed');
  assert.equal(/preventDefault\(/.test(code), false, 'never swallows a click');
});
