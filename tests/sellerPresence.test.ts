import { test } from 'node:test';
import assert from 'node:assert';
import { buildFlightSellerPresence } from '../server/search/sellerPresence';
import type { NormalizedOffer, ParsedQuery } from '../server/types';

const parsed = (q = 'Indore to Delhi'): ParsedQuery => ({
  rawQuery: q, vertical: 'flights', verticalConfidence: 1, entityName: null,
  intent: 'compare', location: {}, travelDates: { depart: '2026-10-29' },
});

const priced = (seller: string): NormalizedOffer => ({
  id: `off_x_${seller}`, canonicalEntityId: null, canonicalVariantId: null, vertical: 'flights',
  title: `6E 123 Indore to Delhi on 2026-10-29`, brand: seller, identifiers: {}, attributes: {},
  vendor: seller, seller, travel: { route: 'indore to delhi', date: '2026-10-29' },
  prices: { effectivePrice: 4100, currency: 'INR', fees: {} },
  availability: 'in_stock', matchState: 'MATCHED', freshnessStatus: 'LIVE_VERIFIED',
  validationStatus: 'VALID', confidence: 0.95,
  provenance: { sourceId: 'w_test', sourceMethod: 'direct_http', adapterVersion: 't', parserVersion: 't', fetchedAt: new Date().toISOString() },
} as any);

test('presence: 4 gated sellers appear when nothing else contributed', async () => {
  const rows = await buildFlightSellerPresence(parsed(), []);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((r) => r.seller).sort(), ['Akasa Air', 'Expedia', 'IndiGo', 'Yatra']);
});

test('presence: honest rows — no price, price_basis flags live fares unavailable', async () => {
  const rows = await buildFlightSellerPresence(parsed(), []);
  for (const r of rows) {
    assert.equal(r.prices.effectivePrice, undefined, `${r.seller} must not claim a price`);
    assert.equal(r.prices.mandatoryTotal, undefined);
    assert.equal(r.attributes.price_basis, 'live_fares_unavailable');
    assert.ok(r.attributes.data_note.includes('never invent'), `${r.seller} data_note must be honest`);
    assert.ok(r.sellerUrl, `${r.seller} must carry a seller deeplink`);
    assert.ok(r.id.startsWith('presence_'));
    assert.equal(r.vertical, 'flights');
    assert.equal(r.validationStatus, 'VALID');
  }
});

test('presence: route-prefilled seller URLs carry IATA codes + date', async () => {
  const rows = await buildFlightSellerPresence(parsed(), []);
  const by = (s: string) => rows.find((r) => r.seller === s)!;
  assert.ok(by('Yatra').sellerUrl!.includes('origin=IDR') && by('Yatra').sellerUrl!.includes('destination=DEL'), 'Yatra SRP must be route-prefilled');
  assert.ok(by('IndiGo').sellerUrl!.includes('from=IDR&to=DEL&depart=2026-10-29'), 'IndiGo booking widget must be route+date prefilled');
  assert.ok(by('Akasa Air').sellerUrl!.startsWith('https://www.akasaair.com/booking'), 'Akasa deeplink must be Akasa booking flow');
  assert.ok(by('Expedia').sellerUrl!.includes('from-date=2026-10-29') && by('Expedia').sellerUrl!.includes('Indore%20(IDR)'), 'Expedia SRP must be route+date prefilled');
});

test('presence: a seller with PRICED live rows suppresses its presence card', async () => {
  const rows = await buildFlightSellerPresence(parsed(), [priced('IndiGo')]);
  assert.ok(!rows.some((r) => r.seller === 'IndiGo'), 'priced IndiGo rows must replace the presence card');
  assert.ok(rows.some((r) => r.seller === 'Yatra'));
});

test('presence: unpriced schedule-reference rows (OpenFlights) do NOT suppress the card', async () => {
  const ref = priced('IndiGo');
  delete (ref.prices as any).effectivePrice; // schedule reference: no fare
  const rows = await buildFlightSellerPresence(parsed(), [ref]);
  assert.ok(rows.some((r) => r.seller === 'IndiGo'), 'an unpriced row must not hide the presence card');
});

test('presence: non-route query produces no rows (honest skip)', async () => {
  assert.equal((await buildFlightSellerPresence(parsed('best flight deals'), [])).length, 0);
});

test('presence: route filter compatibility — engine routeFilter keeps the rows', async () => {
  const { routeFilter } = await import('../server/verticals/verticalEngine');
  const rows = await buildFlightSellerPresence(parsed(), []);
  const kept = routeFilter(rows, parsed());
  assert.equal(kept.length, 4, 'presence rows must survive the flights route filter');
});

test('presence: seller whose source SUCCEEDED with honest zero rows is skipped (no-service route)', async () => {
  // Akasa's own API answered INVALID_STATION => no service on this route:
  // a "feed unreachable" card would be misleading, so no presence row.
  const rows = await buildFlightSellerPresence(parsed(), [], ['w_flights_akasa']);
  assert.ok(!rows.some((r) => r.seller === 'Akasa Air'), 'honest no-service seller must not get a presence card');
  assert.equal(rows.length, 3, 'the other gated sellers keep their cards');
});

test('presence: a FAILED seller keeps its presence card even when other sources succeeded', async () => {
  const rows = await buildFlightSellerPresence(parsed(), [], ['w_flights_kiwi', 'w_flights_ixigo']);
  assert.equal(rows.length, 4, 'none of the presence sellers succeeded, so all four cards stay');
});
