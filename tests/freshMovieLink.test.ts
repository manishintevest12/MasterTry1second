/**
 * Movie exits must open a bookable page (owner 29 Oct, screenshots: our redirect opened
 * BookMyShow's "Sorry! Booking is now closed", while the wanted destination is the seat
 * selection screen).
 *
 * A movie row stores the URL captured during the scrape - date and, on some platforms, the
 * per-show session id included. Replaying it later is what produced "booking closed". These
 * tests pin the click-time rewrite: the buy date becomes the date the user can still buy for,
 * a session bound to another day is dropped (never replayed), and everything that identifies
 * the movie/venue is left exactly as scraped.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { isMovieDestination, movieShowDate, refreshMovieDestination } from '../server/movies/freshMovieLink.ts';

// 29 Oct 2026, 10:00 IST -> today is still selling.
const morningIST = new Date('2026-10-29T04:30:00Z');
// 29 Oct 2026, 22:30 IST -> today's counters are closed, roll to tomorrow.
const lateNightIST = new Date('2026-10-29T17:00:00Z');

test('the buy date is today in IST, and tomorrow once today closes', () => {
  assert.deepEqual(movieShowDate(morningIST), { iso: '2026-10-29', compact: '20261029' });
  assert.deepEqual(movieShowDate(lateNightIST), { iso: '2026-10-30', compact: '20261030' });
});

test('only movie destinations are touched', () => {
  assert.equal(isMovieDestination('https://in.bookmyshow.com/movies/indore/x/buytickets/ET00517731/20261029'), true);
  assert.equal(isMovieDestination('https://www.district.in/movies/seat-layout/abc'), true);
  assert.equal(isMovieDestination('https://www.ticketnew.com/x'), true);
  assert.equal(isMovieDestination('https://www.makemytrip.com/flights/x'), false);
  assert.equal(isMovieDestination('https://paytm.com/recharge'), false);
  assert.equal(isMovieDestination('not a url'), false);
});

test('BookMyShow buytickets: a stale scrape date becomes a bookable date', () => {
  const stale = 'https://in.bookmyshow.com/movies/indore/rajini-the-jailer-2/buytickets/ET00517731/20261027';
  const out = refreshMovieDestination(stale, morningIST);
  assert.ok(out.endsWith('/20261029'), out);
  assert.ok(out.includes('/buytickets/ET00517731/'), 'the movie code is untouched');
  assert.equal(refreshMovieDestination(stale, lateNightIST).endsWith('/20261030'), true, 'tomorrow after closing');
});

test('BookMyShow seat session for an older day is not replayed', () => {
  // A retired /booking/{session} link with no way back to the movie is left alone (we never
  // invent a movie), but one that names the movie is sent to its live showtime page instead.
  const seated = 'https://in.bookmyshow.com/booking/12345?code=ET00517731&region=INDORE&slug=rajini-the-jailer-2';
  const out = refreshMovieDestination(seated, morningIST);
  assert.ok(out.includes('/buytickets/ET00517731/20261029'), out);
  assert.ok(!out.includes('/booking/'), 'no dead session is replayed');
  const orphan = 'https://in.bookmyshow.com/booking/12345';
  assert.equal(refreshMovieDestination(orphan, morningIST), orphan, 'left untouched rather than guessed');
});

test('District seat link: date refreshed and the date-bound session dropped', () => {
  const stale = 'https://www.district.in/movies/seat-layout/52spa016v3o?fromdate=2026-10-28&encsessionid=1056569-22010&freeseating=false&type=movie&contentid=235763';
  const out = refreshMovieDestination(stale, morningIST);
  assert.ok(out.includes('fromdate=2026-10-29'), out);
  assert.ok(!out.includes('encsessionid'), 'the session belonged to another day');
  assert.ok(out.includes('contentid=235763'), 'the movie identity survives');
});

test('a District seat link scraped TODAY keeps its live session', () => {
  const fresh = 'https://www.district.in/movies/seat-layout/52spa016v3o?fromdate=2026-10-29&encsessionid=abc123&type=movie';
  assert.equal(refreshMovieDestination(fresh, morningIST), fresh, 'nothing to fix, nothing changed');
});

test('TicketNew and Cinepolis date params are refreshed in place', () => {
  const tn = 'https://www.ticketnew.com/OnlineTheatre/Book-Tickets/20261027/abc';
  assert.ok(refreshMovieDestination(tn, morningIST).includes('20261029'), 'path date');
  const cine = 'https://www.cinepolisindia.com/movies/booking?date=2026-10-27&movie=x';
  const out = refreshMovieDestination(cine, morningIST);
  assert.ok(out.includes('date=2026-10-29'), out);
  assert.ok(out.includes('movie=x'), 'rest of the query survives');
});

test('non-movie URLs pass through byte-identical', () => {
  for (const url of [
    'https://www.makemytrip.com/flights/booking?date=2026-01-01',
    'https://www.redbus.in/bus-tickets/indore-to-bhopal?doj=2026-01-01',
    'https://www.amazon.in/dp/B0ABC',
  ]) assert.equal(refreshMovieDestination(url, morningIST), url);
});
