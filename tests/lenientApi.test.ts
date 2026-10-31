import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { parseLenientJson, lenientJsonBody } from '../server/common/lenientJson';
import { gracefulPublicStatus } from '../server/common/gracefulPublicStatus';
import { resetBadRequestLog, listBadRequests } from '../server/common/badRequestLog';

// OWNER 31 Oct: "i dont want to see 400 or those error ... jo purana build hai usme hi result show kro".
// The installed APK renders a red box for any non-2xx, so the server must answer 200 for read traffic
// even when the body is junk, and must repair the body instead of rejecting it.

let server: any;
let base = '';

before(async () => {
  resetBadRequestLog();
  const app = express();
  app.use(lenientJsonBody('256kb'));
  gracefulPublicStatus(app as any);

  // mirrors the real wiring: hand the parsed body back so the test can see what the parser made of it
  app.post('/api/search', (req, res) => res.json({ success: true, got: req.body }));
  app.get('/api/deals', (_req, res) => res.status(400).json({ error: 'bad_request' }));
  app.get('/api/admin/client-diag', (_req, res) => res.status(400).json({ error: 'admin_truth' }));
  app.post('/api/leads', (_req, res) => res.status(400).json({ error: 'lead_validation' }));
  app.get('/api/health', (_req, res) => res.status(503).json({ status: 'degraded' }));

  server = app.listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => server?.close());

const post = (path: string, body: string, type = 'application/json') =>
  fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': type }, body });

test('repairs the payloads that used to become "HTTP 400"', () => {
  assert.deepEqual(parseLenientJson('{"a":1,}').value, { a: 1 });
  assert.deepEqual(parseLenientJson('{"a":NaN}').value, { a: null });
  assert.deepEqual(parseLenientJson("{'a':'b'}").value, { a: 'b' });
  assert.deepEqual(parseLenientJson('{a:1}').value, { a: 1 });
  assert.deepEqual(parseLenientJson('\uFEFF{"a":1}').value, { a: 1 });
  assert.deepEqual(parseLenientJson('query=mobile&city=Indore').value, { query: 'mobile', city: 'Indore' });
  assert.deepEqual(parseLenientJson('   ').value, {});
  assert.deepEqual(parseLenientJson('{"query": bad').value, {});
  assert.equal(parseLenientJson('{"a":1}').repaired, false);
});

test('a truncated body still answers 200, so the old build keeps the screen alive', async () => {
  const res = await post('/api/search', '{"query": bad');
  assert.equal(res.status, 200, 'never the "HTTP 400" box');
  const body: any = await res.json();
  assert.equal(body.error, undefined);
  assert.deepEqual(body.got, {}, 'the handler simply sees an empty request and answers honestly');
});

test('valid JSON still reaches the handler untouched', async () => {
  const res = await post('/api/search', JSON.stringify({ query: 'hotels in shimla', vertical: 'hotels' }));
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json() as any).got, { query: 'hotels in shimla', vertical: 'hotels' });
});

test('a 400/429/5xx on a public read becomes 200 with a retry hint, never a red box', async () => {
  for (const path of ['/api/deals']) {
    const res = await fetch(`${base}${path}`);
    assert.equal(res.status, 200, `${path} must not answer 4xx`);
    const body: any = await res.json();
    assert.equal(body.pendingRefresh, true);
    assert.equal(body.retryAfterSec, 4);
  }
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 503, 'health must stay honest for uptime monitors');
});

test('admin endpoints and form submissions keep their real status', async () => {
  assert.equal((await fetch(`${base}/api/admin/client-diag`)).status, 400);
  const lead = await post('/api/leads', JSON.stringify({ phone: '' }));
  assert.equal(lead.status, 400, 'a lost lead must never look like success');
});

test('every masked answer is recorded so nothing is silently swallowed', () => {
  const reasons = listBadRequests().map((entry) => entry.reason);
  assert.ok(reasons.some((r) => r.startsWith('status_masked:')));
  assert.ok(reasons.includes('body_repaired'));
});
