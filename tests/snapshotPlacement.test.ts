import test from 'node:test';
import assert from 'node:assert/strict';
import { pagePlacement } from '../server/seo/liveSnapshot';

test('snapshot placement: city pages ask the catalogue for their own city, routes ask for their terms', () => {
  assert.deepEqual(pagePlacement('/hotels/mumbai'), { city: 'Mumbai', queryTerms: ['Mumbai'] });
  assert.deepEqual(pagePlacement('/cabs/noida'), { city: 'Noida', queryTerms: ['Noida'] });
  assert.deepEqual(pagePlacement('/hotels/new-delhi'), { city: 'New Delhi', queryTerms: ['New Delhi'] });
  assert.deepEqual(pagePlacement('/bus/chennai-to-madurai-bus'), { queryTerms: ['chennai', 'madurai'] });
  assert.deepEqual(pagePlacement('/flights'), {});
  assert.deepEqual(pagePlacement('/best/hotels/maharashtra'), {}, 'answer pages never borrow city prices');
  assert.deepEqual(pagePlacement('/product/iphone-15-128gb'), {});
});
