import test from 'node:test';
import assert from 'node:assert/strict';
import { envAdSlot } from '../server/marketing/placements';

/**
 * OWNER 22 Nov: 3.1k visitors and no revenue because the feed/home ad units only rendered when an admin had created
 * an ad_slots row. The env fallback must light them up from configuration alone, and must never invent an id.
 */
test('no configuration means no ad unit', () => {
  delete process.env.ADSENSE_CLIENT;
  delete process.env.ADSENSE_CLIENT_ID;
  delete process.env.ADSENSE_SLOT;
  delete process.env.ADSENSE_SLOT_ID;
  assert.equal(envAdSlot('home_feed'), null);
});

test('client + default slot lights every unit', () => {
  process.env.ADSENSE_CLIENT = 'ca-pub-3144522772064172';
  process.env.ADSENSE_SLOT = '1234567890';
  const slot = envAdSlot('home_feed');
  assert.ok(slot);
  assert.equal(slot.provider, 'adsense');
  assert.equal(slot.adsense_slot, '1234567890');
  assert.equal(slot.source, 'env');
});

test('a per-unit override wins over the default slot', () => {
  process.env.ADSENSE_CLIENT = 'ca-pub-3144522772064172';
  process.env.ADSENSE_SLOT = '1234567890';
  process.env.VERTICAL_FLIGHTS_AD_SLOT = '9876543210';
  assert.equal(envAdSlot('vertical_flights').adsense_slot, '9876543210');
  assert.equal(envAdSlot('vertical_hotels').adsense_slot, '1234567890');
  delete process.env.VERTICAL_FLIGHTS_AD_SLOT;
});

test('a malformed client or slot is refused, never rendered', () => {
  process.env.ADSENSE_CLIENT = 'pub-123';
  process.env.ADSENSE_SLOT = '1234567890';
  assert.equal(envAdSlot('home_feed'), null);
  process.env.ADSENSE_CLIENT = 'ca-pub-3144522772064172';
  process.env.ADSENSE_SLOT = 'abc';
  assert.equal(envAdSlot('home_feed'), null);
});
