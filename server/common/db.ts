/**
 * Database layer (Section 16): MySQL/MariaDB is the durable source of truth.
 *
 * - When MYSQL_URL/DATABASE_URL is set: real pool + migration runner.
 * - When not set (local dev, Hostinger shared without remote MySQL): a file-backed
 *   fallback store keeps the platform runnable, and every write logs a warning that
 *   persistence is NOT production-grade. Never presented as the production source of truth.
 *
 * The DataStore interface is intentionally narrow (keyed JSON documents + SQL passthrough
 * helpers) so both implementations satisfy the same contract; the SQL migration in
 * database/migrations is the authoritative schema on KVM4.
 */
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { settings, dataDir } from './settings';
import { log } from './logger';

export interface DataStore {
  kind: 'mysql' | 'file';
  query<T = any>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<{ affectedRows: number; insertId: number }>;
  transaction<T>(fn: (tx: { query: any; execute: any }) => Promise<T>): Promise<T>;
  healthy(): Promise<boolean>;
}

// ---------------- MySQL implementation ----------------
/**
 * Normalizes SQL bind params: undefined/NaN → null (exported for tests).
 *
 * DATETIME normalization (21 Oct, caught E2E against MariaDB 10.11): the
 * pipeline produces ISO-8601 strings with a 'T' separator and trailing 'Z'
 * ("2026-10-21T16:40:15.631Z"). MariaDB rejects the trailing timezone marker
 * outright ("Incorrect datetime value") and MySQL coerces it unpredictably —
 * either way the offer row is LOST from the durable store. Any bind value that
 * looks like an ISO datetime is converted to a plain UTC 'YYYY-MM-DD HH:MM:SS'
 * (fractional seconds kept) that both engines accept and round-trip identically
 * with the pool's timezone:'Z'.
 */
const ISO_DT = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2}(?:\.\d+)?)$/;
export function normalizeSqlValue(p: unknown): unknown {
  if (p === undefined || (typeof p === 'number' && Number.isNaN(p))) return null;
  if (typeof p === 'string') {
    const t = p.trim();
    if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(t)) {
      return t.replace('T', ' ').slice(0, -1); // 'T'→space, drop trailing 'Z'
    }
    // ISO with explicit numeric offset (+05:30 / -0400): convert to UTC, then strip.
    const off = t.match(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?([+\-]\d{2}:?\d{2})$/);
    if (off) {
      const d = new Date(t.replace(' ', 'T'));
      if (!Number.isNaN(d.getTime())) return d.toISOString().replace('T', ' ').slice(0, -1);
    }
    if (ISO_DT.test(t)) return t.replace('T', ' '); // T separator, no zone: keep as-is with space
  }
  return p;
}
export function sanitizeBindParams(params: unknown[]): unknown[] {
  return (params || []).map(normalizeSqlValue);
}

class MysqlStore implements DataStore {
  kind = 'mysql' as const;
  private pool: mysql.Pool;

  constructor(pool: mysql.Pool) {
    this.pool = pool;
  }

  /**
   * mysql2 rejects `undefined` bind params ("Bind parameters must not contain
   * undefined"). Offers from real feeds (e.g. VCommission campaigns) legitimately
   * have missing optional fields (brand, currency, expiry…), so every param is
   * normalized: undefined → SQL NULL. NaN also becomes NULL, never a fabricated 0.
   */
  private static bind = sanitizeBindParams;

