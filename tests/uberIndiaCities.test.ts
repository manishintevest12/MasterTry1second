import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { uberIndiaCityFor, UBER_INDIA_PAGE_COUNT } from '../server/workers/parsers/uberIndiaCities';

/** Owner request 17 Oct: "Uber 96+ cities without API". Uber's own sitemap publishes
 *  2241 Indian city/locality presence pages — priced rows where Uber publishes a fare
 *  table, honest "available only on app" presence rows everywhere else. */
test('registry: 2241 sitemap-published India pages parsed with state-stripped city names', () => {
  assert.equal(UBER_INDIA_PAGE_COUNT, 2241);
  const ind = uberIndiaCityFor('Indore');
  assert.equal(ind?.slug, 'indore-madhya-pradesh-in');
  assert.equal(ind?.city, 'Indore');
});

test('registry lookup: district-style names resolve to their city', () => {
  assert.equal(uberIndiaCityFor('Juni Indore Tahsil')?.slug, 'indore-madhya-pradesh-in');
  assert.equal(uberIndiaCityFor('Gautam Buddha Nagar')?.slug, 'gautam-buddha-nagar-uttar-pradesh-in');
});

test('registry lookup: word-boundary matching (bengaluru must never match the town Alur)', () => {
  const hit = uberIndiaCityFor('Bengaluru');
  if (hit) assert.ok(!/alur/.test(hit.slug), `regression: matched ${hit.slug}`);
});

test('cab worker wires the registry into the SSR fallback and emits presence rows', () => {
  const s = readFileSync('server/workers/verticals/cab.ts', 'utf8');
  assert.ok(s.includes("from '../parsers/uberIndiaCities'"), 'registry imported');
  assert.ok(s.includes('uber-presence-'), 'presence-row sku emitted');
  assert.ok(s.includes("available only on app, never estimated"), 'honest app-only wording');
  assert.ok(s.includes('.map((t) => canonCity(t))'), 'destination matching canonicalizes city spellings');
});
