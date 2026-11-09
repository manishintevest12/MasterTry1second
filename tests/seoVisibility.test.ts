// OWNER 9 Nov, after measuring the real SERPs: "try1second" (the bare brand) returned the "1 Second
// Everyday" video app and nothing from this site, "site:try1second.com" showed the city pages were
// indexed, and every commercial phrase returned only Skyscanner/Kayak/MakeMyTrip/happyfares. These
// tests pin the four fixes that came out of that measurement so they cannot silently regress.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveSeoPage, listSeoPaths } from '../server/seo/data';
import { enhanceHtml } from '../server/seo/render';
import { INDEXNOW_KEY, INDEXNOW_KEY_PATH, INDEXNOW_HOST, indexNowPayloads } from '../server/seo/indexnow';
import { renderGuidePage, renderGuidesIndex } from '../server/seo/guidePages';
import { GUIDE_SLUGS } from '../server/seo/guides';

const ORIGIN = 'https://www.try1second.com';

test('homepage title and h1 carry the brand AND the head terms people actually type', () => {
  const home = resolveSeoPage('/')!;
  assert.ok(home, 'homepage SEO page must resolve');
  assert.ok(/Try1Second/.test(home.title), 'brand in title');
  assert.ok(/price comparison/i.test(home.title), 'title must say price comparison');
  assert.ok(/India/i.test(home.title), 'title must say India');
  for (const term of ['flight', 'hotel', 'bus']) assert.ok(new RegExp(term, 'i').test(home.h1), `h1 must name ${term}`);
  assert.ok(/Try1Second/.test(home.h1), 'brand in h1');
  assert.ok(home.title.length <= 70, `title ${home.title.length} chars is too long for a SERP`);
  assert.ok(home.description.length >= 70 && home.description.length <= 180, 'meta description must fit a SERP snippet');
});

test('the brand-collision question is answered on the page, in words and in FAQ schema', () => {
  const home = resolveSeoPage('/')!;
  const faq = home.faqs.find((f) => /1 Second Everyday/i.test(f.q));
  assert.ok(faq, 'a FAQ must answer the collision explicitly');
  assert.ok(/not connected|No\./.test(faq!.a), 'and it must disclaim the link');
  // the intro must claim the misspellings people use
  assert.ok(home.intro.some((p) => /Try 1 Second/.test(p)), 'intro must spell out the brand variants');
});

test('Organization + WebSite expose alternateName so the brand spellings resolve to one entity', () => {
  const html = enhanceHtml('<!doctype html><html><head><title>x</title></head><body></body></html>', '/');
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const org = blocks.find((b: any) => b['@type'] === 'Organization');
  const site = blocks.find((b: any) => b['@type'] === 'WebSite');
  assert.ok(org, 'Organization block');
  assert.ok(Array.isArray(org.alternateName) && org.alternateName.includes('Try 1 Second'), 'org alternateName');
  assert.ok(site && site.potentialAction, 'WebSite must keep the sitelinks SearchAction');
  const search = site.potentialAction.target;
  assert.ok(String(JSON.stringify(search)).includes('{search_term_string}'), 'searchbox target must be templated');
});

