/**
 * Home URL sync (owner 29 Oct: "site mai agar ecommerce vertical se home pr aata hoon
 * tho link change ni hota"). The vertical writer pushed /ecommerce etc. into the address
 * bar, but Home had no path, so the screen said Home while the URL (and every share,
 * bookmark or Back) still pointed at the vertical.
 *
 * These tests pin the shared route map that both the writer (vertical/tab switch) and
 * the reader (popstate restore) now use.
 */
import { test } from 'node:test';
import assert from 'node:assert';
import {
  HOME_PATH,
  VERTICAL_PATHS,
  normalizePath,
  verticalPathFor,
  isVerticalPath,
  isProductPath,
  homePathFrom,
} from '../src/utils/verticalRoutes';

test('every comparison vertical has a canonical path and Home is the root', () => {
  for (const v of ['flights', 'hotels', 'bus', 'ecommerce', 'grocery', 'food', 'movie', 'loans', 'insurance', 'creditcards', 'account', 'cab']) {
    assert.match(verticalPathFor(v) || '', /^\/[a-z-]+$/, `${v} needs a path`);
  }
  assert.strictEqual(HOME_PATH, '/');
  assert.strictEqual(verticalPathFor('nonexistent'), null);
});

test('the paths are the ones already live (no URL churn, no SEO break)', () => {
  assert.strictEqual(verticalPathFor('ecommerce'), '/ecommerce');
  assert.strictEqual(verticalPathFor('movie'), '/movies');
  assert.strictEqual(verticalPathFor('creditcards'), '/credit-cards');
  assert.strictEqual(verticalPathFor('account'), '/bank-accounts');
  assert.strictEqual(verticalPathFor('cab'), '/cabs');
});

test('leaving a vertical for Home writes the root path (the reported bug)', () => {
  assert.strictEqual(homePathFrom('/ecommerce'), '/');
  assert.strictEqual(homePathFrom('/ecommerce/'), '/');
  assert.strictEqual(homePathFrom('/movies'), '/');
  assert.strictEqual(homePathFrom('/product/boat-airdopes-141'), '/');
});

test('already on Home -> no extra history entry', () => {
  assert.strictEqual(homePathFrom('/'), null);
  assert.strictEqual(homePathFrom(''), null);
  assert.strictEqual(homePathFrom('   '), null);
});

test('private admin/merchant screens keep their own URL', () => {
  for (const p of ['/admininsta', '/merchantinstab2b', '/admin', '/merchant']) {
    assert.strictEqual(homePathFrom(p), null, `${p} must not be rewritten`);
  }
});

test('path classification: verticals, product pages, everything else', () => {
  assert.strictEqual(isVerticalPath('/ecommerce'), true);
  assert.strictEqual(isVerticalPath('/ecommerce/'), true);
  assert.strictEqual(isVerticalPath('/e-commerce'), false);
  assert.strictEqual(isVerticalPath('/'), false);
  assert.strictEqual(isProductPath('/product/boat-airdopes-141'), true);
  assert.strictEqual(isProductPath('/product/ab'), false);
  assert.strictEqual(isProductPath('/product'), false);
  // An unrelated SEO landing page is NOT silently turned into Home.
  assert.strictEqual(homePathFrom('/flights/delhi-to-mumbai-flights'), null);
  assert.strictEqual(homePathFrom('/blog/some-post'), null);
});

test('normalizePath trims slashes without inventing a path', () => {
  assert.strictEqual(normalizePath('/ecommerce///'), '/ecommerce');
  assert.strictEqual(normalizePath('/'), '/');
  assert.strictEqual(normalizePath(''), '/');
});

test('the map has no duplicate destinations', () => {
  const values = Object.values(VERTICAL_PATHS);
  assert.strictEqual(new Set(values).size, values.length);
});
