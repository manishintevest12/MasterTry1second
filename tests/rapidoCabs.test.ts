import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { validateOffer } from '../server/pipeline/validation';
import type { NormalizedOffer } from '../server/types';
import {
  buildRapidoAvailability,
  rapidoCityLookup,
  rapidoCitySlug,
  rapidoServedCities,
  type RapidoCity,
} from '../server/workers/parsers/rapidoCabs';

/** Owner request 17 Oct: add Rapido + Uber WITHOUT official APIs, remove Try1Second estimate.
 *  Rapido publishes no web fares (verified: route/city pages are SEO content; web bundle
 *  references only internal .svc hosts), so Rapido surfaces as honest app-only availability
 *  rows. Uber: 10 new SSR city guides added (incl. Indore + Gurgaon) — 19 cities, no API. */

const src: any = { id: 'w_cab_rapido', name: 'Rapido worker', vertical: 'cab', method: 'direct_http' };

const cities: RapidoCity[] = [
  { name: 'Bangalore', mainPagePath: 'Bangalore' },
  { name: 'Gurugram', mainPagePath: 'Gurugram' },
  { name: 'Indore', mainPagePath: 'Indore' },
  { name: 'New Delhi', mainPagePath: 'New Delhi' },
];

test('rapidoCitySlug uses legacy route-spellings; lookup is alias-insensitive both ways', () => {
  assert.equal(rapidoCitySlug('Bengaluru'), 'bangalore');
  assert.equal(rapidoCitySlug('New Delhi'), 'delhi');
  assert.equal(rapidoCitySlug('Gurugram'), 'gurgaon');
  assert.equal(rapidoCitySlug('Indore'), 'indore');
  assert.equal(rapidoCityLookup(cities, 'Gurgaon')?.name, 'Gurugram'); // photon says Gurgaon, Rapido says Gurugram
  assert.equal(rapidoCityLookup(cities, 'bengaluru')?.name, 'Bangalore');
  assert.equal(rapidoCityLookup(cities, 'delhi')?.name, 'New Delhi');
  assert.equal(rapidoCityLookup(cities, 'Mumbai'), null);
});

test('rapidoServedCities parses the cities sitemap (96-city registry, 12h cache)', async () => {
  const xml = `<urlset><url><loc>https://www.rapido.bike/Agartala/main-page</loc></url>`
    + `<url><loc>https://www.rapido.bike/Bangalore/main-page</loc></url>`
    + `<url><loc>https://www.rapido.bike/New%20Delhi/main-page</loc></url></urlset>`;
  const got = await rapidoServedCities(async () => xml);
  assert.deepEqual(got.map((c) => c.name).sort(), ['Agartala', 'Bangalore', 'New Delhi']);
  assert.equal(got[2].mainPagePath, 'New%20Delhi');
  // cache: second call does not re-fetch
  let calls = 0;
  await rapidoServedCities(async () => { calls++; throw new Error('should not fetch'); });
  assert.equal(calls, 0);
});

test('buildRapidoAvailability: 3 honest app-only rows (Bike/Auto/Cab), zero prices invented', () => {
  const rows = buildRapidoAvailability({
    source: src as any,
    from: 'Connaught Place (110001)',
    to: 'Terminal 3 Airport (110037)',
    city: 'New Delhi',
    mainPageUrl: 'https://www.rapido.bike/Delhi/main-page',
  });
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r: any) => r.attributes.vehicle_type), ['Bike Taxi', 'Auto', 'Cab']);
  for (const r of rows as any[]) {
    assert.equal(r.price, undefined, 'no price is ever set for an app-only platform');
    assert.equal(r.currency, 'INR');
    assert.equal(r.seller, 'Rapido');
    assert.equal(r.attributes.price_basis, 'app_only_fares');
    assert.ok(String(r.attributes.data_note).includes('available only on app'));
    assert.ok(String(r.attributes.data_note).includes('New Delhi'));
    assert.ok(String(r.sellerUrl).startsWith('https://www.rapido.bike/'));
    assert.ok(!r.evidence.extractedFields.includes('price'), 'price is NOT claimed extracted');
    assert.ok(r.identifiers.sku.startsWith('rapido-delhi-'));
  }
  assert.ok(String((rows as any[])[0].attributes.data_note).includes("Rapido's own served-city registry"));
});

function cabOffer(attrs: Record<string, string>, price?: number): NormalizedOffer {
  return {
    id: 'o1', vertical: 'cab', title: 'X to Y', seller: 'Rapido',
    prices: { currency: 'INR', ...(price !== undefined ? { mandatoryTotal: price } : {}) },
    attributes: attrs,
    availability: 'unknown',
  } as unknown as NormalizedOffer;
}

test('validation: an app_only_fares cab row passes; a missing-price bug still fails', () => {
  const appOnly = validateOffer(cabOffer({ price_basis: 'app_only_fares', pickup: 'A', drop: 'B', vehicle_type: 'Bike Taxi' }));
  assert.notEqual(appOnly.status, 'INVALID');
  assert.ok(!appOnly.unverified.includes('fare'), 'app_only_fares counts as an answer, not a missing field');

  const broken = validateOffer(cabOffer({ pickup: 'A', drop: 'B' }));
  assert.equal(broken.status, 'INVALID', 'a cab row with neither price nor app_only_fares never surfaces');

  const priced = validateOffer(cabOffer({ pickup: 'A', drop: 'B', vehicle_type: 'Auto' }, 4871));
  assert.equal(priced.status, 'VALID');
});

test('cab worker: Try1Second estimate removed; Uber covers 19 cities incl. Indore + Gurgaon', () => {
  const s = readFileSync('server/workers/verticals/cab.ts', 'utf8');
  assert.ok(!s.includes('w_cab_osrm'), 'OSRM estimate worker removed from cab');
  assert.ok(!readFileSync('server/workers/verticals/bus.ts', 'utf8').includes('w_bus_osrm_estimate'), 'estimate removed from bus too');
  assert.ok(!existsSync('server/workers/parsers/osrmCab.ts'), 'estimate parser deleted');
  for (const slug of ['indore-madhya-pradesh-in', 'gurgaon-haryana-in', 'chandigarh-chandigarh-in', 'kochi-kerala-in',
    'guwahati-assam-in', 'thiruvananthapuram-kerala-in', 'mysore-karnataka-in', 'vadodara-gujarat-in',
    'bhubaneswar-odisha-in', 'jodhpur-rajasthan-in']) {
    assert.ok(s.includes(slug), `Uber city guide ${slug} registered`);
  }
  // Rapido task is a real availability worker now, not the old honest-fail probe
  assert.ok(s.includes("rapidoServedCities(fetchText)"), 'Rapido worker checks the served-city registry');
  assert.ok(!s.includes('rapidoRouteToken'), 'route-page tokens dropped (Rapido route pages are a soft-200 template)');
  assert.ok(!s.includes("Rapido (probe)"), 'probe replaced');
});

test('frontend labels app-only rows "Fare on app" (spec keys are space-normalised server-side)', () => {
  const ui = readFileSync('src/components/TravelDealRow.tsx', 'utf8');
  assert.ok(ui.includes("'price basis', 'price_basis'"), 'both spec key spellings checked');
  assert.ok(ui.includes('Fare on app'));
});
