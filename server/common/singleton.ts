/**
 * SINGLETON BACKGROUND GUARD (owner fix, 13 Oct): Hostinger's app supervisor can
 * boot TWO app instances at once (both listening; both then run the refresh workers
 * and the boot-warm, doubling every site hit and racing the circuit breaker open
 * ("after 3 failures" / "after 4 failures" within the same second).
 *
 * Fix: exactly ONE instance runs background/scheduled work. Everyone keeps serving
 * HTTP — only workers/boot-warm are gated behind a lock:
 *   - MySQL mode: a dedicated connection holds GET_LOCK('try1second_<name>') —
 *     the lock auto-releases when that instance dies, so the survivor can take over.
 *   - File-fallback: an O_EXCL lockfile in .data (stale after 10 minutes).
 */
import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { settings, dataDir } from './settings';
import { log } from './logger';

const STALE_MS = 10 * 60_000;

async function mysqlLock(name: string): Promise<boolean> {
  const conn = await mysql.createConnection(settings.mysqlUrl);
  try {
    const [rows] = (await conn.query(
      'SELECT COALESCE(GET_LOCK(?, 0), 0) AS releasable', [`try1second_${name}`],
    )) as mysql.RowDataPacket[];
    const ok = Number(rows?.[0]?.releasable) === 1;
    if (!ok) {
      await conn.end();
      return false;
    }
    // Hold the connection open for the process lifetime: the lock lives as long
    // as this connection does, and dies with it (crash, restart, hPanel reload).
    conn.on('error', () => undefined); // keep a dead holder from crashing the app
    return true;
  } catch {
    try { await conn.end(); } catch { /* ignore */ }
    return false;
  }
}

function fileLock(name: string): boolean {
  const file = path.join(dataDir, `singleton-${name}.lock`);
  try {
    const st = fs.statSync(file);
    if (Date.now() - st.mtimeMs < STALE_MS) return false;
    fs.unlinkSync(file); // stale holder (crashed instance) — reclaim
  } catch { /* no lockfile yet */ }
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    const fd = fs.openSync(file, 'wx');
    fs.writeSync(fd, String(process.pid));
    fs.closeSync(fd);
    return true;
  } catch {
    return false;
  }
}

/**
 * Try to become THE background instance. Resolves true when this process holds
 * the singleton lock, false when another instance already owns it.
 */
export async function acquireSingletonLock(name: string): Promise<boolean> {
  try {
    if (settings.mysqlUrl) return await mysqlLock(name);
  } catch { /* fall through to the file lock */ }
  return fileLock(name);
}

/** Convenience wrapper: run `fn` only when this instance wins the lock. */
export async function runSingleton(name: string, fn: () => void | Promise<void>): Promise<boolean> {
  const held = await acquireSingletonLock(name);
  if (!held) {
    log.info('Bootstrap', `Background duties deferred — another app instance already runs "${name}"`);
    return false;
  }
  await fn();
  return true;
}
