import test from 'node:test';
import assert from 'node:assert/strict';
import { GUIDES, GUIDE_BY_SLUG } from '../server/seo/guides';
import { renderGuidePage, renderGuidesIndex } from '../server/seo/guidePages';
import { listSeoPaths } from '../server/seo/data';

/**
 * OWNER 2 Nov: AdSense rejected try1second.com for "Low value content" and asked for "substantial
 * unique value ... authentic, high-quality information". These tests hold the editorial surface to
 * that bar so a future edit cannot quietly turn the guides back into thin filler.
 */
test('every guide carries substantial original copy', () => {
  for (const g of GUIDES) {
    const words = g.blocks
      .map((b) => (b.t === 'ul' ? b.items.join(' ') : b.x))
      .join(' ')
      .split(/\s+/)
      .filter(Boolean).length;
    assert.ok(words >= 300, `${g.slug} has only ${words} words - thin content risk`);
    assert.ok(g.description.length >= 80, `${g.slug} needs a real meta description`);
    assert.ok(g.blocks.filter((b) => b.t === 'h2').length >= 2, `${g.slug} needs at least two H2 sections`);
    assert.ok(g.verticals.length > 0, `${g.slug} must link into a vertical`);
  }
});

test('guide pages render unique titles, canonical, Article JSON-LD and a live-vertical link', () => {
  const titles = new Set<string>();
  for (const g of GUIDES) {
    const html = renderGuidePage(g.slug, 'https://www.try1second.com') || '';
    assert.ok(html.includes(`<title>${g.title}</title>`), `${g.slug} title missing`);
    assert.ok(html.includes(`rel="canonical" href="https://www.try1second.com/guides/${g.slug}"`));
    assert.ok(html.includes('"@type":"Article"'), `${g.slug} needs Article structured data`);
    assert.ok(html.includes(`href="/${g.verticals[0]}"`), `${g.slug} must link to its vertical`);
    assert.ok(html.includes('index,follow'), `${g.slug} must be indexable`);
    assert.ok(!/adsbygoogle/.test(html), 'no ad unit on a thin/guide page');
    titles.add(g.title);
  }
  assert.equal(titles.size, GUIDES.length, 'guide titles must be unique');
});

test('no guide invents prices or statistics', () => {
  for (const g of GUIDES) {
    const body = g.blocks.map((b) => (b.t === 'ul' ? b.items.join(' ') : b.x)).join(' ');
    // A rupee figure in evergreen copy goes stale within days and is a classic thin-content signal.
    assert.doesNotMatch(body, /₹\s?\d/, `${g.slug} must not hardcode a price`);
    assert.doesNotMatch(body, /\b\d{2,}%\s+of\s+(users|travellers|shoppers)/i, `${g.slug} must not invent statistics`);
  }
});

test('guides index and sitemap expose every guide', () => {
  const index = renderGuidesIndex('https://www.try1second.com');
  const paths = listSeoPaths();
  assert.ok(index.includes('href="/guides"'));
  for (const g of GUIDES) {
    assert.ok(index.includes(`href="/guides/${g.slug}"`), `${g.slug} missing from the index`);
    assert.ok(paths.includes(`/guides/${g.slug}`), `${g.slug} missing from the sitemap`);
    assert.ok(GUIDE_BY_SLUG[g.slug], 'slug lookup must resolve');
  }
  assert.ok(paths.includes('/guides'));
  assert.equal(renderGuidePage('nope', 'https://www.try1second.com'), undefined);
});
