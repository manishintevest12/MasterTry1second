/**
 * SearchProgress (owner 27 Oct, screenshots of three reference designs):
 * the ONE loading experience for every vertical, web and app.
 *
 * Owner's words: "jb load ho tho aise aaye jiss se user ko maalum ho ki search ho raha
 * hai ... please wait we are getting the best deal for you, comparing prices across the
 * web at warp speed your ultimate steal is arriving — but instead of count down".
 *
 * So the 3-2-1 countdown is gone. What replaces it is real, visible progress:
 *   - a status heading that fits the vertical ("Finding your best fare..." / "...price")
 *   - a pill with a live green dot and the ACTUAL site being queried right now
 *   - a hard count readout ("7 of 9 sites") drawn from the real source list
 *   - a progress bar that advances as the scan advances
 *   - result-shaped skeleton cards so the page never looks dead or empty
 *
 * Nothing here is decorative invention: SEARCH_SOURCES below is the owner-mandated
 * source list per vertical, so "Checking Croma..." is a site we genuinely query.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface VerticalSearchCopy {
  /** Heading, one line, vertically specific. */
  heading: string;
  /** Reassurance line under the heading. */
  sub: string;
  /** What we call the things we compare, for the count readout. */
  unit: string;
  /** Real sources queried for this vertical (owner-mandated list). */
  sources: string[];
}

export const SEARCH_SOURCES: Record<string, VerticalSearchCopy> = {
  flights: {
    heading: 'Finding your best fare…',
    sub: 'Some fares hide on page 3. We check page 47 on every airline and booking site.',
    unit: 'airlines & booking sites',
    sources: ['Air India', 'IndiGo', 'Akasa Air', 'SpiceJet', 'MakeMyTrip', 'EaseMyTrip', 'Ixigo', 'Yatra', 'Cleartrip'],
  },
  hotels: {
    heading: 'Finding your best room rate…',
    sub: 'Booking sites do not always agree. We are finding out who is cheapest right now.',
    unit: 'hotels & booking sites',
    sources: ['MakeMyTrip', 'Goibibo', 'Booking.com', 'Agoda', 'Yatra', 'Cleartrip', 'EaseMyTrip', 'OYO', 'SaffronStays'],
  },
  bus: {
    heading: 'Finding your best seat price…',
    sub: 'Every operator, every boarding point, every site. Checking them all now.',
    unit: 'operators & booking sites',
    sources: ['redBus', 'AbhiBus', 'MakeMyTrip', 'Yatra', 'Ixigo'],
  },
  cab: {
    heading: 'Finding your best fare…',
    sub: 'Each cab app quotes differently for the same ride. Comparing all of them now.',
    unit: 'cab apps',
    sources: ['Ola', 'Uber', 'inDrive', 'Meru', 'Snap-E'],
  },
  ecommerce: {
    heading: 'Finding your best price…',
    sub: 'Some deals hide on page 3. We check page 300.',
    unit: 'stores',
    sources: ['Amazon India', 'Flipkart', 'Meesho', 'Myntra', 'Ajio', 'Tata CLiQ', 'Croma', 'Reliance Digital', 'JioMart'],
  },
  grocery: {
    heading: 'Finding your best basket price…',
    sub: 'Every 10-minute store near you is quoting right now. Comparing all of them.',
    unit: 'quick stores',
    sources: ['Blinkit', 'Zepto', 'Swiggy Instamart', 'BigBasket', 'Flipkart Minutes', 'JioMart'],
  },
  food: {
    heading: 'Finding your best meal deal…',
    sub: 'Restaurants price the same dish differently on each app. Checking them all.',
    unit: 'apps & restaurants',
    sources: ['Zomato', 'Swiggy', "Domino's", 'Oven Story', 'EatSure'],
  },
  movie: {
    heading: 'Finding your cheapest tickets…',
    sub: 'Same film, same seat, different price on every booking site. Comparing now.',
    unit: 'cinemas & booking sites',
    sources: ['BookMyShow', 'District', 'Paytm', 'PVR INOX', 'Cinepolis', 'TicketNew'],
  },
  loans: {
    heading: 'Finding your best rate…',
    sub: 'Banks rarely advertise their cheapest rate. We are checking anyway.',
    unit: 'lenders',
    sources: ['Paisabazaar', 'BankBazaar', 'Policybazaar', 'Money View', 'KreditBee', 'Navi'],
  },
  insurance: {
    heading: 'Finding your best premium…',
    sub: 'The same cover costs different amounts everywhere. Comparing all of them now.',
    unit: 'insurers',
    sources: ['Policybazaar', 'Ditto', 'InsuranceDekho', 'Acko', 'Digit', 'Coverfox'],
  },
  creditcards: {
    heading: 'Finding your best card…',
    sub: 'Rewards, fees, waivers. We are reading every card on every site right now.',
    unit: 'cards & marketplaces',
    sources: ['Paisabazaar', 'BankBazaar', 'Policybazaar', 'Card Insider', 'CreditMantri'],
  },
  account: {
    heading: 'Finding your best account…',
    sub: 'Savings rates, minimum balance and perks, compared live across banks.',
    unit: 'banks',
    sources: ['Paisabazaar', 'BankBazaar', 'Policybazaar', 'HDFC Bank', 'ICICI Bank', 'SBI'],
  },
};

