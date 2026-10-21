/**
 * MMT fare-calendar parser regression (21 Oct): flights-cb.makemytrip.com
 * /api/fareCalendar is the browserless MMT fares source (SRP+SSE stay
 * Akamai-gated). Sample recorded live from the sandbox 21 Oct 2026:
 * BOM-DEL calendar, "281026" key = "Wed, Oct 28" ₹6,638 IndiGo (DDMMYY keys
 * verified against txt labels). Guards: DDMMYY decode (incl. invalid keys),
 * "₹ 6,746"-style fare parsing, airline naming, exact-date-first item build,
 * honest cheapest-upcoming fallback, and the SRP redirect URL shape.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMmtFareCalendar, mmtDayFareItems, mmtSearchUrl } from '../server/workers/parsers/mmtFareCalendar.ts';

const src: any = { id: 't_flights_mmt', name: 'MakeMyTrip', method: 'http', verticals: ['flights'], enabled: true, priority: 15, config: {}, rateLimit: { maxRequestsPerMinute: 4, maxConcurrency: 1 }, freshnessPolicy: {} };

const CAL = JSON.stringify({
  crId: '',
  fares: {
    '281026': { cur: '₹', fr: '6,638', clr: '', txt: 'Wed, Oct 28', lFrTxt: '₹ 6,638', airlineInfo: { name: 'IndiGo', codes: ['6E'] } },
    '291026': { cur: '₹', fr: '7,012', clr: '', txt: 'Thu, Oct 29', lFrTxt: '₹ 7,012', airlineInfo: { name: 'Air India', codes: ['AI'] } },
    '311026': { cur: '₹', fr: '5,999', clr: '', txt: 'Sat, Oct 31', lFrTxt: '₹ 5,999', airlineInfo: { name: 'SpiceJet', codes: ['SG'] } },
    '010127': { cur: '₹', fr: '6,746', clr: '', txt: 'Fri, Jan 1', lFrTxt: '₹ 6,746', airlineInfo: { name: 'SpiceJet', codes: ['SG'] } },
    '321026': { cur: '₹', fr: '0', clr: '', txt: 'invalid day 32' }, // day 32 -> dropped
    'abcd26': { cur: '₹', fr: '5,000', txt: 'garbage key' },         // non-numeric -> dropped
  },
});

test('parseMmtFareCalendar decodes DDMMYY keys and ₹ fares', () => {
  const fares = parseMmtFareCalendar(CAL);
  assert.equal(fares.length, 4);
  const byDt = Object.fromEntries(fares.map((f) => [f.dt, f]));
  assert.ok(byDt['2026-10-28']);
  assert.equal(byDt['2026-10-28'].pr, 6638);
  assert.equal(byDt['2026-10-28'].airline, 'IndiGo');
  assert.equal(byDt['2026-10-28'].label, 'Wed, Oct 28');
  assert.equal(byDt['2026-10-31'].pr, 5999);
  assert.equal(byDt['2027-01-01'].pr, 6746);
  assert.equal(byDt['2026-10-29'].airline, 'Air India');
});

test('parseMmtFareCalendar rejects malformed payloads honestly', () => {
  assert.deepEqual(parseMmtFareCalendar('not json'), []);
  assert.deepEqual(parseMmtFareCalendar('{"fares": null}'), []);
  assert.deepEqual(parseMmtFareCalendar('{}'), []);
});

test('mmtDayFareItems prefers the exact depart date and names seller + airline', () => {
  const fares = parseMmtFareCalendar(CAL);
  const items = mmtDayFareItems(fares, src, 'Mumbai', 'New Delhi', 'BOM', 'DEL', '2026-10-28');
  assert.equal(items.length, 1);
  const it = items[0] as any;
  assert.equal(it.price, 6638);
  assert.equal(it.seller, 'MakeMyTrip');
  assert.ok(it.title.includes('IndiGo'), 'airline named on card per owner rule');
  assert.ok(it.title.includes('2026-10-28'));
  assert.equal(it.travel?.date, '2026-10-28');
  assert.ok(String(it.sellerUrl).includes('BOM-DEL-28/10/2026'), 'redirect is MMT\'s own SRP URL');
});

test('mmtDayFareItems falls back to cheapest upcoming date, clearly labelled', () => {
  const fares = parseMmtFareCalendar(CAL);
  // depart date not in calendar -> cheapest upcoming wins (₹5,999 on 31 Oct)
  const items = mmtDayFareItems(fares, src, 'Mumbai', 'New Delhi', 'BOM', 'DEL', '2026-11-15');
  assert.equal(items.length, 1);
  assert.equal(items[0].price, 5999);
  assert.ok(items[0].title.includes('cheapest upcoming'));
});

test('mmtSearchUrl builds the canonical MMT SRP redirect', () => {
  assert.equal(
    mmtSearchUrl('BOM', 'DEL', '2026-10-28'),
    'https://www.makemytrip.com/flight/search?itinerary=BOM-DEL-28/10/2026&tripType=O&paxType=A-1_C-0_I-0&intl=false&cabinClass=E&lang=eng',
  );
});
