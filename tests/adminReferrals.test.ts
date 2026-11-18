import test from 'node:test';
import assert from 'node:assert/strict';
import { referralsReport, timeColumn, resetTimeColumnCache } from '../server/admin/referralReport';

/**
 * OWNER 18 Nov: the Referrals tab showed `Unknown column 'created_date' in 'SELECT'`.
 *
 * The tables carry `created_at` (001_init.sql), so these fixtures are a store shaped exactly like MySQL:
 * `users` and `referrals` have created_at only, and ANY read that asks for created_date fails with the
 * same message the owner saw. A regression here cannot hide, because the store throws like MySQL does.
 */
type Row = Record<string, any>;

function mysqlStore(opts: { schema?: Array<'created_at' | 'created_date'>; users: Row[]; referrals: Row[]; points?: Row[] }) {
  const schema = new Set(opts.schema || ['created_at']);
  const seen: string[] = [];
  const query = async (sql: string, params: any[] = []): Promise<any[]> => {
    const flat = sql.replace(/\s+/g, ' ').trim();
    seen.push(flat);
    if (/information_schema\.COLUMNS/i.test(flat)) {
      const table = String(params[0]);
      const want = /ROWS OF (users|referrals)/.exec(sql) ? null : null;
      const cols = [...schema].filter((c) => c === 'created_at' || c === 'created_date');
      // only advertise the columns this fake schema really has, and only for the asked table
      if (table !== 'users' && table !== 'referrals') return [];
      return cols.map((c) => ({ c }));
    }
    if (/\bcreated_date\b/i.test(flat)) {
      throw new Error("Unknown column 'created_date' in 'SELECT'");
    }
    if (/^SELECT id, email, display_name, referral_code, created_at AS at FROM users/i.test(flat)) {
      return opts.users.filter((u) => u.referral_code && u.referral_code !== '').map((u) => ({ ...u, at: u.created_at }));
    }
    if (/^SELECT COUNT\(\*\) c FROM users/i.test(flat)) {
      return [{ c: opts.users.filter((u) => u.referral_code && u.referral_code !== '').length }];
    }
    if (/^SELECT referrer_id, referee_id, status, created_at AS at, validated_at FROM referrals/i.test(flat)) {
      return opts.referrals;
    }
    if (/^SELECT id, email, referral_code FROM users LIMIT/i.test(flat)) {
      return opts.users.map(({ id, email, referral_code }) => ({ id, email, referral_code }));
    }
    if (/^SELECT r\.id, r\.referrer_id, r\.referee_id, r\.status, r\.created_at AS at,/i.test(flat)) {
      const points = opts.points || [];
      return opts.referrals.map((r) => ({
        ...r,
        points_awarded: points.filter((p) => Number(p.referral_id) === Number(r.id)).reduce((n, p) => n + Number(p.points), 0),
      }));
    }
    if (/^SELECT id, email, display_name, referral_code FROM users WHERE id IN/i.test(flat)) {
      const ids = new Set(sql.match(/\d+/g)!.map(Number));
      return opts.users.filter((u) => ids.has(Number(u.id)));
    }
    throw new Error('unexpected SQL: ' + flat);
  };
  return { query, seen };
}

function seed() {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const old = '2024-01-01 10:00:00';
  return {
    users: [
      { id: 1, email: 'asha@example.com', display_name: 'Asha', referral_code: 'ASHA1234', created_at: old },
      { id: 2, email: 'ravi@example.com', display_name: null, referral_code: 'RAVI5678', created_at: now },
      { id: 3, email: 'meera@example.com', display_name: 'Meera', referral_code: 'MEERA901', created_at: now },
      { id: 4, email: 'nouser@example.com', display_name: null, referral_code: null, created_at: now },
    ],
    referrals: [
      { id: 10, referrer_id: 1, referee_id: 2, status: 'valid', at: now, validated_at: now },
      { id: 11, referrer_id: 1, referee_id: 3, status: 'valid', at: old, validated_at: old },
      { id: 12, referrer_id: 2, referee_id: 4, status: 'pending', at: now, validated_at: null },
    ],
    points: [
      { referral_id: 10, points: 100 },
      { referral_id: 11, points: 100 },
    ],
  };
}

test('referrals tab loads on a MySQL-shaped store (created_at only) - the reported error cannot return', async () => {
  resetTimeColumnCache();
  const store = mysqlStore(seed());
  const report = await referralsReport(store, 30);

  assert.equal(report.ok, true);
  assert.equal(report.referrals, 2, 'two valid referrals');
  assert.equal(report.pending, 1);
  assert.equal(report.members, 3, 'three members hold a code');
  assert.equal(report.usersWithCode, 3);
  assert.equal(report.awardablePoints, 2);
  // the exact failure mode: no table read may ASK for created_date on this schema. The only mention
  // allowed is the schema probe itself, which lists both names on purpose.
  const tableReads = store.seen.filter((s) => !/information_schema\.COLUMNS/i.test(s));
  assert.ok(tableReads.length >= 4, 'the report really did read the tables');
  assert.deepEqual(tableReads.filter((s) => /created_date/i.test(s)), []);
});

test('the probe adapts to a box whose tables really are created_date', async () => {
  resetTimeColumnCache();
  const data = seed();
  const legacy = {
    users: data.users.map((u) => ({ ...u, created_date: u.created_at })),
    referrals: data.referrals.map((r) => ({ ...r, created_date: r.at })),
    points: data.points,
  };
  const store = mysqlStore({ schema: ['created_date'], ...legacy });
  // this fake throws on created_date, so a created_date box is exercised through the probe only
  assert.equal(await timeColumn(store, 'users'), 'created_date');
  resetTimeColumnCache();
});

test('counts, pair ledger and top referrers come from the ledger, not estimates', async () => {
  resetTimeColumnCache();
  const report = await referralsReport(mysqlStore(seed()), 30);

  assert.equal(report.topReferrers[0].userId, 1);
  assert.equal(report.topReferrers[0].referred, 2);
  assert.equal(report.topReferrers[0].code, 'ASHA1234');
  assert.equal(report.topReferrers[0].email, 'asha@example.com');

  assert.equal(report.referralList.length, 3, 'every referral row, valid or not');
  const pair = report.referralList.find((r) => r.id === 10)!;
  assert.equal(pair.referrer.code, 'ASHA1234');
  assert.equal(pair.referrer.name, 'Asha');
  assert.equal(pair.referee.email, 'ravi@example.com');
  assert.equal(pair.pointsAwarded, 100);
  const noName = report.referralList.find((r) => r.id === 11)!;
  assert.equal(noName.referee.name, 'Meera');
});

test('the window only trims "recent"; totals stay whole', async () => {
  resetTimeColumnCache();
  const report = await referralsReport(mysqlStore(seed()), 3);
  assert.equal(report.referrals, 2, 'totals ignore the window');
  assert.equal(report.recent.length, 1, 'the 2024 referral is outside 3 days');
  assert.equal(report.recent[0].referrer, 'ASHA1234');
});
