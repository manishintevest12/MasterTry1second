/**
 * Cab in-app booking deep links (owner 22 Oct): Uber "looking" format with
 * pickup/drop JSON (owner-supplied spec), my_location fallback, Ola book URL,
 * and admin affiliate param injection with sanitization.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildUberBookUrl, buildOlaBookUrl, buildUberAppSchemeUrl, buildOlaAppSchemeUrl, cabWebUrlToAppScheme, type CabDeeplinkConfig } from '../server/common/cabDeeplink';

const cfg = (over: Partial<CabDeeplinkConfig> = {}): CabDeeplinkConfig => ({
  uberClientId: 'test-client-1',
  uberExtraParams: 'utm_source=try1second&utm_medium=cab',
  olaExtraParams: 'utm_source=try1second',
  uberEnabled: true,
  olaEnabled: true,
  rapidoBaseUrl: 'https://rapido.cc/ride',
  rapidoExtraParams: '',
  rapidoEnabled: true,
  ...over,
});

const drop = { lat: 28.5355, lng: 77.391, name: 'Noida Sector 18' };
const pickup = { lat: 28.6139, lng: 77.209, name: 'Connaught Place' };

test('uber: owner-specified m.uber.com/looking format with JSON pickup + drop + affiliate', () => {
  const url = buildUberBookUrl({ cfg: cfg(), pickup, drop })!;
  assert.ok(url.startsWith('https://m.uber.com/looking/?client_id=test-client-1&'));
  assert.ok(url.includes(`pickup=${encodeURIComponent(JSON.stringify({ latitude: 28.6139, longitude: 77.209, addressLine1: 'Connaught Place' }))}`));
  assert.ok(url.includes(`drop[0]=${encodeURIComponent(JSON.stringify({ latitude: 28.5355, longitude: 77.391, addressLine1: 'Noida Sector 18' }))}`));
  assert.ok(url.includes('utm_source=try1second'), 'affiliate params appended');
});

test('uber: pickup=my_location fallback when pickup coords unknown (owner spec)', () => {
  const url = buildUberBookUrl({ cfg: cfg(), pickup: null, drop })!;
  assert.ok(url.includes('pickup=my_location'));
});

test('uber: admin affiliate params appended, malformed entries dropped', () => {
  const url = buildUberBookUrl({ cfg: cfg({ uberExtraParams: 'sub_id=abc123&===bad&javascript:alert(1)' }), pickup, drop })!;
  assert.ok(url.includes('sub_id=abc123'));
  assert.ok(!url.includes('javascript'));
  assert.ok(!url.includes('bad'), 'malformed pair dropped');
});

test('uber: client_id omitted when admin has not set one', () => {
  const url = buildUberBookUrl({ cfg: cfg({ uberClientId: '' }), pickup, drop })!;
  assert.ok(!url.includes('client_id='));
});

test('disabled providers return null (honest, never a dead link)', () => {
  assert.equal(buildUberBookUrl({ cfg: cfg({ uberEnabled: false }), pickup, drop }), null);
  assert.equal(buildOlaBookUrl({ cfg: cfg({ olaEnabled: false }), pickup, drop }), null);
});

test('ola: book.olacabs.com deep link with coords + name + affiliate', () => {
  const url = buildOlaBookUrl({ cfg: cfg(), pickup, drop })!;
  assert.ok(url.startsWith('https://book.olacabs.com/?'));
  assert.ok(url.includes('lat=28.6139'));
  assert.ok(url.includes('drop_lat=28.5355'));
  assert.ok(url.includes('drop_name=Noida'));
  assert.ok(url.includes('utm_source=try1second'));
});

test('network layer: LinkInR must not claim prefilled cab booking links (trip would be lost)', async () => {
  const { buildSecureDeeplink } = await import('../server/affiliate/deeplink');
  const r = await buildSecureDeeplink('https://m.uber.com/looking/?pickup=my_location&drop[0]=%7B%22latitude%22%3A28.5355%7D&utm_source=try1second');
  assert.equal(r.matchedProfile, 'direct', `expected direct, got ${r.matchedProfile}`);
  assert.ok(r.trackingUrl.startsWith('https://m.uber.com/looking/'), r.trackingUrl);
  const r2 = await buildSecureDeeplink('https://book.olacabs.com/?lat=28.6&lng=77.2&drop_lat=28.5&drop_lng=77.3&utm_source=try1second');
  assert.equal(r2.matchedProfile, 'direct');
});

test('Rapido: /api/cab/book?provider=rapido 302s straight to the admin link, no coordinates needed', async () => {
  const { buildRapidoBookUrl } = await import('../server/common/cabDeeplink');
  const { getCabDeeplinkConfig } = await import('../server/common/cabDeeplink');
  const cfg = await getCabDeeplinkConfig();
  assert.equal(buildRapidoBookUrl({ cfg }), 'https://rapido.cc/ride');
  assert.equal(buildRapidoBookUrl({ cfg: { ...cfg, rapidoExtraParams: 'utm_source=t1s&sub_ id=x' } }), 'https://rapido.cc/ride?utm_source=t1s', 'malformed pair dropped');
  assert.equal(buildRapidoBookUrl({ cfg: { ...cfg, rapidoEnabled: false } }), null, 'disabled stays null');
});

test('network layer: rapido.cc ride link stays direct (not claimed by LinkInR)', async () => {
  const { buildSecureDeeplink } = await import('../server/affiliate/deeplink');
  const r = await buildSecureDeeplink('https://rapido.cc/ride?utm_source=try1second');
  assert.notEqual(r.matchedProfile, 'linkinr');
  assert.ok(r.trackingUrl.startsWith('https://rapido.cc/ride'), r.trackingUrl);
});


// Owner 23 Oct ("deeplink site pr le jaa raha hai, app pr jana tha"): the https
// booking links opened the provider's mobile SITE (browser chain); the app must
// try the NATIVE app scheme first and fall back to the web link honestly.
test('uber app scheme: uber://?action=setPickup with prefilled trip', () => {
  const url = buildUberAppSchemeUrl({ cfg: cfg(), pickup, drop });
  assert.ok(url);
  assert.ok(url!.startsWith('uber://?action=setPickup'));
  assert.ok(url!.includes('client_id=test-client-1'));
  assert.ok(url!.includes('pickup[latitude]=28.6139'));
  assert.ok(url!.includes('dropoff[latitude]=28.5355'));
  assert.ok(url!.includes(`dropoff[nickname]=${encodeURIComponent(drop.name)}`));
});

test('uber app scheme: pickup=my_location fallback when coords unknown', () => {
  const url = buildUberAppSchemeUrl({ cfg: cfg(), pickup: null, drop });
  assert.ok(url!.includes('pickup=my_location'));
});

test('ola app scheme: olacabs://book with pickup + drop', () => {
  const url = buildOlaAppSchemeUrl({ cfg: cfg(), pickup, drop });
  assert.ok(url!.startsWith('olacabs://book?'));
  assert.ok(url!.includes('lat=28.6139'));
  assert.ok(url!.includes('drop_lat=28.5355'));
  // URLSearchParams encodes spaces as '+': compare the decoded param value.
  const q = new URLSearchParams(String(url).split('?')[1]);
  assert.equal(q.get('drop_name'), drop.name);
});

test('cabWebUrlToAppScheme: converts the built web urls back to schemes, rapido honestly null', () => {
  const c = cfg();
  const uberWeb = buildUberBookUrl({ cfg: c, pickup, drop })!;
  const uberScheme = cabWebUrlToAppScheme(uberWeb, c);
  assert.ok(uberScheme && uberScheme.startsWith('uber://'), uberScheme!);
  assert.ok(uberScheme!.includes('dropoff[latitude]=28.5355'), uberScheme!);
  const olaWeb = buildOlaBookUrl({ cfg: c, pickup, drop })!;
  const olaScheme = cabWebUrlToAppScheme(olaWeb, c);
  assert.ok(olaScheme && olaScheme.startsWith('olacabs://book?'), olaScheme!);
  // Rapido has no documented app scheme — never invented.
  assert.equal(cabWebUrlToAppScheme('https://rapido.cc/ride', c), null);
  // Non-cab urls stay null (generic interstitials unaffected).
  assert.equal(cabWebUrlToAppScheme('https://www.agoda.com/hotel', c), null);
});

test('interstitial pointer carries the cab app scheme through the signed token', async () => {
  const { createInterstitialPointer, resolveInterstitialMeta } = await import('../server/redirect/interstitial');
  const k = createInterstitialPointer('https://m.uber.com/looking/?x=1', 'm.uber.com', 'uber://?action=setPickup');
  const meta = resolveInterstitialMeta(k)!;
  assert.equal(meta.url, 'https://m.uber.com/looking/?x=1');
  assert.equal(meta.appScheme, 'uber://?action=setPickup');
  // No scheme -> empty string, page renders exactly as before.
  const plain = resolveInterstitialMeta(createInterstitialPointer('https://www.agoda.com/x', 'agoda.com'))!;
  assert.equal(plain.appScheme, '');
});

test('/api/cab/book: json=1 app-first branch serves appUrl + tracked webUrl (owner 23 Oct)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync('server/api/routes.ts', 'utf8');
  // json=1 (or our app's webview UA) returns the native scheme + fallback.
  const cabBranch = src.match(/apiRouter\.get\('\/cab\/book'[\s\S]*?\n\}\);/);
  assert.ok(cabBranch, 'cab/book route present');
  assert.ok(cabBranch[0].includes("req.query.json"), 'json mode honoured');
  assert.ok(cabBranch[0].includes('isInAppWebView'), 'app webview UA gets the JSON flow too');
  assert.ok(cabBranch[0].includes('buildUberAppSchemeUrl'), 'uber scheme served to the app');
  assert.ok(cabBranch[0].includes('buildOlaAppSchemeUrl'), 'ola scheme served to the app');
  assert.ok(cabBranch[0].includes('recordPointerClick'), 'click still tracked server-side');
  assert.ok(cabBranch[0].includes('webUrl'), 'web fallback returned for app-not-installed');
  // Rapido branch too (no scheme exists — tracked https link only).
  const rapidoBranch = cabBranch[0].match(/provider === 'rapido'[\s\S]*?return res\.redirect/);
  assert.ok(rapidoBranch, 'rapido branch present');
  assert.ok(rapidoBranch[0].includes('json'), 'rapido honours json mode');
  assert.ok(rapidoBranch[0].includes('appUrl: null'), 'rapido scheme honestly null');
  // /api/out forwards the scheme to the interstitial for browser users.
  assert.ok(src.includes('cabWebUrlToAppScheme(resolved.destination'), 'interstitial gets the app scheme');
});
