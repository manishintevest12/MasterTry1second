/**
 * Multi-instance FileStore coherence (owner 21 Oct coupon wipe):
 * hPanel/Passenger runs several app instances. The singleton syncs affiliate
 * offers into ITS in-memory file store and persists devstore.json; other
 * instances must see those rows on their next query instead of answering from
 * a stale boot snapshot (which also caused whole-file clobbering on persist).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Isolated data dir BEFORE the store module loads (each test process owns it).
process.env.NODE_ENV = 'test';
const { FileStore } = await import('../server/common/db');

describe('FileStore multi-instance coherence', () => {
  it('a second instance sees rows written+persisted by the singleton (reload on mtime change)', async () => {
    const singleton = new FileStore();   // background instance: writes
    const serving = new FileStore();     // HTTP instance: booted with an older snapshot
    await singleton.execute('CREATE TABLE IF NOT EXISTS affiliate_offers (network_source VARCHAR(50), network_offer_id VARCHAR(100), coupon_code VARCHAR(120), status VARCHAR(20), last_seen_at DATETIME)');
    assert.equal((await serving.query('SELECT * FROM affiliate_offers')).length, 0, 'fresh data dir — empty');
    for (let i = 0; i < 3; i++) {
      await singleton.execute(
        'INSERT INTO affiliate_offers (network_source, network_offer_id, coupon_code, status, last_seen_at) VALUES (?,?,?,?,NOW())',
        ['cuelinks', 'multi' + i, 'SAVE' + i, 'active']);
    }
    // BEFORE the fix: serving still answered 0 from its boot snapshot.
    // AFTER: it stats the file, sees the singleton's persist, and reloads.
    const seen = await serving.query("SELECT * FROM affiliate_offers WHERE status = 'active'");
    assert.equal(seen.length, 3, 'serving instance must see the singleton persisted rows');
    const codes = seen.map((r: any) => r.coupon_code).sort();
    assert.deepEqual(codes, ['SAVE0', 'SAVE1', 'SAVE2']);
  });

  it('serving instance writes do not clobber rows the singleton persisted', async () => {
    const a = new FileStore();
    const b = new FileStore();
    await a.execute('CREATE TABLE IF NOT EXISTS multi_t (k VARCHAR(50), v VARCHAR(50))');
    await a.execute('INSERT INTO multi_t (k, v) VALUES (?,?)', ['a-row', '1']);
    await b.execute('INSERT INTO multi_t (k, v) VALUES (?,?)', ['b-row', '2']);
    const rows = await a.query('SELECT * FROM multi_t');
    const keys = rows.map((r: any) => r.k).sort();
    assert.ok(keys.includes('a-row') && keys.includes('b-row'), `both rows must survive, got ${keys}`);
  });
});
