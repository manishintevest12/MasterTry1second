/**
 * Regression: Ixigo flights route slugs must never contain %20 —
 * "New Delhi (DEL) to Mumbai (BOM)" produced
 * /search/flight/new%20delhi/mumbai/... which Ixigo 404s, poisoning the
 * search cache with "Ixigo HTTP 404" failures (14 Oct 2026).
 * IATA tokens always resolve; unknown cities fall back to underscore slugs
 * with a hyphen retry.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ixigoRouteTokens } from '../server/workers/parsers/ixigoFlights.ts';

const IATA: Record<string, string> = {
  delhi: 'DEL', 'new delhi': 'DEL', mumbai: 'BOM', indore: 'IDR',
};

test('ixigo: known city resolves to its IATA token (no %20 ever)', () => {
  const t = ixigoRouteTokens('New Delhi', 'Mumbai', 'DEL', 'BOM', IATA);
  assert.equal(t.fromTok, 'DEL');
  assert.equal(t.toTok, 'BOM');
  assert.ok(!t.fromTok.includes(' ') && !t.toTok.includes('%20'));
  // primary already-IATA: alternate is the underscore city slug
  assert.deepEqual(t.alts, ['new_delhi']);
});

test('ixigo: IATA map lookup works without parenthesised codes', () => {
  const t = ixigoRouteTokens('Indore', 'Delhi', undefined, undefined, IATA);
  assert.equal(t.fromTok, 'IDR');
  assert.equal(t.toTok, 'DEL');
});

test('ixigo: unknown single-word city has clean slug and no alts', () => {
  const t = ixigoRouteTokens('Khajuraho', 'Agra', undefined, undefined, IATA);
  assert.equal(t.fromTok, 'khajuraho');
  assert.equal(t.toTok, 'agra');
  assert.deepEqual(t.alts, []); // nothing better to try for single-word unknown cities
});

test('ixigo: multiword unknown city underscores then hyphenates', () => {
  const t = ixigoRouteTokens('Port Blair', 'Chennai', undefined, undefined, IATA);
  assert.equal(t.fromTok, 'port_blair');
  assert.ok(t.alts.includes('port-blair'));
});
