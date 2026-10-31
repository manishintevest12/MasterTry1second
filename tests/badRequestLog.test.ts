import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { recordBadRequest, listBadRequests, resetBadRequestLog } from '../server/common/badRequestLog';

beforeEach(() => resetBadRequestLog());

const req = (headers: Record<string, string> = {}) => ({
  method: 'POST',
  originalUrl: '/api/search?x=1',
  headers: { 'content-type': 'application/json', 'content-length': '42', 'user-agent': 'Try1Second/1.8.51 (Android; app)', ...headers },
});

test('records the exact bytes a rejected body carried, so a phone 400 is explainable', () => {
  recordBadRequest(req({ 'x-t1s-session': 'app-abc-1' }), 'body_rejected:entity.parse.failed', '{"query": bad');
  const [entry] = listBadRequests();
  assert.equal(entry.url, '/api/search?x=1');
  assert.equal(entry.raw, '{"query": bad');
  assert.equal(entry.session, 'app-abc-1');
  assert.equal(entry.reason, 'body_rejected:entity.parse.failed');
});

test('flags whether a request came through the Cloudflare relay', () => {
  recordBadRequest(req({ 'x-t1s-via': 'cf-relay' }), 'body_rejected:entity.parse.failed', 'x');
  recordBadRequest(req(), 'body_rejected:entity.parse.failed', 'x');
  const [relayed, direct] = listBadRequests();
  assert.equal(relayed.relayed, true);
  assert.equal(direct.relayed, false);
});

test('never grows past 200 entries and never throws on a weird request', () => {
  for (let i = 0; i < 240; i++) recordBadRequest(req(), 'r', 'b');
  recordBadRequest(undefined, undefined as any, undefined);
  assert.equal(listBadRequests().length, 200);
});
