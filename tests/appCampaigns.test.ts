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
  const dest = 'https://www.easemytrip.com/hotels/';
  delete process.env.T1S_APP_INSTALL_EXITS;
  assert.equal(appInstallExitEnabled('easemytrip'), false);
  assert.equal(appInstallExit(dest, { isAndroid: true }), null, 'off by default');
  process.env.T1S_APP_INSTALL_EXITS = 'easemytrip';
  assert.equal(appInstallExitEnabled('easemytrip'), true);
  assert.equal(appInstallExitEnabled('jiomart'), false, 'per-merchant, not global');
  assert.ok(appInstallExit(dest, { isAndroid: true }), 'android gets the install link when enabled');
  assert.equal(appInstallExit(dest, { isAndroid: false }), null, 'desktop keeps the merchant site');
  delete process.env.T1S_APP_INSTALL_EXITS;
});

test('a domain with no app campaign is untouched', () => {
  assert.equal(appCampaignFor('https://www.makemytrip.com/hotels/'), null);
  assert.equal(appInstallExit('https://www.makemytrip.com/hotels/', { isAndroid: true }), null);
});
