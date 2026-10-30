import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appTargetFor, directAppTarget, androidIntentUrl, isAndroid, appHandlesIntents, appBuildMarker,
} from '../server/affiliate/appTargets';
import { createInterstitialPointer, resolveInterstitialMeta, renderInterstitialPage } from '../server/redirect/interstitial';

/**
 * OWNER 30 Oct: "har partner app installed ho to seedha app mein khule, warna browser."
 * These pin the two rules that make that safe:
 *  1. an app hop only happens on the partner's OWN host (converter hops must stay in the
 *     browser, otherwise the affiliate redirect chain is skipped and the commission lost),
 *  2. the intent always carries the paid URL as browser_fallback_url, so a missing app
 *     changes where the page opens, never whether we get paid.
 */

test('every vertical has at least one verified partner app target', () => {
  const urls: Record<string, string> = {
    flights: 'https://www.goindigo.in/booking',
    hotels: 'https://www.agoda.com/hotel',
    bus: 'https://www.redbus.in/bus-tickets',
    cabs: 'https://m.uber.com/go/product',
    movie: 'https://in.bookmyshow.com/movies',
    ecommerce: 'https://www.flipkart.com/product/p/itm123',
    grocery: 'https://blinkit.com/prn/milk',
    food: 'https://www.swiggy.com/restaurants/x',
    loans: 'https://www.paisabazaar.com/personal-loan/',
    insurance: 'https://www.acko.com/car-insurance/',
    banking: 'https://www.hdfcbank.com/personal',
  };
  for (const [vertical, url] of Object.entries(urls)) {
    const t = directAppTarget(url);
    assert.ok(t, `${vertical} must resolve a partner app`);
    assert.match(t!.pkg, /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/i, `${vertical} package looks like an app id`);
  }
});

test('affiliate converter hops never trigger an app launch', () => {
  assert.equal(directAppTarget('https://linkinr.com/abc?u=https%3A%2F%2Fflipkart.com'), null);
  assert.equal(directAppTarget('https://fktr.in/abc'), null);
  assert.equal(directAppTarget('https://cuelinks.com/x'), null);
  // ...but the interstitial may still NAME the partner for display purposes.
  assert.equal(appTargetFor('https://linkinr.com/abc', 'Flipkart')?.pkg, 'com.flipkart.android');
});

test('intent URL carries the package and our tracked URL as the fallback', () => {
  const target = { label: 'Flipkart', pkg: 'com.flipkart.android' };
  const paid = 'https://linkinr.com/track?u=abc&v=1';
  const intent = androidIntentUrl(target, paid);
  assert.ok(intent.startsWith('intent://linkinr.com/track?u=abc&v=1#Intent;'));
  assert.match(intent, /package=com\.flipkart\.android/);
  assert.match(intent, /S\.browser_fallback_url=https%3A%2F%2Flinkinr\.com%2Ftrack%3Fu%3Dabc%26v%3D1/);
  assert.ok(intent.endsWith(';end'));
});

test('only Android + builds that forward intent:// get the intent hop', () => {
  assert.equal(isAndroid('Mozilla/5.0 (Linux; Android 14)'), true);
  assert.equal(isAndroid('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)'), false);
  const oldApp = 'Mozilla/5.0 (Linux; Android 14) Chrome/128 Mobile Try1SecondApp/1.8';
  const newApp = 'Mozilla/5.0 (Linux; Android 14) Chrome/128 Mobile Try1SecondApp/1.9';
  assert.equal(appBuildMarker(oldApp), '1.8');
  assert.equal(appHandlesIntents(oldApp), false, '1.8 blocks non-http navigations in its webview');
  assert.equal(appHandlesIntents(newApp), true);
  assert.equal(appHandlesIntents('Mozilla/5.0 (Linux; Android 14) Chrome/128 Mobile'), false);
});

test('interstitial: tap-to-app button present, countdown and AdSense untouched', () => {
  const paid = 'https://linkinr.com/track?u=abc';
  const intent = androidIntentUrl({ label: 'Myntra', pkg: 'com.myntra.android' }, paid);
  const token = createInterstitialPointer(paid, 'myntra.com', null, intent);
  const meta = resolveInterstitialMeta(token);
  assert.ok(meta);
  assert.equal(meta!.appIntent, intent);

  const html = renderInterstitialPage({
    targetUrl: paid,
    partner: 'myntra.com',
    appIntent: meta!.appIntent,
    adSlot: { provider: 'adsense', adsense_client: 'ca-pub-123', adsense_slot: '456' },
  });
  assert.match(html, /Open in the app/);
  assert.ok(html.includes('href="intent://'), 'button must carry the intent');
  assert.match(html, /adsbygoogle/, 'AdSense unit still renders on the exit page');
  assert.match(html, /window\.location\.replace\(target\)/, 'countdown still forwards to the paid URL');
  assert.match(html, /id="n"/, 'countdown ring present');
});

test('interstitial without an intent keeps the old single-button page', () => {
  const html = renderInterstitialPage({ targetUrl: 'https://www.agoda.com/x', partner: 'agoda.com' });
  assert.doesNotMatch(html, /Open in the app/);
  assert.match(html, /Go now/);
});
