/**
 * Department browse regression (owner 29 Oct): "tab pr click kr ke smart watch ya kuch v
 * karo, pehle to results nahi aata, phir jab aata hai tab sirf reliance ka bina image wala
 * aa jata hai. results har seller ka aana chahiye."
 *
 * These pin the two faults that caused it:
 *   1. a department label must resolve to a DEPARTMENT, not be judged as a product name
 *      ("Gaming & PS5" was read as "the model must contain 5" and lost 64 of 71 rows);
 *   2. category membership is judged at the product-type position of the title, so the
 *      department's own products survive (a laptop titled "HP 15s-fq5329TU", a watch sold
 *      "with Silicone Strap") while accessories and other devices are withheld
 *      ("iPhone 15 Silicone Case", "Controller Stand", "SanDisk ... SSD").
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  departmentSeedQueries,
  getEcomDepartment,
  listEcomDepartments,
  resolveEcomDepartment,
  rowHasCategoryEvidence,
  rowMatchesDepartment,
} from '../server/lens/ecomDepartments.ts';

test('every department label, shortName and alias resolves to its own department', () => {
  for (const d of listEcomDepartments()) {
    assert.equal(resolveEcomDepartment(d.label)?.id, d.id, `${d.label} resolves`);
    assert.equal(resolveEcomDepartment(d.id)?.id, d.id, `${d.id} resolves`);
    for (const a of d.aliases) assert.equal(resolveEcomDepartment(a)?.id, d.id, `alias "${a}" -> ${d.id}`);
    assert.ok(d.acquisition.trim().length > 2, `${d.label} has an acquisition term`);
  }
  // A real product query must NEVER be mistaken for a department.
  for (const q of ['iphone 15', 'samsung galaxy s24', 'boat rockerz 450', 'sony wh-1000xm5', 'hp 15s-fq5329tu']) {
    assert.equal(resolveEcomDepartment(q), null, `"${q}" is a product, not a department`);
  }
});

test('the queries the warmer pre-builds are exactly the departments (a tab tap is never cold)', () => {
  const seeds = departmentSeedQueries();
  assert.equal(seeds.length, listEcomDepartments().length);
  for (const d of listEcomDepartments()) assert.ok(seeds.includes(d.acquisition), `${d.acquisition} warmed`);
});

test('smartphones: phones survive, accessories and other devices are withheld', () => {
  const d = getEcomDepartment('ecom-smartphones')!;
  for (const keep of [
    'Motorola g37 5G (Pantone Capri, 4GB RAM, 64GB Storage, 12GB RAM)',
    'Apple iPhone 15 (Blue, 128 GB)',
    'Samsung Galaxy M17e 5G Mobile (Vibrant Blue, 128 GB)',
  ]) assert.equal(rowMatchesDepartment(keep, d), true, `keep ${keep}`);

  for (const drop of [
    'iPhone 15 Silicone Case with MagSafe, Black',
    'SanDisk 2TB Creator Phone SSD - Up to 1,000 MB/s',
    'SanDisk E81 1TB Extreme Pro Portable SSD TypeC Smartphone Compatible',
    'Lenovo Laptop Bag 15.6 inch',
  ]) assert.equal(rowMatchesDepartment(drop, d), false, `withhold ${drop}`);
});

test('laptops: model-code titles survive, sleeves and parts do not', () => {
  const d = getEcomDepartment('ecom-laptops')!;
  for (const keep of ['HP 15s-fq5329TU (Core i5 12th Gen/8GB/512GB SSD)', 'Apple MacBook Air (M3, 13 inch, 8GB, 256GB)']) {
    assert.equal(rowMatchesDepartment(keep, d), true, `keep ${keep}`);
    assert.equal(rowHasCategoryEvidence(keep, '', d), true, `evidence ${keep}`);
  }
  for (const drop of ['YOUSTA Men 15 inch Laptop Sleeves', 'Crucial 8GB DDR4 RAM 3200MHz']) {
    assert.equal(rowMatchesDepartment(drop, d), false, `withhold ${drop}`);
  }
});

test('tvs/cameras/storage reject rows whose head names another category', () => {
  const tv = getEcomDepartment('ecom-tvs')!;
  assert.equal(rowMatchesDepartment('Samsung 43 inch Crystal 4K Smart TV', tv), true);
  assert.equal(rowMatchesDepartment('realme Watch 5 1.97 inch AMOLED Display', tv), false);
  assert.equal(rowMatchesDepartment('realme TechLife 8 kg Washing Machine', tv), false);

  const cam = getEcomDepartment('ecom-cameras')!;
  assert.equal(rowMatchesDepartment('Canon EOS R50 Mirrorless Camera', cam), true);
  assert.equal(rowMatchesDepartment('Sony MDR-7506 Professional Wired Headphone', cam), false);
  assert.equal(rowMatchesDepartment('Motorola G06 Power (Pantone Laurel)', cam), false);

  const st = getEcomDepartment('ecom-storage')!;
  assert.equal(rowMatchesDepartment('SanDisk 1TB Extreme Portable SSD', st), true);
  assert.equal(rowMatchesDepartment('Samsung Galaxy M17e 5G Mobile', st), false);
  assert.equal(rowMatchesDepartment('SSD Enclosure 2.5 inch USB 3.0', st), false);
});

test('wearables keep a watch sold with a strap, gaming keeps the console and drops the stand', () => {
  const w = getEcomDepartment('ecom-wearables')!;
  assert.equal(rowMatchesDepartment('Timex Round Shape Smartwatch with Silicone Strap', w), true);
  assert.equal(rowMatchesDepartment('boAt Wave Call 2 Smart Watch 1.83 inch HD', w), true);

  const g = getEcomDepartment('ecom-gaming')!;
  assert.equal(rowMatchesDepartment('Sony PS5 Slim Console (Disc Edition)', g), true);
  assert.equal(rowMatchesDepartment('Wublue Neo Roux Controller Stand | Dual Gamepad Dock', g), false);
});

test('image backfill: a photo of the same product is shared with a photoless sibling row', async () => {
  const { backfillRowImages } = await import('../server/search/productMatchGate.ts');
  const rows: any[] = [
    { id: 'a', title: 'Reliance listing', seller: 'Reliance Digital', canonicalEntityId: 42, imageUrl: undefined, images: [] },
    { id: 'b', title: 'Amazon listing', seller: 'Amazon.in', canonicalEntityId: 42, imageUrl: 'https://m.media-amazon.com/images/I/x.jpg' },
    { id: 'c', title: 'Unrelated', seller: 'Ajio', canonicalEntityId: 99, imageUrl: undefined, images: [] },
  ];
  const out = backfillRowImages(rows);
  assert.equal(out[0].imageUrl, 'https://m.media-amazon.com/images/I/x.jpg', 'photo shared across the same entity');
  assert.equal(out[2].imageUrl, undefined, 'nothing invented for a different entity');
  assert.equal(out[1].imageUrl, 'https://m.media-amazon.com/images/I/x.jpg', 'donor untouched');
});
