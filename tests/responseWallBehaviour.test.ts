import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * OWNER 21 Nov: the host log showed 503s after 2,544 s / 4,539 s / 5,996 s. Those are requests that never got an
 * answer. This test proves the wall actually answers: an API call degrades into the honest "still scanning" 200 the
 * clients already poll on, and a page gets a fast 503 with Retry-After instead of holding the socket.
 */
test('a hanging request is answered by the wall, never left open', async () => {
  const { makeResponseWall } = await import('../server/httpServer');
  const responseWall = makeResponseWall(300);
  const express = (await import('express')).default;
  const http = await import('node:http');

  const app = express();
  app.use(responseWall);
  app.get('/api/hang', () => { /* never answers */ });
  app.get('/page/hang', () => { /* never answers */ });

  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as any).port;

  const get = (path: string) => new Promise<{ status: number; body: string; retryAfter?: string }>((resolve, reject) => {
    const req = http.get({ port, path }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode || 0, body, retryAfter: String(res.headers['retry-after'] || '') }));
    });
    req.on('error', reject);
    req.setTimeout(5_000, () => reject(new Error('the wall did not answer: socket still open')));
  });

  const api = await get('/api/hang');
  assert.equal(api.status, 200, 'an API hang must not become a 5xx');
  const json = JSON.parse(api.body);
  assert.equal(json.pendingRefresh, true);
  assert.equal(json.ok, true);
  assert.equal(json.servedFrom, 'deadline');

  const page = await get('/page/hang');
  assert.equal(page.status, 503, 'a page has nothing honest to show half-rendered');
  assert.equal(page.retryAfter, '5');

  server.close();
});
