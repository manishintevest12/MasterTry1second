/**
 * Home Showcase (owner spec, 21 Oct + reference-design restyle 22 Oct):
 * the eight curated sections under the "Instant Launch Verticals" grid —
 * Picked Just for You, Special Offers For You, Go Big (bigger deals &
 * greater savings), Best in Tech & Gadgets, Steals You Can't Ignore,
 * Famous Places to Visit, Best Cards, Top Destinations.
 *
 * Reference ideas applied (BuyHatke screenshots: Deal Drop, Deals Worth
 * Grabbing, hatke steal cards) but ALWAYS in the Try1Second RED brand —
 * never the reference purple (standing owner rule).
 *   - hero strip "DEALS WORTH GRABBING" with real floating product art
 *   - category pills that launch REAL metasearch queries
 *   - 2-col mobile product grid; seller chip, star rating, discount ring,
 *     price + struck MRP, and red "EPIC STEAL" / "HOT DEAL" badges.
 *
 * Every item is REAL (server builds them from the live offers catalogue +
 * synced affiliate registries; empty sections are omitted server-side).
 * Every click goes through the masking pointer (/api/out) so the Amazon
 * Associates tag and Myntra INR-Deals/Cuelinks routing are injected
 * server-side, exactly like every other Try1Second redirection.
 */
import React, { useEffect, useState, type SyntheticEvent } from 'react';
import { Sparkles, Ticket, Flame, PiggyBank, Cpu, Bolt, MapPin, CreditCard, ArrowRight, Star, Plane } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { HomeBannerStrip } from './HomeBannerStrip';
import { scaledImage } from '../utils/scaledImage';

export interface ShowcaseItem {
  id: string;
  title: string;
  merchant: string;
  merchantLogo: string | null;
  image: string | null;
  price: number | null;
  mrp: number | null;
  discountPct: number | null;
  rating: number | null;
  badge: string | null;
  url: string;
  launch?: { vertical: string; query: string } | null;
}

export interface ShowcaseSection {
  id: string;
  title: string;
  subtitle: string;
  items: ShowcaseItem[];
}

const SECTION_ICONS: Record<string, typeof Sparkles> = {
  picked: Sparkles,
  special: Ticket,
  massive: Flame,
  mega: PiggyBank,
  tech: Cpu,
  steals: Bolt,
  places: MapPin,
  cards: CreditCard,
  destinations: Plane,
};

/** Section -> the vertical its "View all" launches (real engine, not a fake link). */
const SECTION_VERTICAL: Record<string, string> = {
  picked: 'ecommerce', special: 'ecommerce', massive: 'ecommerce', mega: 'ecommerce',
  tech: 'ecommerce', steals: 'ecommerce', places: 'hotels', cards: 'creditcards', destinations: 'flights',
};

/** Real metasearch queries for the pill row (reference: Deal Drop category pills). */
const PILL_QUERIES = [
  "men's Wrist Watches", 'Smart Televisions', "men's Running Shoes", 'Headphones',
  'Mobile Power Banks', 'Smart Watches', 'Tablets', "men's Shirts",
];

const rupee = (v: number) =>
  `\u20B9${v >= 1000 ? v.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : v % 1 === 0 ? v : v.toFixed(2)}`;

/** Red-brand hatke badges (reference idea, our palette). Tiers are honest math. */
function stealBadge(item: ShowcaseItem): string | null {
  if (item.discountPct == null) return null;
  if (item.discountPct >= 60) return 'EPIC STEAL';
  if (item.discountPct >= 30) return 'HOT DEAL';
  return null;
}

function DiscountRing({ pct }: { pct: number }) {
  // Reference card element: small circular progress arc — here it carries the
  // real discount percent, red brand.
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-label={`${pct}% off`}>
      <circle cx="13" cy="13" r={r} fill="white" stroke="#f1f5f9" strokeWidth="3.5" />
      <circle
        cx="13" cy="13" r={r} fill="none" stroke="#e11d48" strokeWidth="3.5"
        strokeLinecap="round" strokeDasharray={`${(Math.min(pct, 100) / 100) * c} ${c}`}
        transform="rotate(-90 13 13)"
      />
      <text x="13" y="16.5" textAnchor="middle" fontSize="8" fontWeight="900" fill="#e11d48">
        {pct}
      </text>
    </svg>
  );
}

