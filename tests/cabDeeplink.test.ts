/**
 * Cab in-app booking deep links (owner 22 Oct): Uber "looking" format with
 * pickup/drop JSON (owner-supplied spec), my_location fallback, Ola book URL,
 * and admin affiliate param injection with sanitization.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildUberBookUrl, buildOlaBookUrl, type CabDeeplinkConfig } from '../server/common/cabDeeplink';

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
  assert.ok(url.startsWith('https://m.uber.com/looking/?client_id=test-client-1&'), url);
  assert.ok(url.includes(`pickup=${encodeURIComponent(JSON.stringify({ latitude: 28.6139, longitude: 77.209, addressLine1: 'Connaught Place' }))}`), url);
  assert.ok(url.includes(`drop[0]=${encodeURIComponent(JSON.stringify({ latitude: 28.5355, longitude: 77.391, addressLine1: 'Noida Sector 18' }))}`), url);
  assert.ok(url.includes('utm_source=try1second'), 'affiliate params appended');
});

test('uber: pickup=my_location fallback when pickup coords unknown (owner spec)', () => {
  const url = buildUberBookUrl({ cfg: cfg(), pickup: null, drop })!;
  assert.ok(url.includes('pickup=my_location'), url);
});

test('uber: admin affiliate params appended, malformed entries dropped', () => {
  const url = buildUberBookUrl({ cfg: cfg({ uberExtraParams: 'sub_id=abc123&===bad&javascript:alert(1)' }), pickup, drop })!;
  assert.ok(url.includes('sub_id=abc123'), url);
  assert.ok(!url.includes('javascript'), url);
  assert.ok(!url.includes('bad'), 'malformed pair dropped');
});

test('uber: client_id omitted when admin has not set one', () => {
  const url = buildUberBookUrl({ cfg: cfg({ uberClientId: '' }), pickup, drop })!;
  assert.ok(!url.includes('client_id='), url);
});

test('disabled providers return null (honest, never a dead link)', () => {
  assert.equal(buildUberBookUrl({ cfg: cfg({ uberEnabled: false }), pickup, drop }), null);
  assert.equal(buildOlaBookUrl({ cfg: cfg({ olaEnabled: false }), pickup, drop }), null);
});

test('ola: book.olacabs.com deep link with coords + name + affiliate', () => {
  const url = buildOlaBookUrl({ cfg: cfg(), pickup, drop })!;
  assert.ok(url.startsWith('https://book.olacabs.com/?'), url);
  assert.ok(url.includes('lat=28.6139'), url);
  assert.ok(url.includes('drop_lat=28.5355'), url);
  assert.ok(url.includes('drop_name=Noida'), url);
  assert.ok(url.includes('utm_source=try1second'), url);
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
