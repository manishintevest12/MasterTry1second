import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aertripDepartParam,
  aertripSearchUrl,
  aertripResultsUrl,
  aertripDeeplink,
  parseAertripSid,
  parseAertripJourneys,
  aertripDurationMinutes,
  aertripFlightNumber,
  aertripJourneyPrice,
  AERTRIP_GROUPS,
} from '../server/workers/parsers/aertripFlights';
import type { SourceConfig } from '../server/types';

const src = { id: 'w_flights_aertrip' } as unknown as SourceConfig;

/**
 * Fixture mirrors the LIVE payload captured on 2 Nov 2026 for IDR->DEL 19-11-2026
 * (Aertrip /api/v1/flights/results, vcodes_grp=6e). Values are the real ones:
 * 6E-6627 07:15 -> 08:45, 5400 s, base 5325 + taxes 2012 - PPD 53.25 + round-off 0.25
 * = grand_total 7284. Group payloads carry one `flights` array per supplier group and
 * each entry's `results.j` is the journey list.
 */
const GROUP_PAYLOAD = JSON.stringify({
  success: true,
  errors: [],
  data: {
    sid: 'f5f0098535b07bdcac405d571c6f2f56',
    completed: 1,
    done: true,
    vcodes_grp: '6e',
    flights: [
      {
        vcode: '6e',
        display_group_id: 1,
        results: {
          j_count: 2,
          j: [
            {
              vendor: '6e',
              fk: 'b757f1b2e544e698d56fb6ec931a789f',
              farepr: 7284,
              dt: '07:15',
              at: '08:45',
              tt: [5400],
              stp: '0',
              al: ['6E'],
              ap: ['IDR', 'DEL'],
              segment_cabin_classes: ['economy'],
              fare: {
                BF: { name: 'Base Fare', value: 5325 },
                taxes: { name: 'Taxes and Fees', value: 2012 },
                gross_fare: { name: 'Gross Fare', value: 7337 },
                discounts: { name: 'Discounts', value: -53.25 },
                ROUNDOFF: { name: 'Round Off', value: 0.25 },
                net_fare: { name: 'Net Fare', value: 7284 },
                grand_total: { name: 'Grand Total', value: 7284 },
              },
              leg: [
                {
                  all_ap: ['IDR', 'DEL'],
                  ap: ['IDR', 'DEL'],
                  tt: '5400',
                  stp: '0',
                  flights: [{ ffk_str: '6E-6627_19112026_07:15_REGULAR FARE' }],
                },
              ],
            },
            {
              // Honest-drop case: a journey with no schedule in the payload must not
              // become a card (owner rule: no times means no row, never a guess).
              vendor: '6e',
              farepr: 6899,
              dt: '',
              at: '',
              tt: [],
              stp: '0',
              al: ['6E'],
              ap: ['IDR', 'DEL'],
              leg: [],
            },
          ],
        },
      },
    ],
  },
});

test('aertrip: depart is DD-MM-YYYY (their API rejects ISO)', () => {
  assert.equal(aertripDepartParam('2026-11-19'), '19-11-2026');
  assert.equal(aertripDepartParam('19-11-2026'), '', 'already-Indian format is not re-parsed');
  assert.equal(aertripDepartParam(''), '');
});

test('aertrip: search url carries the real query their SPA sends', () => {
  const u = new URL(aertripSearchUrl('IDR', 'DEL', '2026-11-19'));
  assert.equal(u.pathname, '/api/v1/flights/search');
  assert.equal(u.searchParams.get('depart'), '19-11-2026');
  assert.equal(u.searchParams.get('origin'), 'IDR');
  assert.equal(u.searchParams.get('destination'), 'DEL');
  assert.equal(u.searchParams.get('trip_type'), 'single');
  assert.equal(u.searchParams.get('adult'), '1');
  assert.equal(u.searchParams.get('pType'), 'flight');
});

test('aertrip: results url targets the supplier group', () => {
  const u = new URL(aertripResultsUrl('abc12345', 'emtp'));
  assert.equal(u.searchParams.get('sid'), 'abc12345');
  assert.equal(u.searchParams.get('vcodes_grp'), 'emtp');
  assert.equal(u.searchParams.get('display_group_id'), '1');
});

