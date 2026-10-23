import React, { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';

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

export const HomeBannerStrip: React.FC<{ slot: number; onLaunchVertical?: (vertical: string) => void }> = ({ slot, onLaunchVertical }) => {
  const [banners, setBanners] = useState<HomeBanner[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetchHomeBanners().then((b) => {
      if (alive) setBanners(b);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!banners || banners.length === 0) return null;
  const b = banners[slot % banners.length];
  if (!b?.imageUrl) return null;

  const isExternal = /^https?:\/\//.test(b.link);
  const onClick = () => {
    if (isExternal) window.open(b.link, '_blank', 'noopener');
    else if (onLaunchVertical) onLaunchVertical(b.link);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onClick}
        className="group relative block w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm cursor-pointer"
        aria-label={b.title || 'Featured banner'}
      >
        <img
          src={resolveImage(b.imageUrl)}
          alt={b.title || 'Featured'}
          loading="lazy"
          className="w-full h-[92px] sm:h-[128px] lg:h-[150px] object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
        {b.title && (
          <span className="absolute left-3 bottom-2 sm:left-4 sm:bottom-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/95 text-[10px] sm:text-[11px] font-black text-slate-900 shadow">
            {b.title}
            <ChevronRight className="w-3 h-3 text-red-600" />
          </span>
        )}
      </button>
    </div>
  );
};
