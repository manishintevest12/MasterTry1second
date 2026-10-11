import React, { useEffect, useRef, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { VerticalId, UserLocationState } from '../types';

/**
 * Ad slot above the first search result (replaces the old fake "native ad").
 * Renders ONE of:
 *  - Google AdSense unit (when admin configured a ca-pub client + slot for
 *    the `feed_top` slot key)
 *  - Admin-authored custom HTML (provider 'custom_html')
 *  - NOTHING — when no ad is configured there is no placeholder ad, per the
 *    no-fabrication policy.
 */
interface NativeAdCardProps {
  vertical: VerticalId;
  userLocation?: UserLocationState;
}

interface AdSlot {
  slot_key: string;
  provider: string;
  adsense_client: string | null;
  adsense_slot: string | null;
  custom_html: string | null;
}

declare global {
  interface Window { adsbygoogle?: unknown[] }
}

export const NativeAdCard: React.FC<NativeAdCardProps> = () => {
  const [slot, setSlot] = useState<AdSlot | null>(null);
  const pushed = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/ads?slot=feed_top');
        const data = await res.json();
        if (!cancelled) setSlot(data.active ? data.slot : null);
      } catch {
        if (!cancelled) setSlot(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load the AdSense library once and push the ad unit when config arrives.
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
    const t = window.setTimeout(() => {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        pushed.current = true;
      } catch { /* adsbygoogle not ready; AdSense retries on its own */ }
    }, 300);
    return () => window.clearTimeout(t);
  }, [slot]);

  if (!slot) return null;

  if (slot.provider === 'adsense' && slot.adsense_client && slot.adsense_slot) {
    return (
      <div className="w-full my-3" data-ad-slot="feed_top">
        <ins
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client={slot.adsense_client}
          data-ad-slot={slot.adsense_slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    );
  }

  if (slot.provider === 'custom_html' && slot.custom_html) {
    return (
      <div className="w-full my-3">
        <div className="flex items-center gap-1.5 mb-1">
          <Megaphone className="w-3 h-3 text-slate-400" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Advertisement</span>
        </div>
        {/* Admin-authored HTML from the ad_slots table (admin-only input) */}
        <div dangerouslySetInnerHTML={{ __html: slot.custom_html }} />
      </div>
    );
  }

  return null;
};
