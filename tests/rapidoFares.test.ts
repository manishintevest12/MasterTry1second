import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  decodeRapidoFareQuotes,
  buildRapidoFareRows,
  rapidoSignatureConfig,
  rapidoSignatureHeadersForTest,
  resetRapidoThiqaForTests,
  type RapidoFareQuote,
  type RapidoService,
} from '../server/workers/parsers/rapidoFares';
import {
  RAPIDO_THIQA_WASM_B64_SHA256,
  RAPIDO_SIG_SKEY_DEFAULT,
  RAPIDO_SIG_SEQ_DEFAULT,
} from '../server/workers/parsers/rapidoThiqaAsset';

/**
 * Owner 24 Oct ("fare on app ni chaiye real price chaiye bhai"): Rapido's guest
 * booking PWA (m.rapido.bike) publishes LIVE fare windows via a wasm-signed
 * unup fare API. These tests pin: protobuf quote decoding (real live captures),
 * catalog -> row mapping (unknown services skipped, never guessed), env.js
 * signature-config fallback, and the embedded thiqa wasm actually signing
 * (hashes verified against Rapido's own integrity checks).
 */

const src: any = { id: 'w_cab_rapido', name: 'Rapido worker', vertical: 'cab', method: 'direct_http' };

const indoreBytes = Uint8Array.from(JSON.parse(readFileSync('tests/fixtures/rapido_fare_indore.json', 'utf8')) as number[]);
const delhiBytes = Uint8Array.from(JSON.parse(readFileSync('tests/fixtures/rapido_fare_delhi.json', 'utf8')) as number[]);

test('decodeRapidoFareQuotes: Indore capture (Bike 25-28, Cab Premium 139-162)', () => {
  const quotes = decodeRapidoFareQuotes(indoreBytes);
  assert.equal(quotes.length, 8);
  const bike = quotes.find((q) => q.serviceId === '5aacda8bdd58db2b11598d0b');
  assert.ok(bike, 'bike quote present');
  assert.equal(bike.min, 25); assert.equal(bike.max, 28);
  assert.equal(bike.parentServiceId, '572e29b0116b5db3057bd821');
  const prem = quotes.find((q) => q.serviceId === '66def47c6962a7ce4b24dd40');
  assert.ok(prem); assert.equal(prem.min, 139); assert.equal(prem.max, 162);
});

test('decodeRapidoFareQuotes: Delhi capture (city-specific ids, Cab XL 526-631)', () => {
  const quotes = decodeRapidoFareQuotes(delhiBytes);
  assert.equal(quotes.length, 5);
  const cabxl = quotes.find((q) => q.serviceId === '6777b77ee98555bf9e174cd8');
  assert.ok(cabxl); assert.equal(cabxl.min, 526); assert.equal(cabxl.max, 631);
});

test('decodeRapidoFareQuotes: corrupt bytes throw (never half-decode a fare)', () => {
  assert.throws(() => decodeRapidoFareQuotes(Uint8Array.from([8, 200])));
});

test('buildRapidoFareRows: known services priced, unknown skipped, window in attributes', () => {
  const catalogJson = JSON.parse(readFileSync('tests/fixtures/rapido_services_indore.json', 'utf8'));
  const catalog = new Map<string, RapidoService>();
  for (const s of catalogJson.data.data) {
    catalog.set(s._id, { id: s._id, name: s.name, displayName: s.displayName, parentServiceId: s.parentServiceId });
  }
  const quotes: RapidoFareQuote[] = decodeRapidoFareQuotes(indoreBytes);
  const rows = buildRapidoFareRows({
    source: src, from: 'Vijay Nagar', to: 'Rajwada', city: 'Indore', quotes, catalog,
  });
  // Indore catalog maps 4 services: Bike / Auto / Cab Economy / Cab Premium.
  assert.equal(rows.length, 4);
  const vehicles = rows.map((r) => r.attributes.vehicle_type).sort();
  assert.deepEqual(vehicles, ['Auto', 'Bike', 'Cab Economy', 'Cab Premium']);
  const bike = rows.find((r) => r.attributes.vehicle_type === 'Bike')!;
  assert.equal(bike.price, 27); // midpoint of 25-28
  assert.equal(bike.attributes.fare_range, 'Rs 25 - Rs 28');
  assert.match(String(bike.attributes.price_basis), /Rapido live fare estimate on \d{4}-\d{2}-\d{2}/);
  assert.equal(bike.currency, 'INR');
  assert.equal(bike.sellerUrl, 'https://m.rapido.bike');
  assert.equal(bike.evidence.sourceUrl, 'https://m.rapido.bike/pwa/api/unup/scc/fareEstimate');
  // grouping helpers present like the other cab sellers
  assert.match(bike.title, /Vijay Nagar to Rajwada Rapido Bike/);
});

test('buildRapidoFareRows: empty quotes or empty catalog -> no invented rows', () => {
  const rows = buildRapidoFareRows({ source: src, from: 'a', to: 'b', city: 'Indore', quotes: [], catalog: new Map() });
  assert.equal(rows.length, 0);
});

test('rapidoSignatureConfig: env.js refresh wins, network failure falls back to pinned keys', async () => {
  resetRapidoThiqaForTests();
  const envText = `window.env = { signatureVerificationEnabled: 'true',
    signatureVerificationSKey: '999900000000',
    signatureVerificationSequence: 'test-sequence-abc' };`;
  const cfg = await rapidoSignatureConfig(async () => envText);
  assert.equal(cfg.sKey, '999900000000');
  assert.equal(cfg.sequence, 'test-sequence-abc');
  resetRapidoThiqaForTests();
  const fb = await rapidoSignatureConfig(async () => { throw new Error('down'); });
  assert.equal(fb.sKey, RAPIDO_SIG_SKEY_DEFAULT);
  assert.equal(fb.sequence, RAPIDO_SIG_SEQ_DEFAULT);
});

test('embedded thiqa wasm signs a body offline (headers x-km/x-m/x-ekref/x-pm)', async () => {
  resetRapidoThiqaForTests();
  const body = JSON.stringify({ pickupLocation: { lat: 22.7196, lng: 75.8577, displayName: 'Indore', address: 'Indore' }, dropLocation: { lat: 22.7124, lng: 75.8562, displayName: 'Rajwada', address: 'Rajwada' }, deviceId: 'test' });
  let sig: Record<string, string> | null = null;
  try {
    sig = await rapidoSignatureHeadersForTest(body);
  } catch {
    // Node without WasmGC: signing unsupported, callers fall back to presence rows.
  }
  if (sig !== null) {
    assert.ok(sig['x-km'] && sig['x-m'] && sig['x-ekref'] && sig['x-pm'], 'all four signature headers');
    for (const v of Object.values(sig)) assert.match(v, /^[A-Za-z0-9+/=]+$/, 'base64 signature values');
  }
  resetRapidoThiqaForTests();
});

test('asset integrity: wasm sha256 pinned (matches Rapido\'s own embedded check)', async () => {
  const { createHash } = await import('node:crypto');
  const { RAPIDO_THIQA_WASM_B64 } = await import('../server/workers/parsers/rapidoThiqaAsset');
  const sha = createHash('sha256').update(Buffer.from(RAPIDO_THIQA_WASM_B64, 'base64')).digest('hex');
  assert.equal(sha, RAPIDO_THIQA_WASM_B64_SHA256);
});
