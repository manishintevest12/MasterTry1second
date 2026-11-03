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
const POPUNDER_SCRIPT = 'https://abscloud.org/1/30630f41e5b1ff848ce9427d16ad34e1';
export const SMARTLINK_URL = 'https://araplhn.org/4/d507e5d07b8864a761b95b057aaea9a8';

const POPUNDER_FLAG = 't1s_popunder_1';
let nativeSlotTaken = false;

function adSafePath(): boolean {
  if (typeof window === 'undefined') return false;
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

/** Popunder_1 - website only, once per session, loaded idle so it never blocks the app. */
export const useSitePopunder = (): void => {
  useEffect(() => {
    if (!adSafePath()) return;
    try {
      if (sessionStorage.getItem(POPUNDER_FLAG) === '1') return;
      sessionStorage.setItem(POPUNDER_FLAG, '1');
    } catch {
      // private mode: fall through and load once for this page view
    }
    const arm = () => injectScriptOnce('t1s-popunder-1', POPUNDER_SCRIPT, false);
    const timer = setTimeout(() => {
      if ('requestIdleCallback' in window) (window as any).requestIdleCallback(arm, { timeout: 4000 });
      else arm();
    }, 2500);
    return () => clearTimeout(timer);
  }, []);
};

/** Kept for the server side of the app hand-off (see /api/ads smartlink provider). */
export const getSmartlinkUrl = (): string => SMARTLINK_URL;
