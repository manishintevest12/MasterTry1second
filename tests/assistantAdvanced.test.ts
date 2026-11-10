import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretAssistantQuestion } from '../server/lens/assistantIntent';
import { normalizeAssistantQuestion, transliterateHindi, repairPlace } from '../server/lens/questionNormalizer';
import { buildAssistantSearch, shapeAssistantAnswer, type AssistantRow } from '../server/lens/assistantAnswer';

const NOW = new Date(2026, 10, 10); // 10 Nov 2026

/**
 * OWNER 10 Nov: "ask try1second ai ko bilkul advanced ai bnao jiss pr kissi v tarike se baat kre tho exact
 * 100% correct results laye". These are real phrasings in the four shapes that used to fail:
 * Devanagari, typos, budget words that hijacked the category, and bare product + price.
 * "Correct" here means: right vertical, a Latin search string the merchants can actually answer, and a
 * date only where the vertical has one. Nothing asserts a price, because prices come from the live sweep.
 */
const CASES: { q: string; vertical: string; date?: string }[] = [
  { q: 'delhi se mumbai flight kal', vertical: 'flights', date: '2026-11-11' },
  { q: 'Delhi to Mumbai flight tomorrow', vertical: 'flights', date: '2026-11-11' },
  { q: 'mujhe indore se bhopal bus chahiye parso', vertical: 'bus', date: '2026-11-12' },
  { q: 'cheapest flight to dubai next friday', vertical: 'flights' },
  { q: 'flite delhi mumbai', vertical: 'flights' },
  { q: 'इंदौर से भोपाल बस कल', vertical: 'bus', date: '2026-11-11' },
  { q: 'दिल्ली से मुंबई फ्लाइट का किराया', vertical: 'flights' },
  { q: 'बस इंदौर भोपाल', vertical: 'bus' },
  { q: 'मुंबई में होटल 21 नवंबर', vertical: 'hotels' },
  { q: 'mumbai me hotel 21 november', vertical: 'hotels', date: '2026-11-21' },
  { q: 'goa hotel 2 nights under 3000', vertical: 'hotels' },
  { q: 'sabse sasta hotel indore me', vertical: 'hotels' },
  { q: 'hotal in indor', vertical: 'hotels' },
  { q: 'movie ticket in pvr indore today', vertical: 'movies', date: '2026-11-10' },
  { q: 'बुकमायशो पर पीवीआर का टिकट', vertical: 'movies' },
  { q: 'amul butter kitne ka hai', vertical: 'grocery' },
  { q: 'biryani kaha sasta hai', vertical: 'food' },
  { q: 'chowmein order karna hai', vertical: 'food' },
  { q: 'kahan milega sabse sasta doodh', vertical: 'grocery' },
  { q: 'personal loan 5 lakh interest rate', vertical: 'loans' },
  { q: 'टर्म इंश्योरेंस', vertical: 'insurance' },
  { q: 'best credit card for fuel', vertical: 'creditcards' },
  { q: 'savings account with zero balance', vertical: 'account' },
  { q: 'indore to ujjain cab fare', vertical: 'cab' },
  { q: 'uber indore airport', vertical: 'cab' },
];

test('every phrasing of a question routes to the right vertical', () => {
  const wrong: string[] = [];
  for (const c of CASES) {
    const got = interpretAssistantQuestion(c.q, NOW);
    if (got.vertical !== c.vertical) wrong.push(`"${c.q}" -> ${got.vertical} (want ${c.vertical})`);
  }
  assert.deepEqual(wrong, []);
});

test('a bare brand + price reaches shopping through the honest assumed path', () => {
  for (const q of ['iphone 15 price', 'सस्ता आईफोन', 'redmi note 14 price', 'boat airdopes 141']) {
    const { meta, input } = buildAssistantSearch(q);
    assert.ok(input, `${q} must still be searched`);
    assert.equal(meta.vertical, 'ecommerce', `${q} must end up in shopping`);
    assert.equal(meta.assumedVertical, true, `${q}: the assumption must be stated, not hidden`);
  }
});

test('a domain we do not cover is refused honestly instead of mis-routed', () => {
  const metro = interpretAssistantQuestion('metro card recharge', NOW);
  assert.equal(metro.vertical, null);
  assert.match(metro.reply, /do not compare/);
  const train = interpretAssistantQuestion('train ticket delhi to jaipur', NOW);
  assert.equal(train.vertical, null);
  assert.match(train.reply, /train tickets/);
  // a real vertical is never blocked by that guard
  assert.equal(interpretAssistantQuestion('credit card apply', NOW).vertical, 'creditcards');
  assert.equal(interpretAssistantQuestion('flight delhi goa', NOW).vertical, 'flights');
});

