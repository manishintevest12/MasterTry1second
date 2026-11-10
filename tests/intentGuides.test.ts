/**
 * OWNER 10 Nov (GSC report 3.2): eleven target searches had "Koi URL nahi". These tests pin that every one
 * of them now has a dedicated, indexable, internally linked page, and that the copy stays honest (no
 * invented numbers, no "we are the best" claim) because that is what keeps the pages from reading as thin.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { INTENT_GUIDES } from '../server/seo/intentGuides';
import { GUIDE_BY_SLUG } from '../server/seo/guides';
import { renderGuidePage } from '../server/seo/guidePages';
import { listSeoPaths, resolveSeoPage } from '../server/seo/data';

const ORIGIN = 'https://www.try1second.com';

// query the owner listed -> the slug that must answer it
const QUERY_TO_SLUG: Record<string, string> = {
  'try1second.com price comparison': 'try1second-price-comparison',
  'best flight booking comparison website india': 'best-flight-booking-comparison-website-india',
  'compare flight prices india all websites one search': 'compare-flight-prices-india-all-websites',
  'best hotel price comparison site india': 'best-hotel-price-comparison-site-india',
  'best bus ticket price comparison site india': 'best-bus-ticket-price-comparison-site-india',
  'best company in world for hotel booking': 'best-company-for-hotel-booking-in-the-world',
  'best hotel company in maharashtra': 'best-hotel-company-in-maharashtra',
  'bus ticket price comparison indore to bhopal': 'indore-to-bhopal-bus-ticket-price-comparison',
  'compare grocery prices hyderabad blinkit zepto instamart': 'compare-grocery-prices-hyderabad-blinkit-zepto-instamart',
  'best price comparison website india': 'best-price-comparison-website-india',
  'best movie ticket price comparison india': 'best-movie-ticket-price-comparison-india',
};

test('every owner-listed query has its own page, registered as a guide', () => {
  for (const [query, slug] of Object.entries(QUERY_TO_SLUG)) {
    assert.ok(GUIDE_BY_SLUG[slug], `no page for "${query}"`);
  }
  assert.equal(INTENT_GUIDES.length, Object.keys(QUERY_TO_SLUG).length, 'one page per owner query, no strays');
});

test('each page leads with the searched phrase and is indexable with a self canonical', () => {
  for (const [query, slug] of Object.entries(QUERY_TO_SLUG)) {
    const html = renderGuidePage(slug, ORIGIN) || '';
    assert.ok(html, `${slug} must render`);
    assert.ok(html.includes(`rel="canonical" href="${ORIGIN}/guides/${slug}"`), `${slug} canonical`);
    assert.ok(html.includes('index,follow'), `${slug} indexable`);
    // the page must contain the core words of the search so the intent is unmistakable
    const words = query.replace(/\.com/g, '').split(/\s+/).filter((w) => w.length > 3 && !['india', 'one', 'search', 'all', 'world'].includes(w));
    const lower = html.toLowerCase();
    const hit = words.filter((w) => lower.includes(w)).length;
    assert.ok(hit >= Math.ceil(words.length * 0.7), `${slug} does not cover the words of "${query}"`);
  }
});

test('all eleven pages are in the sitemap', () => {
  const paths = new Set(listSeoPaths());
  for (const slug of Object.values(QUERY_TO_SLUG)) assert.ok(paths.has(`/guides/${slug}`), `${slug} missing from sitemap`);
});

test('the homepage and each vertical hub link the pages that answer their searches', () => {
  const home = resolveSeoPage('/');
  const homeLinks = (home?.links || []).map((l) => l.href);
  for (const slug of Object.values(QUERY_TO_SLUG)) assert.ok(homeLinks.includes(`/guides/${slug}`), `homepage must link ${slug}`);
  const expect: Record<string, string[]> = {
    flights: ['best-flight-booking-comparison-website-india', 'compare-flight-prices-india-all-websites'],
    hotels: ['best-hotel-price-comparison-site-india', 'best-company-for-hotel-booking-in-the-world', 'best-hotel-company-in-maharashtra'],
    bus: ['best-bus-ticket-price-comparison-site-india', 'indore-to-bhopal-bus-ticket-price-comparison'],
    grocery: ['compare-grocery-prices-hyderabad-blinkit-zepto-instamart'],
    movies: ['best-movie-ticket-price-comparison-india'],
  };
  for (const [v, slugs] of Object.entries(expect)) {
    const links = (resolveSeoPage(`/${v}`)?.links || []).map((l) => l.href);
    for (const slug of slugs) assert.ok(links.includes(`/guides/${slug}`), `/${v} must link ${slug}`);
  }
});

test('copy stays honest: no invented figures, no "we are the best" or "cheapest" claim, always the caveat', () => {
  for (const g of INTENT_GUIDES) {
    const text = g.blocks.map((b: any) => (b.t === 'ul' ? b.items.join(' ') : b.x)).join(' ');
    assert.ok(!/₹\s?\d|rs\.?\s?\d|\d+\s?%/i.test(text), `${g.slug} must not quote prices or percentages`);
    assert.ok(!/\bwe are (the )?(best|cheapest|#1|number one)\b/i.test(text), `${g.slug} must not claim to be the best`);
    assert.ok(!/\bguarantee[sd]? (the )?(lowest|cheapest)\b/i.test(text), `${g.slug} must not guarantee a lowest price`);
    assert.ok(/metasearch engine/.test(text), `${g.slug} must carry the metasearch caveat`);
  }
});

test('every seller a page names is a real source in the codebase', async () => {
  const { readdirSync, readFileSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');
  const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : []; });
  const code = [...walk('server/workers'), ...walk('server/sources')].map((f) => readFileSync(f, 'utf8').toLowerCase()).join('\n');
  const named = ['redbus', 'abhibus', 'zingbus', 'makemytrip', 'goibibo', 'yatra', 'cleartrip', 'aertrip', 'oyo', 'agoda', 'booking', 'easemytrip', 'kiwi', 'gotogate', 'flightnetwork', 'budgetair', 'blinkit', 'zepto', 'bigbasket', 'bookmyshow', 'ticketnew', 'district', 'indigo', 'akasa', 'ixigo'];
  for (const n of named) assert.ok(code.includes(n), `${n} is named on a page but not a source in server/`);
});

test('movie city pages carry city-specific substance instead of the shared template (report page 2)', async () => {
  const { resolveSeoPage } = await import('../server/seo/data');
  const { MOVIE_CITY_CONTENT } = await import('../server/seo/movieCities');
  const b = resolveSeoPage('/movies/bengaluru') as any;
  const n = resolveSeoPage('/movies/noida') as any;
  assert.ok(b && n, 'both city pages resolve');
  assert.notEqual(b.title, n.title, 'titles must differ per city');
  assert.ok(/Kannada/.test(b.intro.join(' ')), 'Bengaluru page names its language market');
  assert.ok(!/Kannada/.test(n.intro.join(' ')), 'Noida page must not borrow Bengaluru copy');
  assert.ok(b.faqs.length >= 4, 'movie city pages answer real questions');
  // every city we claim facts for must stay a real city we generate
  for (const slug of Object.keys(MOVIE_CITY_CONTENT)) {
    assert.ok(resolveSeoPage(`/movies/${slug}`), `${slug} must have a live page`);
  }
  // hotels must be untouched by the movie enrichment
  const h = resolveSeoPage('/hotels/bengaluru') as any;
  assert.ok(h.title.includes('Hotels in Bengaluru'), 'hotel city title unchanged');
});
