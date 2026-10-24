/**
 * SpiceJet dotREZ fare-calendar + availability regression (24 Oct 2026):
 * www.spicejet.com/api/v2/search/lowfare (with the /api/v1/token NSK JWT)
 * is the browserless SpiceJet fares source; /api/v3/search/availability
 * adds flight-number/time metadata (no prices). Fixtures recorded LIVE from
 * the sandbox 24 Oct 2026: DEL-BOM 7-day calendar centered 28 Oct
 * (28 Oct total 6787 = fare 5050 + taxes 1737) and availability for 28 Oct
 * (SG 612, DEL 19:20 -> BOM 21:40, 2h 20m). Guards: date+total parsing,
 * exact-date-first item build, availability metadata merge, honest
 * cheapest-upcoming fallback, and the SRP redirect URL.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseSpiceJetLowFare,
  parseSpiceJetAvailability,
  spiceJetDayFareItems,
  spiceJetSearchUrl,
  spiceJetLowFareBody,
  spiceJetAvailabilityBody,
  spiceJetTokenHeaders,
} from '../server/workers/parsers/spiceJetDotRez.ts';

const src: any = { id: 't_flights_spicejet', name: 'SpiceJet', method: 'http', verticals: ['flights'], enabled: true, priority: 14, config: {}, rateLimit: { maxRequestsPerMinute: 4, maxConcurrency: 1 }, freshnessPolicy: {} };

const FIX = JSON.parse(readFileSync(new URL('./fixtures/spicejet_lowfare_del_bom.json', import.meta.url), 'utf8'));
const LIVE = JSON.stringify(FIX.response);
const FIXA = JSON.parse(readFileSync(new URL('./fixtures/spicejet_availability_del_bom.json', import.meta.url), 'utf8'));
const LIVEA = JSON.stringify(FIXA.response);

const SYN = JSON.stringify({
  data: {
    lowFareDateMarkets: [
      { lowestFareAmount: { fareAmount: 5050, farePointAmount: 0, taxesAndFeesAmount: 1737 }, departureDate: '2026-10-28T00:00:00' },
      { lowestFareAmount: { fareAmount: 4584, farePointAmount: 0, taxesAndFeesAmount: 1715 }, departureDate: '2026-10-29T00:00:00' },
      { lowestFareAmount: { fareAmount: 4084, farePointAmount: 0, taxesAndFeesAmount: 1689 }, departureDate: '2026-10-31T00:00:00' },
      { lowestFareAmount: { fareAmount: 100 }, departureDate: 'garbage' },                       // bad date -> dropped
      { lowestFareAmount: { fareAmount: 0, taxesAndFeesAmount: 500 }, departureDate: '2026-11-01T00:00:00' }, // zero fare -> dropped
    ],
  },
});

test('parseSpiceJetLowFare decodes the live DEL-BOM calendar (totals incl. taxes)', () => {
  const fares = parseSpiceJetLowFare(LIVE);
  assert.equal(fares.length, 7, `expected 7 calendar days, got ${fares.length}`);
  const byDt = Object.fromEntries(fares.map((f) => [f.dt, f]));
  const f28 = byDt['2026-10-28'];
  assert.ok(f28, '28 Oct entry present');
  assert.equal(f28.pr, 6787);
  assert.equal(f28.fare, 5050);
  assert.equal(f28.taxes, 1737);
});

test('parseSpiceJetLowFare drops bad dates and zero fares', () => {
  const fares = parseSpiceJetLowFare(SYN);
  assert.equal(fares.length, 3);
  assert.equal(fares[0].dt, '2026-10-28');
  assert.equal(fares[0].pr, 6787);
});

test('parseSpiceJetAvailability decodes the live journey (SG 612 metadata)', () => {
  const js = parseSpiceJetAvailability(LIVEA);
  assert.ok(js.length >= 1, `expected journeys, got ${js.length}`);
  const j = js[0];
  assert.equal(j.carrier, 'SG 612');
  assert.equal(j.departure, '2026-10-28T19:20:00');
  assert.equal(j.arrival, '2026-10-28T21:40:00');
  assert.equal(j.duration, '2h 20m');
  assert.equal(j.seatsAvailable, 16);
});

test('spiceJetDayFareItems: exact date wins and merges flight metadata', () => {
  const fares = parseSpiceJetLowFare(LIVE);
  const journeys = parseSpiceJetAvailability(LIVEA);
  const items = spiceJetDayFareItems(fares, journeys, src, 'Delhi', 'Mumbai', 'DEL', 'BOM', '2026-10-28');
  assert.equal(items.length, 1);
  const it: any = items[0];
  assert.equal(it.price, 6787);
  assert.equal(it.currency, 'INR');
  assert.equal(it.seller, 'SpiceJet');
  assert.match(it.title, /SpiceJet Delhi → Mumbai on 2026-10-28/);
  assert.equal(it.attributes.airline, 'SpiceJet');
  assert.equal(it.attributes.flight_number, 'SG 612');
  assert.equal(it.attributes.departure_time, '19:20');
  assert.equal(it.attributes.arrival_time, '21:40');
  assert.equal(it.attributes.departure_date, '2026-10-28');
  assert.equal(it.travel.date, '2026-10-28');
  assert.equal(it.sellerUrl, spiceJetSearchUrl('DEL', 'BOM', '2026-10-28'));
  assert.match(String(it.attributes.data_note), /SG 612/);
});

test('spiceJetDayFareItems: cheapest upcoming fallback is labelled', () => {
  const fares = parseSpiceJetLowFare(SYN);
  const items = spiceJetDayFareItems(fares, [], src, 'Delhi', 'Mumbai', 'DEL', 'BOM', '2026-12-24');
  assert.equal(items.length, 1);
  const it: any = items[0];
  // cheapest of {6787 (28 Oct), 6299 (29 Oct), 5773 (31 Oct)} is 31 Oct
  assert.equal(it.price, 5773);
  assert.equal(it.attributes.departure_date, '2026-10-31');
  assert.match(it.title, /cheapest upcoming/);
  assert.equal(it.attributes.flight_number, undefined); // no metadata merged
});

test('spiceJetDayFareItems: empty calendar emits nothing (honest empty)', () => {
  assert.equal(spiceJetDayFareItems([], [], src, 'Delhi', 'Mumbai', 'DEL', 'BOM', '2026-10-28').length, 0);
});

test('spiceJetSearchUrl is the SRP deeplink pattern from the SPA bundle', () => {
  const u = spiceJetSearchUrl('DEL', 'BOM', '2026-10-28');
  assert.equal(u, 'https://www.spicejet.com/search?from=DEL&to=BOM&tripType=1&departure=2026-10-28&adult=1&child=0&srCitizen=0&infant=0&currency=INR');
});

test('spiceJet payload builders match the captured XHR shapes', () => {
  const lf = JSON.parse(spiceJetLowFareBody('DEL', 'BOM', '2026-10-28'));
  assert.deepEqual(lf, {
    pax: { journeyClass: 'ff', adult: 1, child: 0, infant: 0, srCitizen: 0 },
    codes: { currency: 'INR' },
    origin: 'DEL', destination: 'BOM', centerDate: '2026-10-28',
  });
  const av = JSON.parse(spiceJetAvailabilityBody('DEL', 'BOM', '2026-10-28'));
  assert.deepEqual(av, {
    destinationStationCode: 'BOM', originStationCode: 'DEL',
    onWardDate: '2026-10-28', currency: 'INR',
    pax: { journeyClass: 'ff', adult: 1, child: 0, infant: 0, srCitizen: 0 },
  });
});

test('spiceJetTokenHeaders uses the discovered os/authorization null recipe', () => {
  const h = spiceJetTokenHeaders();
  assert.equal(h['os'], 'web');
  assert.equal(h['authorization'], 'null');
  assert.equal(h['content-type'], 'application/json');
});