test('a date is attached only to verticals that have one, and only when the user said it', () => {
  for (const c of CASES) {
    const got = interpretAssistantQuestion(c.q, NOW);
    if (c.date) assert.equal(got.date, c.date, `date for "${c.q}"`);
    if (['ecommerce', 'grocery', 'food', 'loans', 'insurance', 'creditcards', 'account'].includes(c.vertical)) {
      assert.equal(got.date, undefined, `"${c.q}" must not invent a travel date`);
    }
  }
});

test('the search string handed to merchants is Latin, never Devanagari', () => {
  for (const c of CASES) {
    const got = interpretAssistantQuestion(c.q, NOW);
    assert.ok(!/[\u0900-\u097F]/.test(got.query), `"${c.q}" left Devanagari in query "${got.query}"`);
    assert.ok(!/[₹]/.test(got.query), `"${c.q}" left a currency symbol in query "${got.query}"`);
  }
});

test('a route question produces "A to B", even when the cities are typed with typos', () => {
  assert.match(interpretAssistantQuestion('flite delhi mumbai', NOW).query, /Delhi to Mumbai/);
  assert.match(interpretAssistantQuestion('इंदौर से भोपाल बस कल', NOW).query, /Indore to Bhopal/);
  assert.equal(repairPlace('indor'), 'Indore');
  assert.equal(repairPlace('mumai'), 'Mumbai');
  // the guard: a Hinglish word one edit away from a place name must never become that place
  assert.equal(repairPlace('kahan'), 'kahan');
  assert.equal(repairPlace('karna'), 'karna');
});

test('a budget is lifted out of the question and never decides the category', () => {
  const n = normalizeAssistantQuestion('goa hotel 2 nights under 3000');
  assert.equal(n.budget, 3000);
  assert.equal(n.keywordVertical, 'hotels');
  assert.match(interpretAssistantQuestion('goa hotel 2 nights under 3000', NOW).query, /Goa/);
  assert.equal(normalizeAssistantQuestion('under 2k hotel goa').budget, 2000);
  assert.equal(normalizeAssistantQuestion('hotel goa').budget, undefined);
});

test('transliteration is word-by-word and leaves unknown words alone', () => {
  const t = transliterateHindi('इंदौर से भोपाल बस कल');
  assert.equal(t.changed, true);
  assert.match(t.text, /Indore se Bhopal bus kal/);
  const unknown = transliterateHindi('इंदौर ज़रूरत');
  assert.match(unknown.text, /Indore/);
  assert.match(unknown.text, /ज़रूरत/); // no invented translation
});

function row(provider: string, price: number, title = 'X'): AssistantRow {
  return { title, provider, price, currency: 'INR', priceAvailable: true } as AssistantRow;
}

test('the answer states the cheapest verified row and never invents a price', () => {
  const rows = [row('Agoda', 4200), row('Yatra', 3100), row('OYO', 2650)];
  const a = shapeAssistantAnswer('hotels', 'Goa', rows);
  assert.equal(a.count, 3);
  const min = Math.min(...rows.map((r) => r.price));
  assert.ok(a.reply.includes(String(min)) || a.reply.includes(min.toLocaleString('en-IN')), a.reply);
  assert.match(a.reply, /OYO/);
});

test('a budget is reported honestly: fit count when it fits, the real cheapest when it does not', () => {
  const fits = shapeAssistantAnswer('hotels', 'Goa', [row('Agoda', 4200), row('OYO', 2650)], { budget: 3000 });
  assert.match(fits.reply, /1 of 2 priced option/);
  const none = shapeAssistantAnswer('hotels', 'Goa', [row('Agoda', 4200), row('OYO', 3400)], { budget: 3000 });
  assert.match(none.reply, /Nothing is inside your/);
  assert.match(none.reply, /3,400/);
  assert.equal(none.count, 2, 'a budget must never hide rows');
});

test('no rows still answers honestly and carries nothing invented', () => {
  const a = shapeAssistantAnswer('hotels', 'Goa', []);
  assert.equal(a.count, 0);
  assert.equal(a.results.length, 0);
  assert.match(a.reply, /No live hotels result/);
  assert.ok(!/₹/.test(a.reply), 'a no-result answer must not show a price');
});
