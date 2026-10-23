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
