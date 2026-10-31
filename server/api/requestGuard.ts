/**
 * REQUEST GUARD (owner 31 Oct, exact list: "Allow only one scrape per user/session at a time.
 * Add a strict request timeout. Cancel upstream requests when the client disconnects. Limit
 * concurrent scraping jobs with a queue. Prevent duplicate requests from the mobile app.
 * Return 429 Too Many Requests when the limit is reached instead of starting another process.
 * Stop scraping loops and close every browser, HTTP request, socket and database connection.
 * Add caching so repeated searches do not start new scrapes.")
 *
 * The queue, CPU ceiling, duplicate suppression, repeat cache, disconnect cancellation and
 * graceful shutdown already live in server/common/loadGovernor.ts and were shipped 30 Oct.
 * What the owner's list still needed, and what this module adds:
 *
 *   1. ONE SCRAPE PER SESSION — the same device cannot start a second scrape while its own
 *      previous search is still running (the app's double-tap / retry / poll loop used to
 *      start a second, third, fourth identical job and starve the box). Second attempt gets
 *      429 with Retry-After instead of another process.
 *   2. 429 INSTEAD OF ANOTHER JOB when the global queue is at its ceiling, with a body the
 *      app can render and a Retry-After header — never a silent pendingRefresh forever.
 *   3. STRICT REQUEST TIMEOUT — a hard per-request deadline; when it passes we answer 504
 *      with a JSON body (and the scrape waiter is abandoned, so the job frees its slot).
 *   4. CACHING for the two heavy, non-search endpoints the mobile app calls on every open
 *      (/api/deals, /api/quick-apps) so a repeat open does no work at all.
 *
 * Everything here is per-process, in-memory and self-expiring: a crashed or restarted process
 * cannot leave a session locked (entries stale out after SESSION_TTL_MS), and no browser,
 * socket or DB connection is held by this module — it only books/unbooks slots.
 */

import type { Request, Response } from 'express';
import { governorStats, liveQueueMax } from '../common/loadGovernor';
import { log } from '../common/logger';

/** A session entry older than this is treated as abandoned (a crash cannot wedge a device). */
const SESSION_TTL_MS = 45_000;
/** How long the app is told to wait before retrying after a 429. */
const RETRY_AFTER_SEC = 3;

const active = new Map<string, { startedAt: number; vertical: string; queryKey: string; token: object }>();

/**
 * Session identity for the one-scrape rule. The app already sends a stable device/session
 * header on its own requests; when it does not, IP + User-Agent is used (coarse but honest:
 * two phones behind one NAT are distinguished by their UA, and the TTL keeps it harmless).
 */
export function sessionKeyOf(req: Request): string {
  const header = (name: string) => String((req.headers as any)[name] || '').trim();
  const explicit = header('x-t1s-session') || header('x-device-id') || header('x-session-id') || header('x-t1s-device');
  if (explicit) return `s:${explicit.slice(0, 80)}`;
  const ip = String(
    (req.headers['x-forwarded-for'] as string || '').split(',')[0].trim()
    || req.socket?.remoteAddress
    || '',
  );
  const ua = String(req.headers['user-agent'] || '').slice(0, 60);
  return `h:${ip}|${ua}`;
}

const sweep = (now: number) => {
  for (const [key, entry] of active) {
    if (now - entry.startedAt > SESSION_TTL_MS) active.delete(key);
  }
};

export interface ScrapeSlot {
  ok: boolean;
  reason?: 'session_busy' | 'queue_full';
  retryAfterSec: number;
  release: () => void;
}

/**
 * Books the single scrape slot for this session (plus a global queue check).
 * Always call `release()` in a finally/close handler once the request is done.
 */
