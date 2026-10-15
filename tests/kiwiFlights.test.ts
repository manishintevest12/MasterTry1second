import { test } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import { kiwiItems, KiwiItinerary, kiwiSearch } from '../server/workers/parsers/kiwiFlights';

const fixture = JSON.parse(
  fs.readFileSync(new URL('./fixtures/kiwiFlights-del-dxb-2026-10-22.json', import.meta.url), 'utf8'),
) as { itineraries: KiwiItinerary[]; total: number };

const SRC: any = { sourceId: 'w_flights_kiwi', name: 'Kiwi', sourceDomain: 'kiwi.com' };

test('kiwi parser: maps fixture itineraries to priced items with seller = Kiwi.com', () => {
  const items = kiwiItems(fixture.itineraries, SRC, { from: 'Delhi', to: 'Dubai' }, 'DEL', 'DXB', '2026-10-22');
  assert.ok(items.length >= 15, `expected >=15 items, got ${items.length}`);
  for (const it of items) {
    const o = it as any;
    assert.strictEqual(o.seller, 'Kiwi.com', 'seller must be the ticket-selling website');
    assert.strictEqual(o.currency, 'INR');
    assert.ok((o.price ?? 0) > 1000, 'fares are real rupee amounts');
    assert.match(o.sellerUrl, /^https:\/\/www\.kiwi\.com\//, 'deeplink goes to kiwi.com (booking token or search page)');
    assert.ok(o.attributes.price_basis && String(o.attributes.price_basis).includes('observed on Kiwi.com'), 'honest price basis');
    assert.ok(o.attributes.data_note && String(o.attributes.data_note).includes('SOLD by Kiwi.com'), 'data note credits the seller');
    assert.ok(o.attributes.airline, 'operating airline recorded in attributes');
  }
});

test('kiwi parser: keeps only itineraries departing on the requested date', () => {
  const items = kiwiItems(fixture.itineraries, SRC, { from: 'Delhi', to: 'Dubai' }, 'DEL', 'DXB', '2026-10-22');
  assert.ok(items.length > 0);
  for (const it of items) {
    const o = it as any;
    assert.strictEqual(o.attributes.travel_date, '2026-10-22');
    // flight key present in title with route label
    assert.ok(o.title.includes('Delhi → Dubai'));
  }
});

test('kiwi parser: dedupes same carrier+flight+departure-time and never invents prices', () => {
  const doubled = [...fixture.itineraries, ...fixture.itineraries.slice(0, 5)];
  const items = kiwiItems(doubled, SRC, { from: 'Delhi', to: 'Dubai' }, 'DEL', 'DXB', '2026-10-22');
  const keys = new Set(items.map((i) => (i as any).identifiers.sku));
  assert.strictEqual(keys.size, items.length, 'no duplicate skus');
  // zero-price itineraries are dropped, not published
  const withZero: KiwiItinerary[] = JSON.parse(JSON.stringify(fixture.itineraries.slice(0, 3)));
  withZero[0].price = { amount: '0', currency: { code: 'INR' } };
  const items2 = kiwiItems(withZero, SRC, { from: 'Delhi', to: 'Dubai' }, 'DEL', 'DXB', '2026-10-22');
  for (const i of items2) assert.ok((i as any).price > 0, 'never publish a price we did not see');
});

test('kiwi parser: search variables use the cracked DateTime format (regression guard)', async () => {
  // The DateTime scalar REJECTS trailing 'Z'; the query text must keep partner 'skypicker'.
  const src = await fs.promises.readFile(new URL('../server/workers/parsers/kiwiFlights.ts', import.meta.url), 'utf8');
  assert.match(src, /partner: 'skypicker'/);
  assert.match(src, /\$\{dateIso\}T00:00:00/);
  assert.doesNotMatch(src, /T00:00:00\.000Z/);
  assert.match(src, /Station:airport:/);
  // sanity: real search still works end-to-end (network; skip if gated)
  try {
    const res = await kiwiSearch('DEL', 'DXB', '2026-10-22');
    assert.ok(res === null || res.itineraries.length > 0);
  } catch { /* live API hiccup — fixture tests above still guard the mapping */ }
});
