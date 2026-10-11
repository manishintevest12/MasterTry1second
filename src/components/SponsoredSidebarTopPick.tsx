import React, { useEffect, useState } from 'react';
import { ExternalLink, Sparkles, ShieldCheck, Star, Award, ArrowRight, TrendingDown, Tag, CheckCircle2, RefreshCw } from 'lucide-react';
import { VerticalId, UserLocationState } from '../types';
import { useApp } from '../context/AppContext';

/** Admin-managed Sponsored Top Pick (left sidebar, below filters).
 *  Renders ONLY a pick the admin has actually configured for this vertical
 *  (GET /api/picks). No hardcoded demo partners, no fabricated offers. */

interface TopPick {
  id: number;
  vertical: string;
  partner_name: string;
  partner_code: string | null;
  badge_text: string | null;
  headline: string;
  offer_text: string | null;
  price_badge: string | null;
  perks: string[];
  cta_text: string | null;
  destination_url: string;
  image_url: string | null;
  logo_bg: string | null;
  logo_text: string | null;
  rating: number;
}

interface SponsoredSidebarTopPickProps {
  vertical: VerticalId;
  userLocation?: UserLocationState;
}

export const SponsoredSidebarTopPick: React.FC<SponsoredSidebarTopPickProps> = ({ vertical }) => {
  const { addPoints } = useApp();
  const [pick, setPick] = useState<TopPick | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/picks?vertical=${encodeURIComponent(vertical)}`);
        const data = await res.json();
        if (!cancelled) setPick((data.picks || [])[0] || null);
      } catch {
        if (!cancelled) setPick(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [vertical]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-slate-400 text-xs">
        <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" /> Loading top pick…
      </div>
    );
  }

  // Honest state: nothing rendered when no admin-configured pick exists for this vertical.
  if (!pick) return null;

  const handleCta = async () => {
    try {
      const res = await fetch(`/api/go?url=${encodeURIComponent(pick.destination_url)}`);
      const data = await res.json();
      if (data.redirectUrl) {
        window.open(data.redirectUrl, '_blank', 'noopener');
        addPoints(1, `Visited sponsored pick ${pick.partner_name}`);
      }
    } catch {
      /* redirect service unavailable */
    }
  };

  return (
    <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-b from-amber-50 to-white overflow-hidden shadow-md">
      {/* Badge header */}
      <div className="bg-amber-400 px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Award className="w-3.5 h-3.5 text-slate-900" />
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-900">
            {pick.badge_text || 'Sponsored Top Pick'}
          </span>
        </div>
        <Sparkles className="w-3.5 h-3.5 text-slate-900" />
      </div>

      <div className="p-4">
        {/* Partner identity */}
        <div className="flex items-center gap-2.5 mb-3">
          <div className={`w-10 h-10 rounded-xl ${pick.logo_bg || 'bg-slate-900'} text-white font-black text-xs flex items-center justify-center shadow-sm`}>
            {pick.logo_text || pick.partner_name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 leading-tight truncate">{pick.partner_name}</p>
            <div className="flex items-center gap-1">
              {pick.rating > 0 && (
                <>
                  <Star className="w-3 h-3 text-amber-500 fill-amber-400" />
                  <span className="text-[10px] text-slate-500 font-semibold">{Number(pick.rating).toFixed(1)}</span>
                </>
              )}
              <span className="text-[10px] text-slate-400 uppercase tracking-wide font-bold">Sponsored</span>
            </div>
          </div>
        </div>

        {/* Offer content */}
        <h4 className="text-sm font-bold text-slate-900 leading-snug mb-1.5">{pick.headline}</h4>
        {pick.offer_text && (
          <p className="text-xs text-slate-600 leading-relaxed mb-3">{pick.offer_text}</p>
        )}

        {pick.price_badge && (
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
              <TrendingDown className="w-3 h-3" /> {pick.price_badge}
            </span>
            {pick.rating >= 4.5 && pick.rating > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-semibold">
                <ShieldCheck className="w-3 h-3 text-emerald-600" /> Verified Partner
              </span>
            )}
          </div>
        )}

        {/* Perks */}
        {pick.perks.length > 0 && (
          <div className="space-y-1.5 mb-4">
            {pick.perks.slice(0, 3).map((perk, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-[11px] text-slate-600 leading-snug">{perk}</span>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <button
          onClick={handleCta}
          className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm"
        >
          {pick.cta_text || 'View Deal'} <ExternalLink className="w-3.5 h-3.5" />
        </button>
        <p className="text-[10px] text-slate-400 text-center mt-2">
          Sponsored placement — added by Try1Second admin
        </p>
      </div>
    </div>
  );
};
