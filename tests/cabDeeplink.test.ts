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
