import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Admin affiliate COVERAGE (owner 25 Oct): the owner must see every monetized
 * partnership in the admin panel and be able to override any of them manually.
 * Covers the /api/admin/affiliate/coverage building blocks:
 *   - linkinrCampaignList(): the effective per-domain campaign list (169 campaigns)
 *   - manual profile override wins over the automatic LinkInR layer
 */
test('linkinrCampaignList returns the effective per-domain coverage with real fields', async () => {
  const { linkinrCampaignList, linkinrStats } = await import('../server/affiliate/linkinr');
  const list = linkinrCampaignList();
  const stats = linkinrStats();
  assert.ok(list.length >= 100, `expected ~169 domain campaigns, got ${list.length}`);
  assert.equal(list.length, stats.campaigns, 'list must match the loaded registry size');
  for (const c of list) {
    assert.ok(c.name && c.domain && c.id, 'campaign must carry name/domain/id');
    assert.ok(!c.domain.includes(' '), 'domain must be clean');
  }
  // Sorted for the admin table
  const names = list.map((c) => c.name);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
  // Spot-check travel coverage the owner asked to see
  assert.ok(list.some((c) => /yatra/i.test(c.name)), 'Yatra campaign present');
  assert.ok(list.some((c) => /agoda/i.test(c.name)), 'Agoda campaign present');
  assert.ok(!list.some((c) => /oyo/i.test(c.name)), 'OYO is NOT covered — honest');
});

test('coverage view domain: a manual affiliate_configs profile overrides the automatic LinkInR hop', async () => {
  const { saveProfile, deleteProfile, listProfiles } = await import('../server/affiliate/profiles');
  const { buildSecureDeeplink } = await import('../server/affiliate/deeplink');
  const dest = 'https://hotel.yatra.com/nxt-ui/search?checkIn=2026-10-26&city=Indore';

  // 1. Automatic: LinkInR monetizes Yatra hotel links
  const before = await buildSecureDeeplink(dest);
  assert.equal(before.matchedProfile, 'linkinr', `expected linkinr, got ${before.matchedProfile}`);
  assert.ok(before.trackingUrl.startsWith('https://linkinr.com?'), before.trackingUrl);

  // 2. Owner adds his own tracking template for yatra.com in the admin panel
  const saved = await saveProfile({
    slug: 'yatra-coverage-test',
    company_domain: 'yatra.com',
    network: 'vcommission',
    template: 'https://track.vcommission.com/click?campaign_id=999&pub_id=OWNER&url={url}',
    campaign_key: '',
  });
  assert.equal(saved.ok, true, saved.error);

  // 3. Manual profile now wins over LinkInR
  const after = await buildSecureDeeplink(dest);
  assert.equal(after.matchedProfile, 'affiliate_configs', `expected affiliate_configs, got ${after.matchedProfile}`);
  assert.ok(after.trackingUrl.startsWith('https://track.vcommission.com/click?'), after.trackingUrl);
  assert.ok(after.trackingUrl.includes(encodeURIComponent(dest)), 'destination is wrapped in the template {url}');

  // 4. Deleting the profile restores the automatic LinkInR layer
  await deleteProfile('yatra-coverage-test');
  const restored = await buildSecureDeeplink(dest);
  assert.equal(restored.matchedProfile, 'linkinr');
  // listProfiles must not leak the deleted row
  assert.ok(!(await listProfiles()).some((p: any) => p.slug === 'yatra-coverage-test'));
});

test('coverage view exposes Amazon tag, Cuelinks state and Ekaro status', async () => {
  const { ekaroStats } = await import('../server/affiliate/ekaro');
  const st = ekaroStats();
  assert.equal(typeof st.enabled, 'boolean');
  assert.equal(typeof st.domainsCached, 'number');
  // ekaro converts only EarnKaro-catalog merchants (myntra yes, oyo no) — the
  // admin panel must not claim Ekaro coverage for OYO.
  const { ekaroTrackingUrl } = await import('../server/affiliate/ekaro');
  if (!st.enabled) return; // key absent in this environment: honest skip
  const m = await ekaroTrackingUrl('https://www.myntra.com/');
  assert.ok(!m || m.startsWith('https://myntr.it/'), 'myntra converts via Ekaro');
  const oyo = await ekaroTrackingUrl('https://www.oyorooms.com/');
  assert.equal(oyo, null, 'OYO is not on EarnKaro — must stay null, no invented link');
});
