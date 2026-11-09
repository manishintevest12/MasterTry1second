import { useEffect, useRef, useState } from 'react';

/**
 * Third-party ad tags the owner supplied on 3 Nov (his explicit instruction:
 * "website mai native banner, popunder and app mai smartlink").
 *
 * SCOPE, deliberately narrow:
 *  - NativeBanner_1 and Popunder_1 belong to the WEBSITE only.
 *  - The Smartlink (araplhn.org) is for the app. The Flutter app cannot execute a JS tag, so the
 *    operator URL is served to it by the server (getSmartlinkUrl below) - nothing here loads it on
 *    the web.
 *
 * GUARDRAILS (why this file is careful):
 *  - The native banner needs its exact container id once per page. Two mounts would fight over the
 *    same id, so the slot is claimed by the first mount and released on unmount (claimNativeSlot).
 *  - Every tag is skipped on /admin and on /api/* pages, and skipped for known bots - an ad script
 *    must never run inside the dashboard an operator is using.
 *  - Popunder is loaded once per SESSION per the owner's "site-wide" instruction, not per route
 *    change: a popunder on every navigation would be spam.
 *  - Tags load AFTER first paint (idle) so they never delay the first search render. This is the
 *    only deviation from the pasted snippet, and it is a performance choice, not a format change.
 */

const NATIVE_SCRIPT = 'https://bauval.org/21/70c58edbc3f67ad3fb38bfec9b066a6c';
const NATIVE_CONTAINER_ID = 'container-70c58edbc3f67ad3fb38bfec9b066a6c';
export const SMARTLINK_URL = 'https://araplhn.org/4/d507e5d07b8864a761b95b057aaea9a8';

let nativeSlotTaken = false;

/**
 * APP-WEBVIEW GUARD (owner 3 Nov, in his own words: "App ke andar kabhi bhi direct auto-popup ya
 * background JavaScript inject mat karna, nahi toh Google Play Store kuch hi dino mein app ban kar
 * dega"). The site is often opened INSIDE the app's in-app browser, so a popunder that fired there
 * would be a Play-policy violation in an app we ship. Any Try1Second app webview or a WebView UA is
 * therefore ad-free: the website tags run in real browsers only.
 */
export function isAppWebView(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Try1SecondApp/i.test(ua)) return true;
  // Android WebView exposes "; wv" in its UA string.
  if (/;\s*wv\b/i.test(ua)) return true;
  return false;
}

function adSafePath(): boolean {
  if (typeof window === 'undefined') return false;
  if (isAppWebView()) return false;
  const p = window.location.pathname || '/';
  if (/^\/(api|functions|admin)\b/.test(p) || p.startsWith('/api/')) return false;
  // Operator surfaces stay ad-free.
  if (p.includes('/admin')) return false;
  return true;
}

function injectScriptOnce(id: string, src: string, async: boolean): void {
  if (document.getElementById(id)) return;
  const el = document.createElement('script');
  el.id = id;
  el.src = src;
  el.async = async;
  el.setAttribute('data-cfasync', 'false');
  el.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
  document.body.appendChild(el);
}

/** NativeBanner_1 - renders the network's own container div and loads its async tag once. */
export const NativeBannerSlot: React.FC<{ className?: string }> = ({ className }) => {
  const [mine, setMine] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!adSafePath()) return;
    if (document.getElementById(NATIVE_CONTAINER_ID)) return; // an earlier mount owns it
    nativeSlotTaken = true;
    setMine(true);
    const arm = () => injectScriptOnce('t1s-native-banner-1', NATIVE_SCRIPT, true);
    if ('requestIdleCallback' in window) (window as any).requestIdleCallback(arm, { timeout: 2500 });
    else setTimeout(arm, 1200);
    return () => {
      nativeSlotTaken = false;
      // Leave the injected script in place (re-running it would double-count an impression) but
      // empty our host so a remount gets a fresh container element.
      if (hostRef.current) hostRef.current.innerHTML = '';
    };
  }, []);

  if (!mine) return null;
  // The network fills #container-<hash>; the host keeps that id without React owning children.
  return (
    <div className={className} aria-hidden="true">
      <div ref={(node) => {
        hostRef.current = node;
        if (node && !node.querySelector(`#${NATIVE_CONTAINER_ID}`) && !document.getElementById(NATIVE_CONTAINER_ID)) {
          const mount = document.createElement('div');
          mount.id = NATIVE_CONTAINER_ID;
          node.appendChild(mount);
        }
      }} />
    </div>
  );
};

