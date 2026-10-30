import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANDROID_PACKAGE,
  assetLinksJson,
  appleAppSiteAssociation,
  fingerprintList,
  registerAppLinkRoutes,
} from '../server/marketing/appLinkVerify';

/**
 * OWNER 29 Oct ("universal link khule to app me khule, browser me nahi"): Android and
 * iOS only hand a tapped link to the app when these two files are served correctly.
 * A wrong package name or a missing signing fingerprint silently means "opens Chrome".
 */

const RELEASE = 'BC:22:41:42:7D:5B:43:B8:51:9F:AE:A3:81:33:45:CA:A3:9E:D6:05:8A:65:38:46:43:85:8D:C8:DC:F1:5C:DE';
const DEBUG = '45:9E:B5:8E:8F:71:B0:94:26:59:E5:17:96:C1:54:06:F9:D0:98:F5:64:2E:15:89:A2:23:6B:67:58:30:A7:C5';

test('assetlinks.json: package + both signing certs in the exact Android shape', () => {
  const json = assetLinksJson();
  assert.equal(json.length, 1);
  const st = json[0] as any;
  assert.deepEqual(st.relation, ['delegate_permission/common.handle_all_urls']);
  assert.equal(st.target.namespace, 'android_app');
  assert.equal(st.target.package_name, ANDROID_PACKAGE);
  assert.equal(ANDROID_PACKAGE, 'com.try1second.try1second'); // must match applicationId
  assert.ok(st.target.sha256_cert_fingerprints.includes(RELEASE));
  assert.ok(st.target.sha256_cert_fingerprints.includes(DEBUG));
});

test('Play App Signing certificate is appended from ANDROID_PLAY_SHA256 and validated', () => {
  const before = process.env.ANDROID_PLAY_SHA256;
  const play = '11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00';
  process.env.ANDROID_PLAY_SHA256 = `${play.toLowerCase()},not-a-fingerprint`;
  const list = fingerprintList();
  assert.ok(list.includes(play), 'uppercased Play cert must be present');
  assert.ok(!list.some((f) => f === 'NOT-A-FINGERPRINT'), 'garbage must be dropped');
  assert.equal(list.length, 3);
  if (before === undefined) delete process.env.ANDROID_PLAY_SHA256; else process.env.ANDROID_PLAY_SHA256 = before;
});

test('the release key pasted into the Play var is not duplicated', () => {
  const before = process.env.ANDROID_PLAY_SHA256;
  process.env.ANDROID_PLAY_SHA256 = RELEASE.toLowerCase();
  const list = fingerprintList();
  assert.equal(list.length, 2, 'release + debug only, no duplicate');
  assert.equal(new Set(list).size, list.length);
  if (before === undefined) delete process.env.ANDROID_PLAY_SHA256; else process.env.ANDROID_PLAY_SHA256 = before;
});

test('aasa is served only with a real Team ID, never invented', () => {
  const before = process.env.IOS_TEAM_ID;
  delete process.env.IOS_TEAM_ID;
  assert.equal(appleAppSiteAssociation(), null);
  process.env.IOS_TEAM_ID = 'A1B2C3D4E5';
  const aasa = appleAppSiteAssociation() as any;
  assert.ok(aasa);
  assert.equal(aasa.applinks.details[0].appID, 'A1B2C3D4E5.com.try1second.try1second');
  assert.deepEqual(aasa.applinks.details[0].paths, ['/']);
  if (before === undefined) delete process.env.IOS_TEAM_ID; else process.env.IOS_TEAM_ID = before;
});

test('both verification routes answer JSON with no redirect', () => {
  const routes = new Map<string, (req: any, res: any) => void>();
  registerAppLinkRoutes({ get: (p, h) => routes.set(p, h) } as any);
  assert.ok(routes.has('/.well-known/assetlinks.json'));
  assert.ok(routes.has('/.well-known/apple-app-site-association'));

  const capture = () => {
    const res: any = { headers: {}, statusCode: 200, body: '' };
    res.setHeader = (k: string, v: string) => { res.headers[k.toLowerCase()] = v; };
    res.status = (c: number) => { res.statusCode = c; return res; };
    res.send = (b: any) => { res.body = b; return res; };
    return res;
  };

  const res1 = capture();
  routes.get('/.well-known/assetlinks.json')!({}, res1);
  assert.equal(res1.statusCode, 200);
  assert.equal(res1.headers['content-type'], 'application/json');
  assert.equal(JSON.parse(res1.body)[0].target.package_name, ANDROID_PACKAGE);

  const before = process.env.IOS_TEAM_ID;
  delete process.env.IOS_TEAM_ID;
  const res2 = capture();
  routes.get('/.well-known/apple-app-site-association')!({}, res2);
  assert.equal(res2.statusCode, 404, 'unconfigured AASA must not be served as valid');
  if (before !== undefined) process.env.IOS_TEAM_ID = before;
});
