import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAbhiBusServices, resolveAbhiBusCity } from '../server/workers/parsers/abhibus';

const source: any = { id: 'w_bus_abhibus', method: 'direct_http', vertical: 'bus' };
const route = { fromName: 'Hyderabad', fromId: '3', toName: 'Bangalore', toId: '7', jdate: '2026-10-14' };

const sample = JSON.stringify({
  status: 'success',
  services: [
    { serviceKey: 'Kaveri - 786', travelerAgentName: 'Kaveri Travels', busServiceTypeName: 'NON-AC Seater/Sleeper (2 + 1)',
      serviceName: 'HYDERABAD TO BANGALORE', serviceId: '111', rating: 3.2,
      fares: { fare: 990, offerPrice: 941, fareList: [650, 750, 1050] },
      timings: { startTime: '08:00 PM', arriveTime: '06:50 AM', travelTime: '10:50:00' },
      seatStats: { availableSeats: 22 },
      busInsights: { busThumbnailUrl: 'https://static.abhibus.com/web/media/x.jpg' } },
    { serviceKey: 'No fare', travelerAgentName: 'Ghost', fares: { fare: 0 } },
  ],
});

test('abhibus: parses real service with fare, timings, seats; skips fare-less rows', () => {
  const out = parseAbhiBusServices(sample, source, route);
  assert.equal(out.length, 1);
  const it = out[0];
  assert.match(it.title, /^Kaveri Travels · NON-AC/);
  assert.equal(it.price, 941);
  assert.equal(it.listPrice, 990);
  assert.equal(it.attributes!.departure, '08:00 PM → 06:50 AM');
  assert.equal(it.attributes!.seats_available, '22');
  assert.equal(it.attributes!.rating, '3.2');
  assert.match(String(it.sellerUrl), /^https:\/\/www\.abhibus\.com\/bus_search\/Hyderabad\/3\/Bangalore\/7\/2026-10-14$/);
  assert.equal(it.travel!.route, 'Hyderabad → Bangalore');
});

test('abhibus: malformed JSON and empty services yield no items (never invented)', () => {
  assert.deepEqual(parseAbhiBusServices('nope', source, route), []);
  assert.deepEqual(parseAbhiBusServices('{"services":[]}', source, route), []);
});

test('abhibus: city resolution picks exact label, falls back to first', async () => {
  const fetchJson = async () => [{ id: 51, label: 'Pune Byepass' }, { id: 7, label: 'Bangalore' }];
  const exact = await resolveAbhiBusCity(fetchJson, 'bangalore');
  assert.equal(exact!.id, '7');
  const first = await resolveAbhiBusCity(fetchJson, 'pune');
  assert.equal(first!.id, '51');
});

// ---- Module 4: masking pointer (deeplink.ts) ----
import { createMaskingPointer, resolveMaskingPointer } from '../server/affiliate/deeplink';
test('deeplink: pointer roundtrip validates signature and hides destination', () => {
  const dest = 'https://www.flipkart.com/apple-iphone-15/p/itm123';
  const ptr = createMaskingPointer(dest, { offerId: '42' });
  assert.match(ptr, /^\/api\/out\?t=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.ok(!ptr.includes('flipkart')); // destination never in the pointer
  const r = resolveMaskingPointer(ptr.split('t=')[1])!;
  assert.equal(r.destination, dest);
  assert.equal(r.offerId, '42');
  // tampered pointer is rejected
  assert.equal(resolveMaskingPointer(ptr.split('t=')[1] + 'x'), null);
  assert.equal(resolveMaskingPointer('garbage'), null);
});
