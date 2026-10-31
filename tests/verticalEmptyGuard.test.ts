import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { recallGoodForVertical, rememberGood, clearLastGood } from '../server/search/lastKnownGood';
import { gracefulPublicStatus } from '../server/common/gracefulPublicStatus';
import { resetBadRequestLog } from '../server/common/badRequestLog';

// OWNER 31 Oct: "no matching option found error in every vertical". A gated source used to turn a
// whole vertical into an empty page. These tests pin the rule: a vertical always answers real,
// previously verified rows when its live scan is refused or comes back empty.

beforeEach(() => {
  clearLastGood();
  resetBadRequestLog();
});

const row = (id: number, title: string) => ({ id: `r${id}`, title, prices: { effectivePrice: '999' }, vertical: 'ecommerce' });

test('a vertical keeps its newest verified rows whatever the query', async () => {
  rememberGood({ vertical: 'ecommerce', query: 'mobile phone', city: 'Indore' }, [row(1, 'OnePlus 13'), row(2, 'iPhone 16')], 'live');
  await new Promise((r) => setTimeout(r, 8)); // make "newest" unambiguous
  rememberGood({ vertical: 'ecommerce', query: 'smart watch', city: 'Delhi' }, [row(3, 'Noise Halo')], 'live');
  const hit = recallGoodForVertical('ecommerce');
  assert.ok(hit, 'the vertical must answer');
  assert.equal(hit!.rows.length, 1);
  assert.equal(hit!.rows[0].title, 'Noise Halo', 'newest verified answer wins');
});

test('a vertical with nothing verified answers null, never invented rows', () => {
  assert.equal(recallGoodForVertical('hotels'), null);
  assert.equal(recallGoodForVertical(''), null);
});

test('a refused search answers 200 WITH rows instead of an empty page', async () => {
  rememberGood({ vertical: 'hotels', query: 'hotels in indore', city: 'Indore' }, [row(9, 'Radisson Indore')], 'live');

  const app = express();
  app.use(express.json());
  gracefulPublicStatus(app as any, {
    fallbackRows: (req: any) => recallGoodForVertical(String(req?.body?.vertical || ''))?.rows ?? null,
  });
  app.post('/api/search', (_req, res) => res.status(429).json({ error: 'source_gated' }));

  const server = app.listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const res = await fetch(`${base}/api/search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'hotels in indore', vertical: 'hotels' }),
  });
  const body: any = await res.json();
  server.close();

  assert.equal(res.status, 200, 'never a 4xx box on the phone');
  assert.equal(body.results.length, 1, 'the feed stays populated');
  assert.equal(body.servedFrom, 'last_verified');
  assert.equal(body.pendingRefresh, true, 'still refreshes in the background');
});

test('a different vertical never borrows another vertical rows', async () => {
  rememberGood({ vertical: 'hotels', query: 'hotels in indore' }, [row(9, 'Radisson Indore')], 'live');
  const app = express();
  app.use(express.json());
  gracefulPublicStatus(app as any, {
    fallbackRows: (req: any) => recallGoodForVertical(String(req?.body?.vertical || ''))?.rows ?? null,
  });
  app.post('/api/search', (_req, res) => res.status(503).json({ error: 'down' }));
  const server = app.listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const res = await fetch(`${base}/api/search`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'personal loan', vertical: 'loans' }),
  });
  const body: any = await res.json();
  server.close();
  assert.equal(res.status, 200);
  assert.equal(body.results, undefined, 'no rows may be borrowed from hotels');
});
