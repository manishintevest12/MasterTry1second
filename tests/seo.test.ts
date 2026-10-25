/**
 * SEO layer tests (owner 25 Oct: "sab ka SEO automatic tagra").
 * - every sitemap URL resolves to a real, unique, prerendered page
 * - head injection: unique title/description/canonical/JSON-LD per URL
 * - admin/merchant paths stay noindex and never prerender
 * - robots.txt points at the sitemap and blocks private areas
 */
import { strict as assert } from 'assert';
import { listSeoPaths, resolveSeoPage, resolveAppRoute } from '../server/seo/data';
import { enhanceHtml } from '../server/seo/render';
import { robotsText, sitemapXml } from '../server/seo/sitemap';

const shell = (p: string) => enhanceHtml(
  `<html><head><title>Try1Second</title><meta name="description" content="d" /><meta property="og:title" content="d" /><meta property="og:description" content="d" /></head><body><div id="root"></div></body></html>`,
  p,
);

const run = async () => {
  // 1. Sitemap corpus
  const paths = listSeoPaths();
  assert.ok(paths.length >= 300, `expected a rich corpus, got ${paths.length}`);
  assert.strictEqual(new Set(paths).size, paths.length, 'duplicate sitemap URLs');
  assert.ok(paths.includes('/'), 'home in sitemap');
  assert.ok(paths.some((p) => p.startsWith('/flights/')), 'flight routes in sitemap');
  assert.ok(paths.some((p) => p.startsWith('/bus/')), 'bus routes in sitemap');

  // 2. Every sitemap URL is a real page with content
  const titles = new Set<string>();
  for (const p of paths) {
    const page = resolveSeoPage(p);
    assert.ok(page, `sitemap URL ${p} has no SEO page`);
    assert.ok(page.title.length > 10 && page.title.length <= 65 + 30, `title sane at ${p}`);
    assert.ok(page.description.length >= 70 && page.description.length <= 180, `description 70-180 chars at ${p}`);
    assert.ok(page.h1 && page.intro.length >= 1 && page.faqs.length >= 1, `content present at ${p}`);
    assert.ok(page.breadcrumbs.length >= 1, `breadcrumbs at ${p}`);
    assert.ok(!titles.has(page.title), `duplicate title across corpus: ${page.title}`);
    titles.add(page.title);

    const html = shell(p);
    assert.ok(html.includes(`<title>${page.title.replace(/&/g, '&amp;')}`), `title injected at ${p}`);
    assert.ok(html.includes(`rel="canonical" href="https://www.try1second.com${p}"`), `canonical at ${p}`);
    assert.ok(html.includes('application/ld+json'), `json-ld at ${p}`);
    assert.ok(html.includes('<div id="root"><section'), `prerender block at ${p}`);
    assert.ok(!html.includes('noindex'), `indexable at ${p}`);
  }

  // 3. Sitemap XML shape
  const xml = sitemapXml();
  assert.strictEqual((xml.match(/<loc>/g) || []).length, paths.length, 'sitemap covers every URL');
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'xml prolog');
  assert.ok((xml.match(/<lastmod>/g) || []).length === paths.length, 'lastmod on every URL');

  // 4. robots.txt
  const robots = robotsText();
  assert.ok(robots.includes('Sitemap: https://www.try1second.com/sitemap.xml'), 'robots links sitemap');
  assert.ok(robots.includes('Disallow: /admin'), 'robots blocks admin');
  assert.ok(robots.includes('Disallow: /api'), 'robots blocks api');

  // 5. Private paths: noindex, never prerendered
  for (const priv of ['/admininsta', '/merchantinstab2b', '/api/anything']) {
    const html = shell(priv);
    assert.ok(html.includes('noindex, nofollow'), `noindex at ${priv}`);
    assert.ok(!html.includes('<div id="root"><section'), `no prerender at ${priv}`);
  }

  // 6. App deep-link resolution drives real searches
  assert.deepStrictEqual(resolveAppRoute('/flights/delhi-to-mumbai-flights'), { vertical: 'flights', query: 'Delhi (DEL) to Mumbai (BOM)' });
  assert.deepStrictEqual(resolveAppRoute('/bus/indore-to-bhopal-bus'), { vertical: 'bus', query: 'Indore to Bhopal' });
  assert.deepStrictEqual(resolveAppRoute('/hotels/indore'), { vertical: 'hotels', query: 'Indore' });
  assert.deepStrictEqual(resolveAppRoute('/loans/personal-loan'), { vertical: 'loans', query: 'personal loan' });
  assert.deepStrictEqual(resolveAppRoute('/ecommerce/mobile-phones'), { vertical: 'ecommerce', query: 'mobile phone' });
  assert.deepStrictEqual(resolveAppRoute('/cabs/indore'), { vertical: 'cab', query: 'Indore' });
  assert.deepStrictEqual(resolveAppRoute('/credit-cards/fuel-credit-cards'), { vertical: 'creditcards', query: 'fuel credit card' });
  assert.ok(!resolveAppRoute('/admininsta'), 'admin not an SEO route');
  assert.ok(!resolveAppRoute('/random/xyz'), 'unknown route rejected');

  // 7. Unknown public paths fall back to the default shell (no crash)
  const unknown = shell('/some-random-page');
  assert.ok(unknown.includes('<title>'), 'unknown path still serves HTML');

  console.log(`seo.test.ts: all assertions passed (${paths.length} SEO URLs verified)`);
};

run().catch((e) => { console.error(e); process.exit(1); });
