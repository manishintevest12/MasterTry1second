/**
 * ANDROID WEB → PLAY STORE (owner 22 Nov: "koi mobile website open kre tho seedhe humera play store ka page open
 * ho jaye agar platform android hai tho jiss se humera app download increase ho").
 *
 * WIDENED 22 Nov evening (owner: "jb koi mobile website pr try1second open kre tho playstore pr link jaye, abhi
 * mobile website khulta hai bs"). The first cut only fired for a plain Android Chrome tab on the HOME page, so the
 * two ways people actually open us both fell through and kept showing the website:
 *
 *   - an in-app browser (WhatsApp / Instagram / Facebook / Gmail) ships `; wv` in its UA and was excluded as a
 *     "webview". That is the majority of Indian mobile traffic, so the shop window never handed anyone over.
 *   - a shared product or answer link is a deep page, and only `/` redirected.
 *
 * Now every Android phone/tablet browser is handed to the Play listing, on any consumer page, in-app browser
 * included. What still protects the business, because a careless redirect costs more installs than it wins:
 *
 *   1. NEVER A CRAWLER. Googlebot/Bingbot/etc. are served the real page, so organic search keeps working and the
 *      site is not treated as a doorway that bounces every visitor.
 *   2. NEVER OUR OWN APP. `Try1Second/...` is our Flutter webview; the installed app must not be told to install
 *      itself. Every OTHER app's webview is a real visitor and is redirected.
 *   3. NEVER A MACHINE OR STAFF PATH. /admin, /merchant, /r, /s, /redirect, /api, /functions, robots.txt,
 *      sitemap and llms.txt are untouched.
 *   4. NO LOOP, AND BACK WORKS. `location.href` (not `replace`) plus a session flag means Back returns to the
 *      site; and a `document.referrer` pointing at the Play listing is treated as "they just came back", so a
 *      browser that blocks storage still cannot be trapped in a bounce.
 *   5. A REAL OPT-OUT. "Continue on the website" remembers the choice for 7 days.
 */

import { PLAY_STORE_URL, isOurAppWebview, isExcludedPath } from './appEntry';

const OPT_OUT_KEY = 't1s_play_redirect_opt_out_at';
const SESSION_KEY = 't1s_play_redirect_at';
const OPT_OUT_DAYS = 7;

const uaOf = () => (typeof navigator !== 'undefined' ? navigator.userAgent : '');
const pathOf = () => (typeof location !== 'undefined' ? location.pathname : '');
const refOf = () => (typeof document !== 'undefined' ? document.referrer || '' : '');

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
 * An Android WEBVIEW (`; wv` in the UA) is an app's own embedded browser: WhatsApp, Instagram, Facebook, Gmail.
 * Those are real visitors, so they ARE redirected now. Kept exported because the ad code and tests still ask.
 */
export function isWebview(ua: string = uaOf()): boolean {
  return /;\s*wv\)/i.test(ua);
}

/** Only the home page. Kept for callers/tests that still ask; the redirect no longer requires it. */
export function isHomePath(path: string = pathOf()): boolean {
  const p = (path || '/').replace(/\/+$/, '');
  return p === '' || p === '/home' || p === '/index.html';
}

/** Staff surfaces, API calls, redirect hops and machine files: never a consumer install prompt. */
export function isExcludedFromRedirect(path: string = pathOf()): boolean {
  const p = (path || '/').replace(/\/+$/, '') || '/';
  if (isExcludedPath(path)) return true;
  if (/^\/(api|functions)\b/i.test(p)) return true;
  if (/^\/(robots\.txt|sitemap|llms\.txt|ads\.txt)/i.test(p)) return true;
  return false;
}

/** They just came back from the Play listing: never bounce them again (loop breaker when storage is blocked). */
export function cameBackFromPlayStore(ref: string = refOf()): boolean {
  return /play\.google\.com/i.test(ref) || /^market:\/\//i.test(ref);
}

/** The visitor chose the website recently: respect it. Storage blocked is NOT an opt-out (the referrer guard covers loops). */
export function hasOptedOut(now: number = Date.now()): boolean {
  try {
    const at = Number(localStorage.getItem(OPT_OUT_KEY) || 0);
    return Boolean(at) && now - at < OPT_OUT_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

/** Already handed this tab to the Play listing once: Back must land on the site, not on another redirect. */
export function alreadyRedirectedThisSession(): boolean {
  try {
    return Boolean(sessionStorage.getItem(SESSION_KEY));
  } catch {
    return false;
  }
}

export function shouldRedirectToPlayStore(opts: {
  ua?: string;
  path?: string;
  now?: number;
  referrer?: string;
} = {}): boolean {
  const ua = opts.ua ?? uaOf();
  const path = opts.path ?? pathOf();
  const now = opts.now ?? Date.now();
  const ref = opts.referrer ?? refOf();
  if (!isAndroidPhone(ua)) return false;
  if (isCrawler(ua)) return false;
  if (isOurAppWebview(ua)) return false;
  if (isExcludedFromRedirect(path)) return false;
  if (cameBackFromPlayStore(ref)) return false;
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
    try {
      sessionStorage.setItem(SESSION_KEY, String(Date.now()));
    } catch {
      /* storage blocked: the referrer guard keeps Back from looping */
    }
    // href (not replace): the phone's Back button returns to this page, and the session flag stops a loop.
    window.location.href = PLAY_STORE_URL;
  } catch {
    /* any failure here must never block the website */
  }
}
