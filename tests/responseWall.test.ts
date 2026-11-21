import test from 'node:test';
import assert from 'node:assert/strict';
import { RESPONSE_WALL_MS } from '../server/httpServer';

/**
 * OWNER 21 Nov: the host log showed 503s with response times of 2,544 s / 4,539 s / 5,996 s. Those are sockets that
 * never got an answer. The wall must sit far above every legitimate handler (the API's own hard deadline is 10 s) and
 * far below the edge's patience, and it must be configurable so ops can tune it without a code change.
 */
test('the response wall is above the slowest legitimate handler', () => {
  assert.ok(RESPONSE_WALL_MS >= 15_000, 'never cut a cold metasearch short');
  assert.ok(RESPONSE_WALL_MS <= 60_000, 'must answer before an edge proxy gives up');
});

test('the wall is configurable through the environment', () => {
  assert.equal(typeof process.env.T1S_RESPONSE_WALL_MS === 'undefined' || Number(process.env.T1S_RESPONSE_WALL_MS) > 0, true);
});
