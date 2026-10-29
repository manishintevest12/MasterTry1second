/**
 * Owner 28 Oct: "movies se redirection aap uss movies ke seat booking tak le jaye jiska price
 * dikhta hai humari site pr, abhi wo uss page pr le jata hai jaha cinema hall aata hai, uske
 * karan jo cinema cheapest hota hai user ko samajh nahi aata."
 *
 * The link shape below is the platforms' own (ticketnew-web bundle getSeatLayoutUrl + the
 * cinema route), live-verified 28 Oct: 200, that cinema + that show, seat classes and prices
 * present in the page. These tests pin the contract so a refactor cannot send users back to a
 * cinema list.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cheapestShow, encSessionId, movieSeatLink, slugPath } from '../server/affiliate/movieSeatLink';

const session = { cid: 7709, sid: '38677', mid: 'OBCDF3' };

test('encsessionid carries the SHOW format code, never the cinema id (29 Oct regression)', () => {
  // The platform's own payload: {"encSessionId":"1023935-22234-ob98qv-gogv3dfo2u"} where
  // gogv3dfo2u is that session's entityDataCode/fid. Repeating the cinema id produced an
  // unknown session -> District "Sorry! Booking is now closed", TicketNew a blank shell.
  assert.equal(encSessionId({ ...session, cinemaId: 7709, fid: '13m2lcwhq6c' }), '7709-38677-obcdf3-13m2lcwhq6c');
  assert.equal(encSessionId({ ...session, entityDataCode: '13m2lcwhq6c' }), '7709-38677-obcdf3-13m2lcwhq6c');
  assert.equal(encSessionId({ ...session, cinemaId: 7709 }), '', 'no format code -> no session id');
  assert.equal(encSessionId({ sid: '1' }), '', 'a partial id must never produce a link');
});

test('TicketNew seat link carries the session id, the date and the cinema id', () => {
  const url = movieSeatLink({ host: 'ticketnew', city: 'Indore', cinemaId: 7709, cinemaName: 'Miraj Cinemas : Velocity III, Indore', sid: '38677', mid: 'OBCDF3', cid: 7709, fid: '13m2lcwhq6c', contentId: 219550, dateISO: '2026-10-28' });
  assert.match(url, /^https:\/\/ticketnew\.com\/movies\/indore\/miraj-cinemas-velocity-iii-indore-c\/7709\?/);
  assert.match(url, /encsessionid=7709-38677-obcdf3-13m2lcwhq6c/);
  assert.match(url, /fromdate=2026-10-28/);
  assert.match(url, /fromsessions=true/);
  assert.match(url, /contentid=219550/);
});

test('District rows use the seat-layout route (District has no cinema route: 404 live)', () => {
  const url = movieSeatLink({ host: 'district', city: 'Indore', cinemaId: 7709, sid: '38677', mid: 'OBCDF3', fid: '13m2lcwhq6c', cid: 7709, contentId: 219550, dateISO: '2026-10-28' });
  assert.match(url, /^https:\/\/www\.district\.in\/movies\/seat-layout\/13m2lcwhq6c\?/);
  assert.match(url, /encsessionid=7709-38677-obcdf3-13m2lcwhq6c/);
  assert.match(url, /type=movies/);
});

test('no session format code means no seat link at all (fallback page is chosen upstream)', () => {
  // Without the show's format code a seat page cannot be addressed; the caller then serves the
  // honest date-corrected showtime page instead of a link that the platform answers with
  // "booking is now closed".
  assert.equal(movieSeatLink({ host: 'district', city: 'Indore', cinemaId: 7709, sid: '38677', mid: 'OBCDF3', cid: 7709, dateISO: '2026-10-28' }), '');
});

test('no session ids -> no link at all (an honest gap beats a cinema-list link)', () => {
  assert.equal(movieSeatLink({ host: 'ticketnew', city: 'Indore', cinemaId: 7709 }), '');
});

test('cheapestShow picks the lowest seat class across cinemas and links to that show', () => {
  const shows = [
    { time: '2026-10-28T18:30', theatre: 'PVR Icon, Indore', cinemaId: 1001, sid: '900', mid: 'ABC123', fid: 'aaa111', areas: [{ label: 'PRIME', price: 320 }] },
    { time: '2026-10-28T11:15', theatre: 'Miraj Cinemas, Indore', cinemaId: 7709, sid: '38677', mid: 'OBCDF3', fid: 'bbb222', areas: [{ label: 'SUPER PLATINUM', price: 210 }, { label: 'CLUB', price: 149 }] },
    { time: '2026-10-28T21:00', theatre: 'Kalyan Cinemas, Indore', cinemaId: 1200, sid: '777', mid: 'XYZ99', fid: 'ccc333', areas: [{ label: 'BALCONY', price: 190 }] },
  ];
  const best = cheapestShow(shows as any, { host: 'ticketnew', city: 'Indore', dateISO: '2026-10-28' });
  assert.ok(best);
  assert.equal(best!.price, 149);
  assert.equal(best!.seatClass, 'CLUB');
  assert.equal(best!.theatre, 'Miraj Cinemas, Indore');
  assert.equal(best!.time, '2026-10-28T11:15');
  assert.match(best!.url, /7709\?/);
  assert.match(best!.url, /encsessionid=7709-38677-obcdf3-bbb222/);
});

test('cheapestShow still names the price when the session cannot be addressed', () => {
  const best = cheapestShow([{ time: '11:15', theatre: 'Miraj', cinemaId: 7709, areas: [{ label: 'CLUB', price: 149 }] }] as any, { host: 'ticketnew', city: 'Indore' });
  assert.equal(best!.price, 149);
  assert.equal(best!.url, '', 'no seat id -> no link, but the cheapest cinema is still identified');
});

test('slug path matches the platforms city/cinema slug rules', () => {
  assert.equal(slugPath('New Delhi'), 'new-delhi');
  assert.equal(slugPath('Miraj Cinemas : Velocity III, Indore'), 'miraj-cinemas-velocity-iii-indore');
});
