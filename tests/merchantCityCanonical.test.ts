import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalCity } from '../server/common/cityAlias';
import { merchantDeepLink } from '../server/affiliate/merchantLinks';

// OWNER 3 Nov: the OYO exit opened a 404 page inside the app browser. MEASURED live: oyorooms
// /hotels-in-juni-indore-tahsil/ = 404, /hotels-in-indore-tahsil/ = 404, /hotels-in-indore/ = 200.
// The app's location chip reads "Juni Indore Tahsil" (reverse-geocoded revenue village), so every
// city-slug seller 404'd. These tests pin the permanent rule: a merchant is asked for a CITY.
const LOC = 'Juni Indore Tahsil';
const ctx = { city: LOC, date: '2026-11-20', return: '2026-11-22' };

test('a revenue-village string reduces to its city', () => {
  assert.equal(canonicalCity('Juni Indore Tahsil'), 'Indore');
  assert.equal(canonicalCity('Indore, Madhya Pradesh'), 'Indore');
  assert.equal(canonicalCity('Tehsil Malihabad Lucknow'), 'Lucknow');
  assert.equal(canonicalCity('Pune City'), 'Pune');
  assert.equal(canonicalCity('Goa, India'), 'Goa');
});

test('real multi-word city names survive', () => {
  assert.equal(canonicalCity('New Delhi'), 'New Delhi');
  assert.equal(canonicalCity('Navi Mumbai'), 'Navi Mumbai');
  assert.equal(canonicalCity('Mount Abu'), 'Mount Abu');
});

test('known towns still get their own name, not a metro', () => {
  assert.equal(canonicalCity('Manali'), 'Manali');
  assert.equal(canonicalCity('Ujjain'), 'Ujjain');
});

test('every city-slug hotel seller links on the CITY, never the locality', () => {
  for (const seller of ['OYO', 'Yatra', 'Goibibo', 'Cleartrip', 'EaseMyTrip']) {
    const url = merchantDeepLink(seller, 'hotels in Indore', 'hotels', ctx);
    assert.ok(url, `${seller} must produce a link`);
    assert.doesNotMatch(url, /tahsil|tehsil|juni/i, `${seller} leaked the locality: ${url}`);
    assert.match(url, /indore/i, `${seller} lost the city: ${url}`);
  }
});

test('a hotel link never carries an administrative qualifier', () => {
  const url = merchantDeepLink('OYO', 'hotels in Shimla', 'hotels', { city: 'Shimla District' });
  assert.match(url, /hotels-in-shimla\//);
  assert.doesNotMatch(url, /district/i);
});
