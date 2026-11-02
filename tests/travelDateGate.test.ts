import test from 'node:test';
import assert from 'node:assert/strict';
import { enforceRequestedTravelDate, normalizeTravelDate, offerTravelDate } from '../server/search/travelDateGate';

/** OWNER 2 Nov: "19-11-2026 search kiya, result 2-11-2026 ka bata raha hai - aise issue hr
 *  vertical fix kro". These pin the rule that a date-answering vertical may only show rows for
 *  the date the user asked for. */

test('dates are read in every format our partners actually emit', () => {
  assert.equal(normalizeTravelDate('2026-11-19'), '2026-11-19');
  assert.equal(normalizeTravelDate('2026-11-19T00:00:00Z'), '2026-11-19');
  assert.equal(normalizeTravelDate('19/11/2026'), '2026-11-19');   // EaseMyTrip/MMT calendars
  assert.equal(normalizeTravelDate('19-11-2026'), '2026-11-19');   // AbhiBus/bus rows
  assert.equal(normalizeTravelDate('2026/12/20'), '2026-12-20');
  assert.equal(normalizeTravelDate('19 Nov 2026'), '2026-11-19');
  assert.equal(normalizeTravelDate('Nov 19, 2026'), '2026-11-19');
  assert.equal(normalizeTravelDate('19 Nov 2026 06:00'), '2026-11-19');
  // Month-first is still understood when day-first is impossible.
  assert.equal(normalizeTravelDate('11/19/2026'), '2026-11-19');
  // Unreadable stays empty rather than inventing a date.
  assert.equal(normalizeTravelDate(''), '');
  assert.equal(normalizeTravelDate('tomorrow'), '');
  assert.equal(normalizeTravelDate('2026-13-45'), '');
});

test('the row date is found in travel.date and in the catalogue attribute names', () => {
  assert.equal(offerTravelDate({ travel: { date: '2026-11-19' } }), '2026-11-19');
  assert.equal(offerTravelDate({ attributes: { travel_date: '19/11/2026' } }), '2026-11-19');
  assert.equal(offerTravelDate({ attributes: { departure_date: '2026-11-19' } }), '2026-11-19');
  assert.equal(offerTravelDate({ attributes: { checkin: '20/11/2026' } }), '2026-11-20');
  assert.equal(offerTravelDate({ attributes: {} }), '');
});

test('a 19 Nov flight search can no longer show a 2 Nov (or any other day) card', () => {
  const rows = [
    { title: 'right day (ISO)', travel: { date: '2026-11-19' } },
    { title: 'right day (EMT calendar format)', attributes: { travel_date: '19/11/2026' } },
    { title: 'fare-calendar fallback to today', travel: { date: '2026-11-02' } },
    { title: 'fallback, no travel.date but dated attribute', attributes: { travel_date: '02/11/2026' } },
    { title: 'presence card (no priced date)', prices: { effectivePrice: 0 } },
  ];
  const gate = enforceRequestedTravelDate(rows, 'flights', { depart: '2026-11-19' });
  assert.deepEqual(gate.kept.map((r) => r.title), [
    'right day (ISO)',
    'right day (EMT calendar format)',
    'presence card (no priced date)',
  ]);
  assert.equal(gate.dropped, 2);
  // Both fallback rows answer 2 Nov, one via travel.date and one via a dated attribute.
  assert.deepEqual(gate.droppedOn, { '2026-11-02': 2 });
});

test('measured production case: a 20 Dec search carrying a 19 Nov batch is emptied', () => {
  const rows = Array.from({ length: 40 }, (_, i) => ({ title: `flight ${i}`, travel: { date: '2026-11-19' } }));
  const gate = enforceRequestedTravelDate(rows, 'flights', { depart: '2026-12-20' });
  assert.equal(gate.kept.length, 0);
  assert.equal(gate.dropped, 40);
});

test('a return trip accepts the outbound or the return date, never a third date', () => {
  const rows = [
    { travel: { date: '2026-11-19' } },
    { travel: { date: '2026-11-23' } },
    { travel: { date: '2026-11-21' } },
  ];
  const gate = enforceRequestedTravelDate(rows, 'flights', { depart: '2026-11-19', return: '2026-11-23' });
  assert.equal(gate.kept.length, 2);
  assert.equal(gate.dropped, 1);
});

test('hotels are checked against the check-in date', () => {
  const rows = [
    { attributes: { checkin: '2026-11-19' } },
    { attributes: { checkin: '2026-11-02' } },
  ];
  const gate = enforceRequestedTravelDate(rows, 'hotels', { depart: '2026-11-19' });
  assert.equal(gate.kept.length, 1);
  assert.equal(gate.dropped, 1);
});

test('vertical with no date semantics is never filtered, and no date asked means no filtering', () => {
  const rows = [{ travel: { date: '2026-11-02' } }];
  assert.equal(enforceRequestedTravelDate(rows, 'grocery', { depart: '2026-11-19' }).dropped, 0);
  assert.equal(enforceRequestedTravelDate(rows, 'flights', {}).dropped, 0);
  assert.equal(enforceRequestedTravelDate(rows, 'flights', { depart: 'not-a-date' }).dropped, 0);
});
