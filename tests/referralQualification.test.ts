import test from 'node:test';
import assert from 'node:assert/strict';
import {
  qualifyReferral, qualificationEvidence, DAILY_AWARD_CAP, MIN_SEARCHES,
} from '../server/rewards/referralQualification';

/**
 * OWNER 19 Nov growth brief: "unlock rewards only on qualified genuine user actions rather than raw or
 * duplicate signups." These tests pin the rule and the abuse guards.
 */

type Row = Record<string, any>;

function fakeStore(seed: { referrals?: Row[]; funnel?: Row[]; clicks?: Row[]; points?: Row[] }) {
  const state = {
    referrals: [...(seed.referrals || [])],
    funnel: [...(seed.funnel || [])],
    clicks: [...(seed.clicks || [])],
    points: [...(seed.points || [])],
    inserts: 0,
    updates: [] as any[],
  };
  const store = {
    async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
      const s = sql.replace(/\s+/g, ' ');
      if (s.startsWith('SELECT id, referrer_id, status FROM referrals')) {
        return state.referrals.filter((r) => r.referee_id === params[0]).slice(-1) as T[];
      }
      if (s.includes('FROM funnel_events') && s.includes("event = 'outbound_click'")) {
        return [{ c: state.funnel.filter((f) => f.user_id === params[0] && f.event === 'outbound_click').length }] as T[];
      }
      if (s.includes('FROM affiliate_clicks')) {
        return [{ c: state.clicks.filter((c) => c.user_id === params[0]).length }] as T[];
      }
      if (s.includes("event = 'search'")) {
        const q = new Set(state.funnel.filter((f) => f.user_id === params[0] && f.event === 'search').map((f) => f.query));
        return [{ c: q.size }] as T[];
      }
      if (s.includes("event = 'results_view'")) {
        return [{ c: state.funnel.filter((f) => f.user_id === params[0] && f.event === 'results_view').length }] as T[];
      }
      if (s.includes('FROM referral_point_events')) {
        return [{ c: state.points.filter((p) => p.user_id === params[0]).length }] as T[];
      }
      return [] as T[];
    },
    async execute(sql: string, params: any[] = []) {
      if (sql.startsWith('UPDATE referrals')) state.updates.push(params);
      if (sql.includes('INSERT INTO referral_point_events')) {
        const dup = state.points.some((p) => p.referral_id === params[1]);
        if (dup) throw new Error('Duplicate entry for key referral_id');
        state.points.push({ user_id: params[0], referral_id: params[1], points: params[2] });
        state.inserts += 1;
      }
      return { affectedRows: 1, insertId: 1 };
    },
  };
  return { store, state };
}

test('a fresh signup alone earns nothing: the referral stays pending', async () => {
  const { store, state } = fakeStore({ referrals: [{ id: 7, referrer_id: 1, referee_id: 2, status: 'pending' }] });
  const r = await qualifyReferral(2, 'signup', store);
  assert.equal(r.awarded, false);
  assert.equal(r.reason, 'not_qualified_yet');
  assert.equal(state.points.length, 0);
  assert.equal(state.updates.length, 0, 'a pending referral is not marked valid');
});

test('a real merchant exit qualifies the referral and pays exactly one point', async () => {
  const { store, state } = fakeStore({
    referrals: [{ id: 7, referrer_id: 1, referee_id: 2, status: 'pending' }],
    funnel: [{ user_id: 2, event: 'outbound_click' }],
  });
  const r = await qualifyReferral(2, 'outbound_click', store);
  assert.equal(r.awarded, true);
  assert.equal(r.evidence, 'outbound_click');
  assert.equal(state.points.length, 1);
  assert.equal(state.points[0].points, 1);
});

test('honest comparison use also qualifies: distinct searches plus a rendered results view', async () => {
  const rows = [
    { user_id: 2, event: 'search', query: 'iphone 15' },
    { user_id: 2, event: 'search', query: 'iphone 15' },
    { user_id: 2, event: 'search', query: 'samsung s24' },
    { user_id: 2, event: 'results_view' },
  ];
  const { store } = fakeStore({ referrals: [{ id: 9, referrer_id: 1, referee_id: 2, status: 'pending' }], funnel: rows });
  const r = await qualifyReferral(2, 'search', store);
  assert.equal(r.awarded, true);
  // Two DISTINCT queries (the duplicate 'iphone 15' does not count twice) plus one rendered results view.
  assert.equal(r.evidence, `compared_${MIN_SEARCHES}_searches`);
});

test('one repeated search is not comparison use', async () => {
  const rows = [
    { user_id: 2, event: 'search', query: 'iphone 15' },
    { user_id: 2, event: 'search', query: 'iphone 15' },
    { user_id: 2, event: 'results_view' },
  ];
  const { store } = fakeStore({ referrals: [{ id: 9, referrer_id: 1, referee_id: 2, status: 'pending' }], funnel: rows });
  assert.equal(await qualificationEvidence(2, store), null);
});

test('a retry cannot pay twice', async () => {
  const { store, state } = fakeStore({
    referrals: [{ id: 7, referrer_id: 1, referee_id: 2, status: 'pending' }],
    funnel: [{ user_id: 2, event: 'outbound_click' }],
  });
  const first = await qualifyReferral(2, 'outbound_click', store);
  // The second call sees the row already marked valid in a real DB; simulate by flipping the seed.
  state.referrals[0].status = 'valid';
  const second = await qualifyReferral(2, 'outbound_click', store);
  assert.equal(first.awarded, true);
  assert.equal(second.awarded, false);
  assert.equal(second.reason, 'already_valid');
  assert.equal(state.points.length, 1);
});

test('a farm stops earning at the daily cap, and its referrals stay pending', async () => {
  const points = Array.from({ length: DAILY_AWARD_CAP }, (_, i) => ({ user_id: 1, referral_id: 100 + i, points: 1 }));
  const { store, state } = fakeStore({
    referrals: [{ id: 55, referrer_id: 1, referee_id: 2, status: 'pending' }],
    funnel: [{ user_id: 2, event: 'outbound_click' }],
    points,
  });
  const r = await qualifyReferral(2, 'outbound_click', store);
  assert.equal(r.awarded, false);
  assert.equal(r.reason, 'daily_cap');
  assert.equal(state.points.length, DAILY_AWARD_CAP);
  assert.equal(state.updates.length, 0);
});

test('no referral on record means nothing to pay, and no crash', async () => {
  const { store } = fakeStore({});
  const r = await qualifyReferral(99, 'outbound_click', store);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no_pending_referral');
});