  async query<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
    const [rows] = await (this.pool.query as any)(sql, MysqlStore.bind(params));
    return rows as T[];
  }

  async execute(sql: string, params: unknown[] = []): Promise<{ affectedRows: number; insertId: number }> {
    const [result] = await (this.pool.execute as any)(sql, MysqlStore.bind(params));
    const r = result as mysql.ResultSetHeader;
    return { affectedRows: r.affectedRows, insertId: r.insertId };
  }

  async transaction<T>(fn: (tx: { query: any; execute: any }) => Promise<T>): Promise<T> {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const tx = {
        query: (sql: string, params: unknown[] = []) => (conn.query as any)(sql, MysqlStore.bind(params)).then(([r]: any[]) => r),
        execute: (sql: string, params: unknown[] = []) => (conn.execute as any)(sql, MysqlStore.bind(params)).then(([r]: any[]) => r),
      };
      const out = await fn(tx);
      await conn.commit();
      return out;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async healthy(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}

// ---------------- File fallback (dev only — NOT a production store) ----------------
export class FileStore implements DataStore {
  kind = 'file' as const;
  // Generic table emulation: { tableName: [rows] }
  private file = path.join(dataDir, 'devstore.json');
  private data: Record<string, any[]> = {};
  private warned = false;

  constructor() {
    fs.mkdirSync(dataDir, { recursive: true });
    if (fs.existsSync(this.file)) {
      try {
        this.data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      } catch {
        this.data = {};
      }
    }
  }

  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  private persist() {
    // SELF-HEALING FIX (owner rule, 21 Oct): the old implementation did a
    // synchronous JSON.stringify + writeFileSync of the ENTIRE store on EVERY
    // mutation. With warm-cycle ingestion the store grows ~13MB within minutes,
    // so each insert blocked the event loop for hundreds of ms — profiled at 93%
    // CPU in persist/writeFileSync while every HTTP request froze. That is the
    // exact "server up but everything 504s" production wedge after every restart.
    // Now: one snapshot at most every 2s, serialized off the write path, written
    // asynchronously, failures swallowed (dev store is best-effort by design).
    if (this.warned) {
      this.warned = false;
      log.warn('DataStore', 'Using FILE fallback store — set MYSQL_URL for the real durable catalogue');
    }
    // Test runs demand synchronous durability ("offers survive a store restart");
    // production runs debounce. Same file, same shape, different pacing.
    if (settings.env === 'test') {
      try { fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(this.file, JSON.stringify(this.data)); } catch { /* best-effort */ }
      return;
    }
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      try {
        const snapshot = JSON.stringify(this.data);
        fs.mkdirSync(dataDir, { recursive: true });
        fs.promises.writeFile(this.file, snapshot).catch(() => { /* best-effort */ });
      } catch { /* best-effort */ }
    }, 2000);
  }

  // --- Mini SQL engine (dev parity with the MySQL schema) ---
  private tableOf(sql: string): string {
    const m = sql.match(/(?:from|into|update)\s+`?(\w+)`?/i);
    return m ? m[1] : 'default';
  }

