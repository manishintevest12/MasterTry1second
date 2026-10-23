import { useEffect, useState } from 'react';
import { Crown, TrendingDown, ExternalLink, Store, Ticket } from 'lucide-react';
import { AdBannerSlot } from './AdBannerSlot';
import { CouponCard, ShowcaseItem } from './HomeShowcase';

/**
 * Rewards → Top Picks (owner request 21 Oct): one best pick per vertical.
 * Data comes ONLY from /api/rewards/top-picks — admin-curated picks plus live
 * auto-picks from the real offers catalogue. Every card redirects through its
 * masking pointer (/api/out) so affiliate injection is server-side. When a
 * vertical has no honest pick, it is absent — never a placeholder.
 */
interface TopPick {
  vertical: string;
  source: 'admin' | 'live';
  partnerName: string;
  headline: string;
  offerText: string | null;
  priceBadge: string | null;
  badgeText: string | null;
  rating: number | null;
  image: string | null;
  ctaText: string;
  url: string;
}

const VERTICAL_LABEL: Record<string, string> = {
  ecommerce: 'Shopping', grocery: 'Grocery', food: 'Food', flights: 'Flights', hotels: 'Hotels',
  bus: 'Bus', cab: 'Cabs', movie: 'Movies', loans: 'Loans', insurance: 'Insurance',
  creditcards: 'Credit Cards', account: 'Accounts',
};

export const RewardsTopPicks: React.FC = () => {
  const [picks, setPicks] = useState<TopPick[] | null>(null);
  const [error, setError] = useState('');
  // Owner 23 Oct: 'Special Offers For You' moved from the homepage to HERE —
  // the same /api/home/showcase coupon section, identical CouponCard grid.
  const [special, setSpecial] = useState<ShowcaseItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/home/showcase')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        const sec = (d?.sections || []).find((s: { id: string }) => s.id === 'special');
        if (sec?.items?.length) setSpecial(sec.items);
      })
      .catch(() => {/* honest: strip stays hidden on failure */});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/rewards/top-picks');
        const d = await res.json();
        if (cancelled) return;
        if (!res.ok || d.success === false) throw new Error(d.error || 'Could not load top picks');
        setPicks(d.picks || []);
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message || e));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-5">
      <AdBannerSlot slotKey="rewards_top" />

      {special.length > 0 && (
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Ticket className="w-5 h-5 text-red-600" />
            Special Offers For You
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5 ml-7">auto-tested coupons from live registries — {special.length} offers</p>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {special.map((item) => <CouponCard key={item.id} item={item} />)}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
          <Crown className="w-5 h-5 text-red-600" />
          Top Picks — one best deal per vertical
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          The strongest live deal our engine recorded in each vertical. Prices are real captured offers, never estimated.
        </p>
      </div>

      {error && <div className="bg-white rounded-2xl border border-slate-200 p-4 text-sm text-red-600">{error}</div>}

      {!picks && !error && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-3 animate-pulse">
              <div className="h-28 rounded-lg bg-slate-100" />
              <div className="h-3 rounded bg-slate-100 mt-3" />
              <div className="h-3 w-2/3 rounded bg-slate-100 mt-2" />
            </div>
          ))}
        </div>
      )}

      {picks && picks.length === 0 && !error && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-sm text-slate-600">
          No top picks recorded yet. Every vertical's engine records live offers continuously — picks appear as soon as each has a real captured deal (admin picks also appear instantly once configured under Admin → Placements).
        </div>
      )}

      {picks && picks.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {picks.map((p, i) => (
            <a
              key={`${p.vertical}-${i}`}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="group bg-white rounded-2xl border border-slate-200 hover:border-red-300 hover:shadow-md transition-all overflow-hidden flex flex-col"
            >
              <div className="relative aspect-[4/3] bg-slate-50 overflow-hidden">
                {p.image ? (
                  <img src={p.image} alt={p.headline} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Store className="w-9 h-9 text-slate-300" />
                  </div>
                )}
                <span className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide">
                  {VERTICAL_LABEL[p.vertical] || p.vertical}
                </span>
                {p.badgeText && (
                  <span className="absolute bottom-2 left-2 bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                    <TrendingDown className="w-3 h-3" /> {p.badgeText}
                  </span>
                )}
              </div>
              <div className="p-3 flex flex-col flex-1">
                <p className="text-xs font-black text-slate-900 line-clamp-2 leading-snug">{p.headline}</p>
                <p className="text-[11px] text-slate-500 mt-1 truncate">via {p.partnerName}</p>
                {p.priceBadge && <p className="text-sm font-black text-red-600 mt-1.5">{p.priceBadge}</p>}
                {p.offerText && <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{p.offerText}</p>}
                <span className="mt-auto pt-2.5 inline-flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[11px] font-black transition-colors">
                  {p.ctaText || 'Grab Deal'} <ExternalLink className="w-3.5 h-3.5" />
                </span>
              </div>
            </a>
          ))}
        </div>
      )}

      <AdBannerSlot slotKey="rewards_inline" />
    </div>
  );
};
