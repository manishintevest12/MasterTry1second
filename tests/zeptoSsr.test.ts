/**
 * Zepto SSR rails tests (17 Oct 2026 breakthrough).
 * Parser contract: unescape the RSC payload, extract product records via the
 * "productVariant":{"formattedPacksize" anchor, prices are PAISE, filter client-side.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseZeptoSsr, zeptoSsrMatches, unescapeZeptoRsc } from '../server/workers/parsers/zeptoSsr';

// Real-shaped snippet from /brand/amul (17 Oct): double-escaped RSC payload.
const FIXTURE_ESCAPED = String.raw`{\"prices\":[{\"discountedSellingPrice\":2000,\"pricingEntity\":\"SUPER_SAVER\"}],\"primaryCategoryName\":\"Dairy\",\"product\":{\"brand\":\"Amul\",\"brandId\":\"b27a7a24\",\"description\":[\"Amul Gold Full Cream Fresh Milk\"],\"id\":\"5f6f8fef\",\"name\":\"Amul Gold Full Cream Fresh Milk\"},\"productVariant\":{\"formattedPacksize\":\"1 pack (500 ml)\",\"id\":\"228eee59-8859-49d0-90b6-769230cae2bf\",\"images\":[{\"height\":3000,\"path\":\"cms/product_variant/f539e0b3-c559-40d0-bca9-71e9be7f4eff.jpeg\",\"width\":3000}],\"mrp\":3400,\"packsize\":500},\"availableQuantity\":9}`;
// Same record, already unescaped.
const FIXTURE = `...{"prices":[{"discountedSellingPrice":2000}],"product":{"brand":"Amul","name":"Amul Gold Full Cream Fresh Milk"},"productVariant":{"formattedPacksize":"1 pack (500 ml)","id":"228eee59-8859-49d0-90b6-769230cae2bf","images":[{"path":"cms/product_variant/f539e0b3-c559-40d0-bca9-71e9be7f4eff.jpeg"}],"mrp":3400},"availableQuantity":9}...`;

test('unescapeZeptoRsc converts escaped payload to raw JSON text', () => {
  const u = unescapeZeptoRsc(FIXTURE_ESCAPED);
  assert.ok(u.includes('"productVariant":{"formattedPacksize"'));
  assert.ok(!u.includes('\\"'));
});

test('parseZeptoSsr extracts brand, name, paise price, mrp, pack, image, stock', () => {
  const prods = parseZeptoSsr(FIXTURE);
  assert.equal(prods.length, 1);
  const p = prods[0];
  assert.equal(p.brand, 'Amul');
  assert.equal(p.name, 'Amul Gold Full Cream Fresh Milk');
  assert.equal(p.price, 20); // 2000 paise
  assert.equal(p.mrp, 34); // 3400 paise
  assert.equal(p.pack, '1 pack (500 ml)');
  assert.equal(p.variantId, '228eee59-8859-49d0-90b6-769230cae2bf');
  assert.ok(p.image!.startsWith('https://cdn.zeptonow.com/production/cms/product_variant/'));
  assert.equal(p.availableQuantity, 9);
});

test('parseZeptoSsr dedupes by variant id and skips priceless records', () => {
  const dup = FIXTURE.slice(3) + FIXTURE.slice(3);
  const prods = parseZeptoSsr(dup);
  assert.equal(prods.length, 1);
  const noPrice = `..."product":{"brand":"X","name":"Ghost Product"},"productVariant":{"formattedPacksize":"1 pc"}...`;
  assert.equal(parseZeptoSsr(noPrice).length, 0);
});

test('zeptoSsrMatches plural-stem substring filter', () => {
  const p = { brand: 'Amul', name: 'Gold Full Cream Fresh Milk', price: 20 };
  assert.ok(zeptoSsrMatches('milk', p));
  assert.ok(zeptoSsrMatches('amul milks', p));
  assert.ok(!zeptoSsrMatches('butter', p));
});

test('escaped fixture parses after unescape inside parseZeptoSsr (double-escaped input tolerated)', () => {
  const prods = parseZeptoSsr(FIXTURE_ESCAPED);
  assert.ok(prods.length >= 1);
  assert.equal(prods[0].price, 20);
});
