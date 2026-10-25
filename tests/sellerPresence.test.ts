import { test } from 'node:test';
import assert from 'node:assert';
import { buildFlightSellerPresence } from '../server/search/sellerPresence';
import { recordFailure, resetHealthForTests } from '../server/sources/health';
import type { NormalizedOffer, ParsedQuery } from '../server/types';

// Deterministic presence gating: the catalogue-path health check reads the
// LIVE in-memory health map, so each test starts from a clean slate.
resetHealthForTests();

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

const OTA_EXPANSION = ['Agoda', 'Booking.com', 'BudgetAir', 'FlightNetwork', 'FlightsMojo', 'Gotogate'];

test('presence: 4 gated + 6 OTA-expansion sellers appear when nothing else contributed', async () => {
  const rows = await buildFlightSellerPresence(parsed(), []);
  assert.equal(rows.length, 10);
  assert.deepEqual(rows.map((r) => r.seller).sort(), ['Agoda', 'Akasa Air', 'Booking.com', 'BudgetAir', 'Expedia', 'FlightNetwork', 'FlightsMojo', 'Gotogate', 'IndiGo', 'Yatra']);
});

test('presence: OTA expansion rows carry seller search-page deeplinks (owner 24 Oct)', async () => {
  const rows = await buildFlightSellerPresence(parsed(), []);
  const by = (x: string) => rows.find((r) => r.seller === x)!;
  assert.ok(by('BudgetAir').sellerUrl!.startsWith('https://www.budgetair.com/en_us/flights/IDR/DEL/'), 'BudgetAir deeplink must be the route+date results page');
  assert.ok(by('Gotogate').sellerUrl!.startsWith('https://in.gotogate.com/air/IDRDEL29OCT'), 'Gotogate deeplink must be the IN storefront results page');
  assert.ok(by('FlightNetwork').sellerUrl!.startsWith('https://in.flightnetwork.com/air/IDRDEL29OCT'), 'FlightNetwork deeplink must be the IN storefront results page');
  assert.ok(by('FlightsMojo').sellerUrl!.includes('indore-to-delhi-flights'), 'FlightsMojo deeplink must be the route SEO page');
  assert.ok(by('Booking.com').sellerUrl!.startsWith('https://flights.booking.com/'));
  assert.ok(by('Agoda').sellerUrl!.startsWith('https://www.agoda.com/flights/search?origin=IDR'), 'Agoda deeplink must be the route+date results page');
  for (const s2 of OTA_EXPANSION) assert.equal(by(s2).attributes.price_basis, 'live_fares_unavailable', `${s2} honest price basis`);
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
  assert.equal(kept.length, 10, 'presence rows must survive the flights route filter');
});

test('presence: seller whose source SUCCEEDED with honest zero rows is skipped (no-service route)', async () => {
  // Akasa's own API answered INVALID_STATION => no service on this route:
  // a "feed unreachable" card would be misleading, so no presence row.
  const rows = await buildFlightSellerPresence(parsed(), [], ['w_flights_akasa']);
  assert.ok(!rows.some((r) => r.seller === 'Akasa Air'), 'honest no-service seller must not get a presence card');
  assert.equal(rows.length, 9, 'the other sellers keep their cards');
});

test('presence: a FAILED seller keeps its presence card even when other sources succeeded', async () => {
  const rows = await buildFlightSellerPresence(parsed(), [], ['w_flights_kiwi', 'w_flights_ixigo']);
  assert.equal(rows.length, 10, 'none of the presence sellers succeeded, so all cards stay');
});

test('presence: OTA expansion keeps its card on EMPTY_RESPONSE (recipe-uncracked, not no-service)', async () => {
  // Owner 24 Oct: BudgetAir's probe answered EMPTY_RESPONSE (recipe not yet
  // captured) — an OTA aggregator still sells this route, so unlike a
  // no-service carrier the honest presence card stays.
  recordFailure('w_flights_budgetair', 'EMPTY_RESPONSE', 'no browserless SSR fares');
  const rows = await buildFlightSellerPresence(parsed(), []);
  assert.ok(rows.some((r) => r.seller === 'BudgetAir'), 'OTA expansion seller keeps brand visibility on empty');
});

test('presence: CATALOGUE path — seller whose own API last answered EMPTY_RESPONSE (no-service route) is skipped', async () => {
  // Cache-paint has NO acquisition outcome; the only signal is the source's
  // latest health. Akasa's calendar answered an honest zero on this route, so
  // no "Price unavailable" card for it (owner 24 Oct screenshot).
  recordFailure('w_flights_akasa', 'EMPTY_RESPONSE', 'no bookable fares on this route');
  const rows = await buildFlightSellerPresence(parsed(), []);
  assert.ok(!rows.some((r) => r.seller === 'Akasa Air'), 'no-service carrier must not get a presence card on the catalogue path');
  assert.ok(rows.some((r) => r.seller === 'Yatra'), 'genuinely gated sellers keep their cards');
  assert.ok(!rows.some((r) => r.seller === 'Akasa Air'));
});

test('presence: a gated class (ACCESS_CHALLENGE) brings the card back — self-healing', async () => {
  recordFailure('w_flights_akasa', 'ACCESS_CHALLENGE', 'edge challenge');
  const rows = await buildFlightSellerPresence(parsed(), []);
  assert.equal(rows.length, 10, 'a gated carrier keeps brand visibility');
  assert.ok(rows.every((r) => (r.attributes?.price_basis ?? '') === 'live_fares_unavailable'), 'honest price basis');
});