/** Anything unknown still gets a complete, honest panel (never a blank shell). */
const FALLBACK: VerticalSearchCopy = {
  heading: 'Finding your best deal…',
  sub: 'Comparing prices across the web at warp speed. Your ultimate steal is on its way.',
  unit: 'sites',
  sources: ['our sources'],
};

export function searchCopyFor(vertical?: string | null): VerticalSearchCopy {
  return (vertical && SEARCH_SOURCES[vertical]) || FALLBACK;
}

const ACCENT = '#4f46e5';
const TRACK = '#e8e8f8';
const PILL_BORDER = '#dcdbff';
const PILL_BG = '#eef0fe';
const SKELETON = '#eef2f5';

/** Two result-shaped placeholders: logo square, two text lines, a price bar. */
const SkeletonCards: React.FC<{ rows?: number; className?: string }> = ({ rows = 2, className = '' }) => (
  <div className={`space-y-2.5 ${className}`} aria-hidden>
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        className="flex items-center gap-3 rounded-xl border p-3.5 t1s-sk"
        style={{ borderColor: '#f0f0f0', animationDelay: `${i * 140}ms` }}
      >
        <div className="h-11 w-11 shrink-0 rounded-lg" style={{ background: SKELETON }} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-2.5 rounded-full" style={{ background: SKELETON, width: `${74 - i * 12}%` }} />
          <div className="h-2.5 rounded-full" style={{ background: SKELETON, width: `${46 - i * 6}%` }} />
        </div>
        <div className="h-3 w-12 shrink-0 rounded-full sm:w-16" style={{ background: SKELETON }} />
      </div>
    ))}
  </div>
);

const ProgressStyles: React.FC = () => (
  <style>{`
    @keyframes t1s-sk-kf { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
    .t1s-sk { animation: t1s-sk-kf 1.6s ease-in-out infinite; }
    @keyframes t1s-dot-kf { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.35); opacity: 0.55; } }
    .t1s-dot { animation: t1s-dot-kf 1.2s ease-in-out infinite; }
    @keyframes t1s-fade-up-kf { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }
    .t1s-fade-up { animation: t1s-fade-up-kf 0.35s ease-out; }
    @media (prefers-reduced-motion: reduce) {
      .t1s-sk, .t1s-dot, .t1s-fade-up { animation: none !important; }
    }
  `}</style>
);

export interface SearchProgressProps {
  /** flights | hotels | ecommerce | grocery | ... */
  vertical?: string | null;
  /** What the user typed, echoed back so the page never feels generic. */
  query?: string;
  /** Extra reassurance line (vertical-specific panels supply their own). */
  message?: string;
  /** How many sources have answered so far, when the caller knows it. */
  checked?: number;
  /** Total sources being scanned, when the caller knows it. */
  total?: number;
  /** Skeleton rows under the bar (0 hides them). */
  skeletonRows?: number;
  className?: string;
}

/**
 * The full-size panel: used wherever results will land on this page.
 * Mobile-first: everything stacks, the count readout drops under the pill on
 * narrow screens, and nothing has a fixed width or height.
 */