test('IndexNow: key file, host and payload are consistent and cover the answer layer', () => {
  assert.match(INDEXNOW_KEY, /^[a-f0-9]{32}$/);
  assert.equal(INDEXNOW_KEY_PATH, `/${INDEXNOW_KEY}.txt`);
  assert.equal(INDEXNOW_HOST, 'www.try1second.com');
  const payloads = indexNowPayloads();
  assert.equal(payloads.length, 1, 'one chunk is enough at this size');
  const [p] = payloads;
  assert.equal(p.keyLocation, `${ORIGIN}/${INDEXNOW_KEY}.txt`);
  assert.equal(p.key, INDEXNOW_KEY);
  for (const u of p.urlList) assert.ok(u.startsWith(`${ORIGIN}/`), `${u} must be on the canonical host`);
  assert.ok(p.urlList.includes(`${ORIGIN}/`), 'homepage included');
  assert.ok(p.urlList.includes(`${ORIGIN}/answers`), 'answers hub included');
  assert.ok(p.urlList.includes(`${ORIGIN}/best/hotels/maharashtra`), 'state answer pages included');
  assert.equal(new Set(p.urlList).size, p.urlList.length, 'no duplicate URLs');
  assert.equal(p.urlList.length, listSeoPaths().length, 'payload must match the sitemap exactly');

  const src = readFileSync(new URL('../server/index.ts', import.meta.url), 'utf8');
  const at = src.indexOf('registerIndexNowRoutes(app)');
  assert.ok(at > 0, 'IndexNow routes must be registered');
  assert.ok(src.lastIndexOf("app.get('*'") > at, 'before the SPA catch-all');
});

test('guides link into the answer layer so it is one hop from indexed content', () => {
  const index = renderGuidesIndex(ORIGIN);
  assert.ok(index.includes('href="/answers"'), 'guides index must link /answers');
  for (const slug of GUIDE_SLUGS.slice(0, 3)) {
    const html = renderGuidePage(slug, ORIGIN);
    assert.ok(html && html.includes('href="/answers"'), `${slug} must link /answers`);
  }
});

test('every indexed city page links UP to its state answer page (crawl + relevance both ways)', async () => {
  const { ANSWER_STATES } = await import('../server/seo/answerStates');
  const cases: Array<[string, string]> = [
    ['/hotels/kolkata', 'west-bengal'],
    ['/grocery/hyderabad', 'telangana'],
    ['/cabs/patna', 'bihar'],
  ];
  for (const [path, stateSlug] of cases) {
    const page = resolveSeoPage(path as any);
    assert.ok(page, `${path} must resolve`);
    const hrefs = (page!.links || []).map((l) => l.href);
    const vertical = path.split('/')[1];
    assert.ok(hrefs.includes(`/best/${vertical}/${stateSlug}`), `${path} must link /best/${vertical}/${stateSlug} (got ${hrefs.join(',')})`);
    assert.ok(hrefs.includes(`/best/${vertical}`), `${path} must link the /best/${vertical} hub`);
    // the state must really contain that city, so the link is not invented
    const st = ANSWER_STATES.find((x) => x.slug === stateSlug)!;
    const city = path.split('/')[2];
    assert.ok(st.cities.some((c) => c.toLowerCase().replace(/\s+/g, '-') === city), `${city} must be listed in ${st.name}`);
  }
});

test('route pages link the vertical answer hub', () => {
  const flight = resolveSeoPage('/flights/indore-to-delhi-flights' as any);
  assert.ok(flight, 'flight route page must resolve');
  assert.ok((flight!.links || []).some((l) => l.href === '/best/flights'), 'flight route must link /best/flights');
});

test('Bing verification file is served verbatim at the site root', async () => {
  const express = (await import('express')).default;
  const { registerBingAuthRoutes, BING_AUTH_PATH, BING_AUTH_XML } = await import('../server/seo/bingAuth');
  assert.equal(BING_AUTH_PATH, '/BingSiteAuth.xml');
  assert.match(BING_AUTH_XML, /<user>E811B25A024009A953C73041CF399A5E<\/user>/, 'must carry the exact Bing token');
  assert.ok(BING_AUTH_XML.startsWith('<?xml version="1.0"?>'), 'must keep the XML declaration byte for byte');
  const app = express();
  registerBingAuthRoutes(app);
  const server = app.listen(4612);
  try {
    const res = await fetch(`http://127.0.0.1:4612${BING_AUTH_PATH}`);
    assert.equal(res.status, 200);
    assert.match(String(res.headers.get('content-type')), /xml/, 'must not be served as HTML');
    assert.equal(await res.text(), BING_AUTH_XML, 'body must match the file exactly, not the SPA shell');
  } finally {
    server.close();
  }
});
