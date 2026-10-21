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
}

const STRATEGIES = ['desktop', 'mobile'] as const;
const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const PSI_TIMEOUT_MS = 45_000;   // keep the whole run inside the 55s server deadline
const MIN_RUN_GAP_MS = 60_000;   // PSI shared quota: never re-run a strategy within 60s
const MAX_ROWS_PER_STRATEGY = 50; // trend history kept per strategy; older rows pruned

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

export async function latestScores(): Promise<SpeedScore[]> {
  await ensureTable();
  const store = await getStore();
  // One query per strategy (portable across MySQL 5.7/8 and the sqlite dev store).
  const out: SpeedScore[] = [];
  for (const strategy of STRATEGIES) {
    const rows = await store.query<any>('SELECT * FROM speed_scores WHERE strategy = ? ORDER BY scanned_at DESC LIMIT 1', [strategy]);
    if (rows.length) out.push(rowToScore(rows[0]));
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

async function fetchWithTimeout(url: string): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), PSI_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'try1second-admin-speedtest' } });
    return await res.json();
  } finally { clearTimeout(t); }
}

/** Runs both strategies in parallel and returns the fresh scores. Honours the 60s per-strategy gap. */
export async function runSpeedTest(siteUrl: string): Promise<SpeedScore[]> {
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
    if (gaps[i] !== 0 && gaps[i] < MIN_RUN_GAP_MS) {
      const existing = await store.query<any>('SELECT * FROM speed_scores WHERE strategy = ? ORDER BY scanned_at DESC LIMIT 1', [strategy]);
      if (existing.length) return rowToScore(existing[0]);
    }
    try {
      const key = (process.env.PAGESPEED_API_KEY || '').trim();
      const psi = await fetchWithTimeout(`${PSI_ENDPOINT}?url=${encodeURIComponent(url)}&strategy=${strategyKey}&category=performance${key ? `&key=${encodeURIComponent(key)}` : ''}`);
      const parsed = parsePsiResponse(psi, strategyKey);
      const s: SpeedScore = { ...parsed, url: parsed.url || url };
      await persistScore(s);
      return s;
    } catch (e: any) {
      const s: SpeedScore = { strategy, score: null, lcp_ms: null, tbt_ms: null, cls: null, url, scanned_at: new Date().toISOString(), error: (e?.name === 'AbortError' ? 'PageSpeed run timed out (45s)' : e?.message) || 'PageSpeed request failed' };
      await persistScore(s);
      return s;
    }
  }));

  return runs;
}
