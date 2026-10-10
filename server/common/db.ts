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
class MysqlStore implements DataStore {
  kind = 'mysql' as const;
  private pool: mysql.Pool;

  constructor(pool: mysql.Pool) {
    this.pool = pool;
  }

  async query<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
    const [rows] = await (this.pool.query as any)(sql, params);
    return rows as T[];
  }

  async execute(sql: string, params: unknown[] = []): Promise<{ affectedRows: number; insertId: number }> {
    const [result] = await (this.pool.execute as any)(sql, params);
    const r = result as mysql.ResultSetHeader;
    return { affectedRows: r.affectedRows, insertId: r.insertId };
  }

  async transaction<T>(fn: (tx: { query: any; execute: any }) => Promise<T>): Promise<T> {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const tx = {
        query: (sql: string, params: unknown[] = []) => (conn.query as any)(sql, params).then(([r]: any[]) => r),
        execute: (sql: string, params: unknown[] = []) => (conn.execute as any)(sql, params).then(([r]: any[]) => r),
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

  private persist() {
    fs.writeFileSync(this.file, JSON.stringify(this.data));
    if (!this.warned) {
      this.warned = true;
      log.warn('DataStore', 'Using FILE fallback store — set MYSQL_URL on KVM4 for the real durable catalogue');
    }
  }

  // --- Mini SQL engine (dev parity with the MySQL schema) ---
  private tableOf(sql: string): string {
    const m = sql.match(/(?:from|into|update)\s+`?(\w+)`?/i);
    return m ? m[1] : 'default';
  }

  /** Parse WHERE clauses: supports "col = ?", "col IS [NOT] NULL", "col > n" joined by AND. */
  private whereOf(sql: string, params: unknown[]): ((row: any) => boolean) | null {
    const m = sql.match(/where\s+([\s\S]+?)(?:order by|limit|$)/i);
    if (!m) return null;
    const conditions = m[1].split(/\s+and\s+/i).map((c) => c.trim()).filter(Boolean);
    if (conditions.length === 0) return null;
    let p = 0;
    const preds = conditions.map((c) => {
      let cm: RegExpMatchArray | null;
      if ((cm = c.match(/^`?(\w+)`?\s*=\s*\?$/i))) {
        const col = cm[1];
        const expected = params[p++];
        return (row: any) => String(row[col]) === String(expected);
      }
      if ((cm = c.match(/^`?(\w+)`?\s+is\s+null$/i))) {
        const col = cm[1];
        return (row: any) => row[col] === null || row[col] === undefined;
      }
      if ((cm = c.match(/^`?(\w+)`?\s+is\s+not\s+null$/i))) {
        const col = cm[1];
        return (row: any) => !(row[col] === null || row[col] === undefined);
      }
      if ((cm = c.match(/^`?(\w+)`?\s*(>|>=|<|<=)\s*(\d+)$/i))) {
        const col = cm[1], op = cm[2], v = Number(cm[3]);
        return (row: any) => {
          const rv = Number(row[col]);
          return op === '>' ? rv > v : op === '>=' ? rv >= v : op === '<' ? rv < v : rv <= v;
        };
      }
      return (_row: any) => true; // unknown condition — dev store errs permissive
    });
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
 * Switch the process to the file store after a live MySQL failure (bad credentials,
 * DB down, privileges missing). Keeps the site serving instead of crashing with 503;
 * data becomes non-durable until the env vars are fixed and the app is restarted.
 */
export function resetToFileStore(): void {
  store = new FileStore();
  log.warn('DataStore', 'Switched to FILE FALLBACK store (non-durable) — fix MySQL env vars and restart');
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
      for (const statement of sql.split(';').map((x) => x.trim()).filter(Boolean)) {
        await tx.execute(statement);
      }
      await tx.execute('INSERT INTO schema_migrations (name) VALUES (?)', [f]);
    });
    appliedNow.push(f);
    log.info('Migrations', `Applied ${f}`);
  }
  return { applied: appliedNow, skipped: 'mysql' };
}
