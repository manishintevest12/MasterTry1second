/**
 * Owner 29 Oct ("mobile responsive mai hide ho raha hai jb ki maine bola tha ek baar search button
 * pr click ho jaye tho user results area mai khud navigate kr jaye"): a search on a phone must put
 * the RESULTS in front of the user, not leave them looking at the search form / a collapsed bar.
 *
 * Why the old one-shot jump failed: it fired exactly one requestAnimationFrame after the click, but
 * the results section is mounted a moment LATER (the feed owns #t1s-results-top and it only exists
 * once the vertical has rows/a loader). If the element was not there yet, nothing scrolled at all.
 * It also ignored the sticky navbar and the mobile filter panel collapsing mid-scroll, which moves
 * the target while the browser is animating towards it.
 *
 * This version: collapse the mobile panel first, then keep re-landing on the results until the page
 * has settled (or the budget runs out), offsetting by whatever sticky header is actually on screen.
 */

export const RESULTS_ANCHOR_ID = 't1s-results-top';
export const AUTO_COLLAPSE_EVENT = 't1s:auto-collapse-filters';

/** Where the page must end up: the anchor's top, minus the sticky chrome covering it. */
export function resultsScrollTop(args: { anchorTop: number; scrollY: number; stickyOffset: number }): number {
  const top = args.scrollY + args.anchorTop - args.stickyOffset;
  return top > 0 ? Math.round(top) : 0;
}

/** Height of whatever sticky bar sits over the page top (navbar, tab strip), capped so a broken
 *  measurement can never push the results off-screen. */
export function stickyOffsetPx(measure: () => number): number {
  const h = Math.round(measure());
  if (!Number.isFinite(h) || h < 0) return 0;
  return Math.min(h, 180);
}

function measureSticky(): number {
  if (typeof document === 'undefined') return 0;
  let tallest = 0;
  document.querySelectorAll('header, [data-t1s-sticky]').forEach((el) => {
    const node = el as HTMLElement;
    const style = typeof window !== 'undefined' ? window.getComputedStyle(node) : null;
    if (!style || style.position !== 'sticky' && style.position !== 'fixed') return;
    const rect = node.getBoundingClientRect();
    // Only chrome pinned at the top counts; a fixed footer must not shift the target.
    if (rect.top <= 8 && rect.height > tallest) tallest = rect.height;
  });
  return stickyOffsetPx(() => tallest);
}

export interface ScrollToResultsOptions {
  /** How long to keep re-landing on the results (default 3000ms, the same window a live scan uses). */
  budgetMs?: number;
  /** Collapse the mobile search/filter panel before scrolling (default true). */
  collapseFilters?: boolean;
  behavior?: ScrollBehavior;
}

/**
 * Land the viewport on the results section. Safe to call from anywhere and at any time: it retries
 * while the anchor mounts, re-corrects after the layout settles, and never throws.
 */
export function scrollToResults(opts: ScrollToResultsOptions = {}): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const budgetMs = opts.budgetMs ?? 3000;
  const behavior: ScrollBehavior = opts.behavior ?? 'smooth';

  if (opts.collapseFilters !== false) {
    try { window.dispatchEvent(new CustomEvent(AUTO_COLLAPSE_EVENT)); } catch { /* no listeners */ }
  }

  const land = (): boolean => {
    const el = document.getElementById(RESULTS_ANCHOR_ID);
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const target = resultsScrollTop({ anchorTop: rect.top, scrollY: window.scrollY, stickyOffset: measureSticky() });
    // Already there (within 8px): nothing to animate, so a re-land never fights a user's scroll.
    if (Math.abs(target - window.scrollY) <= 8) return true;
    try {
      window.scrollTo({ top: target, behavior });
    } catch {
      window.scrollTo(0, target);
    }
    return true;
  };

  // A user who starts scrolling or tapping owns the viewport from that moment on: the auto-jump
  // must never drag them back to the results.
  let userTookOver = false;
  const release = () => { userTookOver = true; };
  for (const ev of ['wheel', 'touchstart', 'keydown'] as const) {
    window.addEventListener(ev, release, { passive: true, once: true });
  }
  const cleanup = () => {
    for (const ev of ['wheel', 'touchstart', 'keydown'] as const) window.removeEventListener(ev, release);
  };

  const deadline = Date.now() + budgetMs;
  const tick = () => {
    if (userTookOver) { cleanup(); return; }
    const found = land();
    // Keep checking for a while even after a successful landing: collapsing the filter panel and
    // rows arriving change the page height under us.
    if (Date.now() < deadline) {
      window.setTimeout(tick, found ? 260 : 120);
    } else {
      cleanup();
    }
  };
  try { window.requestAnimationFrame(tick); } catch { tick(); }
}
