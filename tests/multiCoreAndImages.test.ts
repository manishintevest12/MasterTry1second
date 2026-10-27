/**
 * Multi-core boot + product photo resolver (owner 27 Oct).
 * Locks the two decisions: extra vCPUs are opt-in via WEB_CONCURRENCY, and a product
 * with no photo of its own borrows the photo of the same product family.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { workerCount } from '../server/multiCore.js';
import { imageTokens } from '../server/lens/productImage.js';

test('workerCount: default is a single worker (no surprise forking)', () => {
  assert.equal(workerCount({} as any), 1);
  assert.equal(workerCount({ WEB_CONCURRENCY: '' } as any), 1);
  assert.equal(workerCount({ WEB_CONCURRENCY: 'off' } as any), 1);
  assert.equal(workerCount({ WEB_CONCURRENCY: '1' } as any), 1);
});

test('workerCount: explicit counts and auto are honoured, absurd values clamped', () => {
  assert.equal(workerCount({ WEB_CONCURRENCY: '4' } as any), 4);
  assert.equal(workerCount({ WEB_CONCURRENCY: '6' } as any), 6);
  assert.ok(workerCount({ WEB_CONCURRENCY: 'auto' } as any) >= 1);
  assert.equal(workerCount({ WEB_CONCURRENCY: '9999' } as any), 32);
  assert.equal(workerCount({ WEB_CONCURRENCY: 'abc' } as any), 1);
});

test('imageTokens: keeps brand words, drops units and filler', () => {
  const t = imageTokens('Amul Moti Toned Milk 500 ml pack');
  assert.ok(t.includes('amul'));
  assert.ok(t.includes('moti'));
  assert.ok(!t.includes('ml'));
  assert.ok(!t.includes('pack'));
  assert.ok(t.length <= 3);
});

test('imageTokens: numeric-only tokens are not search anchors', () => {
  const t = imageTokens('500 1.5');
  assert.deepEqual(t, []);
});