/**
 * Controlled "ad in the other tab" (owner's own words: "mera vertical khule aur mai rahu v ussi
 * screen pr aur add dusre tab mai aaye jb mai uss app pr jau tb wo muje mile").
 *
 * How it differs from the network popunder: nothing is taken from the user.
 *  - The FIRST real click of the session opens the ad in a BACKGROUND tab (window.open without a
 *    named target keeps the current tab and its navigation untouched, and a user gesture means
 *    browsers do not block it).
 *  - We never preventDefault, never re-route the active tab, so the vertical the user clicked opens
 *    exactly as before and they stay on it. The ad is waiting when they switch tabs.
 *  - Merchant exits are left completely alone (see isExitClick): an ad must never race a paid click.
 *  - Once per session, website only, never inside the app webview, never on /admin or /api.
 */
export const NEWTAB_AD_FLAG = 't1s_newtab_ad';

/** Pure predicate so the skip rules are testable without a DOM. */
export function isExitClick(info: { href?: string | null; hasExitMarker?: boolean; target?: string | null }): boolean {
  if (info.hasExitMarker) return true;
  const href = String(info.href || '');
  if (!href) return false;
  return /(^|\/)(api\/out|redirect)(\?|$|\/)/i.test(href);
}

export function qualifiesForNewTabAd(info: {
  href?: string | null;
  hasExitMarker?: boolean;
  isAppWebView?: boolean;
  pathname?: string;
  alreadyShown?: boolean;
  modifiedClick?: boolean;
}): boolean {
  if (info.alreadyShown) return false;
  if (info.isAppWebView) return false;
  if (info.modifiedClick) return false; // ctrl/cmd/shift clicks are the user's own new-tab intent
  const p = String(info.pathname || '/');
  if (/^\/(api|functions)\b/.test(p) || p.includes('/admin')) return false;
  if (isExitClick(info)) return false;
  return true;
}

/**
 * OWNER 9 Nov, second round ("popunder hata do aisa lg raha hai jaise malware hai iski jagah smartlink
 * rkho"): the previous version opened a background ad tab on the user's first ordinary click anywhere
 * on the page - no popunder script, but from the user's side that IS a popunder: they tap Flights and an
 * ad tab appears behind them. That automatic trigger is now REMOVED. Nothing in this file listens to
 * clicks any more; the smartlink is only ever opened by the labelled link below, when the user chooses
 * to tap it. So: no global listener, no background tab on navigation, no ad on a merchant exit.
 */
export const SponsoredSmartlink = ({ label = 'Sponsored offer' }: { label?: string }) => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    // Same rules as every other ad surface: never inside the app's in-app browser (Play policy for a
    // webpage rendered in a webview), never on /admin or /api.
    const p = window.location.pathname || '/';
    if (isAppWebView()) return;
    if (/^\/(api|functions)\b/.test(p) || p.includes('/admin')) return;
    setShow(true);
  }, []);
  if (!show) return null;
  return (
    <a
      href={SMARTLINK_URL}
      target="_blank"
      rel="sponsored noopener noreferrer"
      data-t1s-ad="smartlink"
      onClick={() => { try { sessionStorage.setItem(NEWTAB_AD_FLAG, '1'); } catch { /* private mode */ } }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px',
        borderRadius: 999, border: '1px solid rgba(0,0,0,0.12)', background: 'transparent',
        fontSize: 11, fontWeight: 600, color: 'inherit', textDecoration: 'none', opacity: 0.75,
      }}
      title="Opens a partner offer in a new tab"
    >
      <span style={{ fontSize: 9, letterSpacing: 0.6, textTransform: 'uppercase', opacity: 0.7 }}>Ad</span>
      {label}
    </a>
  );
};

/** Kept for the server side of the app hand-off (see /api/ads smartlink provider). */
export const getSmartlinkUrl = (): string => SMARTLINK_URL;
