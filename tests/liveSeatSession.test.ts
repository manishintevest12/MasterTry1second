/**
 * Every movie platform must open a SEAT page (owner 29 Oct: "sirf bookmyshow hi nahi, ticketnew,
 * district sb pr aisa hi kro").
 *
 * A seat page is addressed by a session (`encsessionid = cid-sid-mid-cid`), and a session is
 * bound to ONE show on ONE day. These tests pin the click-time resolver's contract: it reads the
 * session out of the ORIGINAL link (not out of the date-corrected fallback, which has already
 * dropped it), recognises District and TicketNew seat routes, and never throws or invents a link.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSeatDestination, refreshSeatDestination } from '../server/movies/liveSeatSession.ts';

const DISTRICT = 'https://www.district.in/movies/seat-layout/52spa016v3o?fromdate=2026-10-28&encsessionid=1056569-22010-obc3dm-1056569&freeseating=false&fromsessions=true&type=movies&contentid=235763';
const TICKETNEW = 'https://ticketnew.com/movies/indore/c21-mall-c/1056569?fromdate=2026-10-27&encsessionid=1056569-22010-obc3dm-1056569&freeseating=false&contentid=235763';

test('District seat link yields host, cinema, session and movie code', () => {
  const p = parseSeatDestination(DISTRICT);
  assert.ok(p, 'parsed');
  assert.equal(p!.host, 'district');
  assert.equal(p!.cinemaId, '1056569');
  assert.equal(p!.sid, '22010');
  assert.equal(p!.mid, 'obc3dm', 'the mid is what survives when the session id changes');
  assert.equal(p!.fid, '52spa016v3o');
  assert.equal(p!.contentId, '235763');
  assert.equal(p!.dateISO, '2026-10-28');
});

test('TicketNew seat link also yields its city and cinema from the path', () => {
  const p = parseSeatDestination(TICKETNEW);
  assert.ok(p);
  assert.equal(p!.host, 'ticketnew');
  assert.equal(p!.city, 'indore');
  assert.equal(p!.cinemaId, '1056569');
  assert.equal(p!.sid, '22010');
});

test('links without a session, and non-seat hosts, are not seat destinations', () => {
  assert.equal(parseSeatDestination('https://in.bookmyshow.com/movies/indore/x/buytickets/ET00517731/20261029'), null);
  assert.equal(parseSeatDestination('https://www.district.in/movies/indore/rajini-the-jailer-2'), null);
  assert.equal(parseSeatDestination('not a url'), null);
});

test('a non-seat movie link only gets the date correction, never a fabricated session', async () => {
  const bms = 'https://in.bookmyshow.com/movies/indore/x/buytickets/ET00517731/20261027';
  const out = await refreshSeatDestination(bms);
  assert.ok(out.startsWith('https://in.bookmyshow.com/'), out);
  assert.ok(!/encsessionid|sessionid=/.test(out), 'no invented session');
});

test('an unresolvable seat link degrades to a dated page, never to an error', async () => {
  // A city that carries no sessions at all: the resolver must return the fallback, not throw.
  const far = 'https://www.district.in/movies/seat-layout/zzzz?fromdate=2026-10-01&encsessionid=1-2-zz-1&type=movies&contentid=9';
  const out = await refreshSeatDestination(far);
  assert.equal(typeof out, 'string');
  assert.ok(out.startsWith('https://www.district.in/'), out);
});
