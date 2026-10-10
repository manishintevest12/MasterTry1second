import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeBindParams } from '../server/common/db';

test('undefined and NaN bind params become SQL NULL, never undefined', () => {
  assert.deepEqual(
    sanitizeBindParams([undefined, NaN, 1, 'x', null, 0]),
    [null, null, 1, 'x', null, 0],
  );
});
test('empty/absent param lists are safe', () => {
  assert.deepEqual(sanitizeBindParams([]), []);
});
