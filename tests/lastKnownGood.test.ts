/**
 * Consistency layer (owner 29 Oct): "ek sbse bda bug jo humesa ke liye fix kro — results
 * kabhi aata hai kabhi ni aata, consistent kro."
 *
 * The same search answered 76 rows one minute and 0 rows the next because the live scan is
 * sometimes gated (403), rate-limited or slow. These tests pin the contract of the store that
 * removes that flicker: only verified, non-empty answers are remembered; an empty answer can
 * never overwrite a good one; the key is the whole question (vertical + query + city + pin +
 * date); and a stale entry stops being served.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { clearLastGood, lastGoodSize, recallGood, rememberGood, searchKey } from '../server/search/lastKnownGood.ts';

const q = { vertical: 'bus', query: 'indore to sirali', city: 'Indore', pincode: '452001' };

test('key identifies the whole question', () => {
  assert.equal(searchKey(q), searchKey({ ...q, query: '  Indore   TO Sirali ' }));
  assert.notEqual(searchKey(q), searchKey({ ...q, city: 'Bhopal' }));
  assert.notEqual(searchKey(q), searchKey({ ...q, query: 'indore to bhopal' }));
});

test('a verified answer is replayed, an empty answer never overwrites it', () => {
  clearLastGood();
  rememberGood(q, [{ id: 'a' }, { id: 'b' }], 'live');
  assert.equal(recallGood(q)?.rows.length, 2);
  rememberGood(q, [], 'live'); // a gated poll
  rememberGood(q, [], 'unavailable');
  assert.equal(recallGood(q)?.rows.length, 2, 'the good answer survives the empty polls');
  assert.equal(lastGoodSize(), 1);
});

test('nothing remembered means nothing recalled (no invented rows)', () => {
  clearLastGood();
  assert.equal(recallGood({ vertical: 'flights', query: 'delhi to mumbai' }), null);
});

test('an old answer is not served as if it were current', () => {
  clearLastGood();
  rememberGood(q, [{ id: 'a' }], 'live');
  assert.equal(recallGood(q, 1)?.rows.length, 1);
  const started = Date.now();
  while (Date.now() - started < 3) { /* spin a couple of ms */ }
  assert.equal(recallGood(q, 1), null, 'expired by its own timestamp');
});

test('the store stays bounded', () => {
  clearLastGood();
  const rows = Array.from({ length: 450 }, (_, i) => ({ id: `r${i}` }));
  for (let i = 0; i < 450; i += 1) {
    rememberGood({ vertical: 'ecommerce', query: `q${i}`, city: 'Indore' }, rows.slice(0, 1), 'live');
  }
  assert.ok(lastGoodSize() <= 400, `bounded, got ${lastGoodSize()}`);
});
