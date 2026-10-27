import test from 'node:test';
import assert from 'node:assert/strict';
import { adBlockHtml } from '../server/redirect/interstitial';

// Owner 27 Oct: "adsense aur affiliate dono ek link mai add kro jiss se paise hr link
// se company ko aaye". Every monetizable exit (/api/out -> /redirect, and the cab
// /api/app-open bridge) pulls its ad unit from ONE helper with env fallback.
test('ad unit renders from env when no admin slot row exists', async () => {
  const before = { c: process.env.ADSENSE_CLIENT, s: process.env.ADSENSE_SLOT };
  process.env.ADSENSE_CLIENT = 'ca-pub-1234567890123456';
  process.env.ADSENSE_SLOT = '9876543210';
  const html = await adBlockHtml('app_open_interstitial_unconfigured_test');
  assert.ok(html.includes('data-ad-client="ca-pub-1234567890123456"'), html.slice(0, 160));
  assert.ok(html.includes('data-ad-slot="9876543210"'));
  assert.ok(html.includes('pagead2.googlesyndication.com'));
  process.env.ADSENSE_CLIENT = before.c;
  process.env.ADSENSE_SLOT = before.s;
});

test('nothing configured -> no ad markup at all (never a blank or fake unit)', async () => {
  const before = { c: process.env.ADSENSE_CLIENT, ci: process.env.ADSENSE_CLIENT_ID, s: process.env.ADSENSE_SLOT, si: process.env.ADSENSE_SLOT_ID };
  delete process.env.ADSENSE_CLIENT; delete process.env.ADSENSE_CLIENT_ID;
  delete process.env.ADSENSE_SLOT; delete process.env.ADSENSE_SLOT_ID;
  const html = await adBlockHtml('definitely_unconfigured_slot_test');
  assert.equal(html, '');
  Object.assign(process.env, before);
});
