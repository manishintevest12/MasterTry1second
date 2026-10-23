import React, { useEffect, useState } from 'react';
import { ChevronRight, Play } from 'lucide-react';

/**
 * HomeBannerStrip (owner 23 Oct): dynamic admin-managed banner strips rendered
 * BETWEEN every home section on web + Flutter. Wide landscape format (length
 * zyada, breadth kam), edge-to-edge image, and the whole strip is a link into
 * the site (e.g. the Movies vertical) — banners come from /api/home-banners
 * (admin HomeBannersTab: image, link, order, active).
 */

export type HomeBanner = {
  id: number;
  imageUrl: string;
  link: string; // vertical id ('movies') or an https URL
  title?: string | null;
  subtitle?: string | null;
};

// Module-level cache: every strip on the page shares ONE fetch per page load.
let bannerCache: HomeBanner[] | null = null;
let bannerInflight: Promise<HomeBanner[]> | null = null;

export function fetchHomeBanners(): Promise<HomeBanner[]> {
  if (bannerCache) return Promise.resolve(bannerCache);
  if (!bannerInflight) {
    const load = async (): Promise<HomeBanner[]> => {
      try {
        const r = await fetch('/api/home-banners');
        const d = r.ok ? await r.json() : null;
        bannerCache = d?.success && Array.isArray(d.banners) ? (d.banners as HomeBanner[]) : [];
        return bannerCache;
      } catch {
        bannerCache = [];
        return [];
      }
    };
    bannerInflight = load();
  }
  return bannerInflight;
}

const resolveImage = (url: string) => (/^https?:\/\//.test(url) ? url : url);

/** Owner 23 Oct (image-1 reference): dark cinematic banner between sections —
 * rounded image left, kind badge, headline, sub, red CTA, dots + next arrow.
 * Auto-cycles every 5s; "Video Library" chip deliberately NOT included. */
const BADGE: Record<string, string> = { movies: 'MOVIE PICK', food: 'FOOD PICK', ecommerce: 'MEGA DEAL' };
const CTA: Record<string, string> = { movies: 'Book Now', food: 'Order Now', ecommerce: 'Grab Deal' };

export const HomeBannerStrip: React.FC<{ slot: number; onLaunchVertical?: (vertical: string) => void }> = ({ slot, onLaunchVertical }) => {
  const [banners, setBanners] = useState<HomeBanner[] | null>(null);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    let alive = true;
    fetchHomeBanners().then((b) => {
      if (alive) setBanners(b);
    });
    return () => {
      alive = false;
    };
  }, []);
  // Auto-cycle the strip (5s per slide, like the hero carousel).
  useEffect(() => {
    if (!banners || banners.length < 2) return;
    const t = setInterval(() => setIdx((i) => i + 1), 5000);
    return () => clearInterval(t);
  }, [banners]);
  // Keep the strip anchored to its slot while cycling within the pool.
  useEffect(() => {
    setIdx(slot);
  }, [slot]);

  if (!banners || banners.length === 0) return null;
  const n = banners.length;
  const b = banners[((idx % n) + n) % n];
  if (!b?.imageUrl) return null;

  const isExternal = /^https?:\/\//.test(b.link);
  const onClick = () => {
    if (isExternal) window.open(b.link, '_blank', 'noopener');
    else if (onLaunchVertical) onLaunchVertical(b.link);
  };
  const badge = BADGE[b.link] || 'TOP PICK';
  const cta = CTA[b.link] || 'Order Now';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="relative w-full overflow-hidden rounded-2xl bg-[#0d0d0d] shadow-md">
        <button type="button" onClick={onClick} className="flex w-full items-center gap-3 sm:gap-5 px-3 py-3 sm:px-6 sm:py-5 text-left cursor-pointer group">
          {/* left: rounded image */}
          <img
            src={resolveImage(b.imageUrl)}
            alt={b.title || 'Featured'}
            loading="lazy"
            className="shrink-0 w-[96px] h-[72px] sm:w-[150px] sm:h-[100px] lg:w-[176px] lg:h-[110px] object-cover rounded-xl sm:rounded-2xl transition-transform duration-300 group-hover:scale-[1.03]"
          />
          {/* middle: badge + headline + sub + source */}
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1a1a2e] text-[9px] sm:text-[10px] font-black tracking-wider text-white">
              <Play className="w-2.5 h-2.5 text-red-500 fill-red-500" />
              {badge}
            </span>
            <div className="mt-1.5 sm:mt-2 truncate text-white font-extrabold text-[13px] sm:text-lg lg:text-xl leading-tight">
              {b.title || 'Featured pick'}
            </div>
            <div className="mt-0.5 sm:mt-1 truncate text-slate-400 text-[10.5px] sm:text-sm">{b.subtitle || 'Live offer'}</div>
          </div>
          {/* right: red CTA */}
          <span className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[11px] sm:text-sm font-bold shadow-sm">
            {cta}
            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </span>
        </button>

        {/* middle-right circular next arrow (only when more than one slide) */}
        {n > 1 && (
          <button
            type="button"
            aria-label="Next banner"
            onClick={(e) => {
              e.stopPropagation();
              setIdx((i) => i + 1);
            }}
            className="absolute right-1.5 sm:right-3 top-1/2 -translate-y-1/2 hidden sm:flex w-8 h-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/10 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {/* bottom-center pagination dots */}
        {n > 1 && (
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {Array.from({ length: n }).map((_, d) => (
              <button
                key={d}
                type="button"
                aria-label={`Banner ${d + 1}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setIdx(d);
                }}
                className={`w-[7px] h-[7px] rounded-full cursor-pointer transition-colors ${d === ((idx % n) + n) % n ? 'bg-white' : 'bg-white/30 hover:bg-white/50'}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
