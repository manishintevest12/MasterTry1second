/**
 * Site speed test (owner 21 Oct): Lighthouse performance scores for the live site,
 * desktop + mobile, via the public PageSpeed Insights API (no key needed, shared
 * quota). Scores are persisted in MySQL so the Admin "Performance" widget can show
 * the last-scanned time, and each manual run is logged for trend tracking.
 */
import { getStore } from '../common/db';

export interface SpeedScore {
  strategy: 'desktop' | 'mobile';
  score: number | null;          // 0-100 Lighthouse performance category (null = run failed)
  lcp_ms: number | null;         // Largest Contentful Paint
  tbt_ms: number | null;         // Total Blocking Time
  cls: number | null;            // Cumulative Layout Shift
  url: string;
  scanned_at: string;            // ISO timestamp
  error?: string | null;
  // Owner 27 Oct: PageSpeed's free daily quota runs out and the widget used to show a
  // raw red Google error with no score. A run that hits the quota now keeps the last
  // GOOD score, marks it cached, and states when the quota resets.
  cached?: boolean;
  quota_blocked?: boolean;
  quota_reset_at?: string | null;
  note?: string | null;
}

const STRATEGIES = ['desktop', 'mobile'] as const;
const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const PSI_TIMEOUT_MS = 45_000;   // keep the whole run inside the 55s server deadline
const MIN_RUN_GAP_MS = 60_000;   // PSI shared quota: never re-run a strategy within 60s
const MAX_ROWS_PER_STRATEGY = 50; // trend history kept per strategy; older rows pruned

/** True when a PSI response carries a quota / rate-limit failure (not a site problem). */
export function isQuotaError(json: any, httpStatus?: number): boolean {
  if (httpStatus === 429) return true;
  const msg = String(json?.error?.message || '');
  if (/quota exceeded|quotaExceeded|rate.?limit|dailyLimitExceeded/i.test(msg)) return true;
  const reasons = [json?.error?.errors, json?.error?.details].flat().map((x: any) => String(x?.reason || ''));
  return reasons.some((r) => /quota|rate[_ ]?limit|daily[_ ]?limit/i.test(r));
}

/** Next UTC midnight — when PageSpeed's per-day quota is replenished. */
export function nextQuotaReset(at: number = Date.now()): string {
  const d = new Date(at);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0)).toISOString();
}

