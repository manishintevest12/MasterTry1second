import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parsePsiResponse } from '../server/admin/speedtest';
import { ringColors } from '../src/components/admin/SpeedTestTab';

// ---------- Owner 21 Oct: admin Site Speed widget (PageSpeed Insights, real data only) ----------

const PSI_SAMPLE = {
  id: 'https://www.try1second.com/',
  lighthouseResult: {
    finalDisplayedUrl: 'https://www.try1second.com/',
    categories: { performance: { score: 0.91 } },
    audits: {
      'largest-contentful-paint': { numericValue: 2100 },
      'total-blocking-time': { numericValue: 70 },
      'cumulative-layout-shift': { numericValue: 0.02 },
    },
  },
};

test('speedtest: parsePsiResponse extracts score + core metrics from a real PSI v5 payload', () => {
  const s = parsePsiResponse(PSI_SAMPLE, 'desktop');
  assert.equal(s.score, 91);
  assert.equal(s.lcp_ms, 2100);
  assert.equal(s.tbt_ms, 70);
  assert.equal(s.cls, 0.02); // CLS keeps 4-decimal precision, never rounded to 0
  assert.equal(s.error, null);
  assert.equal(s.strategy, 'desktop');
});

test('speedtest: parsePsiResponse is honest when PSI returns no Lighthouse result (quota/error)', () => {
  const s = parsePsiResponse({ error: { message: 'Quota exceeded' } }, 'mobile');
  assert.equal(s.score, null);
  assert.ok(s.error, 'must carry a human-readable error, never a fabricated score');
});

test('speedtest: ring colors match the owner reference image thresholds', () => {
  assert.equal(ringColors(91).main, '#00a859');   // green ≥ 90 (image: desktop 91)
  assert.equal(ringColors(87).main, '#e39f00');   // amber 50-89 (image: mobile 87)
  assert.equal(ringColors(30).main, '#d93025');   // red < 50
  assert.equal(ringColors(null).main, '#dadce0'); // unknown = neutral, no fake data
});

test('speedtest: admin routes exist for get/history/run (server bundle parity)', () => {
  const routes = readFileSync('server/admin/adminRoutes.ts', 'utf8');
  if (!/get\('\/speedtest'/.test(routes)) throw new Error('missing GET /api/admin/speedtest');
  if (!/get\('\/speedtest\/history'/.test(routes)) throw new Error('missing GET /api/admin/speedtest/history');
  if (!/post\('\/speedtest\/run'/.test(routes)) throw new Error('missing POST /api/admin/speedtest/run');
  if (!/requireAdmin/.test(routes.split('\n').slice(0, 35).join('\n'))) throw new Error('speedtest routes must stay admin-gated');
});

test('speedtest: file-store persistence round-trip + portable prune (regression: subquery DELETE ate all dev rows)', async () => {
  const { getStore } = await import('../server/common/db');
  const { pruneScoreHistory } = await import('../server/admin/speedtest');
  const store = await getStore();
  const tag = 'test_probe';
  // clean any previous probe rows
  for (const r of await store.query<any>('SELECT id FROM speed_scores WHERE url = ?', [tag])) {
    await store.execute('DELETE FROM speed_scores WHERE id = ?', [Number(r.id)]);
  }
  // insert 55 rows (older first so newest are kept)
  for (let i = 0; i < 55; i++) {
    await store.execute(
      'INSERT INTO speed_scores (strategy, score, lcp_ms, tbt_ms, cls, url, error, scanned_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['desktop', 50 + i, null, null, null, tag, null, new Date(Date.now() + i * 1000).toISOString()]);
  }
  const before = await store.query<any>('SELECT id FROM speed_scores WHERE url = ?', [tag]);
  assert.equal(before.length, 55, 'all 55 inserted rows must be readable back from the store');
  await pruneScoreHistory('desktop');
  const after = await store.query<any>('SELECT id FROM speed_scores WHERE url = ?', [tag]);
  assert.equal(after.length, 50, 'prune keeps the newest 50 rows, never deletes the just-saved run');
  for (const r of after) await store.execute('DELETE FROM speed_scores WHERE id = ?', [Number(r.id)]);
});

test('speedtest: no fabricated/mock scores anywhere in the module', () => {
  const mod = readFileSync('server/admin/speedtest.ts', 'utf8');
  if (/\b91\b|\b87\b|mock|fake/.test(mod)) throw new Error('speedtest module must only report real PSI data');
});
