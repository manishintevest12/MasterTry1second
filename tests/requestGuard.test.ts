/**
 * OWNER 31 Oct (mobile "SocketConnection reset by peer" report) request list:
 *  - only ONE scrape per user/session at a time,
 *  - a repeat of that same search is NOT a second scrape (it coalesces/caches),
 *  - 429 + Retry-After when the session is busy or the queue is at its ceiling,
 *  - a strict request deadline answers instead of hanging,
 *  - caching means a repeated request does no work.
 * These pin the guard's behaviour directly (no server boot, no network).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';

import { beginScrape, resetRequestGuard, sessionKeyOf, withDeadline, activeScrapeSessions } from '../server/api/requestGuard';

const req = (headers: Record<string, string> = {}) => ({
  headers: { 'user-agent': 'Try1Second/1.8.44 (Android; app)', ...headers },
  socket: { remoteAddress: '1.2.3.4' },
}) as any;

test('a GENUINELY new search SUPERSEDES the running one instead of erroring (owner 31 Oct)', () => {
  resetRequestGuard();
  const first = beginScrape(req(), 'flights', 'indore to delhi');
  assert.equal(first.ok, true);
  // The owner's audit found users getting a 429 for their own next search (change city -> error),
  // so the new query takes the slot and the stale booking is dropped.
  const second = beginScrape(req(), 'flights', 'mumbai to goa');
  assert.equal(second.ok, true, 'a new query must never be refused as session_busy');
  assert.equal(activeScrapeSessions(), 1, 'still exactly one active booking per session');
  // the superseded booking's late release must not free the NEW slot
  first.release();
  assert.equal(activeScrapeSessions(), 1);
  // a repeat of the new query coalesces (never a second scrape)
  assert.equal(beginScrape(req(), 'flights', 'mumbai to goa').ok, true);
  assert.equal(activeScrapeSessions(), 1);
  second.release();
  assert.equal(beginScrape(req(), 'flights', 'mumbai to goa').ok, true);
});

test('a poll of the SAME search is not treated as a second scrape', () => {
  resetRequestGuard();
  const first = beginScrape(req(), 'flights', 'indore to delhi');
  const poll = beginScrape(req(), 'flights', 'indore to delhi');
  assert.equal(first.ok, true);
  assert.equal(poll.ok, true, 'the app poll loop must never be refused');
  // releasing the poll must not clear the original booking
  poll.release();
  assert.equal(activeScrapeSessions(), 1);
  // a different query still takes over (supersede) rather than being refused
  assert.equal(beginScrape(req(), 'flights', 'mumbai to goa').ok, true);
});

test('two devices are independent', () => {
  resetRequestGuard();
  const a = beginScrape(req({ 'x-t1s-session': 'device-a' }), 'flights', 'q1');
  const b = beginScrape(req({ 'x-t1s-session': 'device-b' }), 'flights', 'q2');
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
});

test('an explicit session header wins over ip+ua', () => {
  assert.equal(sessionKeyOf(req({ 'x-t1s-session': 'abc123' })), 's:abc123');
  assert.equal(sessionKeyOf(req({ 'x-device-id': 'dev-9' })), 's:dev-9');
  assert.match(sessionKeyOf(req()), /^h:1\.2\.3\.4\|Try1Second/);
});

test('withDeadline answers on time instead of hanging', async () => {
  const slow = new Promise<string>((resolve) => setTimeout(() => resolve('late'), 400));
  const t0 = Date.now();
  const result = await withDeadline(slow, 60);
  assert.equal(result, null);
  assert.ok(Date.now() - t0 < 300, 'must answer at the deadline, not when the work ends');
  const fast = await withDeadline(Promise.resolve('ok'), 500);
  assert.equal(fast, 'ok');
});