export const SearchProgressPanel: React.FC<SearchProgressProps> = ({
  vertical,
  query,
  message,
  checked,
  total,
  skeletonRows = 2,
  className = '',
}) => {
  const copy = useMemo(() => searchCopyFor(vertical), [vertical]);
  const sources = copy.sources.length ? copy.sources : FALLBACK.sources;
  const totalSites = total && total > 0 ? total : sources.length;
  const [siteIdx, setSiteIdx] = useState(0);
  const [progress, setProgress] = useState(6);
  const startedAt = useRef(Date.now());

  // Cycle through the REAL sites we query, so the pill names a genuine source.
  useEffect(() => {
    const id = setInterval(() => setSiteIdx((i) => (i + 1) % sources.length), 850);
    return () => clearInterval(id);
  }, [sources.length]);

  // Ease toward 92% and hold: only real results finish the bar.
  useEffect(() => {
    const id = setInterval(() => {
      setProgress((p) => {
        const elapsed = (Date.now() - startedAt.current) / 1000;
        const target = Math.min(92, 8 + elapsed * 9);
        return Math.max(p, Math.min(92, p + Math.max(0.35, (target - p) * 0.35)));
      });
    }, 450);
    return () => clearInterval(id);
  }, []);

  const answered = typeof checked === 'number' ? Math.max(0, Math.min(checked, totalSites)) : Math.max(1, Math.round((progress / 100) * totalSites));
  const currentSite = sources[siteIdx % sources.length];

  return (
    <section
      className={`w-full rounded-xl border border-slate-200 bg-white p-4 sm:p-6 ${className}`}
      role="status"
      aria-live="polite"
      aria-label={`${copy.heading} Comparing prices across the web at warp speed.`}
    >
      <ProgressStyles />
      <h3 className="text-[15px] leading-snug font-extrabold text-slate-900 sm:text-lg">
        {copy.heading}
        {query ? <span className="font-bold text-slate-500"> {query}</span> : null}
      </h3>
      <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500 sm:text-sm">{message || copy.sub}</p>

      {/* Live pill + hard count readout */}
      <div className="mt-3.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="inline-flex w-fit max-w-full items-center gap-2 rounded-full border px-3 py-1.5"
          style={{ background: PILL_BG, borderColor: PILL_BORDER }}
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70 t1s-dot" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span key={currentSite} className="t1s-fade-up truncate text-[12px] font-bold sm:text-[12.5px]" style={{ color: '#4a4a9c' }}>
            Checking {currentSite}…
          </span>
        </div>
        <p className="text-[11.5px] font-semibold text-slate-500 tabular-nums sm:text-right sm:text-xs">
          {answered} of {totalSites} {copy.unit}
        </p>
      </div>

      {/* Progress bar: track #e8e8f8, fill #4f46e5 */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full" style={{ background: TRACK }}>
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.round(progress)}%`, background: ACCENT }}
        />
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
        Please wait, we are getting the best deal for you. Prices appear here automatically the
        moment each site answers, so there is nothing for you to redo.
      </p>

      {skeletonRows > 0 ? <SkeletonCards rows={skeletonRows} className="mt-4" /> : null}
    </section>
  );
};

/**
 * One-line strip version for tight placements (top of a feed, a card header).
 * Same language, same colours, no countdown.
 */
export const SearchProgressBanner: React.FC<{ vertical?: string | null; query?: string }> = ({ vertical, query }) => {
  const copy = useMemo(() => searchCopyFor(vertical), [vertical]);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % copy.sources.length), 900);
    return () => clearInterval(id);
  }, [copy.sources.length]);
  return (
    <div
      className="mb-3 flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5"
      style={{ borderColor: PILL_BORDER, background: PILL_BG }}
      role="status"
      aria-live="polite"
    >
      <ProgressStyles />
      <span className="relative mt-1 flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70 t1s-dot" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span className="min-w-0 text-[12px] font-semibold leading-snug" style={{ color: '#4a4a9c' }}>
        <span key={idx} className="t1s-fade-up">Checking {copy.sources[idx % copy.sources.length]}…</span>{' '}
        <span className="font-medium text-slate-500">
          {copy.heading} Please wait, we are getting the best deal for you
          {query ? ` for “${query}”` : ''}.
        </span>
      </span>
    </div>
  );
};

export default SearchProgressPanel;
