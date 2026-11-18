import test from 'node:test';
import assert from 'node:assert/strict';
import { fixSpelling } from '../server/lens/spellFix';

/** OWNER 18 Nov (master prompt section 1): a typo must never break the search. */
test('misspelled product words are repaired before the sources are asked', () => {
  assert.equal(fixSpelling('amul buter').query, 'amul butter');
  assert.equal(fixSpelling('iphnoe 16').query, 'iphone 16');
  assert.equal(fixSpelling('samsng galaxy').query, 'samsung galaxy');
});

test('Hinglish staple spellings resolve to the name the shops list', () => {
  assert.equal(fixSpelling('aata 10 kg').query, 'atta 10 kg');
  assert.equal(fixSpelling('biriyani').query, 'biryani');
  assert.equal(fixSpelling('tamatar 1kg').query, 'tomato 1kg');
});

test('numbers, sizes and travel words are never touched', () => {
  assert.equal(fixSpelling('paneer 500g').query, 'paneer 500g');
  assert.equal(fixSpelling('wh-1000xm5').query, 'wh-1000xm5');
  assert.equal(fixSpelling('indor to mumbai flight').query, 'indor to mumbai flight', '"indor" must not become "indigo"');
  assert.equal(fixSpelling('aata 10 kg').query.includes('10 kg'), true, 'the quantity survives repair');
});
