/**
 * Ask Try1Second AI — one word, two shelves (owner 20 Nov).
 *
 * OWNER: "ai mai dosa jb search hota hai tho result sirf grocery se aaya jb ki dosa food section
 * mai v hota hai waha se v aana chaiye waise hi jb rice daalte hai tho result rice ka aag aata hai
 * raw rice ka alag aata hai. ai itna intelligent hona chaiye ki wo excat results de aur samje user
 * kya maang raha hoga."
 *
 * Measured before this file existed:
 *   - "rice" was answered from Grocery only (raw grain), never as a dish,
 *   - "dosa" was answered from one shelf only, so the batter and the plate were never both shown,
 *   - "curd rice", "jeera rice", "lemon rice", "boiled rice", "sambar", "rasam", "upma", "pongal"
 *     were priced as grocery staples or fell through to shopping,
 *   - "basmati rice" was rewritten to "Baramati rice" by the city-repair pass (a different product),
 *   - a bare refinement ("5 kg", "indore me") after a question was searched as a new product.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildAssistantSearch, altShelfQuery } from '../server/lens/assistantAnswer';
import { cleanCategoryQuery, detectCategoryVertical, dualCategoryFor, isProductWord } from '../server/lens/verticalLexicon';
import { normalizeAssistantQuestion } from '../server/lens/questionNormalizer';
import { dualReply, mergeDualRows } from '../server/lens/dualVertical';
import { refineSubjectQuery, subjectFromAnswer } from '../server/lens/assistantThread';

const route = (q: string) => buildAssistantSearch(q, { city: 'Indore' });

test('a word on both shelves asks the second shelf too', () => {
  const cases: Array<[string, string, string]> = [
    ['rice', 'grocery', 'food'],
    ['chicken', 'grocery', 'food'],
    ['paneer', 'grocery', 'food'],
    ['poha', 'grocery', 'food'],
    ['dosa', 'food', 'grocery'],
    ['idli', 'food', 'grocery'],
    ['momos', 'food', 'grocery'],
  ];
  for (const [text, primary, secondary] of cases) {
    const { meta } = route(text);
    assert.equal(meta.vertical, primary, `${text} primary shelf`);
    assert.equal(meta.altVertical, secondary, `${text} second shelf`);
    assert.ok(meta.altQuery, `${text} must say what the second shelf is asked for`);
  }
});

test('a word that settles the shelf never asks the other one', () => {
  const settled: Array<[string, string]> = [
    ['raw rice', 'grocery'],
    ['rice 5 kg', 'grocery'],
    ['basmati rice', 'grocery'],
    ['dosa batter', 'grocery'],
    ['chicken 500g', 'grocery'],
    ['rice plate', 'food'],
    ['order rice', 'food'],
    ['curd rice', 'food'],
  ];
  for (const [text, vertical] of settled) {
    const { meta } = route(text);
    assert.equal(meta.vertical, vertical, `${text} -> ${vertical}`);
    assert.equal(meta.altVertical, undefined, `${text} must not open a second shelf`);
  }
});

test('the dishes the lexicon was missing now go to Food, not grocery or shopping', () => {
  for (const dish of ['curd rice', 'jeera rice', 'lemon rice', 'boiled rice', 'sambar', 'rasam', 'upma', 'pongal', 'khichdi', 'rajma chawal', 'chole bhature']) {
    assert.equal(detectCategoryVertical(dish), 'food', dish);
    assert.equal(route(dish).meta.vertical, 'food', `${dish} routes to food`);
  }
});

test('a dish phrase beats its staple, and a pack size beats a dish', () => {
  assert.equal(detectCategoryVertical('chicken biryani'), 'food');
  assert.equal(detectCategoryVertical('chicken 500g'), 'grocery');
  assert.equal(detectCategoryVertical('paneer'), 'grocery');
  assert.equal(detectCategoryVertical('paneer pizza'), 'food');
});

test('the second shelf is asked in words that shelf can answer', () => {
  assert.equal(altShelfQuery('dosa', 'food', 'grocery'), 'dosa batter');
  assert.equal(altShelfQuery('rice', 'grocery', 'food'), 'rice dishes');
  assert.equal(altShelfQuery('dosa batter', 'food', 'grocery'), 'dosa batter');
  assert.equal(altShelfQuery('rice plate', 'grocery', 'food'), 'rice plate');
});

test('the two-shelf reply names both shelves and both prices', () => {
  const grocery = [
    { vertical: 'grocery', title: 'India Gate Basmati Rice 5 kg', provider: 'Blinkit', price: 549, priceAvailable: true, currency: 'INR' },
  ];
  const food = [
    { vertical: 'food', title: 'Veg Fried Rice', provider: 'Zomato', price: 180, priceAvailable: true, currency: 'INR' },
  ];
  const reply = dualReply({ primary: 'grocery', secondary: 'food' }, 'rice', grocery, food);
  assert.match(reply, /both shelves/i);
  assert.match(reply, /10-minute grocery/);
  assert.match(reply, /food delivery/);
  assert.match(reply, /₹549/);
  assert.match(reply, /₹180/);
});

test('a silent shelf is reported honestly, never filled in', () => {
  const grocery = [
    { vertical: 'grocery', title: 'Daawat Rice 1 kg', provider: 'Zepto', price: 120, priceAvailable: true, currency: 'INR' },
  ];
  const reply = dualReply({ primary: 'grocery', secondary: 'food' }, 'rice', grocery, []);
  assert.match(reply, /Nothing priced came back from the food delivery apps/);
  assert.doesNotMatch(reply, /both shelves/i);
});

test('neither shelf answering is an honest zero, not an invented price', () => {
  const reply = dualReply({ primary: 'grocery', secondary: 'food' }, 'rice', [], []);
  assert.match(reply, /No live price/);
  assert.doesNotMatch(reply, /₹/);
});

test('the merged grid keeps both shelves and labels every card', () => {
  const grocery = Array.from({ length: 6 }, (_, i) => ({
    vertical: 'grocery', title: `Rice pack ${i}`, provider: `G${i}`, price: 100 + i, priceAvailable: true, currency: 'INR',
  }));
  const food = Array.from({ length: 4 }, (_, i) => ({
    vertical: 'food', title: `Rice dish ${i}`, provider: `F${i}`, price: 150 + i, priceAvailable: true, currency: 'INR',
  }));
  const merged = mergeDualRows(grocery, food, { primary: 'grocery', secondary: 'food' }, 10);
  assert.ok(merged.some((r) => r.vertical === 'grocery'), 'grocery shelf present');
  assert.ok(merged.some((r) => r.vertical === 'food'), 'food shelf present');
  assert.ok(merged.length <= 10);
});

test('basmati is a product, not the town Baramati', () => {
  assert.equal(normalizeAssistantQuestion('basmati rice').text, 'basmati rice');
  assert.equal(normalizeAssistantQuestion('basmati rice 5 kg').text, 'basmati rice 5 kg');
  assert.equal(isProductWord('basmati'), true);
  // A real city typo must still be repaired.
  assert.equal(normalizeAssistantQuestion('hotal in indor').text, 'hotel in Indore');
  assert.equal(normalizeAssistantQuestion('mumai flight').text, 'Mumbai flight');
});

test('a bare refinement stays on the previous question', () => {
  const subject = subjectFromAnswer('grocery', 'rice', [
    { title: 'Daawat Rice 1 kg', provider: 'Zepto', price: 120 },
  ], { city: 'Indore' });

  const qty = refineSubjectQuery('5 kg', subject);
  assert.equal(qty.refine, true);
  assert.equal(qty.query, 'rice 5 kg');
  assert.equal(qty.vertical, 'grocery');

  const place = refineSubjectQuery('indore me', subject, (t) => (t === 'indore' ? 'Indore' : null));
  assert.equal(place.refine, true);
  assert.equal(place.query, 'rice');
  assert.equal(place.city, 'Indore');

  const vague = refineSubjectQuery('sasta wala', subject);
  assert.equal(vague.refine, true);
  assert.equal(vague.query, 'rice');
});

test('a refinement never hijacks a genuinely new product', () => {
  const subject = subjectFromAnswer('grocery', 'rice', [{ title: 'Daawat Rice 1 kg', provider: 'Zepto', price: 120 }]);
  for (const q of ['amul butter 500g', 'iphone 15', 'dosa', 'biryani kaha sasta milega']) {
    assert.equal(refineSubjectQuery(q, subject).refine, false, `${q} must be a new question`);
  }
  assert.equal(refineSubjectQuery('5 kg', null).refine, false, 'no thread means no refinement');
});

test('the existing clean-query behaviour is untouched', () => {
  assert.equal(cleanCategoryQuery('aata sbse sasta kaha hai'), 'atta');
  assert.equal(cleanCategoryQuery('zomato se biryani'), 'biryani');
  assert.deepEqual(dualCategoryFor('rice'), { primary: 'grocery', secondary: 'food' });
  assert.equal(dualCategoryFor('milk'), null, 'milk has one shelf');
});
