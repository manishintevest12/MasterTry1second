/**
 * OWNER 31 Oct, mobile: "vertical open karta hoon, thori deir ke baad blank screen aa raha hai."
 *
 * Measured on the live site at 390x844 (headless Chrome, /flights): the document or one of the
 * lazy route chunks came back from the Hostinger LiteSpeed edge as 429 (throttle) / 403
 * (protective mode), the dynamic import rejected, and because nothing catches that, React had
 * nothing to paint — a permanently WHITE page with only the red browser bar. Reproduced verbatim:
 *
 *   PAGEERROR: Failed to fetch dynamically imported module: /assets/ComparisonFeed-*.js
 *
 * A browser would have recovered by itself on the next navigation, but an SPA that already
 * replaced the document cannot: the failed import is remembered, so the screen stays blank until
 * the user force-closes the tab. These are the three recovery belts:
 *
 *   1. lazyWithRetry  - the chunk import is retried a few times with backoff (a throttle is
 *                       transient, one second later the same chunk usually answers 200).
 *   2. reloadOnce     - if every retry fails, reload the document ONCE (the browser then runs the
 *                       normal cache/retry dance) and never loop: a sessionStorage stamp guards it.
 *   3. AppErrorBoundary + vite:preloadError - if a render or a preload still throws, show a small
 *                       honest recovery card instead of a blank page.
 */

const RELOAD_GUARD_MS = 20_000;

/**
 * Set the moment a lazy route/chunk import fails. Chromium sometimes rethrows a bare Event for a
 * killed module fetch (no message, nothing to match), and the boundary then showed the generic copy
 * even though the cause was a chunk. Remembering the fact is more reliable than matching text.
 */
let chunkFailureSeen = false;
export function markChunkFailure(): void {
  chunkFailureSeen = true;
}
export function sawChunkFailure(): boolean {
  return chunkFailureSeen;
}
const RELOAD_KEY = 't1s_chunk_reload_at';

/** True for the family of errors a throttled/blocked chunk fetch produces. */
export function isChunkLoadError(error: unknown): boolean {
  const msg = String((error as any)?.message || error || '');
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /Loading chunk \d+ failed/i.test(msg) ||
    /Loading CSS chunk/i.test(msg) ||
    /ChunkLoadError/i.test(msg) ||
    // Chromium's bare form when the fetch itself is killed (429/403/offline) before Vite can add
    // its wording: "TypeError: Failed to fetch" / "Load failed" (WebKit).
    /Failed to fetch/i.test(msg) ||
    /^Load failed$/i.test(msg) ||
    /NetworkError/i.test(msg)
  );
}

/**
 * Reload the document at most once per [RELOAD_GUARD_MS] window.
 * Returns true when a reload was started, false when we are inside the guard (so callers can fall
 * back to showing the recovery card instead of thrashing the browser).
 */
export function reloadOnce(): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) || '0');
    if (last && Date.now() - last < RELOAD_GUARD_MS) return false;
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Private mode / storage disabled: still reload once, the guard is best-effort.
    window.location.reload();
    return true;
  }
  window.location.reload();
  return true;
}

/**
 * Vite fires `vite:preloadError` when a <link rel=modulepreload> or a dynamic import chunk cannot
 * be fetched (429/403/offline). Preventing the default stops Vite from rethrowing, and reloading
 * gets the app back on a fresh document instead of leaving the page blank.
 */
export function installChunkRecovery(): void {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    markChunkFailure();
    reloadOnce();
  });

  // Belt for the case where a chunk URL answers 429 mid-session (edge throttle) and no component
  // happens to import it: nothing to do proactively, but a later navigation must not be blocked.
  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event.reason)) {
      markChunkFailure();
      reloadOnce();
    }
  });
}
