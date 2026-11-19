/**
 * WEB → APP ENTRY (owner 19 Nov growth brief: "non-intrusive mobile web-to-app entry points that respect
 * user experience and page speed").
 *
 * Today the site has no entry point to the Android app at all: no Play link anywhere in the UI, so a mobile
 * web visitor who would happily install never learns there is an app. The rules here keep the nudge honest and
 * quiet, because a bad banner costs more than it earns:
 *
 *   1. MOBILE WEB ONLY. Desktop never sees it, and neither does our own app's webview (the app is already
 *      installed there — showing "get the app" inside the app is the classic own-goal).
 *   2. NEVER DURING THE FIRST SECOND. It waits until the visitor has actually used the product (a search
 *      that returned rows) or 15s on page, so it cannot sit on top of the search box or the loader.
 *   3. ONE IMPRESSION PER SESSION, and a dismissal is remembered for 30 days. No re-asking, no scroll traps,
 *      no full-screen interstitial, no auto-redirect: a link, a close button and nothing else.
 *   4. IT MUST NEVER COVER CONTENT. It is a small bar above the existing bottom nav, with the page padded so
 *      nothing is hidden behind it.
 *   5. NO FAKE URGENCY. The copy says what is true: the app is faster and can send price alerts. It does not
 *      promise cash, exclusivity or a discount that does not exist.
 */

const DISMISS_KEY = 't1s_app_entry_dismissed_at';
const SHOWN_KEY = 't1s_app_entry_shown_at';
const DISMISS_DAYS = 30;

export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.try1second.try1second';

/** Our own app's webview identifies itself; the installed app must never be told to install itself. */
export function isOurAppWebview(ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean {
  return /Try1Second\//i.test(ua);
}

/** A phone browser, including a standalone PWA (which is not the Play app either, but is already installed UI). */
export function isMobileBrowser(ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean {
  if (isOurAppWebview(ua)) return false;
  const mobile = /Android|iPhone|iPad|iPod|Mobile Safari|IEMobile|Opera Mini/i.test(ua);
  return mobile;
}

/** Admin surfaces are for staff; a consumer install prompt there is noise. */
export function isExcludedPath(pathname = typeof location !== 'undefined' ? location.pathname : ''): boolean {
  return /^\/(admin|merchant|r|s|redirect)\b/i.test(pathname);
}

/** Dismissed recently, or already shown in this session? Then stay quiet. */
export function shouldOfferApp(now = Date.now()): boolean {
  try {
    const dismissed = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissed && now - dismissed < DISMISS_DAYS * 86_400_000) return false;
    // one impression per browser session: sessionStorage clears when the tab closes
    if (sessionStorage.getItem(SHOWN_KEY)) return false;
  } catch {
    return false; // storage blocked (private mode): stay quiet rather than risk re-asking every page
  }
  return isMobileBrowser() && !isExcludedPath();
}

export function markAppEntryShown(now = Date.now()): void {
  try { sessionStorage.setItem(SHOWN_KEY, String(now)); } catch { /* ignore */ }
}

export function dismissAppEntry(now = Date.now()): void {
  try { localStorage.setItem(DISMISS_KEY, String(now)); } catch { /* ignore */ }
}
