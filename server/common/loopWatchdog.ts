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
const SINGLE_STALL_MS = 30_000;
const WINDOW_MS = 180_000;
const WINDOW_BUSY_RATIO = 0.95;

let lastTick = Date.now();
let windowStart = Date.now();
let windowBlockedMs = 0;
let started = false;

function tick(): void {
  const now = Date.now();
  const late = Math.max(0, now - lastTick - TICK_MS);
  lastTick = now;
  windowBlockedMs += Math.min(late, TICK_MS * 8);

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
