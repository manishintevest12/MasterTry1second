import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MASTER_SYSTEM_PROMPT, MASTER_JSON_CONTRACT, MASTER_TEMPERATURE, MASTER_MODEL,
  SITE_URL, VERTICAL_GUIDE, VERTICAL_IDS, ZERO_RESULT_GUIDANCE, exactPackUnavailable,
} from '../server/ai/masterPrompt';
import { validateAiIntent, mergeAiIntent } from '../server/lens/assistantAi';
import { interpretAssistantQuestion } from '../server/lens/assistantIntent';

/**
 * OWNER 18 Nov: "यह प्रॉम्प्ट ... स्पेलिंग मिस्टेक, क्वांटिटी की गलती, और सभी 13 वर्टिकल्स
 * से सही डेटा लाने के साथ-साथ यह भी संभालेगा कि जब कोई रिजल्ट न मिले, तो AI क्या जवाब दे."
 * The prompt is code now, so its promises are testable.
 */

test('the prompt covers the 13 verticals and the offer ids the engine actually routes to', () => {
  assert.equal(VERTICAL_GUIDE.length, 13, '13 verticals as the owner listed them');
  const names = VERTICAL_GUIDE.map((v) => v.name);
  for (const n of ['10-Min Grocery', 'E-Commerce', 'Flights', 'Hotels', 'Bus', 'Food Delivery', 'Cabs & Ride-Hailing', 'Movies', 'Loans', 'Insurance', 'Credit Cards', 'Accounts', 'Nearby']) {
    assert.ok(names.includes(n), `missing ${n}`);
  }
  for (const id of ['coupons', 'giftcards', 'banking']) assert.ok(VERTICAL_IDS.includes(id), id);
  for (const v of VERTICAL_GUIDE) assert.ok(MASTER_SYSTEM_PROMPT.includes(v.name), v.name);
});

test('low temperature, and the prompt forbids inventing prices or stock', () => {
  assert.equal(MASTER_TEMPERATURE, 0.1);
  assert.equal(MASTER_MODEL, 'gemini-2.5-flash');
  assert.match(MASTER_SYSTEM_PROMPT, /never state a price/i);
  assert.match(MASTER_SYSTEM_PROMPT, /never invent/i);
  assert.match(MASTER_SYSTEM_PROMPT, /PARSER, not a shop/i);
});

test('quantity preservation is unconditional in the prompt and in the contract', () => {
  assert.match(MASTER_SYSTEM_PROMPT, /Never change, downgrade or drop a quantity/i);
  assert.match(MASTER_SYSTEM_PROMPT, /10 kg atta" means 10 kg \(10,000 g\)/i);
  assert.match(MASTER_JSON_CONTRACT, /Never change a stated quantity/);
  assert.doesNotMatch(MASTER_SYSTEM_PROMPT, /1 kg or 5 kg pack is the answer/i);
});

test('only the real site is linked: no invented deep links, no api/out tokens', () => {
  const urls = MASTER_SYSTEM_PROMPT.match(/https?:\/\/[^\s)"']+/g) || [];
  assert.ok(urls.length > 0);
  for (const u of urls) assert.ok(u.startsWith(SITE_URL), `unexpected URL in prompt: ${u}`);
  assert.doesNotMatch(MASTER_SYSTEM_PROMPT, /api\/out\?t=/);
});

test('the zero-result answer is actionable, never a bare "no results"', () => {
  assert.doesNotMatch(ZERO_RESULT_GUIDANCE, /^No results/i);
  assert.match(ZERO_RESULT_GUIDANCE, /nearby city or locality/i);
  assert.match(ZERO_RESULT_GUIDANCE, new RegExp(SITE_URL.replace(/[.]/g, '\\.')));
  assert.match(exactPackUnavailable('10 kg'), /^Exact 10 kg pack is currently unavailable across our partner platforms\. Here are the closest available alternatives:$/);
});

test('AI output is filtered: no price, stock, seller or bogus vertical gets through', () => {
  const ok = validateAiIntent({ vertical: 'grocery', query: 'aata', price: 999, stock: 5, seller: 'Blinkit', url: 'https://evil.example' });
  assert.ok(ok);
  assert.equal(ok!.vertical, 'grocery');
  for (const k of ['price', 'stock', 'seller', 'url']) assert.ok(!(k in (ok as any)), `${k} must be dropped`);
  assert.equal(validateAiIntent({ vertical: 'not_a_vertical', query: 'atta' })!.vertical, null, 'unknown vertical is dropped, not routed');
  assert.equal(validateAiIntent({ vertical: 'grocery', query: '' }), null);
  assert.equal(validateAiIntent(null), null);
  assert.equal(validateAiIntent({ vertical: 'grocery', query: 'milk', budget: 120 })!.budget, 120);
  assert.equal(validateAiIntent({ vertical: 'grocery', query: 'milk', budget: -5 })!.budget, undefined);
});

test('the AI only fills gaps: it cannot override a confident deterministic route', () => {
  const base = interpretAssistantQuestion('mumbai se delhi flight kal');
  assert.equal(base.understood, true);
  const merged = mergeAiIntent(base, { vertical: 'hotels', query: 'hotel delhi', city: 'Delhi' });
  assert.equal(merged.vertical, base.vertical, 'deterministic vertical wins');
  assert.equal(merged.query, base.query, 'deterministic query wins');
  assert.equal(merged.date, base.date);
});

test('the AI rescues a question the rules could not place', () => {
  const base = interpretAssistantQuestion('zzqx phlange');
  const merged = mergeAiIntent(base, { vertical: 'grocery', query: 'paneer', repaired: ['zzqx->paneer'] });
  assert.equal(merged.vertical, 'grocery');
  assert.equal(merged.understood, true);
  assert.equal(merged.normalized?.repaired?.[0], 'zzqx->paneer');
});