/** Pure parser (unit-tested): pulls the performance score + core metrics out of a PSI v5 response. */
export function parsePsiResponse(json: any, strategy: string): Omit<SpeedScore, 'scanned_at'> & { scanned_at: string } {
  const scanned_at = new Date().toISOString();
  try {
    const lr = json?.lighthouseResult;
    const scoreRaw = lr?.categories?.performance?.score;
    const num = (v: unknown): number | null => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.round(n) : null;
    };
    if (scoreRaw == null || !lr) {
      const g = json?.error?.message ? `PageSpeed: ${String(json.error.message).slice(0, 200)}` : 'PageSpeed returned no Lighthouse result (quota or internal error)';
      return { strategy: strategy as SpeedScore['strategy'], score: null, lcp_ms: null, tbt_ms: null, cls: null, url: String(json?.id || ''), scanned_at, error: g };
    }
    return {
      strategy: strategy as SpeedScore['strategy'],
      score: Math.round(Number(scoreRaw) * 100),
      lcp_ms: num(lr.audits?.['largest-contentful-paint']?.numericValue),
      tbt_ms: num(lr.audits?.['total-blocking-time']?.numericValue),
      cls: Math.round(Number(lr.audits?.['cumulative-layout-shift']?.numericValue) * 10000) / 10000 || null,
      url: String(lr.finalDisplayedUrl || json?.id || ''),
      scanned_at,
      error: null,
    };
  } catch (e: any) {
    return { strategy: strategy as SpeedScore['strategy'], score: null, lcp_ms: null, tbt_ms: null, cls: null, url: '', scanned_at, error: e?.message || 'Could not parse PageSpeed response' };
  }
}

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  const store = await getStore();
  await store.execute(`CREATE TABLE IF NOT EXISTS speed_scores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    strategy VARCHAR(10) NOT NULL,
    score INT DEFAULT NULL,
    lcp_ms INT DEFAULT NULL,
    tbt_ms INT DEFAULT NULL,
    cls DOUBLE DEFAULT NULL,
    url VARCHAR(500) DEFAULT NULL,
    error VARCHAR(500) DEFAULT NULL,
    scanned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_strategy_time (strategy, scanned_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  ensured = true;
}

/** Quota circuit (owner 27 Oct): once Google answers "Queries per day" we stop calling
 *  PSI altogether until the quota resets, and the widget serves the last GOOD score. */
let quotaEnsured = false;
async function ensureQuotaTable() {
  if (quotaEnsured) return;
  const store = await getStore();
  await store.execute(`CREATE TABLE IF NOT EXISTS speed_quota_state (
    strategy VARCHAR(10) NOT NULL PRIMARY KEY,
    blocked_until TIMESTAMP NULL,
    last_error VARCHAR(500) NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  quotaEnsured = true;
}

export async function quotaBlock(strategy: string): Promise<{ blocked_until: string | null; last_error: string | null }> {
  await ensureQuotaTable();
  const rows = await getStore().query<any>('SELECT blocked_until, last_error FROM speed_quota_state WHERE strategy = ?', [String(strategy).slice(0, 10)]).catch(() => []);
  const r = rows?.[0];
  if (!r) return { blocked_until: null, last_error: null };
  const until = r.blocked_until ? new Date(r.blocked_until).toISOString() : null;
  return { blocked_until: until && new Date(until).getTime() > Date.now() ? until : null, last_error: r.last_error || null };
}

async function setQuotaBlock(strategy: string, error: string, untilIso: string): Promise<void> {
  await ensureQuotaTable();
  await getStore().execute(
    `INSERT INTO speed_quota_state (strategy, blocked_until, last_error) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE blocked_until = VALUES(blocked_until), last_error = VALUES(last_error)`,
    [String(strategy).slice(0, 10), untilIso.slice(0, 19).replace('T', ' '), String(error).slice(0, 500)],
  ).catch(() => { /* dev store may not support ON DUPLICATE KEY */ });
}

async function clearQuotaBlock(strategy: string): Promise<void> {
  await ensureQuotaTable();
  await getStore().execute('UPDATE speed_quota_state SET blocked_until = NULL, last_error = NULL WHERE strategy = ?', [String(strategy).slice(0, 10)]).catch(() => {});
}

/** Latest row that actually HAS a score — a failed attempt must never wipe a real result. */
async function lastGood(strategy: string): Promise<any | null> {
  const rows = await getStore().query<any>(
    'SELECT * FROM speed_scores WHERE strategy = ? AND score IS NOT NULL ORDER BY scanned_at DESC LIMIT 1',
    [String(strategy).slice(0, 10)],
  ).catch(() => []);
  return rows?.[0] || null;
}

export async function latestScores(): Promise<SpeedScore[]> {
  await ensureTable();
  const store = await getStore();
  // One query per strategy (portable across MySQL 5.7/8 and the sqlite dev store).
  const out: SpeedScore[] = [];
  for (const strategy of STRATEGIES) {
    const good = await lastGood(strategy);
    const block = await quotaBlock(strategy);
    if (good) {
      const score = rowToScore(good);
      const newest = await store.query<any>('SELECT scanned_at, error FROM speed_scores WHERE strategy = ? ORDER BY scanned_at DESC LIMIT 1', [strategy]).catch(() => []);
      const laterFailure = newest?.[0] && (!good.scanned_at || new Date(newest[0].scanned_at).getTime() > new Date(good.scanned_at).getTime());
      out.push({
        ...score,
        cached: Boolean(laterFailure),
        quota_blocked: Boolean(block.blocked_until),
        quota_reset_at: block.blocked_until,
        note: block.blocked_until
          ? `PageSpeed ka daily quota khatam hai — last good score dikha rahe hain. Reset: ${block.blocked_until} UTC.`
          : (laterFailure ? 'Last successful scan dikha rahe hain (naya run fail hua).' : null),
      });
    } else if (block.blocked_until || block.last_error) {
      out.push({
        strategy, score: null, lcp_ms: null, tbt_ms: null, cls: null, url: '', scanned_at: new Date().toISOString(),
        error: block.last_error, quota_blocked: Boolean(block.blocked_until), quota_reset_at: block.blocked_until,
        note: block.blocked_until ? `Pehla scan abhi possible nahi — PageSpeed quota reset: ${block.blocked_until} UTC.` : null,
      });
    }
  }
  return out;
}

function rowToScore(r: any): SpeedScore {
  return {
    strategy: r.strategy, score: r.score == null ? null : Number(r.score),
    lcp_ms: r.lcp_ms == null ? null : Number(r.lcp_ms), tbt_ms: r.tbt_ms == null ? null : Number(r.tbt_ms),
    cls: r.cls == null ? null : Number(r.cls), url: r.url || '', scanned_at: r.scanned_at instanceof Date ? r.scanned_at.toISOString() : String(r.scanned_at),
    error: r.error || null,
  };
}

export async function scoreHistory(strategy: string, limit = 20): Promise<SpeedScore[]> {
  await ensureTable();
  const store = await getStore();
  const lim = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const rows = await store.query<any>(`SELECT * FROM speed_scores WHERE strategy = ? ORDER BY scanned_at DESC LIMIT ${lim}`, [String(strategy).slice(0, 10)]);
  return rows.map(rowToScore);
}

async function persistScore(s: SpeedScore): Promise<void> {
  await ensureTable();
  const store = await getStore();
  await store.execute(
    'INSERT INTO speed_scores (strategy, score, lcp_ms, tbt_ms, cls, url, error, scanned_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [s.strategy, s.score, s.lcp_ms, s.tbt_ms, s.cls, s.url.slice(0, 500), s.error ? String(s.error).slice(0, 500) : null, s.scanned_at]);
  // prune old trend rows (keep the newest MAX_ROWS_PER_STRATEGY per strategy)
  await pruneScoreHistory(s.strategy);
}

/**
 * Portable history prune: the SQL-subquery form (`DELETE ... NOT IN (SELECT ...)`) is
 * unsupported by the file fallback store (its mini-SQL engine treats unknown WHERE
 * predicates as always-true and deleted EVERY row for the strategy). Fetch ids, then
 * delete one-by-one — same semantics on MySQL and the dev store.
 */
export async function pruneScoreHistory(strategy: string): Promise<void> {
  await ensureTable();
  const store = await getStore();
  const rows = await store.query<any>('SELECT id FROM speed_scores WHERE strategy = ? ORDER BY scanned_at DESC LIMIT 200', [String(strategy).slice(0, 10)]);
  const drop = rows.slice(MAX_ROWS_PER_STRATEGY).map((r) => Number(r.id)).filter((n) => Number.isFinite(n) && n > 0);
  for (const id of drop) await store.execute('DELETE FROM speed_scores WHERE id = ?', [id]);
}

async function fetchWithTimeout(url: string): Promise<{ status: number; json: any }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), PSI_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'try1second-admin-speedtest' } });
    return { status: res.status, json: await res.json().catch(() => ({})) };
  } finally { clearTimeout(t); }
}

