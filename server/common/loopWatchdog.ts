/**
 * EVENT-LOOP WATCHDOG (owner self-healing rule, 21 Oct).
 *
 * Shared-hosting reality: a single Node process serves HTTP, background warmers
 * and search acquisition. When the event loop gets starved for minutes (observed
 * on production: site "up" but every request hangs until a manual restart), the
 * only durable self-heal on shared hosting is a clean exit — Passenger/hPanel
 * auto-restarts the app within seconds. This watchdog detects pathological loop
 * starvation (not normal busy searches) and triggers that recovery automatically
 * instead of leaving the site wedged until the owner notices.
 *
 * Detection: a 500ms heartbeat timer measures how late each tick actually runs.
 * Normal load: ticks are a few ms late. Pathological wedge (observed 21 Oct):
 * ticks run seconds late continuously. We only act when the loop has been
 * blocked for ~30s continuously (single stall) or >=95% of a rolling 3-minute
 * window — never during ordinary search bursts.
 */

import { log } from './logger';

const TICK_MS = 500;
/**
 * OWNER 16 Nov (production log): 10:59:44 boot -> 11:00:59 self-restart -> "Background duties deferred, another
 * instance already runs background" -> boot again. A restart loop. The first minute after boot is the single
 * busiest moment this process ever has - MySQL retention plus a 758 MB offer compaction, a 47-query boot warm,
 * a proxy sweep and the nearby crawl audit all start within two seconds of the port opening - so the loop was
 * blocked past 30s by our OWN startup work and the watchdog dutifully killed a healthy process, which then did
 * it all again. Startup work is not a hang: it is allowed to be slow. The watchdog now stays silent for the
 * first three minutes and only starts judging once the boot has had a chance to settle.
 */
const BOOT_GRACE_MS = 180_000;
const SINGLE_STALL_MS = 30_000;
const WINDOW_MS = 180_000;
const WINDOW_BUSY_RATIO = 0.95;

const bootedAt = Date.now();
let lastTick = Date.now();
let windowStart = Date.now();
let windowBlockedMs = 0;
let started = false;

function tick(): void {
  const now = Date.now();
  const late = Math.max(0, now - lastTick - TICK_MS);
  lastTick = now;
  windowBlockedMs += Math.min(late, TICK_MS * 8);

  if (now - bootedAt < BOOT_GRACE_MS) {
    // Boot work is ours, not a symptom: keep the window clean so a slow start cannot trigger a restart loop.
    windowStart = now;
    windowBlockedMs = 0;
    lastTick = now;
    return;
  }

  if (now - windowStart >= WINDOW_MS) {
    const busy = windowBlockedMs / (now - windowStart);
    if (busy >= WINDOW_BUSY_RATIO) {
      log.error('Watchdog', `Event loop starved: ${Math.round(busy * 100)}% blocked over last ${WINDOW_MS / 1000}s — exiting for hPanel auto-restart (self-heal)`);
      process.exit(1);
    }
    windowStart = now;
    windowBlockedMs = 0;
  }
  if (late >= SINGLE_STALL_MS) {
    log.error('Watchdog', `Single event-loop stall of ${(late / 1000).toFixed(1)}s — exiting for hPanel auto-restart (self-heal)`);
    process.exit(1);
  }
}

/** Start the watchdog once at server boot. */
export function startLoopWatchdog(): void {
  if (started) return;
  started = true;
  setInterval(tick, TICK_MS).unref();
  log.info('Watchdog', `Event-loop watchdog armed (stall >${SINGLE_STALL_MS / 1000}s or ${WINDOW_BUSY_RATIO * 100}% over ${WINDOW_MS / 1000}s -> self-restart)`);
}
