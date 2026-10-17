/**
 * Yatra flights regression (17 Oct): the air-service JSON API behind Yatra's
 * SRP is open browserless. parseYatraBatch walks resultData[] batches
 * (trigger + per-airline polls): fltSchedule[DELBOM20261025][] flights carry
 * OD[0].FS[] segments (ac/fl/dd/ad/dac/aac) and fareDetails carries
 * [flightId].O.ADT.tf (total INR). The calendar fallback maps
 * day[date].af[airline] = { tf, ow: [{ fl, an, ddt, adt }] }.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseYatraBatch, yatraCalendarItems } from '../server/workers/parsers/yatraFlights.ts';

const src: any = { id: 't_flights_yatra', name: 'Yatra', method: 'http', verticals: ['flights'], enabled: true, priority: 5, config: {}, rateLimit: { maxRequestsPerMinute: 10, maxConcurrency: 2 }, freshnessPolicy: {} };
const SRP = 'https://flight.yatra.com/air-search-ui/dom2/trigger?flex=0&viewName=normal&source=fresco-flights&type=O&class=Economy&ADT=1&CHD=0&INF=0&noOfSegments=1&origin=DEL&originCountry=IN&destination=BOM&destinationCountry=IN&flight_depart_date=25%2F10%2F2026&arrivalDate=';

function batch(flights: any[], fares: any) {
  return JSON.stringify({
    resultData: [{
      isFlights: String(flights.length), isError: '0', isWarnings: '0',
      fltSchedule: { DELBOM20261025: flights, airlineNames: { QP: 'Akasa Air' } },
      fareDetails: { DELBOM20261025: fares },
    }],
  });
}

function flight(id: string, fs: any[], tdu = '02:20') {
  return { ID: id, mode: 'Instant', supplierCode: 'QPAPI', OD: [{ fid: id, tdu, fareId: 'Saver Fare', FS: fs }] };
}

test('yatra: batch parses per-flight offers with real fares, times, seller Yatra', () => {
  const f1 = flight('DELBOMQP1805EC20261025_QPAPI', [
    { ac: 'QP', fl: '1805', dac: 'DEL', aac: 'BOM', dd: '07:10', ad: '09:30', ddt: '2026-10-25', adt: '2026-10-25', du: '0220' },
  ]);
  const f2 = flight('DELBOMAI2678C20261025_1AWS4', [
    { ac: 'AI', fl: '2678', dac: 'DEL', aac: 'LKO', dd: '08:30', ad: '09:55', ddt: '2026-10-25', adt: '2026-10-25', du: '0125' },
    { ac: 'AI', fl: '887', dac: 'LKO', aac: 'BOM', dd: '11:10', ad: '13:35', ddt: '2026-10-25', adt: '2026-10-25', du: '0225' },
  ]);
  const body = batch([f1, f2], {
    DELBOMQP1805EC20261025_QPAPI: { O: { ADT: { tf: '6675', bf: '4877', ftf: '6675' } } },
    DELBOMAI2678C20261025_1AWS4: { O: { ADT: { tf: '7161', bf: '5345' } } },
  });
  const items = parseYatraBatch(body, src, SRP, 'DELBOM20261025', 'Delhi', 'Mumbai');
  assert.equal(items.length, 2);
  const a = items[0];
  assert.equal(a.price, 6675);
  assert.equal(a.seller, 'Yatra');
  assert.equal(a.sellerUrl, SRP);
  assert.equal(a.brand, 'Akasa Air');
  assert.equal(a.attributes.flight_number, 'QP1805');
  assert.equal(a.attributes.departure, '2026-10-25 07:10');
  assert.equal(a.attributes.arrival, '2026-10-25 09:30');
  assert.equal(a.attributes.stops, '0');
  assert.ok(String(a.identifiers?.sku).startsWith('DELBOMQP1805'));
  // 1-stop: arrival airport from the LAST segment
  const b = items[1];
  assert.equal(b.price, 7161);
  assert.equal(b.attributes.stops, '1');
  assert.equal(b.attributes.arrival, '2026-10-25 13:35');
  assert.equal(b.attributes.destination, 'BOM');
});

test('yatra: duplicate flight ids across batches are deduped, priceless flights skipped', () => {
  const f1 = flight('DELBOMQP1805EC20261025_QPAPI', [
    { ac: 'QP', fl: '1805', dac: 'DEL', aac: 'BOM', dd: '07:10', ad: '09:30', ddt: '2026-10-25', adt: '2026-10-25' },
  ]);
  const priceless = flight('DELBOMSG9800SA20261025_SGAPI', [
    { ac: 'SG', fl: '9800', dac: 'DEL', aac: 'BOM', dd: '17:00', ad: '19:15', ddt: '2026-10-25', adt: '2026-10-25' },
  ]);
  const fares = { DELBOMQP1805EC20261025_QPAPI: { O: { ADT: { tf: '6675' } } } };
  const first = parseYatraBatch(batch([f1], fares), src, SRP, 'DELBOM20261025', 'Delhi', 'Mumbai');
  const second = parseYatraBatch(batch([f1, priceless], fares), src, SRP, 'DELBOM20261025', 'Delhi', 'Mumbai');
  const bySku = new Map<string, any>();
  for (const it of [...first, ...second]) bySku.set(String(it.identifiers?.sku), it);
  assert.equal(bySku.size, 1); // dup merged; priceless never emitted
});

test('yatra: malformed / empty batches return empty arrays, never throw', () => {
  assert.deepEqual(parseYatraBatch('not json', src, SRP, 'DELBOM20261025', 'Delhi', 'Mumbai'), []);
  assert.deepEqual(parseYatraBatch('{"resultData":[{"isError":"1"}]}', src, SRP, 'DELBOM20261025', 'Delhi', 'Mumbai'), []);
  assert.deepEqual(parseYatraBatch('{"resultData":[]}', src, SRP, 'DELBOM20261025', 'Delhi', 'Mumbai'), []);
});

test('yatra: calendar fallback emits one offer per airline for the requested date', () => {
  const cal = JSON.stringify({
    ld: '2026-10-18', lf: 5945, isError: false,
    day: {
      '2026-10-18': {
        lf: 5945, la: 'IX',
        af: {
          AI: { tf: 7161, bf: 5345, ac: 'AI', ow: [{ dac: 'DEL', aac: 'BOM', fl: 2678, ac: 'AI', an: 'Air India', ddt: '2026-10-18 08:30', adt: '2026-10-18 10:40' }] },
          QP: { tf: 6675, bf: 4877, ac: 'QP', ow: [{ dac: 'DEL', aac: 'BOM', fl: 1833, ac: 'QP', an: 'Akasa Air', ddt: '2026-10-18 06:50', adt: '2026-10-18 09:05' }] },
        },
      },
    },
  });
  const items = yatraCalendarItems(cal, src, 'Delhi', 'Mumbai', 'DEL', 'BOM', '2026-10-18');
  assert.equal(items.length, 2);
  const qp = items.find((i) => i.brand === 'Akasa Air')!;
  assert.equal(qp.price, 6675);
  assert.equal(qp.seller, 'Yatra');
  assert.equal(qp.attributes.flight_number, 'QP1833');
  assert.equal(qp.attributes.departure, '06:50');
  assert.ok(String(qp.sellerUrl).includes('flight.yatra.com'));
});

test('yatra: calendar with no exact date falls back to the cheapest upcoming day', () => {
  const cal = JSON.stringify({
    day: {
      '2026-10-25': { lf: 0, af: {} },
      '2026-10-26': { lf: 6406, af: { IX: { tf: 6406, ow: [{ fl: 1392, ac: 'IX', an: 'AirAsia India', ddt: '2026-10-26 03:55', adt: '2026-10-26 07:10' }] } } },
    },
  });
  const items = yatraCalendarItems(cal, src, 'Delhi', 'Mumbai', 'DEL', 'BOM', '2026-10-25');
  assert.equal(items.length, 1);
  assert.equal(items[0].price, 6406);
  assert.ok(String(items[0].title).includes('cheapest upcoming'));
});
