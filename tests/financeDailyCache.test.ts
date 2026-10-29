import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Owner 23 Oct ("loan, insurance, credit card, bank account ka data change ni
 * hota frequently tho inko save kr ke result fast do aur din mai ek baar scrap
 * krwao"): the finance segments must serve INSTANTLY from saved cache and be
 * live-scraped only once a day.
 */

test('search cache TTL: finance segments 24h fresh / 48h stale-serve', () => {
  const src = readFileSync('server/search/searchOrchestrator.ts', 'utf8');
  const m = src.match(/function searchCacheTtl[\s\S]*?\n\}/);
  assert.ok(m, 'searchCacheTtl present');
  const body = m[0];
  assert.ok(body.includes("['loans', 'insurance', 'creditcards', 'banking']"),
      'all four finance verticals in the slow-changing tier');
  assert.ok(body.includes('ttlSec: 86_400'), 'fresh window = 24h (daily scrape)');
  assert.ok(body.includes('staleSec: 172_800'), 'stale-serve window = 48h');
  // Travel keeps its fast 5-min window (fares move) — the change is finance-only.
  assert.ok(body.includes("['flights', 'hotels', 'bus', 'cab']"), 'travel tier untouched');
  // Owner 29 Oct: the slow-moving catalogue verticals join the daily tier.
  assert.ok(body.includes("['movies', 'ecommerce', 'creditcards']"), 'movies/ecommerce/creditcards are daily too');
});

test('cacheGet semantics: fresh hit, then stale-serve (instant + background refresh), then miss', async () => {
  const { cachePut, cacheGet } = await import('../server/common/cache');
  const key = `test:finance-daily:${Date.now()}`;
  cachePut(key, { rows: ['hdfc'] }, 1, 2); // 1s fresh, 2s stale
  const fresh = await cacheGet(key);
  assert.ok(fresh.value && fresh.fresh, 'within TTL: fresh hit');
  await new Promise((r) => setTimeout(r, 1100));
  const stale = await cacheGet(key);
  assert.ok(stale.value && stale.stale && !stale.fresh,
      'past TTL but within staleSec: served instantly (stale-while-revalidate)');
  await new Promise((r) => setTimeout(r, 1100));
  const miss = await cacheGet(key);
  assert.equal(miss.value, null, 'past staleSec: honest miss -> live pipeline');
});

test('finance daily seeds: every keep-warm cycle refreshes all 4 finance verticals', async () => {
  const { FINANCE_DAILY_SEEDS } = await import('../server/cron/warm');
  assert.ok(FINANCE_DAILY_SEEDS.length >= 10, 'a real daily-refresh set, not a token one');
  const byVertical: Record<string, number> = {};
  for (const s of FINANCE_DAILY_SEEDS) {
    byVertical[s.vertical] = (byVertical[s.vertical] || 0) + 1;
    // Client-shape parity: warm key must equal the key the web + Flutter clients send.
    assert.equal(s.city, 'Indore', `${s.query}: city parity`);
    assert.equal(s.pincode, '452001', `${s.query}: pincode parity`);
  }
  assert.ok(['loans', 'insurance', 'creditcards', 'banking'].every((v) => byVertical[v] >= 1),
      'loans, insurance, creditcards and banking all covered');
});

test('keepWarmDefaults warms the finance daily seeds too (cron, boot, cold-search triggers)', async () => {
  const src = readFileSync('server/cron/warm.ts', 'utf8');
  assert.ok(src.includes('...FINANCE_DAILY_SEEDS'),
      'the daily-refresh seeds ride on the keep-warm cycle');
  assert.ok(src.includes('hourlyCatalogueSeeds'),
      'movies/credit cards ride the hourly per-city rotation');
});

test('freshness engine already credits finance 24h (the search TTL now matches it)', () => {
  const src = readFileSync('server/pipeline/freshness.ts', 'utf8');
  for (const v of ['loans', 'insurance', 'creditcards']) {
    const m = src.match(new RegExp(`${v}: \\{ liveVerified: (\\d+)`));
    assert.ok(m && Number(m[1]) === 86400, `${v} freshness policy = 24h`);
  }
});
