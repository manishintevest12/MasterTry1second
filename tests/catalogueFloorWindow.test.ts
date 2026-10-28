/**
 * OWNER 28 Oct: "bus, food, movies tho ni de raha" — the cold-start floor rejected every
 * row older than one hour for travel verticals, so a bus route whose sources were gated
 * showed an empty first paint even though a real last-verified fare sat in MySQL.
 * These tests pin the window maths and the INVALID rule.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { filterRowsByAge } from '../server/search/searchOrchestrator';

const now = Date.parse('2026-10-28T08:00:00.000Z');
const row = (minutesAgo: number, status = 'VALID') => ({
  id: `r${minutesAgo}`, fetched_at: new Date(now - minutesAgo * 60_000).toISOString(), validation_status: status,
});

test('strict window keeps only recent rows', () => {
  const rows = [row(10), row(59), row(90), row(60 * 20)];
  assert.equal(filterRowsByAge(rows, 3600, now).length, 2);
});

test('fallback window admits the older last-verified rows', () => {
  const rows = [row(10), row(90), row(60 * 20), row(60 * 30)];
  assert.equal(filterRowsByAge(rows, 24 * 3600, now).length, 3, '20h row belongs to the 24h window, 30h does not');
});

test('INVALID rows never enter a floor, however fresh', () => {
  assert.equal(filterRowsByAge([row(1, 'INVALID'), row(5)], 24 * 3600, now).length, 1);
});

test('a row exactly at the window edge is excluded, not included', () => {
  assert.equal(filterRowsByAge([row(60)], 3600, now).length, 0);
});

test('travel verticals get the wide fallback window (bus/hotels are fetched in cycles)', async () => {
  const { floorWindows } = await import('../server/search/searchOrchestrator');
  for (const v of ['flights', 'hotels', 'bus', 'cab']) {
    assert.deepEqual(floorWindows(v), { strict: 3600, fallback: 24 * 3600 }, v);
  }
});

test('non-travel verticals keep the 24h/72h pair', async () => {
  const { floorWindows } = await import('../server/search/searchOrchestrator');
  for (const v of ['ecommerce', 'grocery', 'food', 'movies', 'loans', 'insurance']) {
    assert.deepEqual(floorWindows(v), { strict: 24 * 3600, fallback: 72 * 3600 }, v);
  }
});