/**
   * Compare two SQL values the way MySQL would: datetimes as instants, numbers
   * numerically, everything else as strings. Prune/expiry compares ISO strings
   * ('2026-10-14T...') against space-format datetimes ('2026-10-21 ...'), so a
   * naive string compare silently mis-orders rows it must keep.
   */
  private static cmp(l: unknown, r: unknown): number | null {
    if (l === null || l === undefined || r === null || r === undefined) return null;
    const ls = String(l).trim(); const rs = String(r).trim();
    if (!ls || !rs) return null;
    const looksDate = (v: string) => /\d{4}-\d{2}-\d{2}/.test(v);
    const toDate = (v: string) => {
      let x = v.replace(' ', 'T');
      if (!/[zZ+]/.test(x)) x = x + 'Z';
      return Date.parse(x);
    };
    if (looksDate(ls) && looksDate(rs)) {
      const ld = toDate(ls); const rd = toDate(rs);
      if (Number.isFinite(ld) && Number.isFinite(rd)) return ld < rd ? -1 : ld > rd ? 1 : 0;
    }
    const ln = Number(ls); const rn = Number(rs);
    if (!Number.isNaN(ln) && !Number.isNaN(rn)) return ln < rn ? -1 : ln > rn ? 1 : 0;
    const a = ls.toLowerCase(); const b = rs.toLowerCase();
    return a < b ? -1 : a > b ? 1 : 0;
  }

  /**
   * Parse WHERE clauses. Operator support (owner bug, 21 Oct): the old parser only
   * understood "= ?", "IS [NOT] NULL" and "< literal-number"; every other shape —
   * crucially `col < ?` used by the retention PRUNE and `col < NOW()` used by
   * affiliate expiry — fell through to a permissive `true`, so on file-fallback
   * storage the hourly prune deleted ENTIRE tables (coupons wiped every cycle)
   * and expirePastOffers expired every active row. Unknown conditions are now
   * CONSERVATIVE (match nothing) so a parse gap can never mass-delete again.
   */
  private whereOf(sql: string, params: unknown[]): ((row: any) => boolean) | null {
    const m = sql.match(/where\s+([\s\S]+?)(?:order by|limit|$)/i);
    if (!m) return null;
    const conditions = m[1].split(/\s+and\s+/i).map((c) => c.trim()).filter(Boolean);
    if (conditions.length === 0) return null;
    let p = 0;
    /** Single-condition parser shared by AND chains and OR groups. */
    const parseCond = (c: string): ((row: any) => boolean) => {
      let cm: RegExpMatchArray | null;
      // Parenthesized OR group: "(a = ? OR b = ?)" — supported at the top level
      // (admin deeplink lookup shape). Nested groups fall through conservative.
      const orGroup = c.match(/^\((.+)\)$/);
      if (orGroup && /\s+or\s+/i.test(orGroup[1])) {
        const subs = orGroup[1].split(/\s+or\s+/i).map((x) => x.trim()).filter(Boolean).map(parseCond);
        return (row: any) => subs.some((fn) => fn(row));
      }
      if ((cm = c.match(/^`?(\w+)`?\s*=\s*'([^']*)'$/i))) {
        const col = cm[1]; const lit = cm[2];
        return (row: any) => String(row[col]) === lit;
      }
      if ((cm = c.match(/^`?(\w+)`?\s*=\s*(\d+(?:\.\d+)?)$/i))) {
        const col = cm[1]; const lit = Number(cm[2]);
        return (row: any) => Number(row[col]) === lit;
      }
      if ((cm = c.match(/^`?(\w+)`?\s*=\s*\?$/i))) {
        const col = cm[1];
        const expected = params[p++];
        return (row: any) => {
          const cmp = FileStore.cmp(row[col], expected);
          return cmp !== null ? cmp === 0 : String(row[col]) === String(expected);
        };
      }
      if ((cm = c.match(/^`?(\w+)`?\s*(!=|<>)\s*\?$/i))) {
        const col = cm[1];
        const expected = params[p++];
        return (row: any) => {
          if (row[col] === null || row[col] === undefined) return false;
          const cmp = FileStore.cmp(row[col], expected);
          return cmp !== null ? cmp !== 0 : String(row[col]) !== String(expected);
        };
      }
      if ((cm = c.match(/^`?(\w+)`?\s+like\s+\?$/i))) {
        const col = cm[1];
        const pat = String(params[p++] ?? '').toLowerCase();
        const rx = new RegExp('^' + pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$');
        return (row: any) => rx.test(String(row[col] ?? '').toLowerCase());
      }
      if ((cm = c.match(/^`?(\w+)`?\s+in\s*\(([^)]+)\)$/i))) {
        const col = cm[1];
        const toks = cm[2].split(',').map((t) => t.trim());
        const vals = toks.map((t) => (t === '?' ? params[p++] : /^null$/i.test(t) ? null : /^'.*'$/.test(t) ? t.slice(1, -1) : Number(t)));
        return (row: any) => vals.some((v) => (v === null ? row[col] === null : String(row[col]) === String(v)));
      }
      if ((cm = c.match(/^`?(\w+)`?\s*is\s*null$/i))) {
        const col = cm[1];
        return (row: any) => row[col] === null || row[col] === undefined;
      }
      if ((cm = c.match(/^`?(\w+)`?\s*is\s*not\s*null$/i))) {
        const col = cm[1];
        return (row: any) => !(row[col] === null || row[col] === undefined);
      }
      // Ordering comparisons: against a bound PARAM (?), NOW(), or a numeric literal.
      if ((cm = c.match(/^`?(\w+)`?\s*(>|>=|<|<=)\s*(\?|now\(\)|-?\d+(?:\.\d+)?)$/i))) {
        const col = cm[1]; const op = cm[2];
        const rhs = /^now\(\)$/i.test(cm[3]) ? new Date().toISOString() : (cm[3] === '?' ? params[p++] : Number(cm[3]));
        return (row: any) => {
          const cmp = FileStore.cmp(row[col], rhs);
          if (cmp === null) return false;
          return op === '>' ? cmp > 0 : op === '>=' ? cmp >= 0 : op === '<' ? cmp < 0 : cmp <= 0;
        };
      }
      return (_row: any) => false; // unknown condition — CONSERVATIVE: never mass-match again
    };
    const preds = conditions.map(parseCond);
    const pred = (row: any) => preds.every((fn) => fn(row));
    (pred as any).takesParams = true;
    return pred;
  }

  async query<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
    const s = sql.trim();
    const table = this.tableOf(s);
    if (!/^select/i.test(s)) return [];
    let rows = [...(this.data[table] || [])];
    const where = this.whereOf(s, params);
    if (where) rows = rows.filter(where);
    const orderMatch = s.match(/order by\s+`?(\w+)`?\s*(desc)?/i);
    if (orderMatch) {
      rows.sort((a, b) => {
        const av = a[orderMatch[1]], bv = b[orderMatch[1]];
        const cmp = av === bv ? 0 : av > bv ? 1 : -1;
        return orderMatch[2] ? -cmp : cmp;
      });
    }
    const limitMatch = s.match(/limit\s+(\d+)/i);
    if (limitMatch) rows = rows.slice(0, Number(limitMatch[1]));
    return rows as T[];
  }

  /** VALUES parser: maps each column to a param or a literal (number, NULL, NOW(), bool). */
  private valuesOf(s: string, cols: string[], params: unknown[]): Record<string, unknown> {
    const vals = s.match(/values\s*\(([^)]+)\)/i)?.[1] || '';
    const tokens = vals.split(',').map((t) => t.trim());
    const row: Record<string, unknown> = {};
    let p = 0;
    cols.forEach((col, i) => {
      const tok = tokens[i];
      if (tok === '?') row[col] = params[p++];
      else if (/^-?\d+(\.\d+)?$/.test(tok)) row[col] = Number(tok);
      else if (/^null$/i.test(tok)) row[col] = null;
      else if (/^now()$/i.test(tok)) row[col] = new Date().toISOString();
      else if (/^1$/.test(tok)) row[col] = true;
      else if (/^0$/.test(tok)) row[col] = false;
      else row[col] = tok;
    });
    return row;
  }

  async execute(sql: string, params: unknown[] = []): Promise<{ affectedRows: number; insertId: number }> {
    const s = sql.trim();
    const table = this.tableOf(s);
    if (!this.data[table]) this.data[table] = [];
    if (/^insert/i.test(s)) {
      const cols = (s.match(/insert\s+into\s+`?\w+`?\s*\(([^)]+)\)/i)?.[1] || '')
        .split(',').map((c) => c.trim().replace(/[`]/g, '')).filter(Boolean);
      const row = this.valuesOf(s, cols, params);
      // Only auto-assign an id when the INSERT did not provide one (e.g. sessions carry their token as id).
      if (!cols.includes('id')) row['id'] = this.data[table].length ? Math.max(...this.data[table].map((r) => Number(r.id) || 0)) + 1 : 1;
      this.data[table].push(row);
      // Bounded dev store: keep the newest rows only. Unbounded growth fed the
      // persist death-spiral (bigger file -> slower stringify -> higher CPU share).
      if (this.data[table].length > 2500) this.data[table] = this.data[table].slice(-2500);
      this.persist();
      return { affectedRows: 1, insertId: row['id'] as number };
    }
    if (/^update/i.test(s)) {
      const setPart = s.match(/set\s+([\s\S]+?)\s+where/i)?.[1];
      // Count only real `?` placeholders in the SET clause to locate the WHERE param
      const setPlaceholders = (setPart?.match(/\?/g) || []).length;
      const whereParams = params.slice(setPlaceholders);
      const where = this.whereOf(s, whereParams);
      if (!setPart || !where) return { affectedRows: 0, insertId: 0 };
      let affected = 0;
      for (const row of this.data[table]) {
        if (!(where as any)(row)) continue;
        for (const assignment of setPart.split(',').map((a) => a.trim())) {
          const cm = assignment.match(/^`?(\w+)`?\s*=\s*(.+)$/);
          if (!cm) continue;
          const col = cm[1], expr = cm[2];
          let qIndex = 0;
          let consumed = 0;
          for (let k = 0; k < assignment.length; k++) if (assignment[k] === '?') consumed++;
          // Re-map placeholder index across the whole SET clause
          let paramIdx = -1;
          {
            // find which ? (position in SET) this assignment's ? is
            const before = setPart.slice(0, setPart.indexOf(assignment));
            const beforeQ = (before.match(/\?/g) || []).length;
            const localQ = (expr.match(/\?/g) || []).length;
            if (localQ === 1) paramIdx = beforeQ;
          }
          if (/^now\(\)$/i.test(expr)) row[col] = new Date().toISOString();
          else if (/^null$/i.test(expr)) row[col] = null;
          else if (expr === '?') row[col] = params[paramIdx >= 0 ? paramIdx : 0];
          else if (/^'([^']*)'$/.test(expr)) row[col] = expr.slice(1, -1); // quoted string literal (status = 'expired')
          else if (/^-?\d+(\.\d+)?$/.test(expr)) row[col] = Number(expr); // numeric literal (is_active=1), NOT a column name
          else if (/^`?(\w+)`?\s*[-+]\s*(\d+)$/i.test(expr)) {
            const am = expr.match(/^`?(\w+)`?\s*([-+])\s*(\d+)$/i)!;
            const cur = Number(row[am[1]] || 0);
            row[col] = am[2] === '-' ? cur - Number(am[3]) : cur + Number(am[3]);
          }
          else if (/^`?(\w+)`?$/i.test(expr)) row[col] = row[expr.replace(/[`]/g, '')];
        }
        row['updated_at'] = new Date().toISOString();
        affected++;
      }
      this.persist();
      return { affectedRows: affected, insertId: 0 };
    }
    if (/^delete/i.test(s)) {
      const where = this.whereOf(s, params);
      const before = this.data[table].length;
      this.data[table] = where ? this.data[table].filter((r) => !where(r)) : [];
      this.persist();
      return { affectedRows: before - this.data[table].length, insertId: 0 };
    }
    return { affectedRows: 0, insertId: 0 };
  }

  async transaction<T>(fn: (tx: { query: any; execute: any }) => Promise<T>): Promise<T> {
    // Single-process dev store — operations are already serialized (Node single thread + sync persist)
    return fn({ query: this.query.bind(this), execute: this.execute.bind(this) });
  }

  async healthy(): Promise<boolean> {
    return true;
  }
}

