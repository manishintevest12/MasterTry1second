import test from 'node:test';
import assert from 'node:assert/strict';
import { makeResponseWall, isApiRequest, requestIsApi } from '../server/httpServer';
import { RESPONSE_WALL_MS, clampSweepMs, SWEEP_SAFETY_MS } from '../server/common/wallBudget';

/**
 * OWNER 23 Nov ("continue"): production answered a 31-second plain-text "Try1Second is busy right now" to
 * POST /api/search hotels, because (1) the wall fired at 30 s while the hotels sweep is allowed 34 s, and
 * (2) the wall judged "API?" from req.path, which inside a mounted router is '/search'.
 */
test('a mounted API route is still recognised as an API request', () => {
  assert.equal(isApiRequest('/api/search'), true);
  // route-relative path, full URL intact: this is the production shape that broke
  assert.equal(requestIsApi({ path: '/search', originalUrl: '/api/search?x=1', baseUrl: '' } as any), true);
  assert.equal(requestIsApi({ path: '/search', originalUrl: '/search', baseUrl: '/api' } as any), true);
  assert.equal(requestIsApi({ path: '/hotels-in-goa', originalUrl: '/hotels-in-goa', baseUrl: '' } as any), false);
});

test('the sweep always settles before the wall', () => {
  assert.ok(clampSweepMs(34_000) <= RESPONSE_WALL_MS - SWEEP_SAFETY_MS, 'hotels sweep must fit inside the wall');
  assert.ok(clampSweepMs(999_999) <= RESPONSE_WALL_MS - SWEEP_SAFETY_MS);
  assert.equal(clampSweepMs(1_000), 2_000, 'a tiny budget is still a real budget');
});

test('an API request that reaches the wall gets JSON, never the human 503 page', async () => {
  const wall = makeResponseWall(5);
  const req: any = { path: '/search', originalUrl: '/api/search', baseUrl: '' };
  let body: any = null;
  let status = 0;
  const res: any = {
    writableEnded: false, headersSent: false,
    status(c: number) { status = c; return this; },
    json(o: any) { body = o; this.writableEnded = true; return this; },
    set() { return this; }, type() { return this; },
    send(o: any) { body = o; this.writableEnded = true; return this; },
    on() { return this; },
  };
  wall(req, res, () => undefined);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(status, 200);
  assert.equal(body.servedFrom, 'deadline');
  assert.equal(body.pendingRefresh, true);
});
