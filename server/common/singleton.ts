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

// Returns 'held' | 'other' | 'error' so the caller can distinguish
// "someone else owns the lock" (defer quietly) from "MySQL unreachable"
// (fall back to the file lock). Conflating the two is what let two app
// instances both run background duties when MySQL hiccuped at boot.
async function mysqlLock(name: string): Promise<'held' | 'other' | 'error'> {
  let conn: mysql.Connection | null = null;
  try {
    conn = await mysql.createConnection(settings.mysqlUrl);
    const [rows] = (await conn.query(
      'SELECT COALESCE(GET_LOCK(?, 0), 0) AS releasable', [`try1second_${name}`],
    )) as mysql.RowDataPacket[];
    if (Number(rows?.[0]?.releasable) !== 1) {
      await conn.end();
      return 'other';
    }
    // Hold the connection open for the process lifetime: the lock lives as long
    // as this connection does, and dies with it (crash, restart, hPanel reload).
    // BUT the server can silently drop an idle connection (wait_timeout) while
    // we still believe we hold the lock — which releases the MySQL lock and lets
    // a second instance win it, so BOTH run background work (seen in prod logs
    // 15 Oct: two boots 1s apart, both running workers + boot-warm + keep-warm).
    // Heartbeat: keepalive ping + periodic re-assert of IS_USED_LOCK; if the
    // lock is gone we log CRITICAL (a second instance may have taken over).
    const holder = conn;
    holder.on('error', () => undefined); // keep a dead holder from crashing the app
    const hb = setInterval(() => {
      holder.ping().catch(() => undefined);
      holder.query('SELECT IS_USED_LOCK(?) AS holderId', [`try1second_${name}`])
        .then(([r]: any[]) => {
          const mine = Number(r?.[0]?.holderId) !== 0 && holder.threadId != null && Number(r?.[0]?.holderId) === holder.threadId;
          if (!mine) {
            log.error('Singleton', `BACKGROUND LOCK LOST (try1second_${name}) — another app instance may now duplicate background work`, { pid: process.pid });
          }
        })
        .catch(() => undefined);
    }, 60_000);
    hb.unref?.();
    return 'held';
  } catch {
    try { await conn?.end(); } catch { /* ignore */ }
    return 'error';
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
  if (settings.mysqlUrl) {
    const r = await mysqlLock(name);
    if (r === 'held') {
      log.info('Bootstrap', `Background singleton acquired via MySQL GET_LOCK (pid ${process.pid})`);
      return true;
    }
    if (r === 'other') return false; // a live sibling owns it — defer, never fall back
    // r === 'error': MySQL unreachable — the FILE lock is the safety net
    log.warn('Bootstrap', `MySQL lock unavailable — falling back to file lock (pid ${process.pid})`);
  }
  const ok = fileLock(name);
  if (ok) log.info('Bootstrap', `Background singleton acquired via file lock (pid ${process.pid})`);
  return ok;
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
