import test from 'node:test';
import assert from 'node:assert/strict';
import { makeResponseWall, isApiRequest, RESPONSE_WALL_MS } from '../server/httpServer';

/**
 * OWNER 22 Nov (access-log screenshot: /api/search/live, /api/store/currently-showing, /api/home/showcase,
 * /api/notifications all showing 5xx with response times of 64 s to 783 s).
 *
 * Two code-level causes are testable here:
 *   1. the response wall only matched `/api/`, so a bare `/api` (and anything the edge rewrote) could sit on the
 *      socket past the budget and surface as a 5xx at the edge;
 *   2. the wall's default budget was 40 s, above what the edge tolerates.
 * The dead legacy paths are covered by their own alias routes and checked in routes (tsc + the endpoint list).
 */

test('every api path shape is recognised as api', () => {
  for (const p of ['/api', '/api/', '/api/search/live', '/api/store/currently-showing', '/api/v1/ProductPage']) {
    assert.equal(isApiRequest(p), true, p);
  }
  for (const p of ['/', '/index.html', '/product/abc', '/apixyz', '']) {
    assert.equal(isApiRequest(p), false, p);
  }
});

test('the wall answers an api request honestly instead of letting it hang', async () => {
  const res = fakeRes();
  const wall = makeResponseWall(10);
  wall(fakeReq('/api/search/live') as any, res as any, () => undefined);
  await sleep(30);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.pendingRefresh, true);
  assert.equal(res.body.degraded, true);
  assert.deepEqual(res.body.results, []);
});

test('a page request gets 503 with Retry-After, never a half-rendered page', async () => {
  const res = fakeRes();
  makeResponseWall(10)(fakeReq('/product/abc') as any, res as any, () => undefined);
  await sleep(30);
  assert.equal(res.statusCode, 503);
  assert.equal(res.headers['Retry-After'], '5');
});

test('a request that already answered is never overwritten by the wall', async () => {
  const res = fakeRes();
  makeResponseWall(10)(fakeReq('/api/deals') as any, res as any, () => undefined);
  res.status(200).json({ success: true, deals: [1, 2, 3] });
  await sleep(30);
  assert.deepEqual(res.body, { success: true, deals: [1, 2, 3] });
});

test('the default budget stays under what the edge tolerates and above the app settle window', () => {
  assert.ok(RESPONSE_WALL_MS >= 15_000, 'never below the app settle budget');
  assert.ok(RESPONSE_WALL_MS <= 40_000, 'never so long the edge turns it into a 5xx');
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const fakeReq = (path: string) => ({ path, method: 'GET', headers: {} });

function fakeRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    writableEnded: false,
    headersSent: false,
    on() {
      return res;
    },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    set(k: string, v: string) {
      res.headers[k] = v;
      return res;
    },
    type() {
      return res;
    },
    json(b: unknown) {
      res.body = b;
      res.headersSent = true;
      res.writableEnded = true;
      return res;
    },
    send(b: unknown) {
      res.body = b;
      res.headersSent = true;
      res.writableEnded = true;
      return res;
    },
  };
  return res;
}