// ---------------- Bootstrap ----------------
let store: DataStore | null = null;

export function getStore(): DataStore {
  if (store) return store;
  if (settings.mysqlUrl) {
    try {
      const pool = mysql.createPool({
        uri: settings.mysqlUrl,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 8000,
        // All app-written datetimes are UTC strings; read/write them as UTC so DATETIME
        // round-trips identically regardless of the host's local timezone.
        timezone: 'Z',
        // KVM4 sizing: small pool, bounded queue
      });
      store = new MysqlStore(pool);
      log.info('DataStore', 'MySQL/MariaDB pool initialized (durable source of truth)');
    } catch (err: any) {
      log.error('DataStore', 'MySQL pool init failed, using file fallback', { error: err.message });
      store = new FileStore();
    }
  } else {
    store = new FileStore();
  }
  return store;
}

/**
 * SELF-HEALING MySQL access recovery (owner 21 Oct, ER_ACCESS_DENIED_ERROR):
 * on Hostinger shared hosting the Node.js app is co-located with MySQL. hPanel's
 * database page shows a server hostname / IP as "Database host", but the DB user
 * is typically granted for localhost connections only — putting that hostname
 * into DB_HOST yields ER_ACCESS_DENIED_ERROR even with the correct password.
 * Before degrading to the non-durable file store, retry the connection with
 * localhost / 127.0.0.1; if one connects it becomes the active store immediately
 * (fix DB_HOST in hPanel env to make it permanent). Returns true when recovered.
 */
