import test from 'node:test';
import assert from 'node:assert/strict';
import { selectSources, isSlowSource } from '../server/sources/registry';
import { SLOW_SOURCE_IDS } from '../server/cron/slowSources';

/**
 * OWNER 23 Nov: "jo time le rahe hai unko cache mai mai rakho hr 15min mai refresh krte rhna."
 * A slow partner must never sit on a user's search (it timed out there and cost the whole sweep); it is refreshed on a
 * 15-minute background clock and served from the catalogue instead.
 */
test('slow partners are marked slow', () => {
  for (const id of ['w_hotels_goibibo', 'w_hotels_booking', 'w_flights_goibibo']) {
    assert.equal(isSlowSource(id), true, id);
    assert.equal(SLOW_SOURCE_IDS.has(id), true, id);
  }
  assert.equal(isSlowSource('w_hotels_oyo'), false);
});

test("a search never attempts a slow partner, the warmer can", () => {
  const inline = selectSources({ vertical: 'hotels' } as any).map((s) => s.id);
  assert.equal(inline.includes('w_hotels_goibibo'), false, 'goibibo must not block a user search');
  assert.equal(inline.includes('w_hotels_booking'), false, 'booking must not block a user search');
  // the fast sellers are untouched
  assert.ok(inline.some((id) => id.startsWith('w_hotels_')), 'the rest of the hotel set still runs');

  const withSlow = selectSources({ vertical: 'hotels' } as any, { includeSlow: true }).map((s) => s.id);
  assert.ok(withSlow.includes('w_hotels_goibibo'), 'the background warmer asks for them explicitly');
  assert.ok(withSlow.includes('w_hotels_booking'));
});
