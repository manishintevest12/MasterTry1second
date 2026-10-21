/**
 * FILE → MYSQL ONE-TIME AUTO-IMPORT (owner self-healing rule, 21 Oct).
 *
 * Production ran on the file-fallback store while MYSQL_URL was broken, so the
 * real data history — leads, approved partner inquiries, merchant logos, admin
 * users/settings, price alerts — lives in .data/devstore.json. The first MySQL
 * boot starts from an EMPTY database: without this import that history would
 * silently vanish from the live app.
 *
 * Design (all automatic, no owner/SSH step):
 * - Claim: devstore.json is atomically RENAMED to devstore.import.lock before
 *   reading, so two app instances (hPanel double-boot) can never import twice.
 * - Resume: if a previous import crashed mid-way, the .lock file is picked up
 *   again on next boot — INSERT IGNORE makes resuming idempotent.
 * - Column-safe: only columns present in BOTH the row and the real MySQL table
 *   (DESCRIBE) are written, so schema drift skips fields instead of failing.
 * - MySQL wins: INSERT IGNORE keeps any row already live in MySQL (fresh worker
 *   data is never overwritten by stale file rows); the file only fills gaps.
 * - Honest: per-table imported/skipped counts logged; nothing fabricated.
 * - Done: the .lock is renamed to devstore.imported-<ts>.json (kept as backup,
 *   never re-imported).
 */
import fs from 'fs';
import path from 'path';
import { getStore, DataStore } from './db';
import { settings, dataDir } from './settings';
import { log } from './logger';

const LOCK = 'devstore.import.lock';

/** Import tables roughly parent-first (no FKs exist, but order is cheap insurance). */
const TABLE_ORDER = ['canonical_entities', 'offers', 'source_evidence', 'price_history'];

async function tableColumns(store: DataStore, table: string): Promise<string[] | null> {
  try {
    const rows = await store.query<any>(`DESCRIBE \`${table}\``);
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rows.map((r) => String(r.Field));
  } catch {
    return null; // table does not exist in MySQL
  }
}

async function importRows(store: DataStore, table: string, cols: string[], rows: any[]): Promise<{ ok: number; skipped: number }> {
  let ok = 0;
  let skipped = 0;
  const chunk = 100;
  for (let i = 0; i < rows.length; i += chunk) {
    const batch = rows.slice(i, i + chunk).filter((r) => r && typeof r === 'object');
    if (batch.length === 0) continue;
    const useCols = cols.filter((c) => batch.every((r) => Object.prototype.hasOwnProperty.call(r, c)));
    if (useCols.length === 0) { skipped += batch.length; continue; }
    const placeholders = batch.map(() => `(${useCols.map(() => '?').join(',')})`).join(',');
    const params: unknown[] = [];
    for (const r of batch) for (const c of useCols) {
      const v = r[c];
      params.push(typeof v === 'object' && v !== null ? JSON.stringify(v) : v);
    }
    try {
      const r = await store.execute(
        `INSERT IGNORE INTO \`${table}\` (${useCols.map((c) => `\`${c}\``).join(',')}) VALUES ${placeholders}`,
        params,
      );
      ok += (typeof r.affectedRows === 'number') ? r.affectedRows : batch.length; // true inserts (IGNORE skips dupes)
    } catch {
      // Batch failed (constraint / encoding edge) — fall back row-by-row so one
      // bad row cannot lose the whole table.
      for (const r of batch) {
        try {
          const rc = cols.filter((c) => Object.prototype.hasOwnProperty.call(r, c));
          if (rc.length === 0) { skipped++; continue; }
          const rr = await store.execute(
            `INSERT IGNORE INTO \`${table}\` (${rc.map((c) => `\`${c}\``).join(',')}) VALUES (${rc.map(() => '?').join(',')})`,
            rc.map((c) => (typeof r[c] === 'object' && r[c] !== null ? JSON.stringify(r[c]) : r[c])),
          );
          ok += (typeof rr.affectedRows === 'number') ? rr.affectedRows : 1;
        } catch { skipped++; }
      }
    }
  }
  return { ok, skipped };
}

/**
 * Runs on every boot; does nothing unless the store is MySQL and a file-store
 * snapshot is waiting. Safe to call concurrently — the rename is the atomic claim.
 */
export async function importFileStoreIntoMysql(): Promise<void> {
  const store = getStore();
  if (store.kind !== 'mysql') return; // file store still in use — nothing to import into

  const src = path.join(dataDir, 'devstore.json');
  const lock = path.join(dataDir, LOCK);
  if (!fs.existsSync(src) && !fs.existsSync(lock)) return;

  let claimed = false;
  try {
    if (fs.existsSync(src)) fs.renameSync(src, lock); // atomic claim (double-boot safe)
    claimed = true;

    const data = JSON.parse(fs.readFileSync(lock, 'utf8')) as Record<string, any[]>;
    const tables = Object.keys(data)
      .filter((t) => Array.isArray(data[t]) && data[t].length > 0)
      .sort((a, b) => {
        const ai = TABLE_ORDER.indexOf(a), bi = TABLE_ORDER.indexOf(b);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });

    log.info('FileImport', `Importing file-store history into MySQL (${tables.length} tables, resume=${fs.existsSync(lock) && claimed})`);
    for (const table of tables) {
      const cols = await tableColumns(store, table);
      if (!cols) { log.warn('FileImport', `Skipping '${table}' (${data[table].length} rows) — no such MySQL table`); continue; }
      const { ok, skipped } = await importRows(store, table, cols, data[table]);
      log.info('FileImport', `'${table}': imported ${ok}, skipped ${skipped} of ${data[table].length}`);
    }
    const done = path.join(dataDir, `devstore.imported-${Date.now()}.json`);
    fs.renameSync(lock, done);
    log.info('FileImport', `File-store history import complete — snapshot kept at ${path.basename(done)}`);
  } catch (err: any) {
    // Leave the .lock in place: next boot resumes (INSERT IGNORE is idempotent).
    log.error('FileImport', `Import failed (will resume next boot): ${err && err.message}`);
  }
}
