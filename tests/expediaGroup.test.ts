/**
 * Expedia Group parser (Expedia.com + Hotels.com, same LodgingCard GraphQL).
 * Fixture = 3 REAL cards captured from the Expedia SRP __PLUGIN_STATE__
 * (14 Oct 2026, Tower Genova Airport Hotel & Conference Center $374/night etc.).
 * Policy: no fabricated prices; parser drops any card without a real price.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseExpediaGroup, parsePriceFormatted } from '../server/workers/parsers/expediaGroup.ts';

const src: any = { id: 'w_hotels_expedia', name: 'Expedia', vertical: 'hotels', method: 'direct_http' };
const fixture = readFileSync(new URL('./fixtures/expediaGroup.sample.json', import.meta.url), 'utf8');

test('expedia group: parses real fixture cards with price, image, seller deeplink', () => {
  const items = parseExpediaGroup(fixture, src, 'expedia.com', '2026-10-21', '2026-10-22');
  assert.ok(items.length >= 1, 'expected at least one priced card');
  const o: any = items[0];
  assert.ok(o.price > 0, 'real price required');
  assert.equal(o.currency, 'USD');
  assert.equal(o.seller, 'Expedia');
  assert.ok(o.sellerUrl.startsWith('https://www.expedia.com/'), 'deeplink to expedia.com');
  assert.ok(o.sellerUrl.includes('chkin=2026-10-21'), 'checkin carried into deeplink');
  assert.ok(String(o.attributes.image).startsWith('https://'));
});

test('expedia group: hotels.com seller name and domain', () => {
  const items = parseExpediaGroup(fixture, src, 'hotels.com', '2026-10-21', '2026-10-22');
  const o: any = items[0];
  assert.equal(o.seller, 'Hotels.com');
  assert.ok(o.sellerUrl.startsWith('https://www.hotels.com/'));
});

test('expedia group: unpriced and nameless cards dropped, never fabricated', () => {
  const body = JSON.stringify({ data: { propertySearch: { propertySearchListings: [
    { __typename: 'LodgingCard', id: '1', headingSection: { heading: 'No Price Hotel' }, priceSection: { priceSummary: { options: [] } } },
    { __typename: 'LodgingCard', id: '2', headingSection: { heading: '' }, priceSection: { priceSummary: { options: [{ displayPrice: { formatted: '$100' } }] } } },
    { __typename: 'PropertyListingPlaceholder' },
  ] } } });
  assert.equal(parseExpediaGroup(body, src, 'expedia.com', '2026-10-21', '2026-10-22').length, 0);
});

test('expedia group: price formatter handles symbols and commas', () => {
  assert.deepEqual(parsePriceFormatted('$1,015'), { value: 1015, currency: 'USD' });
  assert.deepEqual(parsePriceFormatted('₹12,345'), { value: 12345, currency: 'INR' });
  assert.equal(parsePriceFormatted('n/a').value, 0);
});
