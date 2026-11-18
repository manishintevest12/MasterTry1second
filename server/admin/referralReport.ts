/**
 * Admin → Referrals report.
 *
 * OWNER 18 Nov: the Referrals tab died with `Unknown column 'created_date' in 'SELECT'`.
 *
 * The route had been written against a timestamp name this schema never had: `users` and `referrals`
 * both carry `created_at` (001_init.sql, and every other admin query uses it). The tab went blank for a
 * whole day because the column name was guessed once, in three places.
 *
 * So the report is now built here and every timestamped read goes through `timeColumn()`, which asks the
 * server which name actually exists for that table and caches the answer. A rename (either direction) or a
 * mixed box can no longer take the tab down, and the SQL a caller reads never has to assume a timestamp
 * spelling. Table names passed to it are the module's own constants, never request input.
 *
 * Every number is a ledger count from the tables the referral engine writes - users.referral_code,
 * referrals, referral_point_events - never an estimate.
 */

type Store = { query: <T = any>(sql: string, params?: any[]) => Promise<T[]> };

const cache = new Map<string, string>();

/**
 * Which timestamp column does this table really have? Asks information_schema, defaults to `created_at`
 * (the schema's real name) and never throws - a probe failure just means we use the default.
 */
export async function timeColumn(store: Store, table: string): Promise<string> {
  const hit = cache.get(table);
  if (hit) return hit;
  let col: string = 'created_at';
  try {
    const rows = await store.query<any>(
      `SELECT COLUMN_NAME c FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
          AND COLUMN_NAME IN ('created_at','created_date')`,
      [table],
    );
    const names = new Set(rows.map((r: any) => String(r?.c ?? '')));
    if (names.has('created_at')) col = 'created_at';
    else if (names.has('created_date')) col = 'created_date';
  } catch {
    // probe unavailable (mock store, restricted user) - keep the schema's real name
  }
  cache.set(table, col);
  return col;
}

/** Test hook: forget probed answers. */
export function resetTimeColumnCache(): void {
  cache.clear();
}

export type ReferralPerson = {
  id: number;
  name: string;
  email: string | null;
  code: string | null;
};

export type ReferralLedgerRow = {
  id: number;
  referrer: ReferralPerson;
  referee: ReferralPerson;
  status: string;
  at: string | null;
  pointsAwarded: number;
};

export type ReferralReport = {
  ok: true;
  days: number;
  members: number;
  usersWithCode: number;
  referrals: number;
  pending: number;
  awardablePoints: number;
  topReferrers: { userId: number; code: string | null; email: string | null; referred: number }[];
  referralList: ReferralLedgerRow[];
  recent: { referrer: string; referee: string; at: string | null }[];
};

export async function referralsReport(store: Store, daysInput?: unknown): Promise<ReferralReport> {
  const days = Math.max(1, Math.min(365, Number(daysInput) || 30));
  const usersTs = await timeColumn(store, 'users');
  const refTs = await timeColumn(store, 'referrals');

  const [codes, total, refs, users] = await Promise.all([
    store.query<any>(
      `SELECT id, email, display_name, referral_code, ${usersTs} AS at
         FROM users
        WHERE referral_code IS NOT NULL AND referral_code != ?
        ORDER BY id DESC LIMIT 200`,
      [''],
    ),
    store.query<any>('SELECT COUNT(*) c FROM users WHERE referral_code IS NOT NULL AND referral_code != ?', ['']),
    store.query<any>(
      `SELECT referrer_id, referee_id, status, ${refTs} AS at, validated_at
         FROM referrals ORDER BY id DESC LIMIT 500`,
    ),
    store.query<any>('SELECT id, email, referral_code FROM users LIMIT 2000'),
  ]);

  const byId = new Map<number, any>(users.map((u: any) => [Number(u.id), u]));
  const totals = new Map<number, { code: string | null; email: string | null; valid: number }>();
  const valid = refs.filter((r: any) => String(r.status) === 'valid');
  for (const r of valid) {
    const id = Number(r.referrer_id);
    const u = byId.get(id);
    const row =
      totals.get(id) ||
      { code: u?.referral_code ? String(u.referral_code) : null, email: u?.email ? String(u.email) : null, valid: 0 };
    row.valid += 1;
    totals.set(id, row);
  }

  const since = Date.now() - days * 24 * 60 * 60_000;
  const recent = valid
    .filter((r: any) => {
      const at = Date.parse(String(r.at || r.validated_at || ''));
      return !Number.isFinite(at) || at >= since;
    })
    .slice(0, 25)
    .map((r: any) => ({
      referrer: byId.get(Number(r.referrer_id))?.referral_code || `#${r.referrer_id}`,
      referee: byId.get(Number(r.referee_id))?.email || `#${r.referee_id}`,
      at: r.at || r.validated_at || null,
    }));

  const codeCountRow = (total[0] || {}) as any;
  const totalCodes = typeof codeCountRow.c === 'number' ? codeCountRow.c : codes.length;

  // OWNER 18 Nov ("admin mein data ho ki kaunsa user kisko refer kar raha hai"): the panel could see
  // totals but not the actual pair. This is the ledger itself - referrer (name, email, code) ->
  // referee (name, email), when it happened, whether the point was awarded, and the ledger row id.
  const detail = await store.query<any>(
    `SELECT r.id, r.referrer_id, r.referee_id, r.status, r.${refTs} AS at,
            pe.points AS points_awarded
       FROM referrals r
       LEFT JOIN referral_point_events pe ON pe.referral_id = r.id
      ORDER BY r.id DESC LIMIT 300`,
  );
  const ids = new Set<number>();
  for (const r of detail) {
    ids.add(Number(r.referrer_id));
    ids.add(Number(r.referee_id));
  }
  const people = ids.size
    ? await store.query<any>(
        `SELECT id, email, display_name, referral_code FROM users WHERE id IN (${[...ids].join(',')})`,
      )
    : [];
  const pById = new Map<number, any>(people.map((u: any) => [Number(u.id), u]));
  const who = (id: number): ReferralPerson => {
    const u = pById.get(id);
    return {
      id,
      name: u?.display_name ? String(u.display_name) : u?.email ? String(u.email).split('@')[0] : `#${id}`,
      email: u?.email ? String(u.email) : null,
      code: u?.referral_code ? String(u.referral_code) : null,
    };
  };
  const referralList: ReferralLedgerRow[] = detail.map((r: any) => ({
    id: Number(r.id),
    referrer: who(Number(r.referrer_id)),
    referee: who(Number(r.referee_id)),
    status: String(r.status || ''),
    at: r.at || null,
    pointsAwarded: Number(r.points_awarded || 0),
  }));

  return {
    ok: true,
    days,
    members: totalCodes,
    usersWithCode: codes.length,
    referrals: valid.length,
    pending: refs.length - valid.length,
    awardablePoints: valid.length,
    topReferrers: [...totals.entries()]
      .map(([id, v]) => ({ userId: id, code: v.code, email: v.email, referred: v.valid }))
      .sort((a, b) => b.referred - a.referred)
      .slice(0, 25),
    referralList,
    recent,
  };
}
