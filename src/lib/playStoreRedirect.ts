/**
 * ANDROID WEB → PLAY STORE (owner 22 Nov: "koi mobile website open kre tho seedhe humera play store ka page open
 * ho jaye agar platform android hai tho jiss se humera app download increase ho").
 *
 * This deliberately overrides the softer rule in `appEntry.ts` (19 Nov: "no auto-redirect, a link and a close
 * button and nothing else") for exactly one case: an ANDROID PHONE BROWSER opening the HOME page. The owner wants
 * the install, so the shop window hands the phone to the Play listing immediately instead of asking politely.
 *
 * What still protects the business, because a careless redirect costs more installs than it wins:
 *
 *   1. NEVER A CRAWLER. Googlebot/Bingbot/etc. are served the real page, so organic search results keep working
 *      and the site is not treated as a doorway that bounces every visitor.
 *   2. NEVER OUR OWN APP. The installed app must not be told to install itself, and our app's webview is not a
 *      browser session the owner asked to interrupt.
 *   3. NEVER A SENSITIVE PATH. /admin, /merchant, /redirect, /r, /s and every /api call are untouched, and the
 *      redirect only fires on the HOME page — someone who lands on a product or answer page from a search result
 *      still gets the page they came for.
 *   4. ONCE PER SESSION, AND BACK WORKS. `location.href` (not `replace`) plus a session flag means the phone's
 *      Back button returns to the site and the redirect does not fight the user in a loop.
 *   5. A REAL OPT-OUT. "Continue on the website" remembers the choice for 7 days, so a returning visitor is not
 *      bounced every single time they open us.
 */

import { PLAY_STORE_URL, isOurAppWebview, isExcludedPath } from './appEntry';

const OPT_OUT_KEY = 't1s_play_redirect_opt_out_at';
const SESSION_KEY = 't1s_play_redirect_at';
const OPT_OUT_DAYS = 7;

const uaOf = () => (typeof navigator !== 'undefined' ? navigator.userAgent : '');
const pathOf = () => (typeof location !== 'undefined' ? location.pathname : '');

/** Android phone/tablet browser. Windows Phone also says "Android" in some UAs, so it is excluded. */
export function isAndroidPhone(ua: string = uaOf()): boolean {
  return /Android/i.test(ua) && !/Windows Phone/i.test(ua);
}

/**
 * Crawlers, link previewers and headless clients. They must always get the page: Googlebot seeing a Play Store
 * redirect on every mobile URL is how a site loses its search rankings overnight.
 */
export function isCrawler(ua: string = uaOf()): boolean {
  return /bot\b|crawler|spider|googlebot|bingbot|yandex|baidu|duckduckbot|facebookexternalhit|slurp|semrush|ahrefs|mj12|python-requests|curl\/|wget\/|headlesschrome|phantomjs|lighthouse/i.test(
    ua,
  );
}

/**
 * An Android WEBVIEW (`; wv` in the UA) is an app's own embedded browser — ours included. Redirecting there is the
 * own-goal the app-entry rules already warn about: the app telling its own webview to install the app.
 */
export function isWebview(ua: string = uaOf()): boolean {
  return /;\s*wv\)/i.test(ua);
}

/** Only the home page. A deep page (product, answer, city hub) is what the visitor searched for. */
export function isHomePath(path: string = pathOf()): boolean {
  const p = (path || '/').replace(/\/+$/, '');
  return p === '' || p === '/home' || p === '/index.html';
}

/** The visitor chose the website recently: respect it. */
export function hasOptedOut(now: number = Date.now()): boolean {
  try {
    const at = Number(localStorage.getItem(OPT_OUT_KEY) || 0);
    return Boolean(at) && now - at < OPT_OUT_DAYS * 86_400_000;
  } catch {
    return true; // storage blocked (private mode): do not risk bouncing them on every page view
  }
}

/** Already handed this tab to the Play listing once: Back must land on the site, not on another redirect. */
export function alreadyRedirectedThisSession(): boolean {
  try {
    return Boolean(sessionStorage.getItem(SESSION_KEY));
  } catch {
    return true;
  }
}

export function shouldRedirectToPlayStore(opts: {
  ua?: string;
  path?: string;
  now?: number;
} = {}): boolean {
  const ua = opts.ua ?? uaOf();
  const path = opts.path ?? pathOf();
  const now = opts.now ?? Date.now();
  if (!isAndroidPhone(ua)) return false;
  if (isCrawler(ua)) return false;
  if (isOurAppWebview(ua)) return false;
  if (isWebview(ua)) return false;
  if (isExcludedPath(path)) return false;
  if (!isHomePath(path)) return false;
  if (alreadyRedirectedThisSession()) return false;
  if (hasOptedOut(now)) return false;
  return true;
}

/** Remember the opt-out for 7 days (and keep the soft install bar quiet for its own 30 days). */
export function stayOnWebsite(now: number = Date.now()): void {
  try {
    localStorage.setItem(OPT_OUT_KEY, String(now));
  } catch {
    /* storage blocked: nothing to remember */
  }
  try {
    localStorage.setItem('t1s_app_entry_dismissed_at', String(now));
  } catch {
    /* ignore */
  }
}

/**
 * The whole entry point: called once at boot, before the app renders, so an Android visitor never sees a flash of
 * the website it is about to leave.
 */
export function installPlayStoreRedirect(): void {
  try {
    if (!shouldRedirectToPlayStore()) return;
    sessionStorage.setItem(SESSION_KEY, String(Date.now()));
    // href (not replace): the phone's Back button returns to this page, and the session flag stops a loop.
    window.location.href = PLAY_STORE_URL;
  } catch {
    /* any failure here must never block the website */
  }
}