test('aertrip: deeplink opens their results page for the exact date we searched', () => {
  const d = aertripDeeplink('IDR', 'DEL', '2026-11-19');
  assert.ok(d.startsWith('https://www.aertrip.com/v2/flights?'));
  assert.match(d, /depart=19-11-2026/);
  assert.match(d, /origin=IDR/);
  assert.match(d, /destination=DEL/);
  assert.ok(!d.includes('2026-11-19'), 'ISO date must never leak into the exit URL');
});

test('aertrip: sid is read only when the API really minted one', () => {
  assert.equal(parseAertripSid(JSON.stringify({ success: true, data: { sid: 'f5f0098535b07bdcac405d571c6f2f56' } })), 'f5f0098535b07bdcac405d571c6f2f56');
  assert.equal(parseAertripSid(JSON.stringify({ success: false, errors: ['x'], data: {} })), null);
  assert.equal(parseAertripSid('<html>Access Denied</html>'), null);
  assert.equal(parseAertripSid(''), null);
});

test('aertrip: journey helpers read the live field names', () => {
  const j: any = { dt: '07:15', at: '08:45', tt: [5400], stp: '0', farepr: 7284, leg: [{ flights: [{ ffk_str: '6E-6627_19112026_07:15_REGULAR FARE' }] }] };
  assert.equal(aertripDurationMinutes(j), 90);
  assert.equal(aertripFlightNumber(j), '6E-6627');
  assert.equal(aertripJourneyPrice(j), 7284);
  assert.equal(aertripDurationMinutes({ tt: [] } as any), undefined);
});

test('aertrip: group payload yields a complete, honestly-labelled flight row', () => {
  const items = parseAertripJourneys(GROUP_PAYLOAD, {
    source: src, fromCode: 'IDR', toCode: 'DEL', dateIso: '2026-11-19',
    routeLabel: 'IDR to DEL', today: '2026-11-02',
  });
  assert.equal(items.length, 1, 'the timeless journey is dropped, not back-filled');
  const it: any = items[0];
  assert.equal(it.price, 7284);
  assert.equal(it.currency, 'INR');
  assert.equal(it.seller, 'Aertrip');
  assert.equal(it.attributes.flight_number, '6E-6627');
  assert.equal(it.attributes.departure, '07:15');
  assert.equal(it.attributes.arrival, '08:45');
  assert.equal(it.attributes.stops, '0');
  assert.equal(it.attributes.duration_minutes, '90');
  assert.equal(it.attributes.travel_date, '2026-11-19');
  assert.equal(it.travel.date, '2026-11-19');
  assert.match(it.sellerUrl, /depart=19-11-2026/);
  assert.match(it.attributes.price_basis, /Aertrip is the selling website/);
  assert.match(it.attributes.data_note, /SOLD by Aertrip/);
});

test('aertrip: a journey for a different route is never emitted', () => {
  const wrong = JSON.parse(GROUP_PAYLOAD);
  wrong.data.flights[0].results.j[0].ap = ['BOM', 'BLR'];
  const items = parseAertripJourneys(JSON.stringify(wrong), {
    source: src, fromCode: 'IDR', toCode: 'DEL', dateIso: '2026-11-19',
    routeLabel: 'IDR to DEL', today: '2026-11-02',
  });
  assert.equal(items.length, 0);
});

test('aertrip: empty / progressive / garbage payloads are honest empties', () => {
  const empty = JSON.stringify({ success: true, data: { sid: 'x', done: false, flights: [] } });
  for (const body of [empty, '{}', '', '<html>Access Denied</html>', JSON.stringify({ data: null })]) {
    assert.deepEqual(parseAertripJourneys(body, {
      source: src, fromCode: 'IDR', toCode: 'DEL', dateIso: '2026-11-19',
      routeLabel: 'IDR to DEL', today: '2026-11-02',
    }), []);
  }
});

test('aertrip: implied prices and absurd fares are refused', () => {
  const cheap = JSON.parse(GROUP_PAYLOAD);
  cheap.data.flights[0].results.j[0].farepr = 0;
  cheap.data.flights[0].results.j[0].fare = {};
  cheap.data.flights[0].results.j[0].grosspr = 0;
  assert.deepEqual(parseAertripJourneys(JSON.stringify(cheap), {
    source: src, fromCode: 'IDR', toCode: 'DEL', dateIso: '2026-11-19',
    routeLabel: 'IDR to DEL', today: '2026-11-02',
  }), []);
});

test('aertrip: supplier groups list stays non-empty and unique', () => {
  assert.ok(AERTRIP_GROUPS.length >= 5);
  assert.equal(new Set(AERTRIP_GROUPS).size, AERTRIP_GROUPS.length);
});
