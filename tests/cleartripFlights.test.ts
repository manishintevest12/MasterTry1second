/**
 * Cleartrip flights regression (17 Oct): GET www.cleartrip.com/flight/search/v2
 * (headers from Cleartrip's own Next bundle) returns the full fare matrix
 * browserless. parseCleartripFlights walks cards.J1[] -> subTravelOptionIds[0] ->
 * subTravelOptions[id].fareIds[0] -> fares[id].pricing.totalPricing.totalPrice.
 * Values below are from the live capture /tmp/ct_del_bom_v2.json (194 cards).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCleartripFlights, cleartripSearchUrl } from '../server/workers/parsers/cleartripFlights.ts';

const src: any = { id: 't_flights_cleartrip', name: 'Cleartrip', method: 'http', verticals: ['flights'], enabled: true, priority: 8, config: {}, rateLimit: { maxRequestsPerMinute: 4, maxConcurrency: 2 }, freshnessPolicy: {} };
const FARE_ID_QP = 'REGULAR__QP__DEL_BOM__S039__SAVER__V3';
const FARE_ID_IX = 'REGULAR__IX__DEL_NMI__SAVER__V3';

function body(fix: Record<string, any>) { return JSON.stringify({ cards: { J1: fix.cards }, subTravelOptions: fix.subs, fares: fix.fares }); }

const CARD_QP = {
  travelOptionId: 'QP-1805-DEL-BOM-1792892400',
  summary: {
    flights: [{ airlineCode: 'QP', flightNumber: '1805' }],
    firstDeparture: { airport: { code: 'DEL' }, time: '2026-10-25T07:10:00.000+05:30' },
    lastArrival: { airport: { code: 'BOM' }, time: '2026-10-25T09:30:00.000+05:30' },
    totalDuration: { hh: 2, mm: 20 }, stops: 0, timelineText: 'Non-stop',
  },
  subTravelOptionIds: ['QP-1805-DEL-BOM-1792892400'],
};
const CARD_IX = {
  travelOptionId: 'IX-1080-DEL-NMI-1792886400',
  summary: {
    flights: [{ airlineCode: 'IX', flightNumber: '1080' }],
    firstDeparture: { airport: { code: 'DEL' }, time: '2026-10-25T05:30:00.000+05:30' },
    lastArrival: { airport: { code: 'NMI' }, time: '2026-10-25T07:45:00.000+05:30' },
    totalDuration: { hh: 2, mm: 15 }, stops: 0,
  },
  subTravelOptionIds: ['IX-1080-DEL-NMI-1792886400'],
};

const FIXTURE = {
  cards: [CARD_QP, CARD_IX],
  subs: {
    'QP-1805-DEL-BOM-1792892400': { subTravelOptionId: 'QP-1805-DEL-BOM-1792892400', fareIds: [FARE_ID_QP] },
    'IX-1080-DEL-NMI-1792886400': { subTravelOptionId: 'IX-1080-DEL-NMI-1792886400', fareIds: [FARE_ID_IX] },
  },
  fares: {
    [FARE_ID_QP]: { fareId: FARE_ID_QP, pricing: { totalPricing: { totalPrice: 6675.0, totalBaseFare: 4877.0, totalTax: 1798.0, message: '₹934 off with BBDHDFC', couponDetails: { discountAmount: 934, couponCode: 'BBDHDFC' } } } },
    [FARE_ID_IX]: { fareId: FARE_ID_IX, pricing: { totalPricing: { totalPrice: 6844.0, totalBaseFare: 4820.0, totalTax: 2024.0, message: '' } } },
  },
};

test('cleartrip: v2 fare matrix parses to offers with real INR totals, coupon, seller Cleartrip', () => {
  const items = parseCleartripFlights(body(FIXTURE), src, 'Delhi', 'Mumbai', '2026-10-25');
  assert.equal(items.length, 2);
  const [qp, ix] = items;
  assert.equal(qp.brand, 'Akasa Air');
  assert.equal(qp.price, 6675);
  assert.equal(qp.seller, 'Cleartrip');
  assert.equal(qp.attributes.departure, '07:10');
  assert.equal(qp.attributes.arrival, '09:30');
  assert.equal(qp.attributes.stops, '0');
  assert.equal(qp.attributes.origin, 'DEL');
  assert.equal(qp.attributes.destination, 'BOM');
  assert.equal(qp.attributes.duration, '02h 20m');
  assert.equal(qp.attributes.coupon, '₹934 off with BBDHDFC');
  assert.equal(qp.travel.date, '2026-10-25');
  assert.ok(String(qp.sellerUrl).startsWith('https://www.cleartrip.com/flights/results?from=DEL'));
  assert.equal(ix.brand, 'Air India Express');
  assert.equal(ix.price, 6844);
  assert.ok(!('coupon' in ix.attributes)); // no coupon message -> no coupon attr
});

test('cleartrip: broken/empty payloads return empty, never throw', () => {
  assert.deepEqual(parseCleartripFlights('not json', src, 'Delhi', 'Mumbai', '2026-10-25'), []);
  assert.deepEqual(parseCleartripFlights(JSON.stringify({ cards: {} }), src, 'Delhi', 'Mumbai', '2026-10-25'), []);
  assert.deepEqual(parseCleartripFlights(body({ cards: [], subs: {}, fares: {} }), src, 'Delhi', 'Mumbai', '2026-10-25'), []);
  // card with missing fare chain: skipped honestly
  const broken = { cards: [{ ...CARD_QP, subTravelOptionIds: ['missing'] }], subs: {}, fares: {} };
  assert.deepEqual(parseCleartripFlights(body(broken), src, 'Delhi', 'Mumbai', '2026-10-25'), []);
});

test('cleartrip: search URL carries IATA + DD/MM/YYYY date', () => {
  assert.equal(cleartripSearchUrl('DEL', 'BOM', '25/10/2026'), 'https://www.cleartrip.com/flight/search/v2?from=DEL&to=BOM&depart_date=25%2F10%2F2026&adults=1');
});
