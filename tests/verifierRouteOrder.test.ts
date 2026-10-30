import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import { registerAppLinkRoutes } from '../server/marketing/appLinkVerify';
import { shouldRedirectApexToWww, canonicalWwwUrl } from '../server/common/canonicalHost';

/**
 * End-to-end proof that OUR stack serves the verification files on the apex host
 * (owner 30 Oct). A real express app is booted on an ephemeral port with the same
 * middleware + route registration order as server/index.ts, and the Host header is
 * driven explicitly — so "is the route actually there and unredirected" is answered
 * by HTTP, not by reading source.
 */
/** Raw HTTP so the Host header is really sent (fetch/undici forces its own Host). */
function request(base: string, path: string, host: string): Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(`${base}${path}`, { method: 'GET', headers: { Host: host } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode || 0, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function boot(): Promise<{ url: string; close: () => Promise<void> }> {
  const app = express();
  app.use((req, res, next) => {
    if (shouldRedirectApexToWww(req.headers.host, req.path || req.url)) {
      res.redirect(301, canonicalWwwUrl(req.originalUrl || req.url));
      return;
    }
    next();
  });
  registerAppLinkRoutes(app as any);
  app.get('/', (_req, res) => { res.send('home'); });

  const server = app.listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  const port = (server.address() as any).port;
  return { url: `http://127.0.0.1:${port}`, close: () => new Promise<void>((r) => server.close(() => r())) };
}

test('apex host: /.well-known/assetlinks.json is 200 JSON with no redirect', async () => {
  const s = await boot();
  try {
    const res = await request(s.url, '/.well-known/assetlinks.json', 'try1second.com');
    assert.equal(res.status, 200);
    assert.match(String(res.headers['content-type']), /application\/json/);
    const body = JSON.parse(res.body);
    assert.equal(body[0].target.package_name, 'com.try1second.try1second');
    assert.equal(body[0].relation[0], 'delegate_permission/common.handle_all_urls');
  } finally { await s.close(); }
});

test('apex host: pages answer 200 (no host redirect) unless FORCE_WWW_REDIRECT=1', async () => {
  const s = await boot();
  try {
    const res = await request(s.url, '/', 'try1second.com');
    assert.equal(res.status, 200);
    process.env.FORCE_WWW_REDIRECT = '1';
    const forced = await request(s.url, '/flights', 'try1second.com');
    assert.equal(forced.status, 301);
    assert.equal(forced.headers.location, 'https://www.try1second.com/flights');
  } finally { delete process.env.FORCE_WWW_REDIRECT; await s.close(); }
});

test('www host: verification file and pages both answer 200', async () => {
  const s = await boot();
  try {
    const v = await request(s.url, '/.well-known/assetlinks.json', 'www.try1second.com');
    assert.equal(v.status, 200);
    const p = await request(s.url, '/', 'www.try1second.com');
    assert.equal(p.status, 200);
  } finally { await s.close(); }
});
