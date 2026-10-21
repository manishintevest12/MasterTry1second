import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkinrCampaignFor, linkinrTrackingUrl, linkinrStats } from '../server/affiliate/linkinr';
import { bucketCategory } from '../server/marketing/partners';
import { buildSecureDeeplink } from '../server/affiliate/deeplink';

// Owner sheet (21 Oct 2026): 169 LinkInR campaigns, inventory_id dkNuid.
// Rule: LinkInR monetizes every merchant without a direct partner.

test('linkinr: sheet parses to a live registry', () => {
  const st = linkinrStats();
  assert.ok(st.campaigns >= 100, `expected many campaigns, got ${st.campaigns}`);
  assert.equal(st.enabled, true);
});

test('linkinr: inventory id + tracking link shape', () => {
  const url = linkinrTrackingUrl('https://www.agoda.com/hotels/search');
  assert.ok(url, 'agoda must have a campaign');
  assert.match(url!, /^https:\/\/linkinr\.com\?campaign_id=[A-Za-z0-9]+&inventory_id=dkNuid&sub_id1=/);
  assert.ok(url!.includes('sub_id1=try1second'), 'sub id carries our publisher marker');
});

test('linkinr: covers travel, ecommerce and finance merchants', () => {
  for (const d of ['https://www.agoda.com/', 'https://www.myntra.com/x', 'https://www.ajio.com/x',
                   'https://www.flipkart.com/x', 'https://www.jiomart.com/x', 'https://www.uber.com/',
                   'https://www.yatra.com/', 'https://www.cleartrip.com/flights']) {
    assert.ok(linkinrTrackingUrl(d), `${d} should be monetized by a LinkInR campaign`);
  }
});

test('linkinr: campaigns we cannot use stay unmatched (honest null)', () => {
  // Amazon's sheet row is Campaign Access = No -> never monetized here; the
  // Associates store tag (a direct partner) handles Amazon instead.
  assert.equal(linkinrCampaignFor('https://www.amazon.in/dp/B0X'), null);
  assert.equal(linkinrTrackingUrl('https://not-a-campaign.example.org/x'), null);
});

test('linkinr: duplicate domains resolve deterministically to the best payout', () => {
  const c = linkinrCampaignFor('https://www.sbicard.com/apply');
  assert.ok(c, 'sbicard has three campaigns in the sheet');
  assert.ok(c!.payoutScore >= 1800, `expected the highest payout row, got ${c!.payout}`);
});

test('linkinr: kill switch disables the layer without touching destinations', () => {
  process.env.LINKINR_ENABLED = '0';
  assert.equal(linkinrTrackingUrl('https://www.agoda.com/hotels'), null);
  delete process.env.LINKINR_ENABLED;
  assert.ok(linkinrTrackingUrl('https://www.agoda.com/hotels'));
});

test('deeplink priority: direct partners win, LinkInR covers the rest', async () => {
  // Amazon Associates (direct partner, deep product link) is untouched.
  const amz = await buildSecureDeeplink('https://www.amazon.in/dp/B0X');
  assert.equal(amz.matchedProfile, 'amazon_associates');
  assert.ok(amz.trackingUrl.includes('tag=try1second-21'));
  // MakeMyTrip/Goibibo stay on Cuelinks (joined direct partner, deep deeplink).
  const mmt = await buildSecureDeeplink('https://www.makemytrip.com/hotels/x');
  assert.equal(mmt.matchedProfile, 'cuelinks_fallback');
  // Merchants with no direct partner now earn: LinkInR layer.
  const agoda = await buildSecureDeeplink('https://www.agoda.com/hotels/x');
  assert.equal(agoda.matchedProfile, 'linkinr');
  assert.equal(agoda.network, 'linkinr');
  // Unknown destination stays an honest direct hop.
  const other = await buildSecureDeeplink('https://unknown-merchant.example.com/p');
  assert.equal(other.matchedProfile, 'direct');
  assert.equal(other.network, null);
});

test('partners: inquiry category buckets map to directory filters', () => {
  assert.equal(bucketCategory('Travel agency'), 'travel');
  assert.equal(bucketCategory('Hotel booking'), 'travel');
  assert.equal(bucketCategory('Food delivery'), 'food');
  assert.equal(bucketCategory('cab aggregator'), 'cabs');
  assert.equal(bucketCategory('Bank / loans'), 'finance');
  assert.equal(bucketCategory('Demat & investments'), 'finance');
  assert.equal(bucketCategory('Electronics retail'), 'retail');
});
