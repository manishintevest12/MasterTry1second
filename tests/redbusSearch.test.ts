import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRedBusSearch, resolveRedBusCity } from '../server/workers/parsers/redbusSearch';

const source: any = { id: 'w_bus_redbus', method: 'direct_http', vertical: 'bus' };
const route = { fromName: 'Bengaluru', fromId: 122, toName: 'Hyderabad', toId: 124, doj: '2026-10-20' };

const sample = JSON.stringify({
  success: true,
  data: {
    inventories: [
      {
        operatorId: 23264, travelsName: 'LVP Travels', routeId: 50340027, busType: 'A/C Sleeper (2+1)',
        serviceId: '162', departureTime: '2026-10-20 22:40:00', arrivalTime: '2026-10-21 07:30:00',
        journeyDurationMin: 530, fareList: [2599, 2699, 2799], availableSeats: 16, totalSeats: 37,
        totalRatings: 4.8, numberOfReviews: '1419', isSleeper: true, isAc: true,
        amenities: [10, 5, 7], standardBpName: 'Hebbal', standardDpName: 'Lakdikapul',
      },
      { travelsName: 'No Fare Co.', fareList: [] },
      {
        operatorId: 1, travelsName: 'Zingbus', busType: 'A/C Seater (2+2)', serviceId: '900', routeId: 1,
        departureTime: '2026-10-20 21:05:00', arrivalTime: '2026-10-21 08:35:00', journeyDurationMin: 690,
        fareList: [1506], availableSeats: 46, totalSeats: 53, totalRatings: 4.7, numberOfReviews: '1386',
      },
    ],
  },
});

test('parseRedBusSearch extracts real fares, timings, seats, rating', () => {
  const items = parseRedBusSearch(sample, source, route);
  assert.equal(items.length, 2); // no-fare service skipped, never guessed
  const [a, b] = items;
  assert.equal(a.price, 2599); // min of fareList
  assert.equal(a.listPrice, 2799); // max of fareList
  assert.equal(a.currency, 'INR');
  assert.equal(a.seller, 'redBus');
  assert.equal(a.availability, 'in_stock');
  assert.match(a.title, /LVP Travels · A\/C Sleeper/);
  assert.equal(a.attributes?.operator, 'LVP Travels');
  assert.equal(a.attributes?.departure, '22:40 → 07:30 (+1)');
  assert.equal(a.attributes?.duration, '8h 50m');
  assert.equal(a.attributes?.seats_available, '16');
  assert.equal(a.attributes?.total_seats, '37');
  assert.equal(a.attributes?.rating, '4.8');
  assert.equal(a.attributes?.sleeper, 'yes');
  assert.equal(a.attributes?.ac, 'yes');
  assert.equal(a.attributes?.amenities, '3');
  assert.equal(a.attributes?.boarding_point, 'Hebbal');
  assert.equal(a.travel?.route, 'Bengaluru → Hyderabad');
  assert.equal(a.travel?.date, '2026-10-20');
  assert.ok(String(a.sellerUrl).startsWith('https://www.redbus.in/bus-tickets/'));
  assert.equal(b.price, 1506);
  assert.equal(b.listPrice, undefined); // single fare -> no fake listPrice
  assert.ok(b.evidence.rawFingerprint && b.evidence.extractedFields.length > 4);
});

test('parseRedBusSearch returns [] on malformed/empty JSON', () => {
  assert.deepEqual(parseRedBusSearch('not json', source, route), []);
  assert.deepEqual(parseRedBusSearch('{}', source, route), []);
  assert.deepEqual(parseRedBusSearch('{"data":{"inventories":[]}}', source, route), []);
});

test('resolveRedBusCity picks CITY-type doc, handles Solr grouping', () => {
  const flat = [{ ID: 313, Name: 'Indore', locationType: 'CITY' }, { ID: 73694, Name: 'Vijay Nagar, Indore', locationType: 'AREA' }];
  assert.deepEqual(resolveRedBusCity(flat, 'indore'), { id: 313, name: 'Indore' });
  const grouped = [{ doclist: { docs: [{ ID: 313, Name: 'Indore', locationType: 'CITY' }] } }];
  assert.deepEqual(resolveRedBusCity(grouped, 'indore'), { id: 313, name: 'Indore' });
  assert.equal(resolveRedBusCity([], 'nowhere'), null);
  assert.equal(resolveRedBusCity([{ ID: 0 }], 'nowhere'), null);
});
