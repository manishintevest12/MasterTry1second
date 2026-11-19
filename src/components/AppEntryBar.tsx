import { useEffect, useState } from 'react';
import { Smartphone, X } from 'lucide-react';
import { PLAY_STORE_URL, dismissAppEntry, markAppEntryShown, shouldOfferApp } from '../lib/appEntry';

/**
 * Web → app entry bar (owner 19 Nov growth brief: "non-intrusive mobile web-to-app entry points that respect
 * user experience and page speed").
 *
 * Behaviour, all of it in src/lib/appEntry.ts so it is testable: mobile browsers only, never inside our own
 * app webview, never on admin/merchant/share pages, one impression per session, a dismissal remembered for 30
 * days, and it only appears after the visitor has actually used the product (a results view) or 15s on page.
 *
 * Deliberately NOT a modal, NOT an interstitial, no auto-redirect, no scroll lock, no countdown. A single row
 * above the existing bottom nav with one real link and one close button.
 */
export default function AppEntryBar({ active }: { active: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active || !shouldOfferApp()) return;
    const timer = setTimeout(() => {
      if (!shouldOfferApp()) return;
      markAppEntryShown();
      setVisible(true);
    }, 15_000);
    const onResults = () => {
      if (!shouldOfferApp()) return;
      markAppEntryShown();
      setVisible(true);
    };
    window.addEventListener('t1s:results-view', onResults);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('t1s:results-view', onResults);
    };
  }, [active]);

  if (!visible) return null;

  return (
    <div
      className="fixed left-0 right-0 z-40 px-3"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 64px)' }}
      role="complementary"
      aria-label="Get the Try1Second app"
    >
      <div className="mx-auto max-w-md flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-lg">
        <Smartphone className="w-4 h-4 text-[#E7000B] shrink-0" />
        <p className="text-[11px] leading-snug text-slate-600 flex-1">
          <span className="font-bold text-slate-900">Faster in the app</span> — same live prices, plus price alerts.
        </p>
        <a
          href={PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => { dismissAppEntry(); setVisible(false); }}
          className="shrink-0 rounded-lg bg-[#E7000B] px-2.5 py-1.5 text-[11px] font-extrabold text-white"
        >
          Get app
        </a>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => { dismissAppEntry(); setVisible(false); }}
          className="shrink-0 rounded-lg p-1 text-slate-400"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
