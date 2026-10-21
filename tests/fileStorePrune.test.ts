/**
 * Regression (owner bug, 21 Oct): Coupons tab went EMPTY on production for days.
 * Root cause: FileStore's mini SQL parser only understood "= ?" — the retention
 * prune `DELETE ... WHERE last_seen_at < ?` and affiliate expiry
 * `UPDATE ... WHERE expires_at < NOW()` fell through to a permissive `true`,
 * wiping/expiring ENTIRE tables on file-fallback storage every cycle.
 * These tests pin the fixed operator support and the conservative fallback.
 */
import { test } from 'node:test';
import assert from 'node:assert';

// Isolation BEFORE importing db.ts: settings.dataDir picks `.data-tests/<pid>`
// when NODE_ENV=test, so these tests never touch the real .data/devstore.json
// (an earlier run pruned REAL sandbox affiliate rows as a side effect).
process.env.NODE_ENV = 'test';
const { FileStore } = await import('../server/common/db');

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 19).replace('T', ' ');
}
function isoDaysAhead(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 19).replace('T', ' ');
}

test('retention prune deletes ONLY rows older than the cutoff — never the whole table', async () => {
  const s = new FileStore(); await s.execute('DELETE FROM affiliate_offers', []);
  await s.execute(
    `INSERT INTO affiliate_offers (id, merchant_name, coupon_code, last_seen_at, status) VALUES (?, ?, ?, ?, ?)`,
    [1, 'Fresh Merchant', 'FRESH10', new Date().toISOString().slice(0, 19).replace('T', ' '), 'active'],
  );
  await s.execute(
    `INSERT INTO affiliate_offers (id, merchant_name, coupon_code, last_seen_at, status) VALUES (?, ?, ?, ?, ?)`,
    [2, 'Stale Merchant', 'STALE10', isoDaysAgo(10), 'active'],
  );

  // The exact shape the retention prune uses (batchedDelete wraps LIMIT).
  const res = await s.execute(
    `DELETE FROM affiliate_offers WHERE last_seen_at < ? LIMIT 1000`,
    [isoDaysAgo(7)],
  );
  assert.equal(res.affectedRows, 1, 'only the stale row is deleted');

  const left = await s.query<any>('SELECT id FROM affiliate_offers', []);
  assert.equal(left.length, 1, 'the fresh row SURVIVES the prune');
  assert.equal(left[0].id, 1);
});

test('affiliate expiry marks ONLY rows whose expires_at is in the past', async () => {
  const s = new FileStore(); await s.execute('DELETE FROM affiliate_offers', []);
  const insert = (id: number, expires: string | null) =>
    s.execute(
      `INSERT INTO affiliate_offers (id, merchant_name, coupon_code, expires_at, status) VALUES (?, ?, ?, ?, ?)`,
      [id, `Merchant ${id}`, `CODE${id}`, expires, 'active'],
    );
  await insert(1, null);              // no expiry — active forever
  await insert(2, isoDaysAhead(3));   // future expiry — must stay active
  await insert(3, isoDaysAgo(3));     // past expiry — must expire

  // The exact statement expirePastIssues runs.
  await s.execute(
    `UPDATE affiliate_offers SET status = 'expired' WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < NOW()`,
    [],
  );

  const rows = await s.query<any>('SELECT id, status FROM affiliate_offers', []);
  const byId = new Map(rows.map((r) => [Number(r.id), r.status]));
  assert.equal(byId.get(1), 'active', 'no-expiry row stays active');
  assert.equal(byId.get(2), 'active', 'future-expiry row stays active');
  assert.equal(byId.get(3), 'expired', 'past-expiry row is expired');
});

test('status filter still matches after expiry updates (coupons tab only shows active)', async () => {
  const s = new FileStore(); await s.execute('DELETE FROM affiliate_offers', []);
  await s.execute(
    `INSERT INTO affiliate_offers (id, merchant_name, coupon_code, status) VALUES (?, ?, ?, ?)`,
    [1, 'Gonoise', 'SAVE900', 'active'],
  );
  const active = await s.query<any>('SELECT id FROM affiliate_offers WHERE status = ?', ['active']);
  assert.equal(active.length, 1);
});

test('LIKE bound param filters rows instead of returning everything', async () => {
  const s = new FileStore(); await s.execute('DELETE FROM affiliate_offers', []);
  await s.execute(
    `INSERT INTO affiliate_offers (id, merchant_name, coupon_code, status) VALUES (?, ?, ?, ?)`,
    [1, 'Ajio', 'AJIO10', 'active'],
  );
  await s.execute(
    `INSERT INTO affiliate_offers (id, merchant_name, coupon_code, status) VALUES (?, ?, ?, ?)`,
    [2, 'Myntra', 'MYN20', 'active'],
  );
  const rows = await s.query<any>('SELECT id, merchant_name FROM affiliate_offers WHERE merchant_name LIKE ?', ['%ajio%']);
  assert.equal(rows.length, 1, 'only the matching merchant is returned');
  assert.equal(rows[0].merchant_name, 'Ajio');
});

test('unknown WHERE shapes match NOTHING (conservative — a parse gap can never mass-delete)', async () => {
  const s = new FileStore(); await s.execute('DELETE FROM affiliate_offers', []);
  await s.execute(
    `INSERT INTO affiliate_offers (id, merchant_name, coupon_code, status) VALUES (?, ?, ?, ?)`,
    [1, 'Some Merchant', 'X1', 'active'],
  );
  // A deliberately unparseable condition must not select the row.
  const rows = await s.query<any>('SELECT id FROM affiliate_offers WHERE weird_fn(merchant_name)', []);
  assert.equal(rows.length, 0, 'conservative fallback matches nothing');
  // And a DELETE with an unparseable condition must delete nothing.
  const res = await s.execute(`DELETE FROM affiliate_offers WHERE weird_fn(merchant_name)`, []);
  assert.equal(res.affectedRows, 0);
  const left = await s.query<any>('SELECT id FROM affiliate_offers', []);
  assert.equal(left.length, 1, 'row survives an unparseable DELETE');
});

test('!= param excludes only the named value', async () => {
  const s = new FileStore(); await s.execute('DELETE FROM affiliate_offers', []);
  await s.execute(`INSERT INTO affiliate_offers (id, merchant_name, status) VALUES (?, ?, ?)`, [1, 'A', 'active']);
  await s.execute(`INSERT INTO affiliate_offers (id, merchant_name, status) VALUES (?, ?, ?)`, [2, 'B', 'expired']);
  const rows = await s.query<any>('SELECT id FROM affiliate_offers WHERE status != ?', ['expired']);
  assert.equal(rows.length, 1);
  assert.equal(Number(rows[0].id), 1);
});

test('parenthesized OR group matches either side (admin deeplink lookup shape)', async () => {
  const s = new FileStore(); await s.execute('DELETE FROM affiliate_offers', []);
  await s.execute(`INSERT INTO affiliate_offers (id, merchant_name, coupon_code, status) VALUES (?, ?, ?, ?)`, [1, 'Ajio', 'A1', 'active']);
  await s.execute(`INSERT INTO affiliate_offers (id, merchant_name, coupon_code, status) VALUES (?, ?, ?, ?)`, [2, 'Myntra', 'M1', 'active']);
  const rows = await s.query<any>(
    `SELECT id, merchant_name FROM affiliate_offers WHERE status = 'active' AND (merchant_name = ? OR merchant_name = ?) LIMIT 1`,
    ['zzz', 'Myntra'],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].merchant_name, 'Myntra');
});
