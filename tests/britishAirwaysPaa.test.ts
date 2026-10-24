/**
 * British Airways regression (24 Oct 2026): recipe-only availability probe.
 * Live-verified parts: cabinHelper payload (GET /lookup/jsonp/... 200 from
 * sandbox), flight-list deeplink format (live CDP observation of a DEL-LHR
 * search reaching flightList?onds=DEL-LHR_2026-10-28&...), and the request
 * recipe deobfuscated from the public ba-sell bundle (grant + availability
 * body + integrity token). The availability RESPONSE schema is bundle-
 * derived (not yet live-validated because BA tarpits all POSTs from
 * datacenter IPs) - the synthetic fixture below encodes the derived schema
 * and the parser fails loudly (SCHEMA_MISMATCH) on shape drift.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  BA_AVAILABILITY_API, BA_GRANT_API, BA_CABIN_HELPER, BA_FLIGHTLIST,
  baIntegrityToken, baDeeplink, baAvailabilityUrl, baAvailabilityBody,
  parseBaCabinHelper, parseBaAvailability, baFlightItems,
} from '../server/workers/parsers/britishAirwaysPaa.ts';

const src: any = { id: 't_flights_ba', name: 'British Airways', method: 'http', verticals: ['flights'], enabled: true, priority: 15, config: {}, rateLimit: { maxRequestsPerMinute: 2, maxConcurrency: 1 }, freshnessPolicy: {} };

test('ba constants match the captured surface', () => {
  assert.equal(BA_AVAILABILITY_API, 'https://www.britishairways.com/api/sc4/badotcomadapter-paa/rs/v1/flightavailability/search');
  assert.equal(BA_GRANT_API, 'https://www.britishairways.com/api/grant');
  assert.ok(BA_CABIN_HELPER('DEL', 'LHR').includes('/lookup/jsonp/cabinHelper/getCabinsForRoute/LHR/DEL/en'));
  assert.ok(BA_FLIGHTLIST.includes('/travel/book/public/en_gb/flightList'));
});

test('baIntegrityToken matches the deobfuscated generateIntegrityTokenV1', () => {
  const tok = baIntegrityToken('2026-10-28', 'DEL', 'LHR');
  const expected = Buffer.from(
    createHash('sha256').update('2026-10-28DELLHR').digest('hex'), 'hex',
  ).toString('base64');
  assert.equal(tok, expected);
  // bundle-faithful: date+origin are uppercased, destination is NOT
  assert.notEqual(baIntegrityToken('2026-10-28', 'del', 'lhr'), expected);
});

test('baDeeplink matches the live-observed flightList URL', () => {
  const u = baDeeplink('DEL', 'LHR', '2026-10-28');
  assert.equal(u, 'https://www.britishairways.com/travel/book/public/en_gb/flightList?onds=DEL-LHR_2026-10-28&ad=1&yad=0&ch=0&inf=0&cabin=M&flex=LOWEST&ond=1');
});

test('baAvailabilityUrl + body match the SPA recipe exactly', () => {
  assert.equal(baAvailabilityUrl('DEL', 'LHR', '2026-10-28'), 'https://www.britishairways.com/api/sc4/badotcomadapter-paa/rs/v1/flightavailability/search;ondwanted=1?metasearchdata=DEL_LHR_2026-10-28');
  const body: any = baAvailabilityBody('DEL', 'LHR', '2026-10-28');
  assert.deepEqual(body.ondSearches, [{ originLocationCode: 'DEL', destinationLocationCode: 'LHR', departureDate: '2026-10-28' }]);
  assert.equal(body.cabin, 'M');
  assert.equal(body.ticketFlexibility, 'LOWEST');
  assert.deepEqual(body.passengerMix, { adultCount: 1, youngAdultCount: 0, childCount: 0, infantCount: 0 });
  assert.equal(body.cug, false);
  assert.equal(body.includeCalendar, true);
  assert.equal(body.calendarDays, 3);
  assert.equal(body.baIntegrityTokenV1, baIntegrityToken('2026-10-28', 'DEL', 'LHR'));
});

test('parseBaCabinHelper decodes the live payload', () => {
  const live = readFileSync(new URL('./fixtures/british_airways_cabin_helper.json', import.meta.url), 'utf8');
  const cabins = parseBaCabinHelper(live);
  assert.equal(cabins.M, 'Economy');
  assert.equal(cabins.J, 'Business/Club');
  assert.deepEqual(parseBaCabinHelper('{"reply":{}}'), {});
  assert.deepEqual(parseBaCabinHelper('bad json'), {});
});

test('parseBaAvailability decodes the bundle-derived schema (synthetic fixture)', () => {
  // synthetic - encodes the schema derived from ba-sell bundle consumers:
  // availabilityData[].availableOptions[].flightEvents / availableCabinsForOption
  const syn = {
    availabilityData: [{
      availableOptions: [
        {
          flightEvents: [
            {
              departureDateTime: '2026-10-28T09:45:00',
              arrivalDateTime: '2026-10-28T14:10:00',
              departureLocation: { airport: { code: 'DEL' } },
              arrivalLocation: { airport: { code: 'LHR' } },
              marketingCarrierCode: 'BA',
              marketingFlightNumber: '142',
            },
          ],
          availableCabinsForOption: [
            { dominantFareName: 'Economy', isNotAvailable: true, cabinPrice: {} },
            { dominantFareName: 'Economy', cabinPrice: { lowestJourneyPrice: 38999.4, currencyCode: 'INR' } },
            { dominantFareName: 'Business/Club', cabinPrice: { lowestJourneyPrice: 121000, currencyCode: 'INR' } },
          ],
        },
        {
          flightEvents: [
            { departureDateTime: '2026-10-28T03:15:00', arrivalDateTime: '2026-10-28T07:20:00', departureLocation: { airport: { code: 'DEL' } }, arrivalLocation: { airport: { code: 'LHR' } }, marketingCarrierCode: 'BA', marketingFlightNumber: '256' },
            { departureDateTime: '2026-10-28T10:00:00', arrivalDateTime: '2026-10-28T13:55:00', departureLocation: { airport: { code: 'CDG' } }, arrivalLocation: { airport: { code: 'LHR' } }, marketingCarrierCode: 'BA', marketingFlightNumber: '305' },
          ],
          availableCabinsForOption: [
            { dominantFareName: 'Economy', cabinPrice: { lowestJourneyPrice: 41500, currencyCode: 'INR' } },
          ],
        },
      ],
    }],
  };
  const flights = parseBaAvailability(JSON.stringify(syn));
  assert.equal(flights.length, 2);
  assert.equal(flights[0].flightNumber, 'BA142');
  assert.equal(flights[0].depTime, '09:45');
  assert.equal(flights[0].arrTime, '14:10');
  assert.equal(flights[0].stops, 0);
  assert.equal(flights[0].price, 39000); // rounded up from 38999.4 (bundle: Math.ceil)
  assert.equal(flights[0].currency, 'INR');
  assert.equal(flights[0].cabin, 'Economy');
  assert.equal(flights[1].flightNumber, 'BA256');
  assert.equal(flights[1].stops, 1);
  assert.equal(flights[1].price, 41500);
});

test('parseBaAvailability fails loudly on schema drift', () => {
  assert.throws(() => parseBaAvailability('not json'), /SCHEMA_MISMATCH/);
  assert.throws(() => parseBaAvailability('{"data":{}}'), /SCHEMA_MISMATCH/);
  assert.throws(() => parseBaAvailability('{"availabilityData":[{"availableOptions":[]}]}'), /SCHEMA_MISMATCH/);
});

test('baFlightItems: rows are honest about BA excl.-tax pricing', () => {
  const flights = parseBaAvailability(JSON.stringify({
    availabilityData: [{ availableOptions: [{ flightEvents: [{ departureDateTime: '2026-10-28T09:45:00', arrivalDateTime: '2026-10-28T14:10:00', departureLocation: { airport: { code: 'DEL' } }, arrivalLocation: { airport: { code: 'LHR' } }, marketingCarrierCode: 'BA', marketingFlightNumber: '142' }], availableCabinsForOption: [{ dominantFareName: 'Economy', cabinPrice: { lowestJourneyPrice: 38999.4, currencyCode: 'INR' } }] }] }],
  }));
  const items = baFlightItems(flights, src, 'Delhi', 'London', 'DEL', 'LHR', '2026-10-28');
  assert.equal(items.length, 1);
  const it: any = items[0];
  assert.equal(it.attributes.flight_number, 'BA142');
  assert.equal(it.attributes.departs, '09:45');
  assert.equal(it.attributes.stops, 'non-stop');
  assert.equal(it.price, 39000);
  assert.ok(it.attributes.price_basis.includes('EXCLUDES taxes'));
  assert.ok(it.sellerUrl.includes('onds=DEL-LHR_2026-10-28'));
  assert.equal(it.travel.date, '2026-10-28');
});
