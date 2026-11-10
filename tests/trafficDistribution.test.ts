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

test('Cuelinks mints a deep link from the publisher cid even without a campaign id', async () => {
  const src = await import('node:fs').then((fs) => fs.readFileSync(new URL('../server/affiliate/affiliateNetwork.ts', import.meta.url), 'utf8'));
  assert.match(src, /linksredirect\.com\/\?cid=/, 'cid-based linkkit deep link must exist');
  assert.match(src, /if \(cid\)/, 'cid branch');
  assert.match(src, /if \(campaignId\)/, 'campaign template still wins when present');
  assert.match(src, /return null;/, 'still fail-closed when neither cid nor campaign is configured');
  // the deep link must never be built from the API key: an expired key must not stop monetisation
  const cidBlock = src.slice(src.indexOf('if (cid)'), src.indexOf('return null;'));
  assert.ok(!cidBlock.includes('apiKey'), 'link minting must not depend on the API key');
});