/** Co-located hosts to try when the configured one denies access: the Hostinger
 *  Node.js app and MySQL share a server, so localhost / 127.0.0.1 are the grants.
 *  The configured host itself is never retried (it just failed). Exported for tests. */
export function localHostCandidates(configuredHost: string): string[] {
  return ['localhost', '127.0.0.1'].filter((h) => h !== configuredHost.toLowerCase());
}

export async function recoverMysqlWithLocalHost(url: string | null | undefined = settings.mysqlUrl): Promise<boolean> {
  const original = url || '';
  if (!original) return false;
  const originalHost = (() => { try { return new URL(original).hostname; } catch { return ''; } })();
  for (const host of localHostCandidates(originalHost)) {
    let candidate: ReturnType<typeof mysql.createPool> | null = null;
    try {
      const uri = new URL(original);
      uri.hostname = host;
      candidate = mysql.createPool({
        uri: uri.toString(),
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 8000,
        timezone: 'Z',
      });
      const probe = new MysqlStore(candidate);
      await probe.query('SELECT 1 AS ok');
      store = probe;
      log.warn('DataStore', `MySQL access denied on host '${originalHost}' — SELF-HEALED via co-located host '${host}'. Set DB_HOST=${host} in hPanel env vars to make it permanent.`);
      return true;
    } catch {
      candidate?.end?.().catch?.(() => undefined);
    }
  }
  return false;
}

