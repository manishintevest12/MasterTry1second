import test from 'node:test';
import assert from 'node:assert/strict';
import { CITY_STATE, INDIAN_CITIES, citiesOfState } from '../server/seo/cityCorpus';
import { ANSWER_STATES } from '../server/seo/answerStates';
import { listSeoPaths, resolveSeoPage } from '../server/seo/data';
import { sitemapPriority } from '../server/seo/sitemap';

test('every state and UT has at least one city page and every city maps to a real state', () => {
  assert.ok(INDIAN_CITIES.length >= 400, `corpus should cover the country, got ${INDIAN_CITIES.length}`);
  for (const st of ANSWER_STATES) {
    assert.ok(citiesOfState(st.slug).length > 0, `${st.slug} has no city`);
    assert.ok(st.cities.length > 0, `${st.slug} answer page lists no city`);
  }
  for (const c of INDIAN_CITIES) {
    assert.equal(CITY_STATE[c.name.toLowerCase()], c.state);
    assert.ok(ANSWER_STATES.some((s) => s.slug === c.state), `${c.name} points at unknown state ${c.state}`);
  }
});

test('slugs are unique so no place can overwrite another', () => {
  const slugs = INDIAN_CITIES.map((c) => c.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  assert.equal(new Set(slugs.map((s) => s.trim())).size, slugs.length);
  assert.ok(slugs.every((s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)), 'slugs stay url-safe');
});

test('city pages exist for places the old 38-city list never had', () => {
  const paths = new Set(listSeoPaths());
  for (const url of ['/hotels/kozhikode', '/hotels/siliguri', '/cabs/bhilai', '/movies/itanagar', '/food/imphal', '/grocery/warangal', '/hotels/port-blair', '/hotels/leh']) {
    assert.ok(paths.has(url), `${url} missing from the sitemap`);
  }
  const page = resolveSeoPage('/hotels/kozhikode');
  assert.ok(page, 'a new city page must resolve');
  assert.match(page!.title, /Kozhikode/);
  assert.match(page!.h1, /Kozhikode/);
});

test('a city page links its own state before distant metros, and the sitemap tiering stays honest', () => {
  const page = resolveSeoPage('/hotels/kozhikode')!;
  const stateLink = page.links.find((l) => l.href === '/best/hotels/kerala');
  assert.ok(stateLink, 'city page must link up to its state answer page');
  assert.equal(sitemapPriority('/hotels/mumbai'), '0.7');
  assert.equal(sitemapPriority('/hotels/kozhikode'), '0.5');
});
