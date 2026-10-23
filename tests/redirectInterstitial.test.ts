/**
 * Monetizable /redirect interstitial (owner 23 Oct): signed-token exit page
 * between /api/out and the merchant — security model + AdSense policy rules.
 * Plain node:test + tsx, in-process (no live sources), like the rest of the suite.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import process from 'process';

process.env.NODE_ENV = 'test';

test('interstitial pointer: create -> resolve roundtrip keeps the exact URL', async () => {
  const { createInterstitialPointer, resolveInterstitialMeta } = await import('../server/redirect/interstitial');
  const url = 'https://www.flipkart.com/apple-iphone-15/p/itm?pid=MOBENG4H4FYFSZHD&affid=try1second';
  const k = createInterstitialPointer(url, 'flipkart.com');
  assert.ok(k && k.length > 20);
  assert.ok(!k.includes('flipkart'), 'the destination stays masked in the token');
  assert.equal(resolveInterstitialMeta(k)?.url, url);
  assert.equal(resolveInterstitialMeta(k)?.partner, 'flipkart.com', 'partner display name carried through');
});

test('interstitial pointer: tampered or malformed tokens are refused', async () => {
  const { createInterstitialPointer, resolveInterstitialMeta } = await import('../server/redirect/interstitial');
  const k = createInterstitialPointer('https://www.zomato.com/indore/restaurants');
  const [payload] = k.split('.');
  assert.equal(resolveInterstitialMeta(`${payload}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`), null, 'bad signature refused');
  assert.equal(resolveInterstitialMeta(''), null);
  assert.equal(resolveInterstitialMeta('not-a-token'), null);
  assert.equal(resolveInterstitialMeta(k.replace(/./g, c => c === 'a' ? 'b' : c)), null, 'mutated payload refused');
});

test('interstitial pointer: expired tokens are refused (10-minute lifetime)', async () => {
  const { resolveInterstitialMeta } = await import('../server/redirect/interstitial');
  const crypto = await import('crypto');
  // Replicate the derivation (env unset in tests -> stable fallback secret).
  const secret = crypto.createHash('sha256').update('try1second#affiliate-pointer').digest('hex');
  const payload = Buffer.from(JSON.stringify({ d: 'https://www.ola.com/ride', e: Date.now() - 1000 }), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url').slice(0, 32);
  assert.equal(resolveInterstitialMeta(`${payload}.${sig}`), null, 'expired refused');
});

test('interstitial page: copy, countdown and masked-JS embed render per spec', async () => {
  const { renderInterstitialPage } = await import('../server/redirect/interstitial');
  const html = renderInterstitialPage({ targetUrl: 'https://www.blinkit.com/s/prd/puri' });
  assert.ok(html.includes('Connecting to the cheapest store...'), 'owner-specified copy');
  assert.ok(html.includes('blinkit.com'), 'store host shown');
  assert.ok(html.includes('>4<'), '4-second countdown starts at 4');
  assert.ok(html.includes('"https://www.blinkit.com/s/prd/puri"'), 'decoded URL passed to the view');
  assert.ok(html.includes('window.location.replace(target)'), 'auto-redirects at 0');
  assert.ok(!html.includes('adsbygoogle'), 'no AdSense unit when the slot is not configured (no fabrication)');

  // Owner 23 Oct: affiliate converter domains never surface — the page shows
  // ONLY "Try1Second redirecting to <partner> site".
  const masked = renderInterstitialPage({
    targetUrl: 'https://linkinr.com/click?campaign_id=123&url=https%3A%2F%2Fwww.agoda.com%2Fhotels',
    partner: 'agoda.com',
  });
  assert.ok(masked.includes('Try1Second redirecting to agoda.com site'), 'requested sentence shown');
  // The hop URL must (of course) stay inside href/script targets so the
  // redirect works — but NO user-visible label may name it. Strip attributes
  // and the script block, then require the hop domain to be gone from copy.
  const visibleCopy = masked
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<noscript>[\s\S]*?<\/noscript>/g, '')
    .replace(/\shref="[^"]*"/g, '')
    .replace(/\srel="[^"]*"/g, '');
  assert.ok(!visibleCopy.includes('linkinr.com'), 'affiliate hop domain hidden from every visible label');
  assert.ok(masked.includes('Sit tight — agoda.com is opening'), 'partner name in the sub-headline');
  // legacy token (no partner) still degrades honestly to the target host
  const legacy = renderInterstitialPage({ targetUrl: 'https://www.blinkit.com/s/prd/puri' });
  assert.ok(legacy.includes('blinkit.com'), 'legacy tokens fall back to the target host');
});

test('interstitial page: configured AdSense slot renders a standard compliant unit above the fold', async () => {
  const { renderInterstitialPage } = await import('../server/redirect/interstitial');
  const html = renderInterstitialPage({
    targetUrl: 'https://www.flipkart.com/x',
    adSlot: { provider: 'adsense', adsense_client: 'ca-pub-1234567890123456', adsense_slot: '9876543210' },
  });
  assert.ok(html.includes('data-ad-client="ca-pub-1234567890123456"'));
  assert.ok(html.includes('data-ad-slot="9876543210"'));
  assert.ok(html.includes('data-full-width-responsive="true"'), 'responsive unit');
  assert.ok(html.includes('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'), 'standard AdSense loader');
  const adPos = html.indexOf('class="ad-wrap"');
  const goPos = html.indexOf('id="go"');
  assert.ok(adPos > -1 && goPos > adPos, 'ad sits above the manual exit button (above the fold)');
  assert.ok(html.includes('rel="nofollow noopener"'), 'exit link never passes ranking juice');
});

test('interstitial page: XSS payloads in the URL are escaped in every embed', async () => {
  const { renderInterstitialPage } = await import('../server/redirect/interstitial');
  const evil = 'https://example.com/a?x="></script><script>alert(1)</script>';
  const html = renderInterstitialPage({ targetUrl: evil });
  assert.ok(!html.includes('</script><script>alert(1)'), 'raw script payload never lands in the HTML');
  assert.ok(html.includes('u003c'), 'JS embeds escape < as unicode so a script tag can never break out');
});

test('webview detection: our app + stock Android webview skip the interstitial, desktop browsers do not', async () => {
  const { isInAppWebView } = await import('../server/redirect/interstitial');
  assert.equal(isInAppWebView('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/128 Mobile Safari/537.36 Try1SecondApp/1.8'), true, 'our Flutter app UA');
  assert.equal(isInAppWebView('Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/128 Mobile Safari/537.36 wv)'), true, 'Android system WebView marker');
  assert.equal(isInAppWebView('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36'), false, 'desktop browser');
  assert.equal(isInAppWebView('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'), false, 'mobile Safari (real browser)');
  assert.equal(isInAppWebView(undefined), false);
});

// ---- route handler: missing / malformed / expired / refused tokens ----
type Sent = { status: number; body: string };
function fakeRes(): { res: any; sent: Promise<Sent> } {
  let resolve!: (v: Sent) => void;
  const sent = new Promise<Sent>(r => { resolve = r; });
  const res: any = {
    setHeader() {}, status(code: number) { this._c = code; return this; },
    type() { return this; },
    send(body: string) { resolve({ status: this._c ?? 200, body }); return this; },
    _c: undefined as number | undefined,
  };
  return { res, sent };
}

test('route handler: missing token -> 400 honest page, never a stack trace', async () => {
  const { redirectRouteHandler } = await import('../server/redirect/interstitial');
  const { res, sent } = fakeRes();
  await redirectRouteHandler({ query: {} } as any, res);
  const out = await sent;
  assert.equal(out.status, 400);
  assert.ok(out.body.includes('No destination in this link'));
});

test('route handler: malformed token -> 410 expired-style honest page', async () => {
  const { redirectRouteHandler } = await import('../server/redirect/interstitial');
  const { res, sent } = fakeRes();
  await redirectRouteHandler({ query: { k: 'garbage.token' } } as any, res);
  const out = await sent;
  assert.equal(out.status, 410);
  assert.ok(out.body.includes('expired'));
});

test('route handler: valid token -> 200 page with the decoded URL + noindex headers', async () => {
  const { redirectRouteHandler, createInterstitialPointer } = await import('../server/redirect/interstitial');
  const k = createInterstitialPointer('https://www.goibibo.com/hotels/oyo-indore-1234/');
  const headers: Record<string, string> = {};
  let resolve!: (v: Sent) => void;
  const sent = new Promise<Sent>(r => { resolve = r; });
  const res: any = {
    setHeader(n: string, v: string) { headers[n] = v; },
    status(c: number) { this._c = c; return this; },
    type() { return this; },
    send(body: string) { resolve({ status: this._c ?? 200, body }); return this; },
    _c: undefined as number | undefined,
  };
  await redirectRouteHandler({ query: { k } } as any, res);
  const out = await sent;
  assert.equal(out.status, 200);
  assert.ok(out.body.includes('Connecting to the cheapest store...'));
  assert.ok(out.body.includes('goibibo.com'));
  assert.equal(headers['X-Robots-Tag'], 'noindex, nofollow');
  assert.equal(headers['Cache-Control'], 'no-store, must-revalidate');
});

test('route handler: a token holding a non-http(s) destination is refused (anti open-redirect)', async () => {
  const { redirectRouteHandler, createInterstitialPointer } = await import('../server/redirect/interstitial');
  const k = createInterstitialPointer('javascript:alert(1)');
  const { res, sent } = fakeRes();
  await redirectRouteHandler({ query: { k } } as any, res);
  const out = await sent;
  assert.equal(out.status, 400);
  assert.ok(out.body.includes("couldn\u2019t be verified") || out.body.includes('verified'));
});
