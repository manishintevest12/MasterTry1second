/**
 * OWNER 31 Oct: "intercity ride mai hide kro, aur city rides mai dikhao results with price
 * so simple." Rapido publishes no intercity service (their guest fare API returns HTTP 500
 * for a two-city trip) and its live city quotes can fail, so a Rapido card is only shown
 * when it carries a real fare, and never on an intercity search.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { gateRapidoRows } from '../server/search/rapidoPriceGate';

const rapido = (over: Record<string, any> = {}) => ({
  vertical: 'cab',
  title: 'Rajwada Indore to Indore Airport Rapido Cab Economy',
  seller: 'Rapido',
  vendor: 'Rapido',
  prices: { currency: 'INR', effectivePrice: 111 },
  provenance: { sourceId: 'w_cab_rapido' },
  ...over,
});

const ola = (over: Record<string, any> = {}) => ({
  vertical: 'cab', title: 'Ola Mini', seller: 'Ola', vendor: 'Ola',
  prices: { currency: 'INR', effectivePrice: 138 }, provenance: { sourceId: 'w_cab_ola' }, ...over,
});

test('a priced Rapido city row survives', () => {
  const out = gateRapidoRows([rapido(), ola()]);
  assert.equal(out.kept.length, 2);
  assert.equal(out.dropped.length, 0);
});

test('a priceless Rapido row is hidden, other sellers are untouched', () => {
  const out = gateRapidoRows([rapido({ prices: { currency: 'INR', fees: {} } }), ola()]);
  assert.equal(out.kept.length, 1);
  assert.equal((out.kept[0] as any).seller, 'Ola');
  assert.equal(out.dropped.length, 1);
  assert.equal(out.dropped[0].reason, 'no_fare');
});

test('intercity hides Rapido even when a stale row carried a fare', () => {
  const out = gateRapidoRows([rapido({ prices: { currency: 'INR', effectivePrice: 1900 } }), ola()], true);
  assert.equal(out.kept.length, 1);
  assert.equal((out.kept[0] as any).seller, 'Ola');
  assert.equal(out.dropped[0].reason, 'intercity');
});

test('priceless rows of other sellers are never dropped by this gate', () => {
  const out = gateRapidoRows([ola({ prices: { currency: 'INR', fees: {} } })]);
  assert.equal(out.kept.length, 1);
  assert.equal(out.dropped.length, 0);
});
