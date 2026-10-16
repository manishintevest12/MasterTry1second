import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AUTOCOMPLETE_CITIES } from '../src/data/autocompleteData';

/** Owner report: bus location search showed FLIGHT icons and airport/international
 *  entries (Doha, BOM). Bus dropdown must show a bus icon and India-only stops. */
test('bus location dropdown uses a Bus icon, never the flight Plane', () => {
  const src = readFileSync('src/components/AutocompleteInput.tsx', 'utf8');
  // the isBusLocation branch must run BEFORE the city->Plane mapping
  const iconFn = src.match(/const renderIcon = \(sugg[\s\S]*?\n  \};/);
  assert.ok(iconFn, 'renderIcon found');
  const busIdx = iconFn![0].indexOf('isBusLocation');
  const planeIdx = iconFn![0].indexOf("type === 'city'");
  assert.ok(busIdx > -1 && busIdx < planeIdx, 'bus check precedes the Plane (city) branch');
  assert.ok(/<Bus className=/.test(iconFn![0]), 'Bus icon rendered for bus locations');
});

test('bus offline fallback excludes airports and international entries but keeps India bus cities', () => {
  const src = readFileSync('src/components/AutocompleteInput.tsx', 'utf8');
  assert.ok(/!\/airport\|international\/i\.test\(st\)/.test(src), 'fallback filter present');

  // replicate the component's filter against the real curated data
  const busSafe = AUTOCOMPLETE_CITIES.filter((sg) => {
    const st = `${sg.subtext || ''} ${sg.badge || ''}`;
    return !/airport|international/i.test(st);
  }).map((sg) => sg.text);

  assert.ok(!busSafe.some((t) => /\(DOH\)|\(SIN\)|\(BKK\)/.test(t)), 'no Doha/Singapore/Bangkok airports');
  assert.ok(!busSafe.includes('Doha (DOH)'), 'Doha excluded');
  assert.ok(!busSafe.includes('Singapore (SIN)'), 'Singapore excluded');
  assert.ok(!busSafe.includes('Bangkok (BKK)'), 'Bangkok excluded');
  // real India tier-1/2/3 bus cities survive
  assert.ok(busSafe.includes('Mumbai (BOM)'), 'Mumbai stays (bus city)');
  assert.ok(busSafe.includes('Tirunelveli'), 'Tirunelveli (tier-3) stays');
});

test('bus locations API is India-only with tier-3 coverage', () => {
  const src = readFileSync('server/api/routes.ts', 'utf8');
  const m = src.match(/apiRouter\.get\('\/bus\/locations'[\s\S]*?\n\}\);/);
  assert.ok(m, 'route found');
  assert.ok(m[0].includes('limit=20'), 'redBus suggestion limit raised to 20');
  assert.ok(m[0].includes(`String(d.cc).toUpperCase() === 'IND'`), 'India-only cc filter');
  assert.ok(m[0].includes('.slice(0, 20)'), 'returns up to 20 locations');
});

test('bus remote typeahead shows more tier-3 rows', () => {
  const src = readFileSync('src/components/AutocompleteInput.tsx', 'utf8');
  assert.ok(src.includes('setBusRemote(out.slice(0, 16))'), '16 remote rows shown');
});
