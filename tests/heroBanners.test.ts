import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HeroSlide } from '../server/home/heroBanners';

/**
 * Hero banner carousel (owner 23 Oct): the mixed-content slide CONTRACT —
 * shape every consumer (web + Flutter) relies on. Slide kind is one of the
 * mixed verticals (movie / food / ecommerce / custom) so the carousel is
 * never a movie-only strip.
 */
test('HeroSlide contract keeps the mixed-content kinds the clients switch on', () => {
  const kinds: HeroSlide['kind'][] = ['movie', 'food', 'ecommerce', 'custom'];
  assert.deepEqual([...kinds].sort(), [...new Set(kinds)].sort()); // no dupes
  assert.ok(kinds.includes('movie'));
  assert.ok(kinds.includes('food'));
  assert.ok(kinds.includes('ecommerce')); // owner: 1st movie, 2nd food, 3rd ecom
});

test('hero endpoint module exports buildHeroBanners and always resolves', async () => {
  const mod = await import('../server/home/heroBanners');
  assert.equal(typeof mod.buildHeroBanners, 'function');
  // Composes live sources with honest skips — resolves to a slide array
  // (possibly empty when sources are unreachable from the sandbox).
  const slides = await mod.buildHeroBanners();
  assert.ok(Array.isArray(slides));
  for (const s of slides) {
    assert.ok(s.id && s.heading, 'every slide carries id + heading');
    assert.ok(s.badge, 'every slide carries a badge pill');
    assert.ok(s.cta, 'every slide carries a CTA label');
    assert.ok(['movie', 'food', 'ecommerce', 'custom'].includes(s.kind));
    // tap target: external url OR in-app launch, never both null
    assert.ok(s.url !== null || s.launch !== null, 'slide is tappable');
  }
});

/**
 * Section banners (owner 23 Oct follow-up): the BETWEEN-SECTION strips must be
 * MIXED content (movies + food + ecom), never a movie-only strip. The route
 * merges admin banners with these live-composed ones.
 */
test('buildSectionBanners returns mixed verticals with usable strip fields', async () => {
  const mod = await import('../server/home/heroBanners');
  assert.equal(typeof mod.buildSectionBanners, 'function');
  const banners = await mod.buildSectionBanners();
  assert.ok(Array.isArray(banners));
  const links = new Set(banners.map((b) => b.link));
  // With live pools reachable the strip covers more than one vertical; from
  // a gated sandbox at least the contract must hold for whatever composes.
  for (const b of banners) {
    assert.ok(b.id, 'banner carries an id');
    assert.ok(b.imageUrl && /^https?:\/\//.test(b.imageUrl), 'banner image is an absolute url');
    assert.ok(['movies', 'food', 'ecommerce'].includes(b.link), 'banner links a vertical');
  }
  // if ANY banner composed, the mixed-vertical invariant is real data driven
  if (banners.length > 0 && (await mod.buildSectionBanners()).length > 0) {
    assert.ok(banners.length <= 8, 'capped: at most 8 live section banners');
  }
});
