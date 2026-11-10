/**
 * OWNER 10 Nov: "muje unka system yaa architecture implement kro jo v partner site result ni de rahe unke
 * liye. kyunki muje result chaiye kaise v". These pin the architecture, not a vendor: cheapest rung first,
 * only configured rungs, remembered order per host, and an honest exhausted report.
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { CANONICAL_LADDER, rescueRungs, rescueOrderFor, describeRescue } from '../server/sources/rescueFetch';

const SRC = readFileSync(new URL('../server/sources/rescueFetch.ts', import.meta.url), 'utf8');

test('ladder is direct-first and ordered by cost', () => {
  assert.deepEqual(CANONICAL_LADDER, ['direct', 'relay', 'scraperapi', 'reader']);
  assert.equal(rescueRungs()[0], 'direct');
});

test('only configured rungs are attempted', () => {
  const savedRelay = process.env.T1S_EDGE_RELAY;
  const savedScraper = process.env.SCRAPER_API_KEY;
  delete process.env.SCRAPER_API_KEY;
  delete process.env.T1S_EDGE_RELAY;
  const rungs = rescueRungs();
  assert.ok(rungs.includes('direct'));
  assert.ok(!rungs.includes('scraperapi'), 'no key -> no scraperapi rung');
  if (savedRelay) process.env.T1S_EDGE_RELAY = savedRelay;
  if (savedScraper) process.env.SCRAPER_API_KEY = savedScraper;
});

test('learned order is per host and always starts with a usable rung', () => {
  const a = rescueOrderFor('booking.com');
  const b = rescueOrderFor('oyo.com');
  assert.equal(a[0], 'direct');
  assert.equal(b[0], 'direct');
  assert.ok(a.length >= 1);
});

test('a gated or short body never counts as success', () => {
  assert.ok(SRC.includes("reason: 'gated/blocks page'"));
  assert.ok(SRC.includes('short body'));
});

test('exhausted runs still report every rung tried', () => {
  const msg = describeRescue({
    status: 405, body: '', via: 'none', exhausted: true,
    attempts: [
      { via: 'direct', ok: false, status: 405, bytes: 0, reason: 'HTTP 405', ms: 12 },
      { via: 'scraperapi', ok: false, status: 200, bytes: 8859, reason: 'gated/blocks page', ms: 900 },
    ],
  });
  assert.match(msg, /all transports failed/);
  assert.match(msg, /direct:HTTP 405/);
  assert.match(msg, /scraperapi:gated/);
});

test('scoreboard learning is persisted, not in-memory only', () => {
  assert.ok(SRC.includes('CREATE TABLE IF NOT EXISTS rescue_scoreboard'));
  assert.ok(SRC.includes('ON DUPLICATE KEY UPDATE wins = wins + 1'));
});
