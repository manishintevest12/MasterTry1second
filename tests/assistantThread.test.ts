import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyFollowUp, readSubject, resetAssistantThreads, sellerBreakdown,
  shapeFollowUpAnswer, subjectFromAnswer, writeSubject,
} from '../server/lens/assistantThread';

// OWNER 3 Nov (screenshot): after "muje tata tea ka rate batao" (Blinkit ₹50) he asked
// "aur v website batao sirf blinkit hi kyun bata rahe ho" and the assistant searched that whole
// sentence as a NEW PRODUCT ("... is a grocery staple"). These tests pin the thread behaviour.
const tataRows = [
  { title: 'Tata Tea Gold 100 g', provider: 'Blinkit', price: 50 },
  { title: 'Tata Tea Gold 100 g', provider: 'Zepto', price: 52 },
  { title: 'Tata Tea Gold 100 g', provider: 'Amazon', price: 58 },
];
const subject = subjectFromAnswer('grocery', 'tata tea', tataRows, { city: 'Indore' });

test('the exact owner sentence is a follow-up on Tata Tea, not a new product', () => {
  const v = classifyFollowUp('aur v website batao sirf blinkit hi kyun bata rahe ho', subject);
  assert.equal(v.follow, true);
  assert.equal(v.kind, 'more_sellers');
  assert.equal(v.query, 'tata tea');
  assert.equal(v.vertical, 'grocery');
});

test('other ways of asking for more sites stay on the product', () => {
  for (const q of ['zepto aur blinkit par kitna hai', 'sabhi website batao', 'kaun kaun bech raha hai', 'more sites please']) {
    const v = classifyFollowUp(q, subject);
    assert.equal(v.follow, true, `${q} should be a follow-up`);
    assert.equal(v.query, 'tata tea');
  }
});

test('a cheaper / detail question also stays on the product', () => {
  assert.equal(classifyFollowUp('sasta kahan milega', subject).kind, 'cheaper');
  assert.equal(classifyFollowUp('iska detail batao', subject).kind, 'detail');
});

test('a NEW product is never hijacked by the previous subject', () => {
  for (const q of ['amul butter ka rate batao', 'iphone 15 price', 'delhi to mumbai flight']) {
    assert.equal(classifyFollowUp(q, subject).follow, false, `${q} must be a new question`);
  }
});

test('with no earlier subject nothing is a follow-up', () => {
  assert.equal(classifyFollowUp('aur v website batao', null).follow, false);
});

test('the follow-up reply names every seller that answered and the cheapest', () => {
  const reply = shapeFollowUpAnswer('more_sellers', 'tata tea', tataRows, { alsoShopping: true });
  for (const seller of ['Blinkit', 'Zepto', 'Amazon']) assert.match(reply, new RegExp(seller));
  assert.match(reply, /Cheapest is Blinkit/);
  assert.match(reply, /₹50/);
  assert.doesNotMatch(reply, /is a grocery staple/);
});

test('an empty follow-up pass says so instead of inventing a site', () => {
  const reply = shapeFollowUpAnswer('more_sellers', 'tata tea', [], { sellersLastTime: ['Blinkit'] });
  assert.match(reply, /only Blinkit had it/);
  assert.match(reply, /No other site answered/);
});

test('one row per seller, cheapest of that seller wins', () => {
  const b = sellerBreakdown([
    { title: 'Tata Tea 500 g', provider: 'Blinkit', price: 240 },
    { title: 'Tata Tea 100 g', provider: 'Blinkit', price: 50 },
    { title: 'Tata Tea 100 g', provider: 'Zepto', price: 0 },
  ]);
  assert.equal(b.length, 1);
  assert.equal(b[0].price, 50);
});

test('the subject is remembered per session and keeps the product', () => {
  resetAssistantThreads();
  writeSubject('sess-1', subject);
  assert.equal(readSubject('sess-1')?.query, 'tata tea');
  assert.deepEqual(readSubject('sess-1')?.sellers, ['Blinkit', 'Zepto', 'Amazon']);
  assert.equal(readSubject('sess-2'), null);
});
