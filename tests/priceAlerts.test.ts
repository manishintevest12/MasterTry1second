import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAlert, createAlert, listAlerts, deleteAlert, shouldNotify, checkAlertsOnce, alertEmail } from '../server/lens/priceAlerts';

const U = 700000 + Math.floor(Math.random() * 90000);
const base = { userId: U, email: 'a@b.co', productTitle: 'Apple iPhone 17 (Black, 256 GB)', searchQuery: 'Apple iPhone 17 256GB', targetPrice: 80000, priceAtSet: 86999 };

test('alerts: validation rejects bad input honestly', () => {
  assert.equal(validateAlert({ ...base, userId: 0 }).ok, false);
  assert.equal(validateAlert({ ...base, email: 'nope' }).ok, false);
  assert.equal(validateAlert({ ...base, targetPrice: 0 }).ok, false);
  assert.equal(validateAlert({ ...base, targetPrice: 90000 }).ok, false); // not below current
  assert.equal(validateAlert(base).ok, true);
});

test('alerts: create, same product updates instead of duplicating, list, delete', async () => {
  const a = await createAlert(base);
  assert.equal(a.ok, true);
  const b = await createAlert({ ...base, targetPrice: 78000 });
  assert.equal(b.ok, true);
  assert.equal(b.id, a.id);
  const mine = await listAlerts(U);
  assert.equal(mine.length, 1);
  assert.equal(Number(mine[0].target_price), 78000);
  assert.equal(await deleteAlert(U + 1, Number(a.id)), false); // someone else's alert
  assert.equal(await deleteAlert(U, Number(a.id)), true);
  assert.equal((await listAlerts(U)).length, 0);
});

test('alerts: fires only when a verified live price is at or below target, and only once', async () => {
  assert.equal(shouldNotify({ target_price: 80000 }, 79999), true);
  assert.equal(shouldNotify({ target_price: 80000 }, 80001), false);
  assert.equal(shouldNotify({ target_price: 80000 }, 0), false);
  assert.equal(shouldNotify({ target_price: 80000, notified_at: '2026-10-14' }, 70000), false);
});

test('alerts: no live price => no e-mail attempt and the alert stays armed', async () => {
  await createAlert({ ...base, userId: U + 10, searchQuery: 'nothing found query' });
  const r = await checkAlertsOnce(async () => null, 'https://www.try1second.com');
  assert.equal(r.notified, 0);
  const mine = await listAlerts(U + 10);
  assert.equal(mine.length, 1);
  assert.ok(!mine[0].notified_at);
  await deleteAlert(U + 10, Number(mine[0].id));
});

test('alerts: e-mail text carries the real price, seller and escapes HTML', () => {
  const m = alertEmail({ product_title: '<b>iPhone</b> 17', target_price: 80000 }, 79500, 'Flip&kart', 'https://x.test/go');
  assert.match(m.subject, /79,500/);
  assert.ok(!m.html.includes('<b>iPhone</b>'));
  assert.match(m.html, /Flip&amp;kart/);
});
