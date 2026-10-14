import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAppLinkUrl, upsertAppLink, getPublicAppLinks, deleteAppLink, listAppLinks } from '../server/marketing/appLinks';

test('app links: only https URLs are accepted', () => {
  assert.equal(validateAppLinkUrl('https://chromewebstore.google.com/detail/abc').ok, true);
  assert.equal(validateAppLinkUrl('http://example.com/x').ok, false);
  assert.equal(validateAppLinkUrl('javascript:alert(1)').ok, false);
  assert.equal(validateAppLinkUrl('ftp://example.com/x').ok, false);
  assert.equal(validateAppLinkUrl('').ok, false);
  assert.equal(validateAppLinkUrl('not a url').ok, false);
});

test('app links: credentials in URL and bad hosts are rejected', () => {
  assert.equal(validateAppLinkUrl('https://user:pass@example.com/x').ok, false);
  assert.equal(validateAppLinkUrl('https://localhost/x').ok, false);
  assert.equal(validateAppLinkUrl('https://' + 'a'.repeat(600) + '.com').ok, false);
});

test('app links: unknown keys rejected, nothing configured -> all null (no fake links)', async () => {
  const bad = await upsertAppLink({ link_key: 'windows_app', url: 'https://example.com/a' });
  assert.equal(bad.ok, false);
  const before = await getPublicAppLinks();
  assert.deepEqual(Object.keys(before).sort(), ['android_app', 'chrome_extension', 'ios_app']);
});

test('app links: save, expose publicly, hide when inactive, delete', async () => {
  const ok = await upsertAppLink({ link_key: 'android_app', url: 'https://play.google.com/store/apps/details?id=com.try1second', version: 'v1.1.1' });
  assert.equal(ok.ok, true);
  let pub = await getPublicAppLinks();
  assert.equal(pub.android_app?.version, 'v1.1.1');
  assert.ok(pub.android_app?.url.startsWith('https://play.google.com/'));
  assert.equal(pub.ios_app, null);

  await upsertAppLink({ link_key: 'android_app', url: 'https://play.google.com/store/apps/details?id=com.try1second', is_active: false });
  pub = await getPublicAppLinks();
  assert.equal(pub.android_app, null, 'inactive link must not be public');
  assert.equal((await listAppLinks(true)).some((r: any) => r.link_key === 'android_app'), true);

  await deleteAppLink('android_app');
  assert.equal((await listAppLinks(true)).some((r: any) => r.link_key === 'android_app'), false);
});