/** Coupon / special-offer card (owner 22 Oct: "acer, ajio gram logo clearly visible
 *  ni hai"). A merchant logo must never float tiny in a product-image slot:
 *  it gets a dedicated light-grey tile with a border, so white-on-white logos
 *  (Trost) stay visible, and the crisp Wikidata art renders at full quality.
 *  Typography follows the reference: store name BOLD uppercase, description in a
 *  light weight, coupon code BOLD red. */
/** Staged art fallback (owner 22 Oct: initials text is the LAST resort).
 *  Chain: source art -> merchant's own logo tile -> initials avatar. The
 *  `stage` dataset flag stops onError from looping. */
function onArtError(e: SyntheticEvent<HTMLImageElement>, item: ShowcaseItem, initials: string) {
  const img = e.target as HTMLImageElement;
  const stage = img.dataset.stage || '0';
  // stage 0 = wsrv.nl-sized art failed -> retry the RAW CDN URL (proxy down = graceful degrade)
  if (stage === '0' && item.image && item.image !== img.src) {
    img.dataset.stage = '1';
    img.src = item.image;
    return;
  }
  if (stage !== '2' && item.merchantLogo && item.merchantLogo !== img.src) {
    img.dataset.stage = '2';
    img.src = item.merchantLogo;
    return;
  }
  if (stage !== '3') {
    img.dataset.stage = '3';
    img.src = initials; // worst case only — server-side liveness keeps this rare
  }
}

/** Owner 23 Oct: exported — RewardsHub renders the relocated 'Special Offers
 * For You' section with the identical card the homepage used to show. */
