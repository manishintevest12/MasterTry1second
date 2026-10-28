/**
 * OWNER 28 Oct, twice:
 *  1st attempt required location_city = city in SQL -> hotels/Indore fell from 262 rows /
 *  8 sellers / 247 photos to 40 photoless rows, because most photo-rich rows carry no city.
 *  This gate is the narrower rule: keep matching/unknown rows, drop rows that NAME another city
 *  (that is exactly how 'Morjim Pride Hotel, Goa' appeared under an Indore search).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { namesOtherCity } from '../server/search/searchOrchestrator';

test('a Goa property does not pass an Indore search', () => {
  assert.equal(namesOtherCity('Morjim Pride Hotel with Swimming Pool near Morjim Beach Goa', 'Indore'), true);
});

test('a row that names the searched city passes', () => {
  assert.equal(namesOtherCity('Hotel Aventus Suites Indore', 'Indore'), false);
});

test('a row with no city at all stays (these carry the real photos)', () => {
  assert.equal(namesOtherCity('The Social Stays', 'Indore'), false);
});

test('city names are matched as words, not substrings', () => {
  assert.equal(namesOtherCity('Indorekart Electronics', 'Pune'), false, '"indore" inside a brand is not a city');
  assert.equal(namesOtherCity('Lake view stay, Udaipur', 'Indore'), true);
});

test('no city in the search means no gate at all', () => {
  assert.equal(namesOtherCity('Anything, Goa', undefined), false);
});