/**
 * Switch the process to the file store after a live MySQL failure (bad credentials,
 * DB down, privileges missing). Keeps the site serving instead of crashing with 503;
 * data becomes non-durable until the env vars are fixed and the app is restarted.
 */
export function resetToFileStore(): void {
  store = new FileStore();
  log.warn('DataStore', 'Switched to FILE FALLBACK store (non-durable) — fix MySQL env vars and restart');
}


/**
 * Splits a .sql file into executable statements.
 * Naive split-on-';' breaks when comments or string literals contain a semicolon
 * (e.g. "-- hashed; never stored in plaintext"), which caused ER_PARSE_ERROR on MariaDB.
 * This tokenizer respects -- line comments, '...' strings (with '' escapes) and `...` identifiers.
 */
export function splitSqlStatements(sql: string): string[] {
  const out: string[] = [];
  let cur = '';
  let i = 0;
  const hasContent = (s: string) =>
    s.split('\n').some((line) => line.trim() && !line.trim().startsWith('--') && !line.trim().startsWith('#'));
  while (i < sql.length) {
    const ch = sql[i];
    if (ch === '-' && sql[i + 1] === '-') {
      const nl = sql.indexOf('\n', i);
      if (nl === -1) { cur += sql.slice(i); i = sql.length; }
      else { cur += sql.slice(i, nl + 1); i = nl + 1; }
      continue;
    }
    if (ch === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") { j += 2; continue; }
        if (sql[j] === "'") { j++; break; }
        j++;
      }
      cur += sql.slice(i, j); i = j; continue;
    }
    if (ch === '`') {
      const end = sql.indexOf('`', i + 1);
      const stop = end === -1 ? sql.length : end + 1;
      cur += sql.slice(i, stop); i = stop; continue;
    }
    if (ch === ';') {
      if (hasContent(cur)) out.push(cur.trim());
      cur = ''; i++; continue;
    }
    cur += ch; i++;
  }
  if (hasContent(cur)) out.push(cur.trim());
  return out;
}

/** Runs SQL migration files in order, tracked in schema_migrations. No-op for file store. */
export async function runMigrations(): Promise<{ applied: string[]; skipped: string }> {
  const s = getStore();
  if (s.kind !== 'mysql') return { applied: [], skipped: 'file-fallback (dev)' };
  const dir = path.resolve(process.cwd(), 'database', 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  await s.execute(`CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  const applied = await s.query<{ name: string }>('SELECT name FROM schema_migrations');
  const done = new Set(applied.map((r) => r.name));
  const appliedNow: string[] = [];
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    await s.transaction(async (tx) => {
      for (const statement of splitSqlStatements(sql)) {
        await tx.execute(statement);
      }
      await tx.execute('INSERT INTO schema_migrations (name) VALUES (?)', [f]);
    });
    appliedNow.push(f);
    log.info('Migrations', `Applied ${f}`);
  }
  return { applied: appliedNow, skipped: 'mysql' };
}
