import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { assetLinksJson, ANDROID_PACKAGE } from '../server/marketing/appLinkVerify';

/**
 * OWNER 30 Oct: the apex host must answer 200 for /.well-known/assetlinks.json, but the
 * apex is 301-ed onto www for every path except real files in its static document root.
 * Probes proved that root is public/ (ads.txt, robots.txt, favicon.ico, feature-graphic.png
 * and the Google verification html all answer 200 on the apex; index.html and sitemap.xml do
 * not, and neither exists in public/). So the file is shipped as a real static file too, and
 * these tests keep that copy identical to what the Express route serves.
 */
const STATIC = new URL('../public/.well-known/assetlinks.json', import.meta.url);

test('public/.well-known/assetlinks.json exists and is valid JSON', () => {
  assert.ok(existsSync(STATIC), 'static verification file must be committed');
  const parsed = JSON.parse(readFileSync(STATIC, 'utf8'));
  assert.ok(Array.isArray(parsed) && parsed.length === 1);
});

test('static file matches the Express route byte for byte', () => {
  const onDisk = JSON.parse(readFileSync(STATIC, 'utf8'));
  const fromRoute = JSON.parse(JSON.stringify(assetLinksJson()));
  assert.deepEqual(onDisk, fromRoute, 'run: node --import tsx scripts/gen-applink-static.mjs');
});

test('static file declares our package and both signing certificates', () => {
  const parsed = JSON.parse(readFileSync(STATIC, 'utf8'));
  const target = parsed[0].target;
  assert.equal(target.namespace, 'android_app');
  assert.equal(target.package_name, ANDROID_PACKAGE);
  assert.deepEqual(parsed[0].relation, ['delegate_permission/common.handle_all_urls']);
  assert.ok(target.sha256_cert_fingerprints.length >= 2);
  for (const fp of target.sha256_cert_fingerprints) {
    assert.match(fp, /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
  }
});

test('the build regenerates it, so a new Play fingerprint cannot go stale', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(pkg.scripts.build, /gen-applink-static\.mjs/);
});
