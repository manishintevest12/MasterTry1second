import test from 'node:test';
import assert from 'node:assert/strict';
import { renderLegalPage, LEGAL_ALIASES } from '../server/seo/legalPages';
import { LEGAL_PAGES } from '../server/seo/legalContent';
import { listSeoPaths } from '../server/seo/data';
import { robotsText } from '../server/seo/sitemap';

/**
 * OWNER 2 Nov: AdSense put try1second.com on "Needs attention - Low value content". Before this,
 * /privacy-policy, /terms, /about and /contact all answered the SPA shell (measured in production:
 * HTTP 200, 27 words, homepage <title>), so the site looked like it had no policies at all.
 */
test('every legal/support page is real server-rendered HTML with its own title and an H1', () => {
  for (const slug of Object.keys(LEGAL_PAGES)) {
    const html = renderLegalPage(slug, 'https://www.try1second.com') || '';
    const words = html.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').trim().split(/\s+/).length;
    assert.ok(words > 50, `${slug} must carry real copy, got ${words} words`);
    assert.equal((html.match(/<h1>/g) || []).length, 1, `${slug} must have exactly one H1`);
    assert.match(html, new RegExp(`<title>${LEGAL_PAGES[slug].title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</title>`));
    assert.match(html, new RegExp(`rel="canonical" href="https://www.try1second.com/${slug}"`));
    assert.match(html, /name="robots" content="index,follow/);
    assert.doesNotMatch(html, /Try1Second — One Second Is All It Takes/, 'must not fall back to the shell title');
  }
});

test('reviewer-friendly aliases resolve to a real page', () => {
  for (const [path, slug] of Object.entries(LEGAL_ALIASES)) {
    assert.ok(renderLegalPage(slug, 'https://www.try1second.com'), `${path} -> ${slug} must render`);
  }
  assert.equal(LEGAL_ALIASES['/privacy'], 'privacy-policy');
  assert.equal(LEGAL_ALIASES['/disclaimer'], 'terms');
});

test('sitemap lists the legal pages and robots.txt allows crawling them', () => {
  const paths = listSeoPaths();
  for (const p of ['/privacy-policy', '/terms', '/about', '/contact', '/faq', '/affiliate-disclosure']) {
    assert.ok(paths.includes(p), `${p} must be in the sitemap`);
  }
  const robots = robotsText();
  assert.match(robots, /Allow: \//);
  assert.doesNotMatch(robots, /Disallow: \/privacy|Disallow: \/terms|Disallow: \/about/);
});
