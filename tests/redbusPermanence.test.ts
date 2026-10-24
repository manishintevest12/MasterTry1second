import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Owner 24 Oct: "redbus ka result kabhi aata hai kabhi ni aata hai usko
 * permanently fix kro" + same day AbhiBus variant. Two layers:
 *  1. acquisition — every redBus call rides curl_cffi with Chrome TLS
 *     impersonation (the undici fingerprint was tarpitted intermittently,
 *     especially the searchResults POST, which httpAcquire never sent via cffi)
 *  2. cache — a bus response that attempted redBus but got no redBus rows is
 *     cached for 2 minutes only, so the gap self-heals on the next poll
 *     instead of sitting behind the normal 5-minute bus TTL.
 */

test('bus worker: all redBus calls go through curl_cffi Chrome impersonation', () => {
  const src = readFileSync('server/workers/verticals/bus.ts', 'utf8');
  const rbStart = src.indexOf("sourceId: 'w_bus_redbus'");
  const rbEnd = src.indexOf("sourceId: 'w_bus_makemytrip'");
  assert.ok(rbStart > 0 && rbEnd > rbStart, 'redBus task found');
  const task = src.slice(rbStart, rbEnd);
  // citySuggestion + searchResults POST both cffi now — no ctx.fetch on the suggestion path
  assert.ok(task.includes('cffiFetch(url, { impersonate'), 'citySuggestion rides cffi chrome');
  assert.ok(task.includes("method: 'POST', body: '{}'"), 'searchResults POST via cffi');
  assert.ok(task.includes('attempt <= 3'), 'three attempts against tarpit windows');
  // undici remains only as the honest bridge-down fallback
  assert.ok(task.includes('ctx.fetch(u,'), 'undici fallback attempt preserved');
  // route-page fallback unchanged: 404 = honest empty, never fabricated
  assert.ok(task.includes('if (r.status === 404) return []'), '404 stays an honest empty');
  // AbhiBus permanence (owner 24 Oct, same complaint): all calls cffi too
  const abStart = src.indexOf("sourceId: 'w_bus_abhibus'");
  assert.ok(abStart > 0, 'AbhiBus task found');
  const abTask = src.slice(abStart, src.indexOf("sourceId: 'w_bus_zingbus'"));
  assert.ok(abTask.includes('cffiFetch(url, { impersonate'), 'AbhiBus SearchStations rides cffi chrome');
  assert.ok(abTask.includes("method: 'POST', body: payload"), 'AbhiBus services POST via cffi');
  assert.ok(abTask.includes('attempt <= 3'), 'AbhiBus three attempts against tarpit windows');
  assert.ok(abTask.includes('ctx.fetch('), 'AbhiBus undici fallback preserved');
});

test('busSelfHealTtl: attempted-but-empty redBus shortens the cache window', async () => {
  const { busSelfHealTtl } = await import('../server/search/searchOrchestrator');
  const mk = (sellers: string[], attempted: string[]) => ({
    results: sellers.map((seller) => ({ seller })),
    state: { sourcesAttempted: attempted },
  }) as any;

  // redBus present -> full window
  const full = busSelfHealTtl('bus', mk(['redBus', 'AbhiBus'], ['w_bus_redbus', 'w_bus_abhibus']), 300, 900);
  assert.deepEqual(full, { ttlSec: 300, staleSec: 900 });

  // redBus attempted, zero rows -> 2-min self-heal window
  const short = busSelfHealTtl('bus', mk(['AbhiBus', 'zingbus'], ['w_bus_redbus', 'w_bus_abhibus']), 300, 900);
  assert.deepEqual(short, { ttlSec: 120, staleSec: 240 });

  // redBus not even attempted (circuit) -> normal window, nothing to re-attempt
  const circuit = busSelfHealTtl('bus', mk(['AbhiBus'], ['w_bus_abhibus']), 300, 900);
  assert.deepEqual(circuit, { ttlSec: 300, staleSec: 900 });

  // AbhiBus attempted, zero rows (owner 24 Oct same complaint) -> self-heal window
  const abhiMissing = busSelfHealTtl('bus', mk(['redBus', 'zingbus'], ['w_bus_abhibus', 'w_bus_redbus']), 300, 900);
  assert.deepEqual(abhiMissing, { ttlSec: 120, staleSec: 240 });

  // both primaries present -> full window
  const both = busSelfHealTtl('bus', mk(['AbhiBus', 'redBus'], ['w_bus_abhibus', 'w_bus_redbus']), 300, 900);
  assert.deepEqual(both, { ttlSec: 300, staleSec: 900 });

  // other verticals untouched
  const ecom = busSelfHealTtl('ecommerce', mk(['flipkart'], ['w_ecom_flipkart']), 900, 2700);
  assert.deepEqual(ecom, { ttlSec: 900, staleSec: 2700 });
});
