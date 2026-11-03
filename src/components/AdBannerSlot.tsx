import { useEffect, useRef, useState } from 'react';
import { Megaphone } from 'lucide-react';

/**
 * Generic ad banner slot for the Rewards section (owner request 21 Oct: AdSense +
 * banner advertisement slots inside Rewards, every element redirects).
 * Renders ONE of:
 *  - Google AdSense unit (admin configures ca-pub client + slot under this slot key)
 *  - Admin-authored custom HTML
 *  - NOTHING — when no ad is configured there is no placeholder, per no-fabrication.
 */
interface AdSlot {
  slot_key?: string;
  provider: string;
  adsense_client?: string | null;
  adsense_slot?: string | null;
  custom_html?: string | null;
  /** Vertical house sponsor (provider 't1s_house'): deals-registry rows for THIS vertical. */
  vertical?: string;
  deals?: Array<{ merchant: string; title?: string; discount?: string; image?: string | null; url: string }>;
}

declare global {
  interface Window { adsbygoogle?: unknown[] }
}

export const AdBannerSlot: React.FC<{
  slotKey: string;
  format?: string;
  /** Lets the parent know whether a configured ad really rendered, so a network fallback can stand down. */
  onActiveChange?: (active: boolean) => void;
}> = ({ slotKey, format = 'horizontal', onActiveChange }) => {
  const [slot, setSlot] = useState<AdSlot | null>(null);
  const pushed = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/ads?slot=${encodeURIComponent(slotKey)}`);
        const data = await res.json();
        const active = Boolean(data.active && (data.slot?.custom_html || (data.slot?.adsense_client && data.slot?.adsense_slot) || (data.slot?.provider === 't1s_house' && (data.slot?.deals || []).length)));
        if (!cancelled) {
          setSlot(data.active ? data.slot : null);
          onActiveChange?.(active);
        }
      } catch {
        if (!cancelled) { setSlot(null); onActiveChange?.(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [slotKey, onActiveChange]);

  useEffect(() => {
    if (!slot || slot.provider !== 'adsense' || !slot.adsense_client || !slot.adsense_slot) return;
    const client = slot.adsense_client;
    const existing = document.querySelector<HTMLScriptElement>('script.adsbygoogle-lib');
    if (!existing) {
      const s = document.createElement('script');
      s.async = true;
      s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
      s.crossOrigin = 'anonymous';
      s.className = 'adsbygoogle-lib';
      document.head.appendChild(s);
    }
    pushed.current = false;
    const t = window.setInterval(() => {
      if (pushed.current) return;
      const el = document.querySelector(`ins.adsbygoogle[data-ad-slot="${slot.adsense_slot}"]`);
      if (el) {
        try { (window.adsbygoogle = window.adsbygoogle || []).push({}); pushed.current = true; } catch { /* lib not ready yet */ }
        window.clearInterval(t);
      }
    }, 600);
    const stop = window.setTimeout(() => window.clearInterval(t), 15000);
    return () => { window.clearInterval(t); window.clearTimeout(stop); };
  }, [slot]);

  if (!slot) return null;

  // Vertical house sponsor (owner 3 Nov): a Flights feed shows flight offers, not a network's dating
  // or poker inventory. Clicks already point at the masked /api/out pointer from the deals registry.
  if (slot.provider === 't1s_house' && Array.isArray(slot.deals) && slot.deals.length) {
    return (
      <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">Sponsored · {slot.vertical}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {slot.deals.slice(0, 3).map((d: any, i: number) => (
            <a
              key={`${d.merchant}-${i}`}
              href={d.url}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2 hover:border-slate-300"
            >
              {d.image ? (
                <img src={d.image} alt="" className="w-7 h-7 rounded object-contain bg-white" loading="lazy" referrerPolicy="no-referrer" />
              ) : null}
              <span className="min-w-0">
                <span className="block text-[12px] font-bold text-slate-800 truncate">{d.merchant}</span>
                <span className="block text-[11px] text-slate-600 truncate">{d.discount || d.title}</span>
              </span>
            </a>
          ))}
        </div>
      </div>
    );
  }

  if (slot.provider === 'custom_html' && slot.custom_html) {
    return (
      <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-2" dangerouslySetInnerHTML={{ __html: slot.custom_html }} />
    );
  }

  if (slot.provider === 'adsense' && slot.adsense_client && slot.adsense_slot) {
    return (
      <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-2 flex items-center justify-center gap-2 min-h-[92px]">
        <ins
          className="adsbygoogle"
          style={{ display: 'block', width: '100%' }}
          data-ad-client={slot.adsense_client}
          data-ad-slot={slot.adsense_slot}
          data-ad-format={format}
          data-full-width-responsive="true"
        />
      </div>
    );
  }

  // Configured but incomplete: show nothing rather than a dead ad frame.
  return null;
};

export const AdBannerLabel: React.FC = () => (
  <p className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
    <Megaphone className="w-3 h-3" /> Advertisement
  </p>
);
