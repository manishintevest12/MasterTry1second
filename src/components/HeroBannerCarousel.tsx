import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Play, ArrowRight } from 'lucide-react';

/**
 * HeroBannerCarousel (owner 23 Oct, BookMyShow reference): the big dark hero
 * at the top of the home page. MIXED content — one movie slide, one food
 * slide, one ecom-deal slide (server-composed from live data), rotating with
 * arrows + dots, autoplay 5s, swipeable on touch, fully responsive: on phones
 * the poster shrinks and the synopsis/meta collapse so the slide stays clearly
 * visible. Brand red (#E11D48) for accents — reference colors never copied.
 */

export interface HeroSlide {
  id: string;
  kind: 'movie' | 'food' | 'ecommerce' | 'custom';
  badge: string;
  subheading: string | null;
  heading: string;
  meta: string | null;
  language: string | null;
  synopsis: string | null;
  poster: string | null;
  backdrop: string | null;
  cta: string;
  url: string | null;
  launch: { vertical: string; query: string } | null;
}

let slideCache: HeroSlide[] | null = null;

export const HeroBannerCarousel: React.FC<{
  onLaunch?: (vertical: string, query: string) => void;
}> = ({ onLaunch }) => {
  const [slides, setSlides] = useState<HeroSlide[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    if (slideCache) { setSlides(slideCache); return; }
    let alive = true;
    fetch('/api/home/hero-banners')
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const s: HeroSlide[] = d?.success && Array.isArray(d.slides) ? d.slides : [];
        slideCache = s;
        setSlides(s);
      })
      .catch(() => alive && setSlides([]));
    return () => { alive = false; };
  }, []);

  const go = useCallback((n: number) => {
    setIdx((i) => {
      if (!slides || slides.length === 0) return 0;
      return (n + slides.length) % slides.length;
    });
  }, [slides]);

  useEffect(() => {
    if (!slides || slides.length < 2 || paused) return;
    const t = setInterval(() => go(idx + 1), 5000);
    return () => clearInterval(t);
  }, [slides, idx, paused, go]);

  if (!slides || slides.length === 0) return null; // honest: no data, no hero
  const s = slides[Math.min(idx, slides.length - 1)];

  const activate = () => {
    if (s.url) window.open(s.url, '_blank', 'noopener');
    else if (s.launch && onLaunch) onLaunch(s.launch.vertical, s.launch.query);
  };

  return (
    <section
      className="relative w-full overflow-hidden select-none"
      style={{ background: 'linear-gradient(135deg, #0a0b1e 0%, #000000 100%)' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 45) go(idx + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
    >
      {/* blurred backdrop */}
      {s.backdrop && (
        <img
          src={s.backdrop}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover opacity-25 blur-[6px] scale-110 pointer-events-none"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/85 pointer-events-none" />

      {/* Owner 23 Oct: "Video Library" chip removed per request */}

      <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 lg:py-10">
        <div className="flex items-center gap-4 sm:gap-7 lg:gap-10">
          {/* poster (left) — shrinks but never disappears on mobile */}
          <button
            type="button"
            onClick={activate}
            className="shrink-0 rounded-lg sm:rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/15 w-[104px] sm:w-40 lg:w-48 aspect-[2/3] bg-[#14162b] block"
            aria-label={s.heading}
          >
            {s.poster && <img src={s.poster} alt={s.heading} className="w-full h-full object-cover" />}
          </button>

          {/* content (right) */}
          <div className="min-w-0 flex-1 text-left">
            <span className="inline-flex items-center gap-1.5 bg-[#1e2235] text-white text-[10px] sm:text-[11px] font-black tracking-wider px-2.5 py-1 rounded-md">
              <Play className="w-3 h-3 text-red-500 fill-red-500" />
              {s.badge}
            </span>
            {s.subheading && (
              <p className="mt-1.5 sm:mt-2.5 text-[11px] sm:text-[13px] font-semibold text-slate-300">{s.subheading}</p>
            )}
            <h2 className="mt-0.5 sm:mt-1 text-lg sm:text-3xl lg:text-4xl font-black text-white leading-tight line-clamp-2">{s.heading}</h2>
            {s.meta && <p className="mt-1 sm:mt-1.5 text-[10.5px] sm:text-[13px] text-slate-200 font-medium truncate">{s.meta}</p>}
            {s.language && <p className="mt-0.5 text-[10.5px] sm:text-xs text-slate-300">{s.language}</p>}
            {s.synopsis && (
              <p className="mt-2 hidden sm:block max-w-xl text-[12px] leading-relaxed text-slate-300 line-clamp-3">{s.synopsis}</p>
            )}
            <div className="mt-2.5 sm:mt-5 flex items-center gap-2.5">
              <button
                type="button"
                onClick={activate}
                className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-[11px] sm:text-sm font-bold px-3.5 sm:px-6 py-1.5 sm:py-2.5 rounded-lg transition-colors shadow-lg shadow-red-600/25"
              >
                {s.cta} <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* pagination dots */}
        <div className="mt-4 sm:mt-6 flex items-center justify-center gap-2">
          {slides.map((_, i) => (
            <button
              key={`dot-${i}`}
              type="button"
              aria-label={`Slide ${i + 1}`}
              onClick={() => go(i)}
              className={`rounded-full transition-all ${i === Math.min(idx, slides.length - 1) ? 'w-2 h-2 bg-white' : 'w-2 h-2 bg-white/25 hover:bg-white/45'}`}
            />
          ))}
        </div>
      </div>

      {/* arrows (desktop hover affordance; small screens swipe) */}
      {slides.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous"
            onClick={() => go(idx - 1)}
            className="hidden sm:flex absolute left-2 lg:left-3 top-1/2 -translate-y-1/2 z-20 items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={() => go(idx + 1)}
            className="hidden sm:flex absolute right-2 lg:right-3 top-1/2 -translate-y-1/2 z-20 items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}
    </section>
  );
};

export default HeroBannerCarousel;
