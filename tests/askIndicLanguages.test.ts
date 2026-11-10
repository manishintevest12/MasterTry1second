import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretAssistantQuestion } from '../server/lens/assistantIntent';
import { translateIndic, detectIndicScript } from '../server/lens/indicLexicon';
import { normalizeAssistantQuestion } from '../server/lens/questionNormalizer';
import { questionSignature, recallQuestionRoute } from '../server/lens/searchMemory';

const NOW = new Date(2026, 10, 10);

/**
 * OWNER 10 Nov: "ab aise hi pure india ke language mai isko kro jiss se ki v language ka aadmi iss se
 * baat kr ke results le kr aa jaayega" - a person should get results in their own language, typed either in
 * their script or romanised.
 */
const LANGUAGE_CASES: { q: string; vertical: string; lang: string }[] = [
  { q: 'কলকাতায় সস্তা হোটেল', vertical: 'hotels', lang: 'bengali' },
  { q: 'চেন্নাই থেকে দিল্লি ফ্লাইট', vertical: 'flights', lang: 'bengali' },
  { q: 'અમદાવાદમાં સસ્તું હોટેલ', vertical: 'hotels', lang: 'gujarati' },
  { q: 'ਅੰਮ੍ਰਿਤਸਰ ਤੋਂ ਦਿੱਲੀ ਫਲਾਈਟ', vertical: 'flights', lang: 'gurmukhi' },
  { q: 'சென்னைல ஹோட்டல் வேணும்', vertical: 'hotels', lang: 'tamil' },
  { q: 'சென்னையிலிருந்து மதுரை பஸ்', vertical: 'bus', lang: 'tamil' },
  { q: 'హైదరాబాద్లో చవకైన హోటల్', vertical: 'hotels', lang: 'telugu' },
  { q: 'ಬೆಂಗಳೂರಿನಲ್ಲಿ ಹೋಟೆಲ್ ಎಷ್ಟು', vertical: 'hotels', lang: 'kannada' },
  { q: 'കൊച്ചിയിൽ ഹോട്ടൽ വില', vertical: 'hotels', lang: 'malayalam' },
  { q: 'ଭୁବନେଶ୍ୱରରେ ଶସ୍ତା ହୋଟେଲ', vertical: 'hotels', lang: 'odia' },
  { q: 'دہلی سے ممبئی فلائٹ', vertical: 'flights', lang: 'urdu' },
  { q: 'لکھنؤ میں سستا ہوٹل', vertical: 'hotels', lang: 'urdu' },
];

test('every Indian script is understood, in its own script', () => {
  for (const c of LANGUAGE_CASES) {
    assert.equal(detectIndicScript(c.q), c.lang, `${c.q} script detection`);
    const got = interpretAssistantQuestion(c.q, NOW);
    assert.equal(got.vertical, c.vertical, `"${c.q}" routed to ${got.vertical}`);
    assert.ok(!/[\u0900-\u0DFF\u0600-\u06FF]/.test(got.query), `"${c.q}" left native script in "${got.query}"`);
  }
});

test('romanised Indian languages work too (how people actually type)', () => {
  const cases: [string, string][] = [
    ['chennai la hotel venum', 'hotels'],
    ['kolkata te sosta hotel koto', 'hotels'],
    ['mumbai madhe hotel kiti', 'hotels'],
    ['bangalore alli hotel beku', 'hotels'],
    ['hyderabad lo hotel kavali', 'hotels'],
  ];
  for (const [q, want] of cases) {
    assert.equal(interpretAssistantQuestion(q, NOW).vertical, want, q);
  }
});

test('translation never invents: unmapped words stay as the user typed them', () => {
  const out = translateIndic('chennai la hotel venum');
  assert.match(out.text, /hotel/);
  assert.equal(out.changed, true);
  const unknown = translateIndic('சென்னை zzzqq');
  assert.match(unknown.text, /zzzqq/);
});

test('the owner screenshot: "Indore mein kam price ke Cosmetic" is understood as cosmetics', () => {
  for (const q of ['Indore mein kam price ke Cosmetic', 'cosmetic items for range are available', 'indore me sasta cosmetics']) {
    const got = interpretAssistantQuestion(q, NOW);
    assert.equal(got.vertical, 'ecommerce', q);
    // the city must never ride along in a product search that made Shopsy answer with a jewellery box
    assert.equal(got.query, 'cosmetics', `${q} -> ${got.query}`);
  }
  // a real budget is still carried, and still never decides the category
  const withBudget = interpretAssistantQuestion('best cosmetic under 500', NOW);
  assert.equal(withBudget.vertical, 'ecommerce');
  assert.equal(withBudget.budget, 500);
  assert.equal(withBudget.query, 'cosmetics');
  // and a city inside a product question is not dropped from a LOCATION-sensitive vertical
  assert.match(interpretAssistantQuestion('indore me sasta milk', NOW).query, /milk/i);
});

test('question signatures are stable so a remembered route is found again', () => {
  assert.equal(questionSignature('Indore mein kam price ke Cosmetic!'), questionSignature('indore mein kam price ke cosmetic'));
  assert.notEqual(questionSignature('hotel in goa'), questionSignature('flight to goa'));
  const n = normalizeAssistantQuestion('சென்னைல ஹோட்டல் வேணும்');
  assert.equal(n.language, 'tamil');
});

test('a remembered route is looked up without throwing when the table is empty', async () => {
  const learned = await recallQuestionRoute('a question never asked before 12345');
  assert.equal(learned, null);
});
