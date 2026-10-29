/**
 * Ask Try1Second AI — category routing (owner 28 Oct).
 *
 * The owner asked "aata sbse sasta kaha hai" and got "I could not pin a single
 * category, so I am comparing 'aata sbse kaha' across every shopping site", and
 * "biryani kaha sasta milega" was not sent to the Food vertical at all. Aata is a
 * 10-minute grocery staple, biryani is a food order: the assistant has to route
 * those to their own vertical and put only the product words in the search box.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildAssistantSearch } from '../server/lens/assistantAnswer';
import { cleanCategoryQuery, detectCategoryVertical } from '../server/lens/verticalLexicon';
import { interpretAssistantQuestion } from '../server/lens/assistantIntent';

const route = (q: string) => buildAssistantSearch(q, { city: 'Indore' });

test('grocery staples route to the 10-minute Grocery vertical, not e-commerce', () => {
  const cases: Array<[string, string]> = [
    ['aata sbse sasta kaha hai', 'atta'],
    ['atta ka price kya hai', 'atta'],
    ['kahan milega sabse sasta doodh', 'milk'],
    ['milk 1l price', 'milk 1l'],
    ['amul butter 500g', 'amul butter 500g'],
    ['chicken 500g', 'chicken 500g'],
    ['detergent sabse sasta', 'detergent'],
    ['maggi noodles ka rate', 'maggi noodles'],
  ];
  for (const [text, expectedQuery] of cases) {
    const { meta, input } = route(text);
    assert.equal(meta.vertical, 'grocery', `${text} -> grocery`);
    assert.equal(input?.vertical, 'grocery', `${text} -> engine vertical`);
    assert.equal(input?.query, expectedQuery, `${text} -> query`);
  }
});

test('dishes and restaurant food route to the Food vertical', () => {
  const cases: Array<[string, string]> = [
    ['biryani kaha sasta milega', 'biryani'],
    ['chicken biryani', 'chicken biryani'],
    ['paneer pizza near me', 'paneer pizza'],
    ['chowmein order karna hai', 'chowmein'],
    ['cold coffee', 'cold coffee'],
    ['momos', 'momos'],
  ];
  for (const [text, expectedQuery] of cases) {
    const { meta, input } = route(text);
    assert.equal(meta.vertical, 'food', `${text} -> food`);
    assert.equal(input?.query, expectedQuery, `${text} -> query`);
  }
});

test('a dish beats a staple: chicken biryani is food, chicken 500g is grocery', () => {
  assert.equal(detectCategoryVertical('chicken biryani'), 'food');
  assert.equal(detectCategoryVertical('chicken 500g'), 'grocery');
  assert.equal(detectCategoryVertical('paneer pizza'), 'food');
  assert.equal(detectCategoryVertical('paneer'), 'grocery');
});

test('bare products still go to shopping (the lexicon must not over-route)', () => {
  for (const text of ['iphone 15', 'samsung tv ka price', 'nike shoes', 'laptop bag', 'sony headphones']) {
    const { meta } = route(text);
    assert.equal(meta.vertical, 'ecommerce', `${text} -> ecommerce`);
  }
});

test('an explicitly named vertical is never overridden by the lexicon', () => {
  const cases: Array<[string, string]> = [
    ['Delhi to Mumbai flight', 'flights'],
    ['hotels in Goa', 'hotels'],
    ['Indore to Bhopal bus', 'bus'],
    ['movie tickets in Indore', 'movies'],
  ];
  for (const [text, expected] of cases) {
    assert.equal(route(text).meta.vertical, expected, text);
  }
});

test('the search box never receives the question wrapper', () => {
  const junk = /\b(kaha|kahan|milega|milegi|sasta|sabse|cheapest|hai|price|rate|kitna)\b/i;
  for (const text of ['aata sbse sasta kaha hai', 'biryani kaha sasta milega', 'doodh ka price kya hai']) {
    const q = route(text).input?.query || '';
    assert.ok(q.length >= 2, `${text} -> non-empty query`);
    assert.doesNotMatch(q, junk, `${text} -> "${q}" must be product words only`);
  }
});

test('the bubble copy names the vertical that actually answers', () => {
  const grocery = interpretAssistantQuestion('aata sbse sasta kaha hai');
  assert.equal(grocery.vertical, 'grocery');
  assert.match(grocery.reply, /grocery staple|10-minute/i);
  assert.doesNotMatch(grocery.reply, /could not pin|every shopping site/i);

  const food = interpretAssistantQuestion('biryani kaha sasta milega');
  assert.equal(food.vertical, 'food');
  assert.match(food.reply, /food order|restaurant/i);
});

test('cleanCategoryQuery keeps quantities and brands, drops the question', () => {
  assert.equal(cleanCategoryQuery('aata sbse sasta kaha hai'), 'atta');
  assert.equal(cleanCategoryQuery('Amul Butter 500g kahan milega?'), 'Amul Butter 500g');
  assert.equal(cleanCategoryQuery('zomato se biryani'), 'biryani');
  assert.equal(cleanCategoryQuery('blinkit pe doodh'), 'milk');
});
