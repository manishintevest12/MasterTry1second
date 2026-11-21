import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addLine, cartKey, cartTotals, groupByPartner, loadCart, qtyOf, removeLine, saveCart, setQty, MAX_QTY,
} from '../src/lib/groceryCart';

/**
 * OWNER 20 Nov: "hr card pr partner website ka naam, order now button and add to cart functionality" for the
 * 10-min grocery vertical on web AND app. These tests pin the basket rules: the same product from a different
 * partner is a different line, quantities clamp, and the total is the sum of the prices the shopper saw.
 */

const attaZepto = { key: cartKey('Aashirvaad Atta', '5 kg', 'Zepto'), title: 'Aashirvaad Atta', unit: '5 kg', price: 321, mrp: 450, partner: 'Zepto' };
const attaBlinkit = { key: cartKey('Aashirvaad Atta', '5 kg', 'Blinkit'), title: 'Aashirvaad Atta', unit: '5 kg', price: 330, mrp: 450, partner: 'Blinkit' };

test('the same product from two partners is two lines, not one', () => {
  let cart = addLine([], attaZepto);
  cart = addLine(cart, attaBlinkit);
  assert.equal(cart.length, 2);
  assert.equal(cart[0].partner, 'Zepto');
  assert.equal(cart[1].partner, 'Blinkit');
});

test('adding the same product from the same partner increments instead of duplicating', () => {
  let cart = addLine([], attaZepto);
  cart = addLine(cart, attaZepto);
  cart = addLine(cart, attaZepto);
  assert.equal(cart.length, 1);
  assert.equal(cart[0].qty, 3);
});

test('quantity clamps at the cap and at zero', () => {
  let cart = addLine([], attaZepto, 1);
  cart = setQty(cart, attaZepto.key, 999);
  assert.equal(cart[0].qty, MAX_QTY);
  cart = setQty(cart, attaZepto.key, 0);
  assert.equal(cart.length, 0, 'zero removes the line');
});

test('totals are the prices the shopper saw, with the saving shown honestly', () => {
  let cart = addLine([], attaZepto);
  cart = addLine(cart, { ...attaBlinkit, title: 'Amul Butter', unit: '500 g', price: 62, mrp: 66 });
  cart = setQty(cart, cartKey('Aashirvaad Atta', '5 kg', 'Zepto'), 2);
  const t = cartTotals(cart);
  assert.equal(t.units, 3);
  assert.equal(t.total, 321 * 2 + 62);
  assert.equal(t.mrpTotal, 450 * 2 + 66);
  assert.equal(t.saving, 450 * 2 + 66 - (321 * 2 + 62));
});

test('lines are grouped by the partner they will be ordered from', () => {
  let cart = addLine([], attaZepto);
  // a different product needs its own key, which is exactly what the card computes for every card
  cart = addLine(cart, { ...attaZepto, title: 'Milk', unit: '1 L', price: 60, key: cartKey('Milk', '1 L', 'Zepto') });
  cart = addLine(cart, attaBlinkit);
  const groups = groupByPartner(cart);
  assert.equal(groups.length, 2);
  const zepto = groups.find((g) => g.partner === 'Zepto')!;
  assert.equal(zepto.lines.length, 2);
  assert.equal(zepto.subtotal, 381);
});

test('removing a line leaves the rest untouched', () => {
  let cart = addLine([], attaZepto);
  cart = addLine(cart, attaBlinkit);
  cart = removeLine(cart, attaZepto.key);
  assert.equal(cart.length, 1);
  assert.equal(qtyOf(cart, attaBlinkit.key), 1);
});

test('a basket survives a reload and rejects junk from storage', () => {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v; },
  };
  const cart = addLine([], attaZepto);
  saveCart(cart);
  assert.equal(loadCart().length, 1);
  assert.equal(loadCart()[0].partner, 'Zepto');

  store['t1s_grocery_cart_v1'] = JSON.stringify([{ title: '' }, null, { title: 'Ok', qty: 999, price: 'x' }]);
  const cleaned = loadCart();
  assert.equal(cleaned.length, 1, 'a line with no title is dropped');
  assert.equal(cleaned[0].qty, MAX_QTY, 'an absurd qty is clamped');
  assert.equal(cleaned[0].price, 0, 'a non-numeric price is not trusted');
});