export function CouponCard({ item }: { item: ShowcaseItem }) {
  // Owner 22 Oct (reference screenshot): this section is ALL merchant logos —
  // a logo never goes through the product-image pipeline (no cover-crop, no
  // image tile). Each card is a pure LOGO card: logo centered at a fixed
  // height on a clean white surface, bold brand name, grey offer line, and a
  // pill-shaped outlined coupon code. Mirrored in Flutter showcase cards.
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.merchant)}&background=1e293b&color=ffffff&size=160`;
  const code = item.badge && item.badge.startsWith('Code: ') ? item.badge.slice(6) : null;
  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer" className="group bg-white rounded-lg border border-slate-200 hover:border-red-400 hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col cursor-pointer">
      <div className="h-[84px] bg-white flex items-center justify-center p-4">
        <img
          src={scaledImage(item.image, 240) || fallback}
          alt={item.merchant}
          width={240}
          height={84}
          loading="lazy"
          decoding="async"
          className="max-h-[56px] max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
          onError={(e) => onArtError(e, item, fallback)}
        />
      </div>
      <div className="px-3 pb-3 pt-1.5 flex flex-col gap-1 flex-1 border-t border-slate-100">
        <span className="text-[11px] font-black uppercase tracking-wide text-slate-900 truncate">{item.merchant}</span>
        <span className="text-[11px] font-medium text-slate-500 leading-snug line-clamp-2">{item.title}</span>
        <span className="mt-auto inline-flex items-center self-start px-2.5 py-1 rounded-full bg-red-50/60 border border-red-200 text-[10.5px] font-black text-red-600 tracking-wide">
          {code ? `CODE: ${code}` : item.badge}
        </span>
      </div>
    </a>
  );
}

function ShowcaseCard({ item, onLaunch }: { item: ShowcaseItem; onLaunch?: (q: string, v: string) => void }) {
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.merchant)}&background=fef2f2&color=e11d48&size=160`;
  const sb = stealBadge(item);
  const isLaunchCard = Boolean(item.launch);
  const cardClass = "group bg-white rounded-2xl border border-slate-200 hover:border-red-400 hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col cursor-pointer";
  const inner = (
    <>
      <div className="relative h-36 sm:h-40 bg-slate-50 overflow-hidden">
        <img
          src={scaledImage(item.image, 400, 160) || fallback}
          alt={item.title}
          width={400}
          height={160}
          loading="lazy"
          decoding="async"
          /* Owner 23 Oct: images OCCUPY the card edge-to-edge like the hotel photos
           (object-contain + padding left portrait credit-card art floating small
           in a sea of white). Cover fills the tile; wide product/hotel art is
           unaffected visually. */
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => onArtError(e, item, fallback)}
        />
        {item.discountPct ? (
          <div className="absolute top-2 right-2">
            <DiscountRing pct={item.discountPct} />
          </div>
        ) : null}
        {/* seller chip (reference: marketplace logo corner badge) */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-white/95 backdrop-blur px-1.5 py-0.5 rounded-lg border border-slate-200">
          {item.merchantLogo ? (
            <img src={item.merchantLogo} alt="" className="w-4 h-4 rounded object-contain" />
          ) : null}
          <span className="text-[9px] font-black text-slate-600 uppercase tracking-wide">{item.merchant}</span>
        </div>
        {item.rating ? (
          <div className="absolute bottom-2 right-2 flex items-center gap-0.5 bg-emerald-50 px-1.5 py-0.5 rounded-lg border border-emerald-200">
            <Star className="w-2.5 h-2.5 fill-emerald-500 text-emerald-500" />
            <span className="text-[9px] font-black text-emerald-700">{item.rating.toFixed(1)}</span>
          </div>
        ) : null}
      </div>
      <div className="p-2.5 flex flex-col gap-1 flex-1">
        {/* Owner 22 Oct typography hierarchy (reference image 2): product name in a
            standard weight, price BOLD and bigger, savings in green. */}
        <span className="text-[11.5px] font-medium text-slate-700 leading-snug line-clamp-2">{item.title}</span>
        <div className="flex flex-wrap items-baseline gap-1.5">
          {item.price != null ? (
            <>
              <span className="text-base font-black text-slate-900">{rupee(item.price)}</span>
              {item.mrp ? <span className="text-[10.5px] font-medium text-slate-400 line-through">{rupee(item.mrp)}</span> : null}
              {item.discountPct ? <span className="text-[10.5px] font-black text-emerald-600">{item.discountPct}% Off</span> : null}
            </>
          ) : item.badge ? (
            <span className="text-[11px] font-black text-red-600">{item.badge}</span>
          ) : null}
        </div>
        {sb ? (
          <span className="mt-auto inline-flex items-center gap-1 self-start px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[9.5px] font-black text-emerald-700 tracking-wide">
            {sb === 'EPIC STEAL' ? '\u{1F680}' : '\u{1F525}'} {sb}
          </span>
        ) : item.badge && (item.price != null || isLaunchCard) ? (
          <span className="mt-auto inline-flex items-center self-start px-2 py-0.5 rounded-full bg-red-50 border border-red-100 text-[9.5px] font-black text-red-600 tracking-wide">
            {item.badge}
          </span>
        ) : null}
      </div>
    </>
  );
  // Famous Destinations: a real in-app flights engine launch, never an external link.
  if (isLaunchCard && item.launch && onLaunch) {
    return (
      <button type="button" onClick={() => onLaunch(item.launch!.query, item.launch!.vertical)} className={cardClass + ' text-left'}>
        {inner}
      </button>
    );
  }
  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer" className={cardClass}>
      {inner}
    </a>
  );
}

