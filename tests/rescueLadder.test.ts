import test from 'node:test';
import assert from 'node:assert/strict';
import { rescueRungs, rescueOrderFor } from '../server/sources/rescueFetch';

/**
 * OWNER 22 Nov ("gibibo and booking.com"): both partners are attempted on every hotels search now, and both fail at
 * the edge (Goibibo: 8-byte Akamai stub, Booking.com: 202 challenge). The only rung that can return their pages is a
 * browser-backed proxy, so the ladder must expose it the moment its key exists.
 */
test('the reader rung is on by default and ScraperAPI appears with its key', () => {
  delete process.env.SCRAPER_API_KEY;
  process.env.T1S_READER_RESCUE = '1';
  assert.ok(rescueRungs().includes('reader'));
  assert.equal(rescueRungs().includes('scraperapi'), false, 'no key, no paid rung');

  process.env.SCRAPER_API_KEY = 'test-key';
  assert.ok(rescueRungs().includes('scraperapi'), 'a browser proxy is what beats the bot wall');
  assert.ok(rescueOrderFor('www.booking.com').includes('scraperapi'));
  delete process.env.SCRAPER_API_KEY;
});

test('a host keeps a learned order but never loses the enabled rungs', () => {
  const order = rescueOrderFor('www.goibibo.com');
  assert.equal(order[0], 'direct', 'the cheap rung is always tried first');
  assert.ok(order.length >= 2);
});
