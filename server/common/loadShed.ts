/**
 * LOAD SHEDDING — keep the process answering when the box is saturated.
 *
 * OWNER 25 Nov ("isko fix kro, app performance improve kro"). The production log showed 503s whose response times
 * were 83 s and 8,356 s on endpoints that do almost nothing: /api/notifications, /api/track, /api/home/showcase,
 * next to /api/scrape/live. A request that sits for two hours is not a slow handler — it is a process that stopped
 * answering. Once Node stops answering, the LiteSpeed edge queues every new request behind it and finally logs 503,
 * which is why the cheap endpoints appear in the same list as the expensive one.
 *
 * Two things keep that from happening again:
 *
 *  1. THE LOOP IS WATCHED. A 1 s timer that measures its own drift reports the event-loop lag. When the loop is
 *     blocked (heavy parsing, a synchronous call, a flood of timers) the drift is the honest measure of how long a
 *     request would have to wait — and it is the signal used below.
 *  2. EXPENSIVE WORK IS SHED FIRST. When the lag crosses the limit, the live search answers immediately with the
 *     `pendingRefresh` payload the clients already poll, instead of opening a scrape that would make the queue
 *     longer. Cheap reads (the bell, home sections) keep answering, so the app stays usable.
 *
 * The shed is deliberately narrow: it only ever refuses to START expensive work, and it never touches a cached
 * answer. Nothing here invents data — a shed response is the same honest "still scanning" the deadline wall sends.
 */

/** Event-loop lag in ms, as measured by the monitor below. 0 until the monitor has run twice. */
let lagMs = 0;
let monitorTimer: NodeJS.Timeout | undefined;
let started = false;

/** How many times the monitor saw the loop blocked beyond the limit (observability, not a limit). */
let shedSignals = 0;

export const lagLimitMs = (): number => Math.max(250, Number(process.env.T1S_SHED_LAG_MS || 1_500));

/**
 * Start the loop monitor. Idempotent — both entrypoints call it, and a second call is a no-op.
 * The timer is unref'd so it can never hold the process open during shutdown.
 */
export function startLoopMonitor(intervalMs = 1_000): void {
  if (started) return;
  started = true;
  const tick = () => {
    const expected = Date.now() + intervalMs;
    monitorTimer = setTimeout(() => {
      const drift = Math.max(0, Date.now() - expected);
      lagMs = drift;
      if (drift >= lagLimitMs()) shedSignals += 1;
      tick();
    }, intervalMs);
    if (typeof (monitorTimer as any).unref === 'function') (monitorTimer as any).unref();
  };
  tick();
}

/** Stop the monitor (tests, graceful shutdown). */
export function stopLoopMonitor(): void {
  if (monitorTimer) clearTimeout(monitorTimer);
  monitorTimer = undefined;
  started = false;
}

/** Current event-loop lag in ms. */
export const currentLagMs = (): number => lagMs;

/**
 * Should a NEW expensive job (a live scrape) be refused right now?
 *
 * True when the loop is already blocked past the limit. The caller answers with the honest pendingRefresh payload:
 * the client polls, and the scrape starts on a later tick when the box has room.
 */
export const shouldShedExpensive = (): boolean => lagMs >= lagLimitMs();

/** Set the lag directly. Only for tests — production always measures it. */
export function __setLagForTest(ms: number): void {
  lagMs = Math.max(0, Number(ms) || 0);
}

/** What the monitor has seen, for /api/status and the health page. */
export function loadShedSnapshot(): { lagMs: number; lagLimitMs: number; shedSignals: number; started: boolean } {
  return { lagMs, lagLimitMs: lagLimitMs(), shedSignals, started };
}
