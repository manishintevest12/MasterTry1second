/**
 * Ask Try1Second AI coverage (owner 28 Oct: "har vertical ka har product ka result
 * chahiye, abhi ask try1second ai sab vertical cover nahi kar raha").
 * These tests pin the two things that were missing: every one of the 12 shipped
 * verticals is answerable, and a bare product name is answered as shopping instead
 * of coming back as "I could not tell which category that is".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildAssistantSearch, cleanAssistantQuery, shapeAssistantAnswer, toAssistantRows, verticalLabel } from '../server/lens/assistantAnswer';

const VERTICAL_PROMPTS: Array<[string, string]> = [
  ['Delhi to Mumbai flight ka rate batao', 'flights'],
  ['hotels in Goa for 2 nights', 'hotels'],
  ['Indore to Bhopal bus', 'bus'],
  ['cab from Vijay Nagar to airport', 'cab'],
  ['iphone 15 price', 'ecommerce'],
  ['amul butter 500g', 'grocery'],
  ['paneer pizza near me', 'food'],
  ['movie tickets in Indore', 'movies'],
  ['personal loan 2 lakh', 'loans'],
  ['health insurance for family', 'insurance'],
  ['best credit card lifetime free', 'creditcards'],
  ['savings bank account zero balance', 'account'],
];

test('all 12 shipped verticals are answered by the assistant', () => {
  for (const [prompt, expected] of VERTICAL_PROMPTS) {
    const { meta, input } = buildAssistantSearch(prompt);
    assert.equal(meta.vertical, expected, `"${prompt}" must route to ${expected}`);
    assert.ok(input, `"${prompt}" must produce a search input`);
    assert.equal(input!.vertical, expected);
    assert.ok(input!.query.length > 0, `"${prompt}" must keep a searchable query`);
  }
});

test('a bare product name is answered as shopping, never refused', () => {
  for (const p of ['boat airdopes 141', 'sony wh-1000xm5', 'nike revolution 7', 'prestige pressure cooker']) {
    const { meta, input } = buildAssistantSearch(p);
    assert.ok(input, `${p} must still be searched`);
    assert.equal(meta.vertical, 'ecommerce');
    assert.equal(meta.assumedVertical, true, 'the assumption must be stated, not hidden');
    assert.match(meta.reply, /comparing/i);
  }
});

test('empty or meaningless text asks back instead of pretending to search', () => {
  for (const p of ['', '   ', '?', 'ok']) {
    const { meta, input } = buildAssistantSearch(p);
    assert.equal(input, null, `"${p}" must not trigger a search`);
    assert.match(meta.reply, /what should i compare|type or say/i);
  }
});

test('the question context (city, pincode, date) reaches the search input', () => {
  const { input } = buildAssistantSearch('paneer pizza', { city: 'Indore', pincode: '452010', lat: 22.75, lng: 75.9 });
  assert.equal(input!.city, 'Indore');
  assert.equal(input!.pincode, '452010');
  assert.equal(input!.lat, 22.75);

  const dated = buildAssistantSearch('delhi to mumbai flight kal');
  assert.ok(dated.input!.travelDates?.depart, 'spoken dates must reach the flight search');
});

test('filler is stripped so the sources get a clean query', () => {
  assert.equal(cleanAssistantQuery('iphone 15 ka price batao'), 'iphone 15');
  assert.equal(cleanAssistantQuery('sabse sasta amul butter dikhao'), 'amul butter');
});

test('rows map from pipeline offers with real prices only', () => {
  const rows = toAssistantRows([
    { vertical: 'ecommerce', title: 'iPhone 15 128GB', vendor: 'Flipkart', prices: { effectivePrice: 58999, currency: 'INR' }, sellerUrl: 'https://flipkart.com/x', attributes: { storage: '128GB' } },
    { vertical: 'ecommerce', title: 'iPhone 15 128GB', vendor: 'Croma', prices: { effectivePrice: 0 }, sellerUrl: 'https://croma.com/x' },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].priceAvailable, true);
  assert.equal(rows[1].priceAvailable, false, 'a priceless row must not claim a price');
  assert.equal(rows[0].specs?.storage, '128GB');
});

test('the answer names the real cheapest row and the site count', () => {
  const rows = toAssistantRows([
    { vertical: 'flights', title: 'IndiGo 6E6972', vendor: 'Ixigo', prices: { effectivePrice: 6786, currency: 'INR' } },
    { vertical: 'flights', title: 'Air India AI9580', vendor: 'EaseMyTrip', prices: { effectivePrice: 8236, currency: 'INR' } },
  ]);
  const a = shapeAssistantAnswer('flights', 'delhi to mumbai', rows, { sourcesSucceeded: ['ixigo', 'emt', 'yatra'] });
  assert.match(a.reply, /IndiGo 6E6972/);
  assert.match(a.reply, /Ixigo/);
  assert.match(a.reply, /6,786/);
  assert.match(a.reply, /Spread/);
  assert.equal(a.count, 2);
});

test('an empty pass is stated honestly, with the pending wording when still scanning', () => {
  const pending = shapeAssistantAnswer('grocery', 'amul butter', [], { pending: true });
  assert.match(pending.reply, /no live grocery result/i);
  assert.match(pending.reply, /still scanning/i);
  const done = shapeAssistantAnswer('grocery', 'amul butter', [], { pending: false });
  assert.match(done.reply, /no live grocery result/i);
  assert.doesNotMatch(done.reply, /still scanning/i);
});

test('every vertical has a human label for the reply', () => {
  for (const v of ['flights', 'hotels', 'bus', 'cab', 'ecommerce', 'grocery', 'food', 'movies', 'loans', 'insurance', 'creditcards', 'account', 'banking']) {
    assert.notEqual(verticalLabel(v), 'results', `${v} needs its own label`);
  }
});
