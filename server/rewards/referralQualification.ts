/**
 * REFERRAL QUALIFICATION (owner 19 Nov growth brief: "unlock rewards only on qualified genuine user
 * actions rather than raw/duplicate signups").
 *
 * Until now `registerReferral` marked a referral 'valid' and paid the point at SIGNUP. That is the
 * cheapest thing to farm: one email, one click, one point. This module moves the award to the first
 * piece of real product use by the referee, and keeps the referral 'pending' until then.
 *
 * A referee qualifies when they do at least one of:
 *   1. OUTBOUND EXIT — they actually left for a merchant (/api/out recorded a click for them). Real
 *      intent: they picked a deal and went to buy.
 *   2. COMPARISON USE — two distinct searches AND a rendered results view inside the window. Covers the
 *      user who compares honestly but books elsewhere, which is most of a metasearch audience.
 *
 * Anti-abuse, all deterministic:
 *   * self-referral is already blocked in registerReferral;
 *   * one referee can never be referred twice (unique referee_id);
 *   * the point insert is unique per referral, so a retry cannot double-pay;
 *   * a referrer cannot earn more than DAILY_AWARD_CAP awards in a rolling day — a farm of fresh
 *     accounts stops earning instead of paying out, and those referrals stay 'pending';
 *   * evidence is read from tables the server writes (funnel_events, affiliate_clicks, searches), never
 *     from anything the client claims.
 *
 * Pure functions over an injected store so every rule is unit-testable without MySQL.
 */

export const QUALIFY_EVENTS = ['outbound_click', 'share'] as const;
export const MIN_SEARCHES = 2;
export const DAILY_AWARD_CAP = 20;
export const QUALIFY_WINDOW_DAYS = 30;
export const POINTS_PER_VALID_REFERRAL = 1;

export interface QualifyResult {
  ok: boolean;
  /** true only when THIS call moved the referral to valid and paid the point */
  awarded: boolean;
  reason?: 'no_pending_referral' | 'not_qualified_yet' | 'already_valid' | 'daily_cap' | 'error';
  referralId?: number;
  evidence?: string;
}

type Store = { query: <T = any>(sql: string, params?: unknown[]) => Promise<T[]>; execute: (sql: string, params?: unknown[]) => Promise<any> };

/** Rows come back with whatever the driver names them; read defensively. */
function num(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Does the referee show real use? Returns the evidence label, or null.
 * Order matters only for the message the admin sees.
 */
export async function qualificationEvidence(refereeId: number, store: Store, now = Date.now()): Promise<string | null> {
  if (!refereeId) return null;
  const since = new Date(now - QUALIFY_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 19).replace('T', ' ');

  // 1. A merchant exit attributed to this user (server-written in /api/out).
  try {
    const rows = await store.query<any>(
      `SELECT COUNT(*) AS c FROM funnel_events WHERE user_id = ? AND event = 'outbound_click' AND created_at >= ?`,
      [refereeId, since],
    );
    if (num(rows?.[0]?.c) > 0) return 'outbound_click';
  } catch { /* table may predate migration 029 */ }
  try {
    const rows = await store.query<any>('SELECT COUNT(*) AS c FROM affiliate_clicks WHERE user_id = ?', [refereeId]);
    if (num(rows?.[0]?.c) > 0) return 'affiliate_click';
  } catch { /* older schema */ }

  // 2. Real comparison use: distinct searches + a results view.
  try {
    const rows = await store.query<any>(
      `SELECT COUNT(DISTINCT query) AS c FROM funnel_events WHERE user_id = ? AND event = 'search' AND created_at >= ?`,
      [refereeId, since],
    );
    const distinct = num(rows?.[0]?.c);
    if (distinct >= MIN_SEARCHES) {
      const viewed = await store.query<any>(
        `SELECT COUNT(*) AS c FROM funnel_events WHERE user_id = ? AND event = 'results_view' AND created_at >= ?`,
        [refereeId, since],
      );
      if (num(viewed?.[0]?.c) > 0) return `compared_${distinct}_searches`;
    }
  } catch { /* pre-migration */ }

  return null;
}

/**
 * Called after a qualifying server-side action. Idempotent: the second call for the same referee finds
 * nothing pending and returns awarded:false.
 */
export async function qualifyReferral(refereeId: number, trigger: string, store: Store, now = Date.now()): Promise<QualifyResult> {
  if (!refereeId) return { ok: false, awarded: false, reason: 'no_pending_referral' };
  const pending = await store.query<any>(
    `SELECT id, referrer_id, status FROM referrals WHERE referee_id = ? ORDER BY id DESC LIMIT 1`,
    [refereeId],
  );
  const row = pending?.[0];
  if (!row) return { ok: false, awarded: false, reason: 'no_pending_referral' };
  const status = String(row.status || '');
  if (status === 'valid') return { ok: true, awarded: false, reason: 'already_valid', referralId: num(row.id) };

  const evidence = await qualificationEvidence(refereeId, store, now);
  if (!evidence) return { ok: false, awarded: false, reason: 'not_qualified_yet', referralId: num(row.id) };

  const referrerId = num(row.referrer_id);
  // Farm guard: a referrer earning nonstop in one day is not a referral programme, it is a script.
  try {
    const cap = await store.query<any>(
      `SELECT COUNT(*) AS c FROM referral_point_events WHERE user_id = ? AND created_at >= ?`,
      [referrerId, new Date(now - 86_400_000).toISOString().slice(0, 19).replace('T', ' ')],
    );
    if (num(cap?.[0]?.c) >= DAILY_AWARD_CAP) {
      return { ok: false, awarded: false, reason: 'daily_cap', referralId: num(row.id), evidence };
    }
  } catch { /* older schema */ }

  const referralId = num(row.id);
  await store.execute(`UPDATE referrals SET status = ?, validated_at = NOW() WHERE id = ?`, ['valid', referralId]);
  try {
    await store.execute(
      `INSERT INTO referral_point_events (user_id, referral_id, points) VALUES (?, ?, ?)`,
      [referrerId, referralId, POINTS_PER_VALID_REFERRAL],
    );
  } catch (e: any) {
    // Unique per referral: a concurrent call already paid it. Not an error, not a second point.
    if (String(e).includes('unique') || String(e).includes('Duplicate')) {
      return { ok: true, awarded: false, reason: 'already_valid', referralId, evidence };
    }
    throw e;
  }
  return { ok: true, awarded: true, referralId, evidence };
}
