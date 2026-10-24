/**
 * Owner 24 Oct: colony/street-level address autocomplete. The 10-min delivery,
 * food and cab verticals need users to enter EXACT addresses (colony, street,
 * house). Photon (OSM autocomplete) returns structured parts; photonFeatureToPlace
 * must build the granular secondary address line, dedupe parts, keep pincode only
 * when it is a real 6-digit Indian postcode and compute distance from the user.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { photonFeatureToPlace } from '../server/common/geoProxy';

const feat = (props: any, coords: number[]) => ({
  type: 'Feature',
  geometry: { coordinates: coords },
  properties: props,
});

test('suggest: POI maps to name + granular street/colony/city/pincode', () => {
  const p = photonFeatureToPlace(feat({
    name: 'Apna Sweets',
    street: 'Sapna Sangeeta Road',
    district: 'Patel Nagar',
    city: 'Indore',
    state: 'Madhya Pradesh',
    postcode: '452001',
    type: 'amenity',
  }, [75.8669, 22.6995]));
  assert.ok(p);
  assert.equal(p.name, 'Apna Sweets');
  assert.equal(p.street, 'Sapna Sangeeta Road');
  assert.equal(p.colony, 'Patel Nagar');
  assert.equal(p.city, 'Indore');
  assert.equal(p.pincode, '452001');
  assert.equal(p.address, 'Sapna Sangeeta Road, Patel Nagar, Indore, Madhya Pradesh',
    'secondary line excludes the name and shows colony + street');
  assert.equal(p.lat, 22.6995);
  assert.equal(p.lng, 75.8669);
});

test('suggest: house number joins the street; parts never duplicate', () => {
  const p = photonFeatureToPlace(feat({
    name: 'Apna Sweets',
    housenumber: '4',
    street: 'Bridge',
    locality: 'Indore City',
    city: 'Indore',
    type: 'house',
  }, [75.9, 22.7]));
  assert.ok(p);
  assert.equal(p.address, '4, Bridge, Indore City, Indore', 'housenumber+street lead the line');
  assert.equal(p.colony, 'Indore City');
  assert.equal(p.pincode, undefined, 'no postcode published = no pincode');
});

test('suggest: distance computed from user coords, rounded to 0.1 km', () => {
  const p = photonFeatureToPlace(
    feat({ name: 'Apna Sweets Pigdambar', city: 'Indore', type: 'amenity' }, [75.797, 22.611]),
    { lat: 22.62, lng: 75.85 },
  );
  assert.ok(p);
  assert.equal(typeof p.distanceKm, 'number');
  assert.ok((p.distanceKm as number) > 0 && (p.distanceKm as number) < 15, `plausible in-city distance, got ${p.distanceKm}`);
});

test('suggest: no coordinates = row dropped (never a fabricated place)', () => {
  assert.equal(photonFeatureToPlace(feat({ name: 'X' }, []), undefined), null);
  assert.equal(photonFeatureToPlace(null, undefined), null);
});

test('suggest: name-less street still shows; unknown postcode dropped', () => {
  const p = photonFeatureToPlace(feat({
    street: 'Vijay Nagar',
    city: 'Indore',
    postcode: 'AB12CD',
  }, [75.8, 22.6]));
  assert.ok(p);
  assert.equal(p.name, 'Vijay Nagar', 'falls back to street when POI name is absent');
  assert.equal(p.pincode, undefined, 'non-numeric postcode is not a pincode');
});
