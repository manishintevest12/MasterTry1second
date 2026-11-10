import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePriceFormatted } from '../server/workers/parsers/expediaGroup';
import { readFileSync } from 'node:fs';

/**
 * Hotels.com regressions that cost the seller its place in the answer on 10 Nov:
 * (1) the gated safari profile ran first and burned the whole worker budget, and
 * (2) a clean LodgingCard search is followed by a 429 wall, so a success must be cached, not re-fetched.
 * The transport ordering/caching lives in the worker; what is testable here is the price contract the
 * rows rely on, plus the source code guard that keeps chrome first and the cache in place.
 */
const workerSrc = readFileSync(new URL('../server/workers/verticals/hotels.ts', import.meta.url), 'utf8');

test('Hotels.com tries the chrome profile before the gated safari one', () => {
  const block = workerSrc.slice(workerSrc.indexOf("sourceId: 'w_hotels_hotelscom'"), workerSrc.indexOf("sourceId: 'w_hotels_osm'"));
  const chromeAt = block.indexOf("'chrome'");
  const safariAt = block.indexOf("'safari17_0'");
  assert.ok(chromeAt > -1 && safariAt > -1);
  assert.ok(chromeAt < safariAt, 'chrome must be the primary profile: safari returns 429 after ~16s');
  assert.ok(/hotelsComCache\.set/.test(block), 'a successful LodgingCard search must be cached');
  assert.ok(/hotelsComBlockedUntil/.test(block), 'a 429 must park the source instead of re-paying for the wall');
  assert.ok(/hcDeadline/.test(block), 'the profile fallbacks need one overall deadline');
});

test('Expedia Group prices keep their own currency and never invent a value', () => {
  assert.deepEqual(parsePriceFormatted('$1,234'), { value: 1234, currency: 'USD' });
  assert.deepEqual(parsePriceFormatted('₹ 4,800'), { value: 4800, currency: 'INR' });
  assert.equal(parsePriceFormatted('').value, 0);
  assert.equal(parsePriceFormatted(undefined).value, 0);
  assert.equal(parsePriceFormatted('Sold out').value, 0);
});
