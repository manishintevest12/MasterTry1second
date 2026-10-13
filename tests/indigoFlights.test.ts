import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIndigoSearch, indigoItems, collectFlights } from '../server/workers/parsers/indigoFlights';
import type { SourceConfig } from '../server/types';

const src = { id: 'w_flights_indigo' } as unknown as SourceConfig;

const SAMPLE = JSON.stringify({
  status: 'SUCCESS',
  data: {
    journeys: [
      {
        journeyId: 'j1',
        flightOptions: [
          {
            flightOptionId: 'fo1',
            totalFare: 5432,
            currencyCode: 'INR',
            flights: [
              {
                flightNumber: '6E-2087',
                flightDetail: { departureTime: '07:45', arrivalTime: '09:50', duration: '2h 05m', originStation: 'DEL', destinationStation: 'BOM' },
                fareInfo: { totalFare: 5432, seatsLeft: '9' },
              },
            ],
          },
          {
            flightOptionId: 'fo2',
            totalAmount: 6890,
            flights: [
              { flightNumber: '6E  502', departureTime: '12:10', arrivalTime: '14:20', duration: '2h 10m', totalFare: 6890 },
            ],
          },
          // a node with a flight number but NO fare — must be dropped (honesty)
          { flightOptionId: 'fo3', flights: [{ flightNumber: '6E-999', departureTime: '01:00' }] },
        ],
      },
    ],
  },
});

test('parseIndigoSearch finds priced 6E flights via deep walk', () => {
  const f = parseIndigoSearch(SAMPLE);
  assert.equal(f.length, 3); // 2087 (fare from parent), 502 (own fare), 999 (fareless -> filtered at item stage)
  const byNo = Object.fromEntries(f.map((x) => [x.flightNo, x]));
  assert.equal(byNo['6E-2087'].fare, 5432); // fare adopted from parent option node
  assert.equal(byNo['6E-502'].fare, 6890);  // own fare, double-space code normalised
  assert.equal(byNo['6E-502'].depTime, '12:10');
  assert.equal(byNo['6E-999'].fare, undefined);
});

test('collectFlights ignores non-IndiGo and fare-only nodes', () => {
  const tree = { a: [{ flightNumber: 'AI-401', totalFare: 3000 }], b: { flightNumber: '6E-101' }, c: { fare: 999 } };
  const got = collectFlights(tree);
  assert.equal(got.length, 1);          // 6E-101 kept as fareless candidate
  assert.equal(got[0].fare, undefined); // no fare invented
});

test('indigoItems maps to catalogue items with airline as seller and honest price', () => {
  const f = parseIndigoSearch(SAMPLE);
  const items = indigoItems(f, src, 'Delhi', 'Mumbai', 'DEL', 'BOM', '2026-10-20');
  assert.equal(items.length, 2);
  const i = items[0];
  assert.equal(i.seller, 'IndiGo');
  assert.equal(i.price, 5432);
  assert.equal(i.currency, 'INR');
  assert.match(i.sellerUrl!, /goindigo\.in/);
  assert.equal(i.attributes!.flight_no, '6E-2087');
  assert.equal(i.attributes!.from_iata, 'DEL');
  assert.equal(i.travel!.seatType, 'Economy');
  assert.equal(i.travel!.date, '2026-10-20');
});

test('indigoItems skips flights without positive fares', () => {
  const f = parseIndigoSearch(JSON.stringify({ x: [{ flightNumber: '6E-111', totalFare: 0 }] }));
  assert.deepEqual(indigoItems(f, src, 'a', 'b', 'AAA', 'BBB', '2026-10-20'), []);
});

test('parseIndigoSearch returns [] on malformed JSON', () => {
  assert.deepEqual(parseIndigoSearch('<html>not json</html>'), []);
});
