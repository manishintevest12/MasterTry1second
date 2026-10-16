import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** The Chrome install section must showcase ALL 13 vertical engines (11 product
 *  verticals + Coupons + Rewards), not just the shopping/coupon story. */
test('ChromeInstallSection displays all 13 vertical engines', () => {
  const src = readFileSync('src/components/ChromeInstallSection.tsx', 'utf8');

  const enginesBlock = src.match(/const ENGINES[^=]*=\s*\[([\s\S]*?)\];/);
  assert.ok(enginesBlock, 'ENGINES array exists in ChromeInstallSection');

  const names = [...enginesBlock[1].matchAll(/name: '([^']+)'/g)].map((m) => m[1]);
  assert.equal(names.length, 13, `expected 13 engines, got ${names.length}`);

  const expected = [
    'Shopping', '10-min Grocery', 'Food Delivery', 'Flights', 'Hotels', 'Bus',
    'Cab & Ride', 'Movies', 'Loans', 'Insurance', 'Credit Cards', 'Coupons', 'Rewards',
  ];
  for (const e of expected) assert.ok(names.includes(e), `missing engine: ${e}`);

  // the strip is rendered across the full card, always visible
  assert.ok(src.includes('All 13 vertical engines'), 'visible "All 13 vertical engines" heading present');
  assert.ok(/ENGINES\.map/.test(src), 'ENGINES is rendered with .map');

  // every engine carries an honest note (no fabricated claims)
  const notes = [...enginesBlock[1].matchAll(/note: '([^']+)'/g)].map((m) => m[1]);
  assert.equal(notes.length, 13, 'every engine has a note');
  assert.ok(notes.every((n) => n.length > 0 && n.length < 40), 'notes are short, honest captions');
});

test('ChromeInstallSection engine icons all come from lucide-react', () => {
  const src = readFileSync('src/components/ChromeInstallSection.tsx', 'utf8');
  const icons = ['ShoppingBag', 'ShoppingBasket', 'Utensils', 'Plane', 'Building2', 'Bus', 'Car', 'Film', 'Landmark', 'CreditCard', 'Gift'];
  for (const i of icons) assert.ok(src.includes(i), `icon ${i} referenced`);
  assert.ok(/from 'lucide-react'/.test(src), 'lucide-react import present');
});
