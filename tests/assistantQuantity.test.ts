import test from 'node:test';
import assert from 'node:assert/strict';
import { shapeAssistantAnswer } from '../server/lens/assistantAnswer';
import { parseRequestedQuantity } from '../server/lens/quantityIntent';

/**
 * OWNER 18 Nov, end to end: ask "10 kg atta" and the answer must be a 10 kg pack — or, when no partner has
 * one, the owner's exact apology followed by labelled alternatives. A 1 kg pouch must never be dressed up as
 * the answer to a 10 kg question, however cheap it is.
 */
const row = (title: string, price: number, provider: string) => ({ title, price, provider, priceAvailable: true, currency: 'INR' }) as any;

const shelf = [
  row('Aashirvaad Atta 1 kg Pouch', 62, 'Blinkit'),
  row('Aashirvaad Atta 5 kg', 255, 'Zepto'),
  row('Aashirvaad Atta 10 kg', 470, 'Amazon'),
];

test('a 10 kg question is answered by the 10 kg pack, not the cheapest 1 kg', () => {
  const q = parseRequestedQuantity('10 kg atta');
  const out = shapeAssistantAnswer('grocery', 'atta', shelf, { requestedQuantity: q });
  assert.match(out.reply, /^Exact 10 kg pack: /);
  assert.match(out.reply, /Aashirvaad Atta 10 kg on Amazon at ₹470/);
  assert.equal(out.results[0].title, 'Aashirvaad Atta 10 kg', 'requested size leads the list');
  assert.equal(out.results.length, 3, 'alternatives are still offered, just not as the answer');
});

test('with no 10 kg pack on any partner, the owner\'s apology comes first', () => {
  const two = shelf.filter((r) => !/10 kg/.test(r.title));
  const out = shapeAssistantAnswer('grocery', 'atta', two, { requestedQuantity: parseRequestedQuantity('10 kg atta') });
  assert.match(out.reply, /^Exact 10 kg pack is currently unavailable across our partner platforms\. Here are the closest available alternatives: /);
  assert.match(out.reply, /Closest: Aashirvaad Atta 1 kg Pouch on Blinkit at ₹62/);
  assert.doesNotMatch(out.reply, /Cheapest Grocery result/, 'it must not claim the cheapest row answers the question');
});

test('no stated size keeps the old, purely price-based answer', () => {
  const out = shapeAssistantAnswer('grocery', 'atta', shelf, {});
  assert.match(out.reply, /^Cheapest grocery result for "atta": Aashirvaad Atta 1 kg Pouch on Blinkit at ₹62\./);
  assert.equal(out.results[0].title, 'Aashirvaad Atta 1 kg Pouch');
});

test('a size the user did not state is never invented: 2 L of milk is not 1 L', () => {
  const milk = [row('Amul Taaza Toned Milk 1 L', 72, 'Zepto'), row('Amul Taaza Toned Milk 2 L', 138, 'Blinkit')];
  const out = shapeAssistantAnswer('grocery', 'amul milk', milk, { requestedQuantity: parseRequestedQuantity('2 litre amul milk') });
  assert.match(out.reply, /^Exact 2 L pack: /);
  assert.match(out.reply, /2 L on Blinkit/);
});

test('an empty pass offers a way forward instead of "no results found"', () => {
  const out = shapeAssistantAnswer('flights', 'delhi to mumbai kal', [], {});
  assert.doesNotMatch(out.reply, /^No results found/i);
  assert.match(out.reply, /Try a nearby city or locality, a different date, or a wider brand\/size/);
  assert.match(out.reply, /https:\/\/www\.try1second\.com/);
  assert.equal(out.count, 0);
});

test('a still-scanning pass says it is scanning, and adds nothing false', () => {
  const out = shapeAssistantAnswer('flights', 'delhi to mumbai', [], { pending: true });
  assert.match(out.reply, /still scanning/);
  assert.doesNotMatch(out.reply, /₹/);
});
