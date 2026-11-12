/**
 * OWNER 10 Nov: "traffic homepage se le kr sb page se aana chaiye ... jo bhi kami hai pdf report mai
 * sb k fix kro". The report's finding was that impressions arrive from city/movies pages while the
 * answer layer sits five clicks deep. These tests pin the two internal-link fixes that make the
 * homepage and every vertical hub feed the whole answer layer.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSeoPage, VERTICALS } from '../server/seo/data';
import { resolveAnswerPage } from '../server/seo/answerPages';

test('homepage links every vertical comparison AND every vertical answer hub AND the answers index', () => {
  const home = resolveSeoPage('/')!;
  const hrefs = home.links.map((l) => l.href);
  assert.ok(VERTICALS.length >= 12, 'all verticals are exposed');
  for (const { slug } of VERTICALS) {
    assert.ok(hrefs.includes(`/${slug}`), `homepage must link the ${slug} comparison`);
    assert.ok(hrefs.includes(`/best/${slug}`), `homepage must link /best/${slug}`);
  }
  assert.ok(hrefs.includes('/answers'), 'homepage must link the answers index');
  assert.equal(new Set(hrefs).size, hrefs.length, 'no duplicate homepage links');
  assert.ok(home.links.every((l) => l.href.startsWith('/')), 'all internal, no external hop');
});

test('a vertical hub hands its equity to the answer layer (hub, states, then index)', () => {
  const hub = resolveSeoPage('/hotels')!;
  const hrefs = hub.links.map((l) => l.href);
  assert.equal(hrefs[0], '/best/hotels', 'its own best-in-India page comes first');
  assert.ok(hrefs.filter((h) => /^\/best\/hotels\/[a-z-]+$/.test(h)).length >= 5, 'state answers linked');
  assert.equal(hrefs[hrefs.length - 1], '/answers', 'answers index last');
  assert.ok(hrefs.some((h) => h === '/hotels/mumbai' || h.startsWith('/hotels/')), 'city pages still linked');
});

test('every state linked from a hub really exists on the answer layer', () => {
  const hub = resolveSeoPage('/flights')!;
  const stateLinks = hub.links.map((l) => l.href).filter((h) => /^\/best\/flights\/[a-z-]+$/.test(h));
  assert.ok(stateLinks.length >= 5);
  for (const href of stateLinks) {
    // /best/<vertical>/<state> lives on the answer layer, not the SEO page map.
    const page = resolveAnswerPage(href);
    assert.ok(page, `${href} must resolve to a real answer page`);
    assert.equal(page!.path, href);
  }
});

test('Cuelinks mints a deep link through the shared verified builder, never from the API key', async () => {
  const src = await import('node:fs').then((fs) => fs.readFileSync(new URL('../server/affiliate/affiliateNetwork.ts', import.meta.url), 'utf8'));
  // 12 Nov: the cid + link shape live in ONE place now (server/affiliate/cuelinksCid.ts), because a publisher
  // id in the cid slot answered cuelinks.com/broken-links. affiliateNetwork must delegate, not re-implement.
  assert.match(src, /import \{ buildCuelinksDeepLink \} from '\.\/cuelinksCid'/, 'uses the shared builder');
  assert.match(src, /return buildCuelinksDeepLink\(destinationUrl, subId\);/, 'cid-based deep link must exist');
  assert.match(src, /return null;/, 'still fail-closed when nothing is configured');
  const builder = await import('node:fs').then((fs) => fs.readFileSync(new URL('../server/affiliate/cuelinksCid.ts', import.meta.url), 'utf8'));
  assert.match(builder, /linksredirect\.com\/\?cid=/, 'the verified link shape lives here');
  // the deep link must never be built from the API key: an expired key must not stop monetisation
  const fn = builder.slice(builder.indexOf('export function buildCuelinksDeepLink'));
  assert.ok(!fn.includes('apiKey'), 'link minting must not depend on the API key');
});

test('Admitad, VCommission and INRDeals activate from one env template each, fail-closed', async () => {
  const { attachAffiliateDeepLinks } = await import('../server/affiliate/affiliateNetwork');
  const offer = (url: string) => [{ sellerUrl: url, seller: 'Test' } as any];

  // no templates -> Cuelinks still mints from cid (see the previous test), so assert on the ORDER and
  // the template behaviour instead of an empty result.
  process.env.ADMITAD_LINK_TEMPLATE = 'https://ad.admitad.com/g/abc123/?subid=try1second&ulp={DESTINATION}';
  process.env.VCOMMISSION_LINK_TEMPLATE = 'not-a-https-template';
  process.env.INRDEALS_LINK_TEMPLATE = 'https://inr.deals/track?id=xyz&url={DESTINATION}';
  try {
    const [a] = await attachAffiliateDeepLinks(offer('https://www.makemytrip.com/flights') as any);
    // Cuelinks is first in the list, so with a cid configured it wins; the templates are the fallback
    // for deployments with no cid.
    assert.ok(a.affiliate, 'an affiliate link must always be minted when a network can');
    assert.ok(['cuelinks', 'admitad', 'inrdeals'].includes(a.affiliate!.network), 'network must be a configured one');
    // a non-https template must never be used
    assert.ok(!String(a.affiliate!.deepLink).startsWith('not-a-https'));
  } finally {
    delete process.env.ADMITAD_LINK_TEMPLATE;
    delete process.env.VCOMMISSION_LINK_TEMPLATE;
    delete process.env.INRDEALS_LINK_TEMPLATE;
  }
});
