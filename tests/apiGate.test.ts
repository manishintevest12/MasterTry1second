import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGatedFetch, relayUrlFor } from '../src/lib/apiGate';

(globalThis as any).DOMException = globalThis.DOMException ?? class extends Error { name = 'AbortError'; };

const ok = (body = '{}') => new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });

test('never lets more than 3 API requests hit the edge at once (the reset trigger)', async () => {
  let inFlight = 0;
  let peak = 0;
  const base = (async () => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 25));
    inFlight--;
    return ok();
  }) as unknown as typeof fetch;

  const gated = createGatedFetch(base, { maxConcurrent: 3 });
  await Promise.all(Array.from({ length: 12 }, (_, i) => gated(`/api/x${i}`)));
  assert.equal(peak, 3);
});

test('a reset socket becomes a retry, not a red error box', async () => {
  let calls = 0;
  const base = (async () => {
    calls++;
    if (calls < 3) throw new TypeError('Failed to fetch');
    return ok('{"results":[]}');
  }) as unknown as typeof fetch;

  const gated = createGatedFetch(base, { retriesPerRoute: 2 });
  const res = await gated('/api/scrape/live', { method: 'POST', body: '{}' });
  assert.equal(res.status, 200);
  assert.equal(calls, 3);
});

test('an edge 429 with an HTML body is retried instead of surfaced', async () => {
  let calls = 0;
  const base = (async () => {
    calls++;
    return calls === 1 ? new Response('Too Many Requests', { status: 429 }) : ok();
  }) as unknown as typeof fetch;

  const gated = createGatedFetch(base, { retriesPerRoute: 2 });
  const res = await gated('/api/quick-apps');
  assert.equal(res.status, 200);
  assert.equal(calls, 2);
});

test('duplicate in-flight GETs share one request', async () => {
  let calls = 0;
  const base = (async () => {
    calls++;
    await new Promise((r) => setTimeout(r, 20));
    return ok('{"ok":true}');
  }) as unknown as typeof fetch;

  const gated = createGatedFetch(base);
  const [a, b, c] = await Promise.all([gated('/api/deals?limit=200'), gated('/api/deals?limit=200'), gated('/api/deals?limit=200')]);
  assert.equal(calls, 1);
  // Each caller still gets its own readable body.
  assert.equal(await a.text(), '{"ok":true}');
  assert.equal(await b.text(), '{"ok":true}');
  assert.equal(await c.text(), '{"ok":true}');
});

test('non-API traffic is untouched, and a real API error is not retried', async () => {
  let nonApi = 0;
  let api = 0;
  const base = (async (input: any) => {
    const url = String(input);
    if (url.startsWith('/assets/')) { nonApi++; return new Response('x'); }
    api++;
    return new Response('{"error":"bad"}', { status: 400, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;

  const gated = createGatedFetch(base, {
    isGated: (url) => url.startsWith('/api/'),
    relayBase: '',
  });
  void 0;
  await gated('/assets/a.js');
  assert.equal(nonApi, 1);
  const res = await gated('/api/search', { method: 'POST' });
  assert.equal(res.status, 400);
  assert.equal(api, 1, 'a real 400 must reach the caller immediately, never be retried');
});


test('relay URL keeps path and query, and only for our API paths', () => {
  assert.equal(
    relayUrlFor('https://www.try1second.com/api/scrape/live?vertical=flights', 'https://relay.example.dev/'),
    'https://relay.example.dev/api/scrape/live?vertical=flights',
  );
  assert.equal(relayUrlFor('https://www.try1second.com/flights', 'https://relay.example.dev'), null);
  assert.equal(relayUrlFor('https://www.try1second.com/api/deals', ''), null);
});

test('when the origin reset, the request is rescued through the Cloudflare relay', async () => {
  const seen: string[] = [];
  const realFetch = globalThis.fetch;
  const base = (async (request: any) => {
    const url = String(request.url ?? request);
    seen.push(url);
    if (url.startsWith('https://www.try1second.com/')) throw new TypeError('Failed to fetch');
    return new Response('{"relayed":true}', { status: 200, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;

  const gated = createGatedFetch(base, {
    relayBase: 'https://relay.example.dev',
    retriesPerRoute: 1,
    isGated: (url) => url.startsWith('https://www.try1second.com/api/'),
  });

  const res = await gated('https://www.try1second.com/api/quick-apps');
  assert.equal(res.status, 200);
  assert.equal(await res.text(), '{"relayed":true}');
  assert.equal(seen.filter((u) => u.startsWith('https://www.try1second.com/')).length, 2, 'origin tried twice');
  assert.equal(seen.at(-1), 'https://relay.example.dev/api/quick-apps');

  // The relay route is now the preferred one, so the next call skips the dead origin entirely.
  seen.length = 0;
  await gated('https://www.try1second.com/api/deals?limit=5');
  assert.equal(seen[0], 'https://relay.example.dev/api/deals?limit=5');
  void realFetch;
});