/**
 * Runs both strategies in parallel and returns the scores.
 * Owner 27 Oct self-healing rules:
 *  - 60s per-strategy gap (shared PSI quota) still applies.
 *  - If the daily quota is exhausted, DO NOT call PSI at all; return the last GOOD score
 *    marked cached + the UTC reset time instead of a red Google error.
 *  - A quota hit sets a circuit until the next UTC midnight so we never burn calls.
 *  - `force` (admin "Run speed test") retries once even during a circuit — e.g. after the
 *    owner adds PAGESPEED_API_KEY.
 */
export async function runSpeedTest(siteUrl: string, opts: { force?: boolean } = {}): Promise<SpeedScore[]> {
  const url = String(siteUrl || 'https://www.try1second.com').trim().slice(0, 300);
  await ensureTable();
  const store = await getStore();

  const now = Date.now();
  const gaps = await Promise.all(STRATEGIES.map(async (strategy) => {
    const last = await store.query<any>('SELECT scanned_at FROM speed_scores WHERE strategy = ? ORDER BY scanned_at DESC LIMIT 1', [strategy]);
    if (!last.length || !last[0].scanned_at) return 0;
    const ts = new Date(last[0].scanned_at).getTime();
    return Number.isFinite(ts) ? now - ts : 0;
  }));

  const runs = await Promise.all(STRATEGIES.map(async (strategy, i) => {
    const strategyKey = strategy === 'desktop' ? 'desktop' : 'mobile';

    // Daily-quota circuit: answer from the last good scan, never from Google.
    const block = await quotaBlock(strategy);
    if (block.blocked_until && !opts.force) {
      const good = await lastGood(strategy);
      const cachedNote = `PageSpeed daily quota reset ${block.blocked_until} UTC — last good score.`;
      if (good) return { ...rowToScore(good), cached: true, quota_blocked: true, quota_reset_at: block.blocked_until, note: cachedNote };
      return { strategy, score: null, lcp_ms: null, tbt_ms: null, cls: null, url, scanned_at: new Date().toISOString(), error: block.last_error, quota_blocked: true, quota_reset_at: block.blocked_until, note: cachedNote } as SpeedScore;
    }

    if (gaps[i] !== 0 && gaps[i] < MIN_RUN_GAP_MS) {
      const existing = await store.query<any>('SELECT * FROM speed_scores WHERE strategy = ? ORDER BY scanned_at DESC LIMIT 1', [strategy]);
      if (existing.length) return { ...rowToScore(existing[0]), cached: true };
    }
    try {
      const key = (process.env.PAGESPEED_API_KEY || '').trim();
      const { status, json: psi } = await fetchWithTimeout(`${PSI_ENDPOINT}?url=${encodeURIComponent(url)}&strategy=${strategyKey}&category=performance${key ? `&key=${encodeURIComponent(key)}` : ''}`);

      // Quota / rate limit: circuit until the next UTC midnight, serve the last good score.
      if (isQuotaError(psi, status)) {
        const resetAt = nextQuotaReset();
        const raw = String(psi?.error?.message || 'PageSpeed quota exceeded').slice(0, 500);
        await setQuotaBlock(strategy, raw, resetAt);
        await persistScore({ strategy, score: null, lcp_ms: null, tbt_ms: null, cls: null, url, scanned_at: new Date().toISOString(), error: raw });
        const good = await lastGood(strategy);
        const note = `PageSpeed daily quota khatam — reset ${resetAt} UTC. ${good ? 'Last good score dikha rahe hain.' : 'Quota reset ke baad pehla scan chalega.'}`;
        return good
          ? { ...rowToScore(good), cached: true, quota_blocked: true, quota_reset_at: resetAt, note }
          : { strategy, score: null, lcp_ms: null, tbt_ms: null, cls: null, url, scanned_at: new Date().toISOString(), error: raw, quota_blocked: true, quota_reset_at: resetAt, note } as SpeedScore;
      }

      const parsed = parsePsiResponse(psi, strategyKey);
      const s: SpeedScore = { ...parsed, url: parsed.url || url };
      await persistScore(s);
      if (s.score != null) await clearQuotaBlock(strategy);
      else if (s.error && /quota/i.test(s.error)) await setQuotaBlock(strategy, s.error, nextQuotaReset());
      return s;
    } catch (e: any) {
      const raw = (e?.name === 'AbortError' ? 'PageSpeed run timed out (45s)' : e?.message) || 'PageSpeed request failed';
      await persistScore({ strategy, score: null, lcp_ms: null, tbt_ms: null, cls: null, url, scanned_at: new Date().toISOString(), error: raw });
      const good = await lastGood(strategy);
      return good
        ? { ...rowToScore(good), cached: true, note: 'Naya run fail hua — last good score dikha rahe hain.' }
        : { strategy, score: null, lcp_ms: null, tbt_ms: null, cls: null, url, scanned_at: new Date().toISOString(), error: raw } as SpeedScore;
    }
  }));

  return runs;
}
