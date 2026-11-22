import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * OWNER 22 Nov: "koi mobile website open kre tho seedhe humera play store ka page open ho jaye agar platform android
 * hai tho jiss se humera app download increase ho".
 *
 * The redirect is deliberately aggressive on ONE case (Android phone browser, home page) and deliberately silent
 * everywhere a bounce would cost more than it earns. These tests pin the silence: a crawler must always see the
 * site, and so must our own app and every deep page.
 */

// The module reads navigator/location at call time, so give it a browser-shaped global before importing.
const ua = { value: '' };
const path = { value: '/' };
const define = (name: string, value: unknown) =>
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
define('navigator', { get userAgent() { return ua.value; } });
define('location', { get pathname() { return path.value; } });
const store = new Map<string, string>();
define('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
});
define('sessionStorage', {
  getItem: (k: string) => store.get('s:' + k) ?? null,
  setItem: (k: string, v: string) => void store.set('s:' + k, v),
});

const { shouldRedirectToPlayStore, isAndroidPhone, isCrawler, isHomePath, isWebview, stayOnWebsite } = await import(
  '../src/lib/playStoreRedirect'
);

const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const GOOGLEBOT = 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

const fresh = () => {
  store.clear();
  path.value = '/';
  ua.value = ANDROID;
};

test('an Android phone opening the home page is handed to the Play listing', () => {
  fresh();
  assert.equal(isAndroidPhone(ANDROID), true);
  assert.equal(shouldRedirectToPlayStore({ ua: ANDROID, path: '/', now: 1_000 }), true);
  assert.equal(shouldRedirectToPlayStore({ ua: ANDROID, path: '/index.html', now: 1_000 }), true);
});

test('desktop and iPhone keep the website', () => {
  fresh();
  assert.equal(shouldRedirectToPlayStore({ ua: DESKTOP, path: '/', now: 1_000 }), false);
  assert.equal(shouldRedirectToPlayStore({ ua: IPHONE, path: '/', now: 1_000 }), false);
  assert.equal(isAndroidPhone(IPHONE), false);
});

test('a crawler is NEVER redirected - organic search must keep working', () => {
  fresh();
  assert.equal(isCrawler(GOOGLEBOT), true);
  assert.equal(shouldRedirectToPlayStore({ ua: GOOGLEBOT, path: '/', now: 1_000 }), false);
  for (const bot of ['bingbot/2.0', 'DuckDuckBot/1.1', 'facebookexternalhit/1.1', 'curl/8.4.0', 'HeadlessChrome/131']) {
    assert.equal(isCrawler(bot), true, bot);
  }
});

test('a deep page is what the visitor searched for, so it is served', () => {
  fresh();
  for (const p of ['/product/abc', '/answer/indore-to-bhopal-bus', '/nearby', '/flights']) {
    assert.equal(shouldRedirectToPlayStore({ ua: ANDROID, path: p, now: 1_000 }), false, p);
  }
  assert.equal(isHomePath('/'), true);
  assert.equal(isHomePath('/home'), true);
  assert.equal(isHomePath('/product/abc'), false);
});

test('our own app and staff surfaces are untouched', () => {
  fresh();
  assert.equal(shouldRedirectToPlayStore({ ua: ANDROID + ' Try1Second/1.8.112', path: '/', now: 1_000 }), false);
  for (const p of ['/admin', '/merchant', '/redirect', '/r/abc', '/s/abc']) {
    assert.equal(shouldRedirectToPlayStore({ ua: ANDROID, path: p, now: 1_000 }), false, p);
  }
});

test('an embedded webview (our app, any app) is never sent to the Play listing', () => {
  fresh();
  const WV =
    'Mozilla/5.0 (Linux; Android 14; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36';
  assert.equal(isWebview(WV), true);
  assert.equal(isWebview(ANDROID), false, 'a real Chrome tab has no wv marker');
  assert.equal(shouldRedirectToPlayStore({ ua: WV, path: '/', now: 1_000 }), false);
});

test('once per session, and the opt-out is remembered for 7 days', () => {
  fresh();
  assert.equal(shouldRedirectToPlayStore({ ua: ANDROID, path: '/', now: 1_000 }), true);
  // the boot path marks the session flag
  (globalThis as any).sessionStorage.setItem('t1s_play_redirect_at', '1000');
  assert.equal(shouldRedirectToPlayStore({ ua: ANDROID, path: '/', now: 2_000 }), false, 'Back must not loop');

  fresh();
  stayOnWebsite(1_000);
  assert.equal(shouldRedirectToPlayStore({ ua: ANDROID, path: '/', now: 1_000 + 86_400_000 }), false, 'day 1');
  assert.equal(shouldRedirectToPlayStore({ ua: ANDROID, path: '/', now: 1_000 + 8 * 86_400_000 }), true, 'after 7 days');
});
