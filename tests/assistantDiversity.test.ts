import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diversifyByProvider, toAssistantRows } from '../server/lens/assistantAnswer';

/**
 * Owner 29 Oct ("abhi ek hi company jaise dekho blinkit se sb item bata raha hai, yaha sb company
 * ka dikhana chaiye tha"): the assistant grid must show every company that answered, not the
 * cheapest six rows of one seller. These tests pin that mix and the honest fallbacks.
 */

const row = (provider: string, price: number, title = `${provider} item ${price}`) => ({ provider, price, priceAvailable: price > 0, currency: 'INR', vertical: 'grocery', title });

test('one best row per provider comes first, cheapest provider leading', () => {
  const rows = [
    row('Blinkit', 89), row('Blinkit', 92), row('Blinkit', 95), row('Blinkit', 99),
    row('Zepto', 91), row('Zepto', 120),
    row('BigBasket', 105), row('Instamart', 110),
  ];
  const out = diversifyByProvider(rows, 6);
  assert.equal(out.length, 6);
  // Three companies up front (Blinkit cheapest, then Zepto, BigBasket, Instamart by own best).
  assert.deepEqual(out.slice(0, 4).map((r) => r.provider), ['Blinkit', 'Zepto', 'BigBasket', 'Instamart']);
  // Then the second round fills the rest.
  assert.equal(out[4].provider, 'Blinkit');
  assert.equal(out[5].provider, 'Zepto');
  // Every row keeps its own real price.
  assert.equal(out[0].price, 89);
  assert.equal(out[1].price, 91);
});

test('a single seller still fills the grid (no invented companies)', () => {
  const rows = Array.from({ length: 8 }, (_, i) => row('Blinkit', 50 + i));
  const out = diversifyByProvider(rows, 6);
  assert.equal(out.length, 6);
  assert.ok(out.every((r) => r.provider === 'Blinkit'));
});

test('unpriced rows sort last but are never dropped when needed', () => {
  const rows = [row('Zepto', 0), row('Blinkit', 70)];
  const out = diversifyByProvider(rows, 2);
  assert.equal(out[0].provider, 'Blinkit');
  assert.equal(out[1].provider, 'Zepto');
});

test('toAssistantRows with diversify keeps multiple providers in the visible six', () => {
  const offers = [
    ...Array.from({ length: 10 }, (_, i) => ({ title: `Tata Sampann Moong ${i}`, vendor: 'Blinkit', prices: { finalPayablePrice: 80 + i } })),
    { title: 'Moong Dal 1kg', vendor: 'Zepto', prices: { finalPayablePrice: 99 } },
    { title: 'Moong Dal 1kg BigBasket', vendor: 'BigBasket', prices: { finalPayablePrice: 101 } },
  ];
  const flat = toAssistantRows(offers, 6);
  const mixed = toAssistantRows(offers, 6, { diversify: true });
  assert.equal(flat.length, 6);
  assert.equal(new Set(flat.map((r) => r.provider)).size, 1); // old behaviour: one company only
  assert.equal(new Set(mixed.map((r) => r.provider)).size, 3); // new behaviour: all three
});

test('diversify never exceeds the limit or duplicates rows', () => {
  const rows = [...Array.from({ length: 5 }, (_, i) => row('A', 10 + i)), ...Array.from({ length: 5 }, (_, i) => row('B', 20 + i))];
  const out = diversifyByProvider(rows, 4);
  assert.equal(out.length, 4);
  assert.equal(new Set(out.map((r) => r.title)).size, 4);
});
