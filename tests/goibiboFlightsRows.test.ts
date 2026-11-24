import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGoibiboSsr } from '../server/workers/parsers/goibiboFlights';

/**
 * OWNER 24 Nov: "goibibo mai sirf ek card aa raha hai. flight number, date ni aata isko fix kro".
 *
 * Two measured causes, both pinned here:
 *   1. `listing.journeys.allJourneys` is a list of GROUPS; only the first was read, so a listing with many journeys
 *      reached the page as a single card.
 *   2. the card's date came only from the page-level itinerary token; the journey key itself carries the departure
 *      day, so a page with a missing/stale itinerary produced a card with no date.
 */

const source: any = { id: 'goibibo_flights', name: 'Goibibo', vertical: 'flights' };

function page(journeys: any[][], itinerary?: string) {
  const data = {
    props: {
      pageProps: {
        data: {
          state: {
            listing: {
              flightSearchParams: itinerary ? { itinerary } : {},
              journeyMap: {
                data: {
                  'IDR$DEL$2026-11-28 06:50$6E-2045': { depTime: '06:50', arrTime: '08:15', depCityCd: 'IDR', arrCityCd: 'DEL', duration: { h: 1, m: 25 } },
                  'IDR$DEL$2026-11-28 14:10$AI-803': { depTime: '14:10', arrTime: '15:40', depCityCd: 'IDR', arrCityCd: 'DEL', duration: { h: 1, m: 30 } },
                  'IDR$DEL$2026-11-28 19:35$QP-1833': { depTime: '19:35', arrTime: '21:05', depCityCd: 'IDR', arrCityCd: 'DEL', duration: { h: 1, m: 30 } },
                },
              },
              journeys: { allJourneys: journeys },
            },
          },
        },
      },
    },
  };
  return `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script></html>`;
}

const j = (fare: number, key: string, flno: string, airline = 'IndiGo') => ({
  fare,
  flightNumber: flno,
  simpleAirlineHeading: { cd: flno.split('-')[0], nm: airline },
  journeyKeys: [key],
});

test('every journey group is read, not just the first', () => {
  const html = page([
    [j(7337, 'IDR$DEL$2026-11-28 06:50$6E-2045', '6E-2045')],
    [j(7650, 'IDR$DEL$2026-11-28 14:10$AI-803', 'AI-803', 'Air India')],
    [j(6999, 'IDR$DEL$2026-11-28 19:35$QP-1833', 'QP-1833', 'Akasa Air')],
  ], 'IDR-DEL-28/11/2026');
  const rows = parseGoibiboSsr(html, source, 'https://www.goibibo.com/flights/indore-to-delhi-flights/', 'Indore', 'New Delhi');
  assert.equal(rows.length, 3, 'three journeys must produce three cards');
  const numbers = rows.map((r: any) => r.attributes.flight_number).sort();
  assert.deepEqual(numbers, ['6E-2045', 'AI-803', 'QP-1833']);
  for (const r of rows as any[]) {
    assert.equal(r.travel.date, '2026-11-28');
    assert.ok(r.attributes.departure, 'departure time present');
    assert.ok(String(r.title).includes('on 2026-11-28'), 'date printed on the card');
  }
});

test('a repeated journey is never shown twice', () => {
  const html = page([
    [j(7337, 'IDR$DEL$2026-11-28 06:50$6E-2045', '6E-2045')],
    [j(7337, 'IDR$DEL$2026-11-28 06:50$6E-2045', '6E-2045')],
  ]);
  const rows = parseGoibiboSsr(html, source, 'https://x/', 'Indore', 'New Delhi');
  assert.equal(rows.length, 1);
});

test('the date comes from the journey key when the page itinerary is missing', () => {
  const html = page([[j(7337, 'IDR$DEL$2026-11-28 06:50$6E-2045', '6E-2045')]]);
  const rows = parseGoibiboSsr(html, source, 'https://x/', 'Indore', 'New Delhi');
  assert.equal(rows.length, 1);
  assert.equal((rows[0] as any).travel.date, '2026-11-28', 'date ni aata: the key carries it');
  assert.match(String((rows[0] as any).title), /on 2026-11-28/);
});

test('a journey with no price is skipped, never shown as a free flight', () => {
  const html = page([
    [j(0, 'IDR$DEL$2026-11-28 06:50$6E-2045', '6E-2045'), j(7337, 'IDR$DEL$2026-11-28 14:10$AI-803', 'AI-803')],
  ]);
  const rows = parseGoibiboSsr(html, source, 'https://x/', 'Indore', 'New Delhi');
  assert.equal(rows.length, 1);
  assert.equal((rows[0] as any).attributes.flight_number, 'AI-803');
});
