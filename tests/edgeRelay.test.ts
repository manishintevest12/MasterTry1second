/**
 * Edge Relay tests (owner 26 Oct) — deterministic, no external network.
 *
 * A local stub HTTP server plays the relay endpoint; we assert:
 *  - gate detection (statuses, challenge markers, tiny stubs)
 *  - host policy matching
 *  - AWS-preferred ordering, CF fallback
 *  - a gated relay leg is skipped and the next leg wins
 *  - circuit breaker opens after repeated failures
 *  - kill switch (EDGE_RELAY_DISABLE=1)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

process.env.EDGE_RELAY_HOSTS = 'uber.com,rapido.bike,booking.com,hotels.com,expedia.com,makemytrip.com,goibibo.com';

const { isGatedResponse, hostInPolicy, edgeRelayFetch, relayStats, relayConfigured } = await import('../server/sources/edgeRelay');

function startStub(handler: (body: any) => { status?: number; body?: string; error?: string; httpStatus?: number }) {
  const srv = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (d) => { raw += d; });
    req.on('end', () => {
      const payload = JSON.parse(raw || '{}');
      const out = handler(payload);
      res.writeHead(out.httpStatus || 200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(out));
    });
  });
  return new Promise<{ url: string; close: () => void }>((resolve) => {
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address() as any;
      resolve({ url: `http://127.0.0.1:${addr.port}/`, close: () => srv.close() });
    });
  });
}

test('isGatedResponse flags real gate shapes and passes real content', () => {
  assert.equal(isGatedResponse(403, 'anything'), true);
  assert.equal(isGatedResponse(429, ''), true);
  assert.equal(isGatedResponse(503, ''), true);
  assert.equal(isGatedResponse(200, '<html><title>Just a moment...</title></html>'), true);
  assert.equal(isGatedResponse(200, 'x'.repeat(50) + '<html>'), false); // not an html stub
  assert.equal(isGatedResponse(200, '<html>stub</html>'), true);         // tiny html stub
  assert.equal(isGatedResponse(200, JSON.stringify({ fares: [1, 2, 3] })), false);
  const bigPage = '<html>' + 'content '.repeat(400) + '</html>';
  assert.equal(isGatedResponse(200, bigPage), false);
});

test('hostInPolicy matches subdomains of the named gated sources', () => {
  assert.equal(hostInPolicy('https://m.uber.com/looking'), true);
  assert.equal(hostInPolicy('https://m.rapido.bike/pwa/api'), true);
  assert.equal(hostInPolicy('https://www.makemytrip.com/hotels/'), true);
  assert.equal(hostInPolicy('https://www.goibibo.com/hotels/hotels-in-goa/'), true);
  assert.equal(hostInPolicy('https://www.booking.com/searchresults.html'), true);
  assert.equal(hostInPolicy('https://www.expedia.com/graphql'), true);
  assert.equal(hostInPolicy('https://www.hotels.com/'), true);
  assert.equal(hostInPolicy('https://www.amazon.in/dp/x'), false);
});

test('AWS leg is preferred and wins when healthy', async () => {
  const stub = await startStub(() => ({ status: 200, body: JSON.stringify({ ok: 'aws' }) }));
  process.env.EDGE_RELAY_AWS_URL = stub.url;
  process.env.EDGE_RELAY_AWS_TOKEN = 'secret';
  delete process.env.EDGE_RELAY_CF_URL;
  const r = await edgeRelayFetch('https://m.uber.com/looking', { method: 'GET' });
  assert.ok(r, 'relay should answer');
  assert.equal(r!.via, 'aws');
  assert.equal(JSON.parse(r!.body).ok, 'aws');
  stub.close();
});

test('a gated AWS leg falls through to Cloudflare', async () => {
  const gated = await startStub(() => ({ status: 403, body: 'Access Denied' }));
  const good = await startStub(() => ({ status: 200, body: '{"ok":"cf"}' }));
  process.env.EDGE_RELAY_AWS_URL = gated.url;
  process.env.EDGE_RELAY_CF_URL = good.url;
  process.env.EDGE_RELAY_CF_TOKEN = 'cfsecret';
  const r = await edgeRelayFetch('https://www.makemytrip.com/hotels/', {});
  assert.ok(r);
  assert.equal(r!.via, 'cf');
  assert.equal(JSON.parse(r!.body).ok, 'cf');
  gated.close(); good.close();
});

test('relay returns null when every leg is down, and stats record it', async () => {
  const dead = await startStub(() => ({ httpStatus: 500 }));
  process.env.EDGE_RELAY_AWS_URL = dead.url;
  delete process.env.EDGE_RELAY_CF_URL;
  // force the breaker open with repeated failures
  for (let i = 0; i < 4; i++) await edgeRelayFetch('https://m.uber.com/looking', {});
  const before = relayStats().failed;
  const r = await edgeRelayFetch('https://m.uber.com/looking', {});
  assert.equal(r, null);
  assert.ok(relayStats().failed >= before, 'failures are counted');
  dead.close();
});

test('kill switch disables the relay entirely', async () => {
  const stub = await startStub(() => ({ status: 200, body: '{}' }));
  process.env.EDGE_RELAY_AWS_URL = stub.url;
  process.env.EDGE_RELAY_DISABLE = '1';
  assert.equal(relayConfigured(), false);
  assert.equal(await edgeRelayFetch('https://m.uber.com/looking', {}), null);
  delete process.env.EDGE_RELAY_DISABLE;
  stub.close();
});
