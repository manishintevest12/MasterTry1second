import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeSpend, validateEntry, type SpendEntry } from '../server/spend/spendLens';

const e = (id: number, merchant: string, amount: number, entryDate: string): SpendEntry =>
  ({ id, merchant, amount, entryDate, source: 'manual' });

test('spend lens: validation refuses bad input honestly', () => {
  assert.equal(validateEntry({ userId: 1, merchant: 'Amazon.in', amount: 999, entryDate: '2026-10-13' }).ok, true);
  assert.equal(validateEntry({ userId: 0, merchant: 'Amazon.in', amount: 999, entryDate: '2026-10-13' }).ok, false);
  assert.equal(validateEntry({ userId: 1, merchant: '', amount: 999, entryDate: '2026-10-13' }).ok, false);
  assert.equal(validateEntry({ userId: 1, merchant: '<script>x', amount: 999, entryDate: '2026-10-13' }).ok, false);
  assert.equal(validateEntry({ userId: 1, merchant: 'Amazon.in', amount: 0, entryDate: '2026-10-13' }).ok, false);
  assert.equal(validateEntry({ userId: 1, merchant: 'Amazon.in', amount: -5, entryDate: '2026-10-13' }).ok, false);
  assert.equal(validateEntry({ userId: 1, merchant: 'Amazon.in', amount: 999, entryDate: '13/10/2026' }).ok, false);
  assert.equal(validateEntry({ userId: 1, merchant: 'Amazon.in', amount: 999, entryDate: '2099-01-01' }).ok, false);
});

test('spend lens: totals, per-merchant ranking and monthly trend', () => {
  const entries = [
    e(1, 'Amazon.in', 1000, '2026-09-02'),
    e(2, 'Amazon.in', 500, '2026-09-15'),
    e(3, 'Myntra', 800, '2026-10-01'),
    e(4, 'Flipkart', 300, '2026-08-20'),
    e(5, 'Swiggy', 250, '2026-10-05'),
  ];
  const s = summarizeSpend(entries);
  assert.equal(s.total, 2850);
  assert.equal(s.entries, 5);
  // Amazon (1500) first, Myntra (800) second
  assert.equal(s.byMerchant[0].merchant, 'Amazon.in');
  assert.equal(s.byMerchant[0].total, 1500);
  assert.equal(s.byMerchant[0].count, 2);
  assert.equal(s.byMerchant[1].merchant, 'Myntra');
  // Monthly trend oldest-first, capped at 12 months
  assert.deepEqual(s.byMonth, [
    { month: '2026-08', total: 300 },
    { month: '2026-09', total: 1500 },
    { month: '2026-10', total: 1050 },
  ]);
});

test('spend lens: empty state is honest zeros, no fabricated data', () => {
  const s = summarizeSpend([]);
  assert.equal(s.total, 0);
  assert.equal(s.entries, 0);
  assert.deepEqual(s.byMerchant, []);
  assert.deepEqual(s.byMonth, []);
});
