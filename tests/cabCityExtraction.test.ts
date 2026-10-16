import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cityFromRouteText, geocodePlace } from '../server/workers/parsers/osmTravel';
import { indrivePickCity, type InDriveCity } from '../server/workers/parsers/indriveIntercity';

/** Owner report 16 Oct: cab UI (pincode/hotspot flow) sent locality-decorated
 *  endpoints ("Chappan Dukan / MG Road, Indore to DLF Cyber City, Gurugram")
 *  and EVERY city-based worker (Ola rate-card DB, InDrive registry, BharatTaxi
 *  and Savaari route slugs, Uber city guides) failed to resolve the city —
 *  only BharatTaxi occasionally survived. All must extract the clean city. */
test('cityFromRouteText extracts the clean city from UI-decorated endpoints', () => {
  assert.equal(cityFromRouteText('Chappan Dukan / MG Road, Indore'), 'Indore');
  assert.equal(cityFromRouteText('DLF Cyber City, Gurugram'), 'Gurugram');
  assert.equal(cityFromRouteText('Terminal 3 Airport (110037)'), 'Terminal 3 Airport');
  assert.equal(cityFromRouteText('Connaught Place (110001)'), 'Connaught Place');
  assert.equal(cityFromRouteText('Indore'), 'Indore'); // clean city stays clean
  assert.equal(cityFromRouteText('  Godowlia / Dashashwamedh , Varanasi '), 'Varanasi');
});

test('geocodePlace falls back to the clean city when the full string fails', async () => {
  // a garbage locality that photon cannot place, but its city is real
  const g = await geocodePlace('Zqxwv Notaplace 99999, Bhopal');
  assert.ok(g, 'city fallback geocoded');
  if (g) assert.equal(typeof g.lat, 'number');
});

test('indrivePickCity ranks exact name before lookalike substrings (bhopal != bhopalgarh)', () => {
  const cities: InDriveCity[] = [
    { id: 21301, name: 'Bhopalgarh' },   // appears FIRST in InDrive's list (owner bug)
    { id: 12345, name: 'Bhopal' },
    { id: 5233, name: 'Delhi NCR' },
  ];
  assert.equal(indrivePickCity(cities, 'bhopal')?.name, 'Bhopal');
  assert.equal(indrivePickCity(cities, 'Bhopal')?.name, 'Bhopal');
  assert.equal(indrivePickCity(cities, 'indore'), null); // no fuzzy fallback inside the pure helper
  const ncr: InDriveCity[] = [{ id: 5233, name: 'Delhi NCR', sub_name: 'Delhi, India' }];
  assert.equal(indrivePickCity(ncr, 'delhi')?.name, 'Delhi NCR'); // word-boundary prefix still wins
});

test('every city-based cab worker routes through the clean-city extraction', () => {
  const src = readFileSync('server/workers/verticals/cab.ts', 'utf8');
  assert.ok(src.includes('cityFromRouteText(rt.from)'), 'cab workers reference clean city');
  assert.ok(src.includes('bharatTaxiSlug(cityFromRouteText(rt.from))'), 'BharatTaxi slugs the clean city');
  assert.ok(src.includes('savaariRouteSlug(cityFromRouteText(rt.from))'), 'Savaari slugs the clean city');
  assert.ok(src.includes('indriveCityLookup(cityFromRouteText(x))'), 'InDrive looks up the clean city');
  assert.ok(src.includes('uberCitySlugFor(cityFromRouteText(rt.from))'), 'Uber city guide tries the clean city');
  assert.ok(src.includes('geocodePlace(rt.from)'), 'geocoding falls back to the clean city');
  const osrm = readFileSync('server/workers/parsers/osrmCab.ts', 'utf8');
  assert.ok(osrm.includes('geocodePlace'), 'OSRM estimate geocodes with fallback');
});
