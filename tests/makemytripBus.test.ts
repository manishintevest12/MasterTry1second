/**
 * MakeMyTrip bus source (owner 28 Oct: "inko add kro aur price le kr bhi aao inke").
 * MMT's bus SPA talks to a public Apollo endpoint; these tests pin the request contract and the
 * parser against the response captured live for Indore->Bhopal (251 services, 28 Oct 2026).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  istTime,
  mmtBusDeeplink,
  mmtBusRequest,
  mmtDate,
  parseMmtBusListing,
  parseMmtCitySuggestion,
} from '../server/workers/parsers/makemytripBus';

const source: any = { id: 'w_bus_makemytrip', method: 'direct_http', vertical: 'bus' };

function bus(over: Record<string, any> = {}) {
  return {
    tripKey: 'MMTCC1324|MMTCC1119|TRIP-1',
    operatorName: 'Chartered Bus - First',
    availability: { totalSeatsLeft: 58 },
    attributes: { isSleeper: false, isAc: true, type: 'Volvo 9600 A/C Seater (2+2)' },
    journeyInfo: { departureTimeStamp: 1793346300, arrivalTimeStamp: 1793359800, journeyTimeInMinutes: 225 },
    fareDetails: { minPrice: 405, maxPrice: 471, displayPrice: 405 },
    extraInfo: { overallRating: 4.3, ratings: 1288 },
    operatorConfig: { serviceId: 'SVC-1', shortName: 'Chartered' },
    ...over,
  };
}

const listing = (buses: any[], status = 'SUCCESS') => ({ data: { search: { status, data: { buses } } } });

test('MMT date + deeplink use the format MMT itself sends', () => {
  assert.equal(mmtDate('2026-10-30'), '30-10-2026');
  assert.equal(mmtDate(''), '');
  assert.equal(mmtBusDeeplink('indore', 'bhopal', '2026-10-30'), 'https://www.makemytrip.com/bus/search/Indore/Bhopal/30-10-2026');
});

test('request body is the BusListing operation with from/to/date/flags', () => {
  const req = mmtBusRequest('MMTCC1324', 'MMTCC1119', '2026-10-30');
  assert.equal(req.operationName, 'BusListing');
  assert.equal(req.variables.req.from, 'MMTCC1324');
  assert.equal(req.variables.req.to, 'MMTCC1119');
  assert.equal(req.variables.req.date, '30-10-2026');
  assert.deepEqual(req.variables.req.flags, { supportAltRoutes: true });
  assert.match(req.query, /search\(request: \$req\)/);
});

test('city autosuggest prefers the exact city and ignores localities', () => {
  const json = { data: { r: [
    { dn: 'Indore Junction, Indore', n: 'Indore Junction', t: 'area', _id: 'MMTLC2500' },
    { dn: 'Indore, Madhya Pradesh', n: 'Indore', t: 'city', _id: 'MMTCC1324' },
  ] } };
  assert.deepEqual(parseMmtCitySuggestion(json, 'Indore'), { code: 'MMTCC1324', name: 'Indore' });
  assert.equal(parseMmtCitySuggestion({ data: { r: [] } }, 'Nowhere'), null);
  assert.equal(parseMmtCitySuggestion({}, 'Nowhere'), null);
});

test('IST times come out as HH:MM and cross-midnight arrivals are flagged', () => {
  assert.equal(istTime(1793346300), '13:15');
  assert.equal(istTime(0), '');
  const out = parseMmtBusListing(
    listing([
      bus(),
      bus({
        tripKey: 'TRIP-2', operatorName: 'Humsafar Travels', fareDetails: { displayPrice: 270 },
        attributes: { isSleeper: true, isAc: true, type: '' },
        journeyInfo: { departureTimeStamp: 1793377800, arrivalTimeStamp: 1793392200, journeyTimeInMinutes: 240 },
      }),
    ]),
    source, 'https://www.makemytrip.com/bus/search/Indore/Bhopal/30-10-2026', 'Indore', 'Bhopal', '2026-10-30',
  );
  const overnight = out.items.find((i) => i.attributes?.operator === 'Humsafar Travels')!;
  assert.match(String(overnight.attributes?.departure), /\(\+1\)$/);
  // Empty attributes.type falls back to the AC/sleeper flags, never an empty label.
  assert.equal(overnight.attributes?.bus_type, 'AC Sleeper');
});

test('rows carry real fare, operator, seats, rating and the queried date', () => {
  const out = parseMmtBusListing(listing([bus()]), source, 'https://www.makemytrip.com/bus/search/Indore/Bhopal/30-10-2026', 'Indore', 'Bhopal', '2026-10-30');
  assert.equal(out.busCount, 1);
  assert.equal(out.items.length, 1);
  const it = out.items[0];
  assert.equal(it.price, 405);
  assert.equal(it.seller, 'makemytrip');
  assert.equal(it.attributes?.operator, 'Chartered Bus - First');
  assert.equal(it.attributes?.departure_time, '13:15');
  assert.equal(it.attributes?.duration_minutes, '225');
  assert.equal(it.attributes?.seats_available, '58');
  assert.equal(it.attributes?.rating, '4.3');
  assert.equal(it.attributes?.journey_date, '2026-10-30');
  assert.equal(it.travel?.date, '2026-10-30');
  assert.equal(it.sellerUrl, 'https://www.makemytrip.com/bus/search/Indore/Bhopal/30-10-2026');
});

test('fractional MMT fares are rounded to whole rupees, never shown as 329.20001220703125', () => {
  const out = parseMmtBusListing(listing([bus({ fareDetails: { displayPrice: 329.20001220703125 } })]), source, 'u', 'Indore', 'Bhopal', '2026-10-30');
  assert.equal(out.items[0].price, 329);
});

test('cheapest-first ordering, one row per service, rows without a fare dropped', () => {
  const out = parseMmtBusListing(
    listing([
      bus({ tripKey: 'A', fareDetails: { displayPrice: 500 } }),
      bus({ tripKey: 'B', fareDetails: { displayPrice: 250 } }),
      bus({ tripKey: 'C', fareDetails: { displayPrice: 0 } }),
      bus({ tripKey: 'B', fareDetails: { displayPrice: 250 } }),
    ]),
    source, 'u', 'Indore', 'Bhopal', '2026-10-30',
  );
  assert.deepEqual(out.items.map((i) => i.price), [250, 500]);
});

test('an empty or errored search reports an honest reason', () => {
  const empty = parseMmtBusListing(listing([]), source, 'u', 'Indore', 'Bhopal', '2026-10-30');
  assert.equal(empty.items.length, 0);
  assert.match(String(empty.reason), /no services returned/i);

  const errored = parseMmtBusListing({ errors: [{ message: 'Cannot read properties of undefined' }] }, source, 'u', 'Indore', 'Bhopal', '2026-10-30');
  assert.equal(errored.items.length, 0);
  assert.match(String(errored.reason), /GraphQL error/);
});
