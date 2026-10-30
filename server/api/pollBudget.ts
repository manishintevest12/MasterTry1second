/**
 * Poll-chain budget (owner 29 Oct: "fix this error from app for all verticals",
 * screenshot = `SocketException: Connection reset by peer (errno 104)` on
 * /api/scrape/live).
 *
 * Why this exists. The app (and the web feed) keep asking "still working?" every
 * two seconds while a response carries `pendingRefresh: true`, up to 40 times per
 * search. Hostinger's LiteSpeed edge in front of the site counts those requests
 * per client IP, and a cold grocery/food/travel search on a phone can push ~40
 * requests in a minute. Once the edge decides that IP is abusive it stops talking
 * to it - first with a 403 "Bot Verification" page, then with a bare TCP reset,
 * which is exactly the `Connection reset by peer` the owner photographed. From
 * that moment EVERY vertical fails on that phone, which is why it looked like a
 * feature-wide bug rather than one broken source.
 *
 * The installed APK cannot be changed (owner rule: no new builds unless truly
 * unavoidable), so the server has to stop feeding the chain. This module holds
 * one honest rule:
 *
 *   a search may claim "still working" while its acquisition is young, and must
 *   stop claiming it after a bounded window.
 *
 * Once the window closes the next response says `pendingRefresh: false`, the
 * client's chain ends by its own rule, and the answer on screen is whatever was
 * really verified - priced rows, the last verified snapshot, or the honest empty
 * state with its Retry button. Nothing is hidden and nothing is invented; we just
 * stop promising that more is coming forever.
 *
 * Travel pipelines legitimately finish at 40-60s, so the window is generous
 * (default 25s of "still working"), and every request still returns real rows the
 * moment they land - the budget only governs the FLAG, never the data.
 */

/** How long one search key may keep telling a client "more is coming". */
export const PENDING_WINDOW_MS = 25_000;

/** Keys expire on their own so a long-running process cannot grow without bound. */
const KEY_TTL_MS = 10 * 60_000;

interface Entry {
  firstPendingAt: number;
  seenAt: number;
}

const entries = new Map<string, Entry>();

const sweep = (now: number) => {
  if (entries.size < 512) return;
  for (const [key, e] of entries) {
    if (now - e.seenAt > KEY_TTL_MS) entries.delete(key);
  }
};

/**
 * Identity of one search as the client sees it: the same query, vertical, place
 * and date re-polled is the same chain. A new query, city or date is a new chain
 * and gets its own fresh window.
 */
export const pollKey = (parts: Array<string | number | undefined | null>): string =>
  parts.map((p) => String(p ?? '').trim().toLowerCase()).join('|');

/**
 * Should this response be allowed to say "still working"?
 *
 * `pending` is what the pipeline itself reported. It is only ever narrowed here,
 * never widened: a finished search can never be made to look pending.
 */
export const allowPending = (key: string, pending: boolean, now: number = Date.now()): boolean => {
  if (!pending) return false;
  if (!key) return true;               // no identity -> keep legacy behaviour
  sweep(now);
  const existing = entries.get(key);
  if (!existing) {
    entries.set(key, { firstPendingAt: now, seenAt: now });
    return true;
  }
  existing.seenAt = now;
  if (now - existing.firstPendingAt > PENDING_WINDOW_MS) return false;
  return true;
};

/** The search settled with real data: forget the chain so a re-search is fresh. */
export const forgetPending = (key: string): void => {
  if (key) entries.delete(key);
};

/** Test/housekeeping hook. */
export const _resetPollBudget = (): void => {
  entries.clear();
};

/** Inspect one key without touching it (admin diagnostics / tests). */
export const pendingAgeMs = (key: string, now: number = Date.now()): number | null => {
  const e = entries.get(key);
  return e ? now - e.firstPendingAt : null;
};
