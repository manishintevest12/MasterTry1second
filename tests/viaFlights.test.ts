/**
 * Via.com flight fare-calendar regression (17 Oct). in.via.com's B2C
 * fare-calendar API is open (public bundle authToken in their own JS):
 * POST /apiv2/flight/fare-calendar -> { cd: [ { dt, pr, prType } ] }.
 * viaDayFareItems must emit ONE honest offer — exact requested date first,
 * else cheapest upcoming day — with seller Via.com and a Via search deeplink.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseViaFareCalendar, viaDayFareItems, viaSearchUrl, viaFareCalendarUrl } from '../server/workers/parsers/viaFlights.ts';

const SRC: any = { id: 1, name: 'via', vertical: 'flights' };

test('via calendar: parses cd[] entries, rejects junk', () => {
  const body = JSON.stringify({
    cd: [
      { dt: '2026-12-24', pr: 4100, prType: 'LOW' },
      { dt: '2026-12-25', pr: 5800, prType: 'HIGH' },
      { dt: 'bad-date', pr: 1000, prType: 'LOW' },   // invalid dt dropped
      { dt: '2026-12-26', pr: -5, prType: 'LOW' },    // non-positive dropped
      { dt: '2026-12-27' },                            // missing pr dropped
    ],
    webDta: { hdr: { priNavEl: [{ dsplyNm: 'Flights' }] } },
  });
  const out = parseViaFareCalendar(body);
  assert.equal(out.length, 2);
  assert.equal(out[0].pr, 4100);
  assert.equal(out[1].prType, 'HIGH');
});

test('via calendar: non-JSON / challenge bodies yield empty (never fabricate)', () => {
  assert.equal(parseViaFareCalendar('<html>error</html>').length, 0);
  assert.equal(parseViaFareCalendar('{"err":{"title":"No handler"}}').length, 0);
  assert.equal(parseViaFareCalendar('').length, 0);
});

test('via offer: exact requested date wins', () => {
  const fares = [
    { dt: '2026-10-25', pr: 5000, prType: 'LOW' },
    { dt: '2026-11-02', pr: 3200, prType: 'LOW' }, // cheaper but not requested
    { dt: '2026-10-30', pr: 6500, prType: 'HIGH' },
  ];
  const items = viaDayFareItems(fares, SRC, 'New Delhi', 'Mumbai', 'DEL', 'BOM', '2026-10-25');
  assert.equal(items.length, 1);
  const it = items[0];
  assert.equal(it.price, 5000);
  assert.equal(it.currency, 'INR');
  assert.equal(it.seller, 'Via.com');
  assert.ok(it.title.includes('on 2026-10-25'));
  assert.ok(it.sellerUrl.startsWith('https://in.via.com/flight/search'));
  assert.ok(it.sellerUrl.includes('destination=BOM'));
  assert.equal(it.identifiers.sku, 'via-DEL-BOM-2026-10-25');
  assert.deepEqual(it.evidence.extractedFields, ['cd[].dt', 'cd[].pr (INR)', 'cd[].prType']);
});

test('via offer: falls back to cheapest upcoming when exact date absent', () => {
  const fares = [
    { dt: '2026-11-05', pr: 7100, prType: 'MEDIUM' },
    { dt: '2026-11-02', pr: 3200, prType: 'LOW' },
    { dt: '2027-01-08', pr: 6923, prType: 'LOW' },
  ];
  const items = viaDayFareItems(fares, SRC, 'New Delhi', 'Mumbai', 'DEL', 'BOM', '2026-10-25');
  assert.equal(items.length, 1);
  assert.equal(items[0].price, 3200);
  assert.ok(items[0].title.includes('cheapest upcoming'));
  assert.ok(items[0].title.includes('2026-11-02'));
});

test('via deeplink helpers carry public token and canonical search URL', () => {
  assert.ok(viaFareCalendarUrl().includes('authToken=553f5767-373f-4d98-9e6d-08fa87400a42'));
  const u = viaSearchUrl('DEL', 'BOM', '2026-10-25');
  assert.ok(u.includes('source=DEL&bsource=DEL'));
  assert.ok(u.includes('month=10&day=25&year=2026'));
  assert.ok(u.includes('travType=DOM'));
});
