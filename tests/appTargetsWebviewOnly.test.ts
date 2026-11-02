import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { keepsWebviewExit, directAppTarget } from '../server/affiliate/appTargets';

/**
 * Owner 2 Nov: a movies exit must open INSIDE the in-app browser (dark header, hidden URL),
 * never in an OS app hop that ends up as a Chrome tab. The hop is emitted by /api/out as an
 * `intent://` URL for Android app webviews, so these hosts must be excluded from it.
 */
test('ticketing exits stay in the in-app browser', () => {
  for (const url of [
    'https://in.bookmyshow.com/movies/IND/indore/buytickets/ET00495822/20261102',
    'https://www.bookmyshow.com/explore/home/indore',
    'https://www.district.in/movies/seat-layout/gogv3dfo2u?fromdate=2026-11-02',
    'https://www.ticketnew.com/indore/movies/udta-teer',
    'https://www.cinepolisindia.com/movies/indore',
    'https://www.cinepolis.com/buy-tickets',
  ]) {
    assert.equal(keepsWebviewExit(url), true, `${url} must open in the app browser`);
  }
});

test('other partner exits keep their app hop', () => {
  for (const url of [
    'https://www.amazon.in/dp/B0CHX1W1XY',
    'https://www.flipkart.com/search?q=iphone',
    'https://www.goindigo.in/flight-booking/booking?from=IDR&to=DEL',
    'https://www.zomato.com/indore/order-food-online',
  ]) {
    assert.equal(keepsWebviewExit(url), false, `${url} should still be able to open its app`);
  }
});

test('malformed or empty destinations are never webview-only by accident', () => {
  assert.equal(keepsWebviewExit(''), false);
  assert.equal(keepsWebviewExit('not a url'), false);
  // A lookalike host must not match.
  assert.equal(keepsWebviewExit('https://bookmyshow.com.evil.example/x'), false);
});

test('EVERY in-app webview exit loads inside the app browser (owner rule 2 Nov)', () => {
  const src = readFileSync(new URL('../server/api/routes.ts', import.meta.url), 'utf8');
  const start = src.indexOf("if (isInAppWebView(req.headers['user-agent'])) {");
  assert.ok(start > 0, 'the webview branch must exist in /api/out');
  const raw = src.slice(start, src.indexOf('\n  }', start));
  // Strip comments: the explanation legitimately NAMES the old intent:// url.
  const block = raw.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  // No OS app hop may survive on the webview path: that is what opened Chrome.
  assert.doesNotMatch(block, /intent:\/\//, 'the webview branch must never build an intent:// url');
  assert.doesNotMatch(block, /androidIntentUrl/, 'the webview branch must not hand off to the OS');
  assert.match(block, /res\.redirect\(302, dl\.trackingUrl\)/,
    'the webview must load the tracked https URL directly, so it stays in our own browser');
});

test('the interstitial one-tap app hop skips ticketing partners only', () => {
  const src = readFileSync(new URL('../server/api/routes.ts', import.meta.url), 'utf8');
  // Browser users (not our app) still get the optional one-tap app hop, minus ticketing.
  assert.match(src, /!keepsWebviewExit\(freshDestination\)\) \{\s*\n\s*appIntent = androidIntentUrl\(direct, dl\.trackingUrl\)/);
});

test('every webview-only host is also a known app target', () => {
  assert.ok(directAppTarget('https://in.bookmyshow.com/x'), 'BookMyShow must still be a known partner');
  assert.ok(directAppTarget('https://www.district.in/x'));
});
