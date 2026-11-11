/**
 * OWNER 11 Nov: "make it end to end dynamic, connect to db so that everything should be reflected on site".
 * These tests pin the three links that were broken: the answer funnel must attach manual DB rows, the merge
 * must be idempotent, and a photo-sized body must reach the upload route.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import express from 'express';
import { withManualFinanceRows } from '../server/marketing/financeOffers';
import { lenientJsonBody } from '../server/common/lenientJson';

const row = (id: string, seller: string) => ({ id, seller, title: `${seller} offer` });

test('manual entries are merged first, once, and never duplicated', () => {
  const base = [row('manual-7', 'Existing'), row('live-1', 'Live')];
  const manual = [row('manual-7', 'Existing'), row('manual-9', 'New Entry')];
  const out = withManualFinanceRows(base as any[], 'loans', manual as any[]);
  assert.deepEqual(out.map((r: any) => r.id), ['manual-9', 'manual-7', 'live-1']);
});

test('a non-finance vertical still gets the merge call but with its own rows only', () => {
  const out = withManualFinanceRows([row('live-1', 'Live')] as any[], 'flights', [row('manual-3', 'Typed')] as any[]);
  assert.equal(out[0].id, 'manual-3');
});

test('every answer exit attaches manual finance rows before the partner row', () => {
  const src = readFileSync('server/api/routes.ts', 'utf8');
  const wrapper = src.slice(src.indexOf('async function withPartnerRow'), src.indexOf('async function finaliseLiveAnswer'));
  assert.match(wrapper, /manualFinanceFeedRows/, 'the shared funnel must read the DB rows');
  assert.match(wrapper, /withManualFinanceRows/);
  assert.ok(wrapper.indexOf('withManualFinanceRows') < wrapper.indexOf('withGromoRow'), 'entries come before the partner row');
  for (const v of ['loans', 'creditcards', 'insurance', 'account']) {
    assert.ok(wrapper.includes(`'${v}'`), `${v} must be in the finance vertical list`);
  }
  assert.match(src, /response = await withPartnerRow\(response, String\(vertical\)\)/, 'finalise must await the funnel');
});

test('a photo-sized body reaches the upload route while other routes keep the guard', async () => {
  const app = express();
  app.use('/api/admin/merchant-logos', lenientJsonBody('2mb'));
  app.use(lenientJsonBody('256kb'));
  app.post('/api/admin/merchant-logos', (req: any, res) => res.json({ bytes: String(req.body?.logo || '').length }));
  app.post('/api/plain', (req: any, res) => res.json({ bytes: String(req.body?.pad || '').length }));
  const server = app.listen(0);
  const port = (server.address() as any).port;
  const post = async (path: string, body: any) => {
    const r = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    return (await r.json()) as { bytes: number };
  };
  try {
    const big = 'A'.repeat(700_000);
    assert.equal((await post('/api/admin/merchant-logos', { logo: big })).bytes, 700_000, 'upload route keeps the whole data URL');
    assert.equal((await post('/api/plain', { pad: big })).bytes, 0, 'the global 256 kb guard still applies');
  } finally {
    server.close();
  }
});
