import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isMobileBrowser, isOurAppWebview, isExcludedPath, shouldOfferApp, dismissAppEntry, markAppEntryShown,
  PLAY_STORE_URL,
} from '../src/lib/appEntry';

/**
 * OWNER 19 Nov growth brief: "non-intrusive mobile web-to-app entry points that respect user experience and
 * page speed." These tests pin the restraint: a banner that nags is worse than no banner.
 */

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
const APP_WEBVIEW = 'Try1Second/1.8.105+112 (Android; app; +https://try1second.com)';

/** Minimal localStorage/sessionStorage/location stubs so the gate can be exercised outside a browser. */
function stubStorage(opts: { dismissedAt?: number; shown?: boolean } = {}) {
  const store: Record<string, string> = {};
  if (opts.dismissedAt) store['t1s_app_entry_dismissed_at'] = String(opts.dismissedAt);
  if (opts.shown) store['t1s_app_entry_shown_at'] = '1';
  (globalThis as any).localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v; },
  };
  (globalThis as any).sessionStorage = {
    getItem: (k: string) => (k === 't1s_app_entry_shown_at' && opts.shown ? '1' : null),
    setItem: () => undefined,
  };
  (globalThis as any).location = { pathname: '/movies' };
  // Node exposes `navigator` as a getter-only global, so it is redefined rather than assigned.
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: ANDROID }, configurable: true, writable: true });
  return store;
}

test('a phone browser qualifies, desktop and the app webview never do', () => {
  assert.equal(isMobileBrowser(ANDROID), true);
  assert.equal(isMobileBrowser(DESKTOP), false);
  assert.equal(isMobileBrowser(APP_WEBVIEW), false, 'the app must not be told to install itself');
  assert.equal(isOurAppWebview(APP_WEBVIEW), true);
});

test('staff and share surfaces are excluded', () => {
  assert.equal(isExcludedPath('/admin'), true);
  assert.equal(isExcludedPath('/admin/funnel'), true);
  assert.equal(isExcludedPath('/merchant'), true);
  assert.equal(isExcludedPath('/r/T1S-AB12CD'), true);
  assert.equal(isExcludedPath('/s/abc.def'), true);
  assert.equal(isExcludedPath('/movies'), false);
  assert.equal(isExcludedPath('/'), false);
});

test('the bar appears on a phone at the results screen', () => {
  stubStorage();
  assert.equal(shouldOfferApp(Date.now()), true);
});

test('a dismissal keeps it quiet for 30 days, then it may ask again', () => {
  const now = Date.now();
  stubStorage({ dismissedAt: now - 5 * 86_400_000 });
  assert.equal(shouldOfferApp(now), false, 'dismissed five days ago');
  stubStorage({ dismissedAt: now - 31 * 86_400_000 });
  assert.equal(shouldOfferApp(now), true, 'the cooldown expired');
});

test('one impression per session, never twice', () => {
  stubStorage({ shown: true });
  assert.equal(shouldOfferApp(Date.now()), false);
});

test('desktop and admin pages stay clean even with storage available', () => {
  stubStorage();
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: DESKTOP }, configurable: true, writable: true });
  assert.equal(shouldOfferApp(Date.now()), false);
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: ANDROID }, configurable: true, writable: true });
  (globalThis as any).location = { pathname: '/admin' };
  assert.equal(shouldOfferApp(Date.now()), false);
});

test('dismissing writes the cooldown, showing writes the session mark', () => {
  const store = stubStorage();
  const now = Date.now();
  dismissAppEntry(now);
  assert.equal(store['t1s_app_entry_dismissed_at'], String(now));
  assert.equal(shouldOfferApp(now), false);
  markAppEntryShown(now);
});

test('the CTA is the real Play listing, not a placeholder', () => {
  assert.match(PLAY_STORE_URL, /^https:\/\/play\.google\.com\/store\/apps\/details\?id=com\.try1second\.try1second$/);
});
