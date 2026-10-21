/**
 * Prune-statement schema parity (owner 21 Oct prod log):
 * boot logs showed "price_history prune skipped / Unknown column 'created_at'"
 * and the same for source_health — retention silently no-op'd, so price_history
 * (the biggest append table) would grow unbounded again on the shared host.
 * Guard: every retention DELETE must reference columns that actually exist in
 * the migrations, and source_health must NOT be pruned (bounded state table).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const pruneSrc = readFileSync('server/catalogue/prune.ts', 'utf8');
const raw = readdirSync('database/migrations').filter(f => f.endsWith('.sql'))
  .map(f => readFileSync(join('database/migrations', f), 'utf8')).join('\n');
// strip line comments first (they contain semicolons that fake-truncate table bodies)
const migrations = raw.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');

/** CREATE TABLE column names for a table, concatenated from all migrations. */
function columnsOf(table: string): string[] {
  const re = new RegExp('CREATE TABLE IF NOT EXISTS ' + table + '\\s*\\(([\\s\\S]*?)\\n\\) ENGINE', 'is');
  const body = migrations.match(re)?.[1] || '';
  return body.split('\n').map(l => l.trim().split(/\s+/)[0]).filter(c => /^[a-z_]+$/i.test(c));
}

describe('prune statements match real schema', () => {
  const targets = [...pruneSrc.matchAll(/\['([^']+)',\s*'((?:DELETE|OPTIMIZE)[^']+)'/g)];

  it('price_history retention uses captured_at (the real column)', () => {
    const ph = targets.find(m => m[1] === 'price_history');
    assert.ok(ph, 'price_history prune statement exists');
    assert.match(ph[2], /captured_at/);
    assert.doesNotMatch(ph[2], /created_at/);
    assert.ok(columnsOf('price_history').includes('captured_at'), 'schema has captured_at');
  });

  it('source_health is NOT pruned (bounded state table, one row per source)', () => {
    assert.ok(!targets.some(m => m[1] === 'source_health'), 'source_health must not appear in retention deletes');
    assert.match(migrations, /CREATE TABLE IF NOT EXISTS source_health[\s\S]*?source_id[^,]*PRIMARY KEY/is);
  });

  it('every time column referenced by retention exists in the migrations', () => {
    for (const [, table, sql] of targets) {
      if (table.includes(' ') || sql.includes('\n')) continue; // "deals (auto)" alias + multi-line join deletes
      const m = sql.match(/WHERE (\w+) </);
      if (!m) continue;
      const cols = columnsOf(table);
      assert.ok(cols.includes(m[1]), `${table} prune column ${m[1]} missing from schema (cols: ${cols.slice(0, 8).join(',')})`);
    }
  });
});
