import { test } from 'node:test';
import assert from 'node:assert/strict';
import { busFacetPred } from '../src/components/BusFilters';

const bus = (specs: Record<string, string>) => ({ specs });

test('busFacetPred: structured facets from real parser attributes', () => {
  const acSleeper = bus({ ac: 'yes', sleeper: 'yes', seater: 'no', premium: 'yes', 'free cancellation': 'yes', 'live tracking': 'yes', 'boarding point': 'Piplayapala' });
  assert.ok(busFacetPred('ac', acSleeper));
  assert.ok(!busFacetPred('nonac', acSleeper));
  assert.ok(busFacetPred('sleeper', acSleeper));
  assert.ok(busFacetPred('premium', acSleeper));
  assert.ok(busFacetPred('free_cancellation', acSleeper));
  assert.ok(busFacetPred('live_tracking', acSleeper));
  const nonAcSeater = bus({ ac: 'no', sleeper: 'no', seater: 'yes' });
  assert.ok(busFacetPred('nonac', nonAcSeater));
  assert.ok(busFacetPred('seater', nonAcSeater));
  assert.ok(!busFacetPred('ac', nonAcSeater));
});

test('busFacetPred: departure time slots parsed from real departure attributes', () => {
  const night = bus({ 'departure time': '23:45' });
  const morning = bus({ departure: '05:00 → 09:30 (+1)' });
  const noon = bus({ 'departure time': '13:20' });
  const unknown = bus({});
  assert.ok(busFacetPred('slot_18_24', night) && !busFacetPred('slot_12_18', night));
  assert.ok(busFacetPred('slot_00_06', morning) && !busFacetPred('slot_06_12', morning));
  assert.ok(busFacetPred('slot_12_18', noon));
  for (const slot of ['slot_00_06', 'slot_06_12', 'slot_12_18', 'slot_18_24']) assert.ok(!busFacetPred(slot, unknown));
});

test('busFacetPred: absent facet never matches (chip hides at count 0)', () => {
  const bare = bus({ 'boarding point': 'Bus Stand Harda' });
  assert.ok(!busFacetPred('ac', bare));
  assert.ok(!busFacetPred('sleeper', bare));
  assert.equal(bare.specs['boarding point'], 'Bus Stand Harda');
});
