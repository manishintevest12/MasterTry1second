import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APP_CAMPAIGNS, appCampaignFor, appInstallTrackingUrl, appInstallExit, appInstallExitEnabled,
} from '../server/affiliate/appCampaigns';

test('EaseMyTrip is registered as a Cuelinks CPI-Android campaign (campaign 80705, 172.5 per acquisition)', () => {
  const c = appCampaignFor('https://www.easemytrip.com/hotels/');
  assert.ok(c, 'easemytrip.com must match a campaign');
  assert.equal(c!.campaignId, 80705);
  assert.equal(c!.campaignType, 'CPI - Android');
  assert.equal(c!.payout, 172.5);
  assert.equal(c!.payoutType, 'Per Acquisition');
  assert.ok(c!.storeUrl.includes('com.easemytrip.android'));
});

test('tracked install link keeps cid + source=api + the store url, and carries our subid', () => {
  const c = APP_CAMPAIGNS[0];
  const u = appInstallTrackingUrl(c, 't1s-test');
  const p = new URL(u).searchParams;
  assert.equal(new URL(u).host, 'linksredirect.com');
  assert.equal(p.get('cid'), '326794');
  assert.equal(p.get('source'), 'api');
  assert.equal(p.get('url'), c.storeUrl);
  assert.equal(p.get('subid'), 't1s-test');
});

test('app-install exits are opt-in, Android only, and never touch the website exit', () => {
  const dest = 'https://www.jiomart.com/groceries';
  delete process.env.T1S_APP_INSTALL_EXITS;
  assert.equal(appInstallExitEnabled('jiomart'), false);
  assert.equal(appInstallExit(dest, { isAndroid: true }), null, 'off by default');
  process.env.T1S_APP_INSTALL_EXITS = 'jiomart';
  assert.equal(appInstallExitEnabled('jiomart'), true);
  assert.equal(appInstallExitEnabled('easemytrip'), false, 'EMT is owner-blocked, per-merchant only');
  assert.ok(appInstallExit(dest, { isAndroid: true }), 'android gets the install link when enabled');
  assert.equal(appInstallExit(dest, { isAndroid: false }), null, 'desktop keeps the merchant site');
  delete process.env.T1S_APP_INSTALL_EXITS;
});

test('a domain with no app campaign is untouched', () => {
  assert.equal(appCampaignFor('https://www.makemytrip.com/hotels/'), null);
  assert.equal(appInstallExit('https://www.makemytrip.com/hotels/', { isAndroid: true }), null);
});

test('the Flutter app counts as Android even though its UA is Dart/... ', async () => {
  const { appLikeAndroid, appInstallExitForUserAgent } = await import('../server/affiliate/appCampaigns');
  assert.equal(appLikeAndroid('Mozilla/5.0 (Linux; Android 13) Chrome/120 Mobile'), true);
  assert.equal(appLikeAndroid('Dart/3.5 (dart:io)'), true, 'app requests must count');
  assert.equal(appLikeAndroid('Try1Second/1.8.79'), true);
  assert.equal(appLikeAndroid('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605'), false);
  process.env.T1S_APP_INSTALL_EXITS = 'jiomart';
  assert.ok(appInstallExitForUserAgent('Dart/3.5 (dart:io)', 'https://www.jiomart.com/groceries'));
  assert.equal(appInstallExitForUserAgent('Mozilla/5.0 (Windows NT 10.0) Chrome/120', 'https://www.jiomart.com/groceries'), null);
  delete process.env.T1S_APP_INSTALL_EXITS;
});

test("owner 10 Nov: EaseMyTrip keeps its deeplink - the install link is never an exit for it", async () => {
  const { buildSecureDeeplink } = await import('../server/affiliate/deeplink');
  const dest = 'https://www.easemytrip.com/hotels/';
  // even when the env tries to switch every campaign on
  for (const flag of ['easemytrip', 'all', 'on']) {
    process.env.T1S_APP_INSTALL_EXITS = flag;
    assert.equal(appInstallExitEnabled('easemytrip'), false, `flag "${flag}" must not enable EMT installs`);
    assert.equal(appInstallExit(dest, { isAndroid: true }), null, 'no install redirect for EMT, ever');
  }
  delete process.env.T1S_APP_INSTALL_EXITS;
  // and the merchant exit itself still carries the exact deep path
  const r: any = await buildSecureDeeplink(dest);
  assert.ok(String(r.trackingUrl).includes(encodeURIComponent(dest)), 'EMT deep link must survive');
  // the campaign stays visible for reporting only
  const c = APP_CAMPAIGNS.find((x) => x.key === 'easemytrip')!;
  assert.equal(c.installExitAllowed, false);
});
