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

test('a manual entry ships as a priced row whose click goes through our masked exit', () => {
  const src = readFileSync('server/marketing/financeOffers.ts', 'utf8');
  const fn = src.slice(src.indexOf('export async function manualFinanceFeedRows'), src.indexOf('export function withManualFinanceRows'));
  // The row is attached at the last funnel, after answer shaping, so it must carry the comparison price
  // itself or "No Price, No Card" hides a card the owner just created.
  assert.match(fn, /prices: \{ currency: 'INR', effectivePrice: price/, 'price must exist in the comparison shape');
  assert.match(fn, /primaryPrice: price/);
  // Attribution: a manual entry must not jump straight to the merchant.
  assert.match(fn, /createMaskingPointer\(dest, \{ vertical: String\(m\.vertical\), trusted: true \}\)/, 'click exits via /api/out');
});

test('a failed photo upload names its cause instead of a bare "Upload failed"', () => {
  const view = readFileSync('src/components/admin/FinanceVerticalsTab.tsx', 'utf8');
  const fn = view.slice(view.indexOf('const uploadPhoto'), view.indexOf('const save ='));
  assert.match(fn, /HTTP \$\{res\.status\}/, 'the HTTP status must be shown');
  assert.match(fn, /dataUrl\.length > 220_000/, 'the payload is squeezed before sending');
  assert.match(fn, /HEIC/, 'an unconvertible phone photo must be called out, not silently generic');
  // The catch-all label may only appear as part of a detailed sentence, never alone.
  assert.ok(!/'Upload failed'\)/.test(fn), 'no bare generic message');
});

test('a missing hashed asset answers 404, never the 200 SPA shell', () => {
  const src = readFileSync('server/index.ts', 'utf8');
  const at = src.indexOf('const isAsset');
  const branch = src.slice(at, at + 700);
  // Before 11 Nov this branch answered dist/index.html with 200 for any /assets/*.js, which is how a
  // stale HTML body got cached under a script URL after a deploy.
  assert.match(branch, /status\(404\)/, 'missing assets must 404');
  assert.ok(!/isAsset\) \{ res\.sendFile/.test(branch), 'never serve the shell for an asset path');
});

test('a stored logo is never reported as a failed upload', () => {
  // The owner's 13 Nov screenshot: server answered {"ok":true,"name_key":...} with HTTP 200 and the tab still
  // printed "Upload failed (HTTP 200: ...)" because it only trusted `success`.
  const route = readFileSync('server/admin/adminRoutes.ts', 'utf8');
  const block = route.slice(route.indexOf("adminRouter.post('/merchant-logos'"), route.indexOf("adminRouter.delete('/merchant-logos"));
  assert.match(block, /success: true/, 'the route answers success for older bundles');
  assert.match(block, /success: false/, 'failures carry the same key too');

  const finance = readFileSync('src/components/admin/FinanceVerticalsTab.tsx', 'utf8');
  const fn = finance.slice(finance.indexOf('const uploadPhoto'), finance.indexOf('const save ='));
  assert.match(fn, /d\.ok === true \|\| d\.success === true/, 'the tab trusts both keys');
  assert.ok(!/compress nahi ho payi/.test(fn), 'no size scolding: the server takes the photo');

  const promo = readFileSync('src/components/admin/PromoOffersTab.tsx', 'utf8');
  assert.match(promo, /d\.success \|\| d\.ok/, 'the promo tab has the same tolerance');
});

test('the upload route takes a phone-sized photo (8 MB base64) instead of rejecting it', () => {
  const logos = readFileSync('server/marketing/merchantLogos.ts', 'utf8');
  assert.match(logos, /8_000_000/, 'the stored-logo cap is a safety valve, not size advice');
  const idx = readFileSync('server/index.ts', 'utf8');
  assert.match(idx, /lenientJsonBody\('8mb'\)/, 'the upload routes parse an 8 MB body');
});