export default function HomeShowcase() {
  const [sections, setSections] = useState<ShowcaseSection[]>([]);
  const { setVertical, setActiveNavTab, setPendingAssistantSearch } = useApp();

  useEffect(() => {
    let alive = true;
    fetch('/api/home/showcase')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        // Owner 23 Oct: 'Special Offers For You' moved to the REWARDS hub —
        // the homepage never renders it anymore.
        if (alive && d?.sections) setSections(d.sections.filter((s: ShowcaseSection) => s.id !== 'special'));
      })
      .catch(() => {/* honest: no showcase rather than mock cards */});
    return () => { alive = false; };
  }, []);

  const launchQuery = (q: string, vertical: string = 'ecommerce') => {
    setVertical(vertical as never);
    setPendingAssistantSearch({ vertical, query: q });
    setActiveNavTab('compare');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const viewAll = (secId: string) => {
    const v = SECTION_VERTICAL[secId] || 'ecommerce';
    setVertical(v as never);
    setActiveNavTab('compare');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (sections.length === 0) return null;
  const heroArts = sections.flatMap((s) => s.items).filter((i) => i.image).slice(0, 3);

  return (
    <section className="space-y-7">
      {/* HERO STRIP (reference: "Deals Worth Grabbing" banner) — red brand,
          real product art from the live showcase itself. */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-red-100 bg-gradient-to-r from-rose-50 via-orange-50 to-amber-50 px-5 py-5 sm:px-8 sm:py-7">
          <div className="absolute inset-0 opacity-[0.35] pointer-events-none bg-[radial-gradient(#fecdd3_1.2px,transparent_1.2px)] [background-size:22px_22px]" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg sm:text-2xl font-black tracking-tight text-red-600">
                DEALS WORTH GRABBING
              </h2>
              <p className="text-[11.5px] sm:text-xs text-slate-600 font-semibold mt-1">
                Live-acquired prices from India's biggest stores. No guesswork, just the lowest.
              </p>
            </div>
            <div className="hidden sm:flex items-end -space-x-6 shrink-0">
              {heroArts.map((a) => (
                <img
                  key={a.id}
                  src={scaledImage(a.image, 160, 160) || undefined}
                  alt=""
                  width={80}
                  height={80}
                  className="w-20 h-20 object-contain drop-shadow-md rounded-xl bg-white/70 border border-white"
                  loading="lazy"
                  decoding="async"
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CATEGORY PILLS (reference: Deal Drop pills) — each launches a REAL search */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {PILL_QUERIES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => launchQuery(q)}
              className="shrink-0 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 hover:border-red-400 hover:text-red-600 text-[11.5px] font-bold text-slate-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* SECTIONS (reference: 2-col card grid on mobile) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {sections.map((sec, idx) => {
          const Icon = SECTION_ICONS[sec.id] || Sparkles;
          // Owner 23 Oct ('6, 12' rule): rows render in complete blocks of 6 —
          // a section shows 6 items (one row) or 12 (two rows); anything
          // between (or below) trims/hides so no half-empty row ever shows.
          const visible = sec.items.length >= 12 ? 12 : sec.items.length >= 6 ? 6 : 0;
          if (visible === 0) return null;
          const items = sec.items.slice(0, visible);
          return (
            <React.Fragment key={sec.id}>
            {/* Owner 23 Oct: a dynamic admin banner strip sits between EVERY
                section (e.g. between 'Picked Just for You' and 'Go Big'). */}
            {idx > 0 && <HomeBannerStrip slot={idx + 1} onLaunchVertical={(v) => launchQuery('', v)} />}
            <div>
              <div className="flex items-end justify-between mb-3 gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-8 h-8 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-red-600" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-[15px] font-black uppercase tracking-wide text-slate-900 truncate">
                      {sec.title}
                    </h2>
                    <p className="text-[11px] text-slate-500 truncate">{sec.subtitle}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => viewAll(sec.id)}
                  className="text-[11px] font-black text-red-600 hover:text-red-700 flex items-center gap-0.5 shrink-0 cursor-pointer"
                >
                  View all <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {items.map((item) =>
                  sec.id === 'special' ? (
                    <CouponCard key={item.id} item={item} />
                  ) : (
                    <ShowcaseCard key={item.id} item={item} onLaunch={launchQuery} />
                  ),
                )}
              </div>
            </div>
            </React.Fragment>
          );
        })}
      </div>
    </section>
  );
}
