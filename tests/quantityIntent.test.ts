import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRequestedQuantity, rowQuantity, quantityVerdict, planByQuantity } from '../server/lens/quantityIntent';
import { exactPackUnavailable } from '../server/ai/masterPrompt';

/**
 * OWNER 18 Nov (master prompt section 2, "CRITICAL"): a stated quantity is binding.
 * "10 kg atta" is 10 kg = 10,000 g; a 1 kg or 5 kg pack is an ALTERNATIVE, never the answer.
 */

test('the requested size is read from real phrasings, Hinglish included', () => {
  const cases: Array<[string, string]> = [
    ['10 kg atta', '10 kg'],
    ['aata 10kg chahiye', '10 kg'],
    ['atta 10 kilogram sabse sasta', '10 kg'],
    ['500 gram paneer', '500 g'],
    ['500g paneer price', '500 g'],
    ['2 litre doodh', '2 L'],
    ['1.5 l milk', '1.5 L'],
    ['pack of 6 eggs', '6 pack'],
    ['do kilo atta', '2 kg'],
    ['ek litre tel', '1 L'],
  ];
  for (const [input, label] of cases) {
    const q = parseRequestedQuantity(input);
    assert.ok(q, `should read a quantity from "${input}"`);
    assert.equal(q!.label, label, input);
  }
});

test('a bare number is not a quantity (price, model, year all look like numbers)', () => {
  for (const input of ['atta', 'iphone 15', 'atta 500', 'best atta under 300', 'movies in pune']) {
    assert.equal(parseRequestedQuantity(input), null, input);
  }
});

test('pack sizes are read the way sellers write them', () => {
  const cases: Array<[string, string]> = [
    ['Aashirvaad Atta 5 kg', '5 kg'],
    ['Aashirvaad Atta 1 kg Pouch', '1 kg'],
    ['Atta 10 kg (Pack of 1)', '10 kg'],
    ['Atta 5kg x 2 combo', '5 kg'],
    ['Amul Taaza Toned Milk 1 L Tetra Pak', '1 L'],
    ['Amul Milk 500 ml', '500 ml'],
    ['Tata Salt 1 kg Pouch', '1 kg'],
  ];
  for (const [title, label] of cases) {
    const q = rowQuantity(title);
    assert.ok(q, title);
    assert.equal(q!.label, label, title);
  }
  assert.equal(rowQuantity('iPhone 15 Pro 256 GB'), null, 'storage is not a pack size');
});

test('units never mix: a litre of milk is not a kilo of atta', () => {
  const oneKg = parseRequestedQuantity('1 kg atta')!;
  assert.equal(quantityVerdict(oneKg, 'Amul Milk 1 L'), 'unknown');
  assert.equal(quantityVerdict(oneKg, 'Aashirvaad Atta 1 kg'), 'exact');
  assert.equal(quantityVerdict(oneKg, 'Aashirvaad Atta 5 kg'), 'different');
  assert.equal(quantityVerdict(oneKg, 'Atta (no size printed)'), 'unknown');
});

test('the exact pack wins even when a small pack is cheaper', () => {
  const rows = [
    { title: 'Aashirvaad Atta 1 kg Pouch', price: 60 },
    { title: 'Aashirvaad Atta 5 kg', price: 250 },
    { title: 'Aashirvaad Atta 10 kg', price: 470 },
  ];
  const plan = planByQuantity(parseRequestedQuantity('10 kg atta'), rows, exactPackUnavailable);
  assert.equal(plan.notice, null, 'no apology needed: the exact pack exists');
  assert.deepEqual(plan.exact.map((r) => r.title), ['Aashirvaad Atta 10 kg']);
  assert.equal(plan.alternates.length, 2);
});

test('a missing exact pack says so in the owner\'s words, then offers the closest', () => {
  const rows = [
    { title: 'Aashirvaad Atta 5 kg', price: 250 },
    { title: 'Aashirvaad Atta 1 kg Pouch', price: 60 },
  ];
  const plan = planByQuantity(parseRequestedQuantity('10 kg atta'), rows, exactPackUnavailable);
  assert.equal(
    plan.notice,
    'Exact 10 kg pack is currently unavailable across our partner platforms. Here are the closest available alternatives:',
  );
  assert.equal(plan.exact.length, 0);
  assert.deepEqual(plan.alternates.map((r) => r.title), ['Aashirvaad Atta 1 kg Pouch', 'Aashirvaad Atta 5 kg'], 'cheapest first');
});

test('no stated size leaves the ranking exactly as it was', () => {
  const rows = [{ title: 'Atta 5 kg', price: 250 }, { title: 'Atta 1 kg', price: 60 }];
  const plan = planByQuantity(null, rows, exactPackUnavailable);
  assert.equal(plan.notice, null);
  assert.equal(plan.exact.length, 0);
  assert.equal(plan.alternates, rows);
});
