/**
 * REGRESSION GUARD (owner 28 Oct). The previous hotel-art purge deleted every row whose
 * `$.image_url` was NULL. Photo-bearing rows that keep art under another key (image / photo /
 * images / thumbnail) or as a gallery were therefore wiped: hotels/Indore fell from 262 rows /
 * 8 sellers / 247 photos to 40 photoless Agoda rows. This test pins the safe contract: the
 * delete may only target rows whose art is PROVABLY a favicon or a bundled brand logo.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { PURGE_BAD_HOTEL_ART_SQL as SQL } from '../server/catalogue/catalogueService';

test('the purge never deletes a row merely for lacking image_url', () => {
  assert.ok(!/image_url'\)\s*IS NULL/i.test(SQL), 'no "image_url IS NULL" clause allowed');
  assert.ok(!/NOT LIKE '%"image_url"%'/i.test(SQL), 'no absence-of-key LIKE allowed');
});

test('the purge only removes provably-bad art', () => {
  assert.match(SQL, /s2\/favicons/);
  assert.match(SQL, /brand-logos/);
});

test('the purge is scoped to hotels', () => {
  assert.match(SQL, /vertical = 'hotels'/);
  assert.match(SQL, /^DELETE FROM offers/i);
});
