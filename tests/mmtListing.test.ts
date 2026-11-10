import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMmtHotelListing, mmtCityCode, mmtListingUrl, mmtPageMatchesStay } from '../server/workers/parsers/mmtListing';

const html = readFileSync(new URL('./fixtures/mmt_dated_listing.html', import.meta.url), 'utf8');

test('MMT hotel city code is CT + IATA, and an unknown city gets no code', () => {
  assert.equal(mmtCityCode('Indore'), 'CTIDR');
  assert.equal(mmtCityCode('indore'), 'CTIDR');
  assert.equal(mmtCityCode('Mumbai'), 'CTBOM');
  // The bug that made this source look "gated" for days: CTIXE is Mangalore, so Indore must never map to it.
  assert.notEqual(mmtCityCode('Indore'), 'CTIXE');
  assert.equal(mmtCityCode('not-a-city'), null);
});

test('the listing URL carries the stay as MMDDYYYY and refuses to guess a city', () => {
  const url = mmtListingUrl('Indore', '2026-11-21', '2026-11-22');
  assert.ok(url && url.includes('checkin=11212026') && url.includes('checkout=11222026'));
  assert.ok(url!.includes('city=CTIDR') && url!.includes('locusId=CTIDR'));
  assert.equal(mmtListingUrl('not-a-city', '2026-11-21', '2026-11-22'), null);
  assert.equal(mmtListingUrl('Indore', '21-11-2026', '2026-11-22'), null);
});

test('a rendered listing is parsed into real priced hotels with taxes', () => {
  const rows = parseMmtHotelListing(html);
  assert.ok(rows.length >= 3, `expected real cards, got ${rows.length}`);
  for (const r of rows) {
    assert.ok(r.price > 0 && r.total >= r.price);
    assert.ok(r.name.length > 2 && !/spotlight program|advertisement fee/i.test(r.name));
  }
  const bw = rows.find((r) => /best western/i.test(r.name));
  assert.ok(bw, 'the 4-star card is in the page');
  assert.equal(bw!.price, 5500);
  assert.equal(bw!.taxes, 275);
  assert.equal(bw!.total, 5775);
});

test('the date is stamped only when the page really is the requested stay', () => {
  assert.equal(mmtPageMatchesStay(html, '2026-11-21', '2026-11-22'), true);
  assert.equal(mmtPageMatchesStay(html, '2026-11-24', '2026-11-25'), false, 'a different stay must not be stamped');
  assert.equal(mmtPageMatchesStay('200-OK', '2026-11-21', '2026-11-22'), false, 'an Akamai stub is not a listing');
  assert.equal(parseMmtHotelListing('200-OK').length, 0, 'No Price, No Card: a stub yields no rows');
});