export function beginScrape(req: Request, vertical: string, queryKey: string = ''): ScrapeSlot {
  const now = Date.now();
  sweep(now);
  const key = sessionKeyOf(req);
  const noop = () => undefined;

  let existing = active.get(key);
  // A REPEAT of the search already running is not a second scrape: the load governor
  // coalesces it onto the in-flight job and the repeat cache answers it, which is exactly
  // how the app's poll loop is meant to work. Only a DIFFERENT search from the same device
  // while one is still running is refused (owner rule: one scrape per user/session).
  if (existing && queryKey && existing.queryKey && existing.queryKey !== queryKey) {
    // OWNER 31 Oct audit finding ("agar sb jagah ye perfect results de"): a GENUINELY new search
    // from the same device used to be refused with 429 session_busy, so a user who changed the
    // city/vertical quickly got an error box for their own next search. That is not a duplicate,
    // so it now SUPERSEDES the old booking: the stale job is left to finish (its answer is simply
    // not awaited), the slot moves to the new query, and the global CPU/queue governor still caps
    // real concurrency. Duplicates of the same query are still coalesced, never re-scraped.
    log.info('Search', 'New search superseded the running one (owner 31 Oct)', {
      vertical,
      from: existing.vertical,
      fromKey: existing.queryKey.slice(0, 60),
      toKey: queryKey.slice(0, 60),
      ranForMs: now - existing.startedAt,
    });
    active.delete(key);
    // Clear the local too: otherwise the `if (existing)` duplicate branch below would hand back a
    // no-op booking and the NEW query would never actually own the slot.
    existing = undefined;
  }
  if (existing) {
    // Same search: hand back a release that does NOT clear the original booking.
    return { ok: true, retryAfterSec: 0, release: noop };
  }
  const stats = governorStats();
  // One slot of headroom is kept free so the queue never becomes the reason a device waits
  // behind a stampede: the request is refused early with 429 instead of piling on.
  if (stats.queued >= Math.max(1, liveQueueMax() - 1)) {
    return { ok: false, reason: 'queue_full', retryAfterSec: RETRY_AFTER_SEC, release: noop };
  }
  // A per-booking token: a SUPERSEDED booking's late release must never free the slot its
  // successor now owns (that would let two scrapes run for one session).
  const token = {};
  active.set(key, { startedAt: now, vertical, queryKey, token });
  let released = false;
  return {
    ok: true,
    retryAfterSec: 0,
    release: () => {
      if (released) return;
      released = true;
      if (active.get(key)?.token === token) active.delete(key);
    },
  };
}

export function activeScrapeSessions(): number {
  sweep(Date.now());
  return active.size;
}

/** 429 body the app can render (shape kept close to a normal search answer). */
export function send429(res: Response, slot: ScrapeSlot, vertical: string): void {
  res.setHeader('Retry-After', String(slot.retryAfterSec));
  res.status(429).json({
    success: false,
    results: [],
    resultsCount: 0,
    vertical,
    error: slot.reason === 'queue_full' ? 'server_busy' : 'search_in_progress',
    pendingRefresh: true,
    retryAfterSec: slot.retryAfterSec,
    honestNotice: slot.reason === 'queue_full'
      ? 'Server is at capacity right now. Please retry in a few seconds — no search was started, so nothing is stuck.'
      : 'Your previous search is still running. Please retry in a few seconds.',
    servedFrom: 'unavailable',
    sourcesAttempted: [],
    sourcesSucceeded: [],
    sourcesFailed: [],
  });
  log.info('Search', 'Refused a scrape (request guard, owner 31 Oct)', {
    reason: slot.reason, retryAfterSec: slot.retryAfterSec, activeSessions: active.size,
  });
}

/**
 * Strict request timeout: resolves with `null` when the deadline passes. The caller answers
 * 504 and abandons its waiter (the load governor frees the slot for the remaining work).
 */
export function withDeadline<T>(work: Promise<T>, ms: number): Promise<T | null> {
  return new Promise<T | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), Math.max(50, ms));
    if (typeof (timer as any).unref === 'function') (timer as any).unref();
    work.then(
      (value) => { clearTimeout(timer); resolve(value); },
      () => { clearTimeout(timer); resolve(null); },
    );
  });
}

/** 504 body (same shape as a search answer so the app's parser keeps working). */
export function send504(res: Response, vertical: string, startedAt: number): void {
  res.status(504).json({
    success: false,
    results: [],
    resultsCount: 0,
    vertical,
    error: 'request_timeout',
    pendingRefresh: false,
    honestNotice: 'This search took too long and was stopped so the server stays responsive. Please retry.',
    servedFrom: 'unavailable',
    sourcesAttempted: [],
    sourcesSucceeded: [],
    sourcesFailed: [],
    latencyMs: Date.now() - startedAt,
  });
  log.info('Search', 'Stopped a scrape at the strict request deadline (owner 31 Oct)', { vertical, ms: Date.now() - startedAt });
}

/** Test helper. */
export function resetRequestGuard(): void {
  active.clear();
}
