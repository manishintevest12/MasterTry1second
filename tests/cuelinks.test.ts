/** Cuelinks integration tests (publisher 278473, MMT campaign 3801, Oct 2026):
 *  - linkkit deeplink format verified live: linksredirect.com/?cid=3801&subid=
 *    278473&source=try1second&url=<enc> 302s to the exact MMT destination.
 *  - Monetization API v3 provider (campaigns / offers / links-convert) activates
 *    with CUELINKS_API_KEY; linkkit deeplinks work without it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cuelinksMerchantUrl } from '../server/affiliate/deeplink';
import { CuelinksProvider } from '../server/affiliate/providers/cuelinks';
import { settings } from '../server/common/settings';

const MMT_HOTEL = 'https://www.makemytrip.com/hotels/hotels-in-goa/';
const MMT_FLIGHT = 'https://www.makemytrip.com/flight/search?itinerary=DEL-BOM-18/10/2026&tripType=O';

test('MMT hotel deeplink routes through the per-publisher cid with subid attribution', () => {
  const link = cuelinksMerchantUrl(MMT_HOTEL);
  assert.ok(link, 'makemytrip.com is in the campaign registry');
  const u = new URL(link!);
  assert.equal(u.hostname, 'linksredirect.com');
  assert.equal(u.searchParams.get('cid'), settings.cuelinks.cid); // per-publisher 326794
  assert.equal(u.searchParams.get('subid'), settings.cuelinks.publisherId);
  assert.ok(u.searchParams.get('url')!.includes('hotels-in-goa'));
});

test('MMT flight deeplinks ride the same publisher cid (attribution is by domain)', () => {
  const link = cuelinksMerchantUrl(MMT_FLIGHT);
  assert.ok(link);
  assert.equal(new URL(link!).searchParams.get('cid'), settings.cuelinks.cid);
  assert.ok(decodeURIComponent(new URL(link!).searchParams.get('url')!).includes('itinerary=DEL-BOM'));
});

test('Goibibo deeplinks route through the publisher cid (owner request 15 Oct)', () => {
  const link = cuelinksMerchantUrl('https://www.goibibo.com/hotels/hotels-in-goa/');
  assert.ok(link);
  const u = new URL(link!);
  assert.equal(u.searchParams.get('cid'), settings.cuelinks.cid);
  assert.equal(u.searchParams.get('subid'), settings.cuelinks.publisherId);
});

test('unknown merchants stay direct — never invented', () => {
  assert.equal(cuelinksMerchantUrl('https://www.google.com/search?q=x'), null);
  assert.equal(cuelinksMerchantUrl('https://yatra.com/hotels/'), null); // not joined yet
  assert.equal(cuelinksMerchantUrl('not a url'), null);
});

test('provider needs the dashboard API key for the Monetization API (offers/campaigns)', () => {
  const p = new CuelinksProvider();
  if (!settings.cuelinks.apiKey) {
    assert.equal(p.isConfigured(), false);
    const res = p.fetchOffers();
    res.then((r) => { assert.equal(r.count, 0); assert.ok(r.warnings.length > 0); });
  }
});

test('v3 offers normalize into the unified shape (fixture per API docs)', async () => {
  const p = new CuelinksProvider();
  const o = p.normalize({
    id: 987, title: 'Flat 12% off on domestic hotels', description: '<b>Save</b> on all India hotels',
    terms: 'Min booking Rs.1500', coupon_code: 'MMT12', offer_type: 'coupon',
    campaign_id: 3801, campaign_name: 'MakeMyTrip (Hotels)',
    categories: [{ id: 5, name: 'Travel' }],
    tracking_url: 'https://linksredirect.com/?cid=3801&source=api&url=https%3A%2F%2Fwww.makemytrip.com%2Fhotels%2F',
    status: 'live', start_date: '2026-10-01', end_date: '2026-12-31', percent_off: 12,
  });
  assert.equal(o.network_source, 'cuelinks');
  assert.equal(o.merchant_name, 'MakeMyTrip (Hotels)');
  assert.equal(o.coupon_code, 'MMT12');
  assert.equal(o.discount_value, 12);
  assert.equal(o.discount_type, 'percentage');
  assert.equal(o.status, 'active');
  assert.ok(o.affiliate_url!.startsWith('https://linksredirect.com/'));
  assert.ok(o.categories.includes('travel'));
  assert.equal((o.expires_at as Date).getFullYear(), 2026);
});

test('fetchOffers hits the v3 endpoint and paginates until meta.next_page is null', async (t) => {
  process.env.CUELINKS_API_KEY = 'test_key_123';
  const { CuelinksProvider: P } = await import('../server/affiliate/providers/cuelinks');
  const { settings: s } = await import('../server/common/settings');
  // settings is import-cached; force-configure via the same object the provider reads
  const orig = s.cuelinks.apiKey;
  s.cuelinks.apiKey = 'test_key_123';
  const calls: string[] = [];
  const realFetch = global.fetch;
  global.fetch = (async (url: string, init?: any) => {
    calls.push(String(url));
    const page = new URL(String(url)).searchParams.get('page') || '1';
    const onePage = page === '1';
    return {
      ok: true, status: 200,
      json: async () => ({
        data: [page === '1'
          ? { id: 1, title: 'Offer A', campaign_name: 'MakeMyTrip (Hotels)', offer_type: 'deal', status: 'live', percent_off: 10, categories: [] }
          : { id: 2, title: 'Offer B', campaign_name: 'MakeMyTrip (Hotels)', offer_type: 'deal', status: 'live', percent_off: 15, categories: [] }],
        meta: { next_page: onePage ? 2 : null },
      }),
    } as any;
  }) as any;
  t.after(() => { global.fetch = realFetch; s.cuelinks.apiKey = orig; delete process.env.CUELINKS_API_KEY; });
  const p = new P();
  assert.equal(p.isConfigured(), true);
  const res = await p.fetchOffers({ pages: 3 });
  assert.equal(res.count, 2);
  assert.equal(res.warnings.length, 0);
  assert.ok(calls[0].includes('/offers?per_page=200&page=1'));
  assert.ok(calls.some((c) => c.includes('page=2')));
  assert.ok(!calls.some((c) => c.includes('page=3'))); // stops at next_page null
  assert.ok(calls.every((c) => c.startsWith(s.cuelinks.apiBase)));
});

test('links/convert: affiliated=false falls back to the direct URL (never a dead hop)', async (t) => {
  const { settings: s } = await import('../server/common/settings');
  const orig = s.cuelinks.apiKey;
  s.cuelinks.apiKey = 'test_key_123';
  const realFetch = global.fetch;
  global.fetch = (async () => ({
    ok: true, status: 200,
    json: async () => ({ data: { tracking_url: 'https://linksredirect.com/?cid=999&url=x', affiliated: false, campaign: null } }),
  })) as any;
  t.after(() => { global.fetch = realFetch; s.cuelinks.apiKey = orig; });
  const p = new CuelinksProvider();
  const link = await p.generateTrackingLink('https://www.makemytrip.com/hotels-in-goa/');
  assert.equal(link, 'https://www.makemytrip.com/hotels-in-goa/');
});
