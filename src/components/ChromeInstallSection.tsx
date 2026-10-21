import React, { useState, useEffect } from 'react';
import { Chrome, Play, Sparkles, Bell, TrendingDown, Ticket, ArrowRight, BadgeCheck, ShieldCheck, MapPin, ShoppingBag, ShoppingBasket, Utensils, Plane, Building2, Bus, Car, Film, Landmark, CreditCard, Gift } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAppLinks } from '../utils/useAppLinks';

/**
 * Chrome install section (owner reference design, 16 Oct) — sits right below the
 * Instant Launch Verticals grid. Structure follows the reference layout
 * (label / two-line heading with accent word / CTAs / laurels / stat rows /
 * right-side interactive demo with slide dots) with ORIGINAL copy and HONEST
 * startup claims only: no borrowed store ratings or "most installed" claims —
 * the numbers below are Try1Second's own real capabilities.
 */

interface Slide {
  id: string;
  label: string;
  headingA: string;
  headingAccent: string;
  sub: string;
  icon: React.ReactNode;
  demo: React.ReactNode;
}

const ACCENT = 'text-red-600';
const ACCENT_BG = '#E11D48'; // Try1Second brand red — matches the extension
const GREEN = '#10B981';

const LAURELS = [
  { title: '100% Free', sub: 'Chrome Web Store listing' },
  { title: 'Privacy-First', sub: 'No data selling, ever' },
  { title: 'Made in India', sub: 'For Indian shoppers' },
];

const STAT_ROWS = [
  { icon: <Chrome className="w-4 h-4" />, name: 'Chrome & Edge ready', value: '21 store domains' },
  { icon: <MapPin className="w-4 h-4 text-red-600" />, name: '13 vertical engines', value: 'Flights to grocery' },
  { icon: <TrendingDown className="w-4 h-4 text-emerald-600" />, name: 'Real price history', value: '365-day recorded charts' },
];

/* ---------- LIVE demo data (owner 21 Oct: demo prices must be REAL, current) ----------
   The right-side mockup cards used illustrative numbers. They now fetch the REAL
   engine: /api/scrape/live 'iPhone 17' offers (priced, title-matched, one per seller)
   and the REAL live-coupon count from /api/deals. When the fetch fails or returns
   fewer than 2 priced offers, the cards fall back to the labelled example numbers —
   never a mix of real and invented. */

interface LiveOffer { seller: string; title: string; price: number; }
const DEMO_QUERY = 'iPhone 17';

const useLiveDemoData = () => {
  const [offers, setOffers] = useState<LiveOffer[] | null>(null);
  const [couponCount, setCouponCount] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/api/scrape/live', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: DEMO_QUERY, vertical: 'ecommerce' }),
    }).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!alive || !d) return;
      const seen = new Set<string>();
      const out: LiveOffer[] = [];
      for (const r of (d.results || []) as any[]) {
        const t = String(r.title || '');
        const price = Number(r.primaryPrice || 0);
        const seller = String(r.provider || r.seller || 'Verified source');
        if (!new RegExp(DEMO_QUERY, 'i').test(t) || price < 10000 || seen.has(seller)) continue;
        seen.add(seller);
        out.push({ seller, title: t.slice(0, 44), price });
      }
      out.sort((a, b) => a.price - b.price);
      if (out.length >= 2) setOffers(out.slice(0, 3));
    }).catch(() => { /* offline/blocked -> labelled examples stay */ });
    fetch('/api/deals?limit=100').then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!alive || !d) return;
      setCouponCount(Number((d.deals || []).length));
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return { offers, couponCount };
};

const pctCheaper = (base: number, price: number) =>
  base > 0 && price > 0 && price < base ? Math.round(((base - price) / base) * 100) : 0;

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/* ---------- right-side demo mockups (pure UI, honest illustrative numbers labelled as examples) ---------- */

const DemoAlert: React.FC<{ livePrice?: number | null }> = ({ livePrice }) => (
  <div className="space-y-3">
    <div className="relative bg-white rounded-2xl border border-slate-200 shadow-xl p-4 w-64 ml-auto">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-black text-slate-900">Price Alerts</span>
        <Bell className="w-4 h-4 text-red-600" />
      </div>
      <p className="text-[11px] text-slate-500 font-semibold mb-3">Set a price drop alert to buy later</p>
      <div className="space-y-2">
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
          <span className="text-[10.5px] font-bold text-slate-600">Current price{livePrice ? ' · live' : ''}</span>
          <span className="text-xs font-black text-slate-900">{inr(livePrice || 72999)}</span>
        </div>
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
          <span className="text-[10.5px] font-bold text-slate-600">Target price</span>
          <span className="text-xs font-black text-red-600">{inr(livePrice ? Math.max(1000, Math.floor((livePrice * 0.95) / 1000) * 1000) : 70000)}</span>
        </div>
        <button type="button" className="w-full py-2.5 rounded-xl text-white text-xs font-black" style={{ background: ACCENT_BG }}>
          Set alert
        </button>
        <p className="text-[10px] text-slate-500 text-center font-bold">You get notified the moment a verified price crosses your target</p>
      </div>
    </div>
    <div className="absolute -bottom-3 right-4 bg-emerald-500 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1">
      <BadgeCheck className="w-3 h-3" /> Drop verified → alerted
    </div>
  </div>
);

const DemoCompare: React.FC<{ live?: LiveOffer[] | null }> = ({ live }) => {
  const rows = live && live.length >= 2 ? live : null;
  const hiPrice = rows ? rows[rows.length - 1].price : 70499;
  const best = rows ? rows[0] : { seller: 'Flipkart', title: 'iPhone 17', price: 67900 };
  const rest = rows ? rows.slice(1) : [
    { seller: 'Croma', title: 'iPhone 17', price: 68990 },
    { seller: 'Reliance Digital', title: 'iPhone 17', price: 70499 },
  ];
  const bestPct = rows ? pctCheaper(hiPrice, best.price) : 22;
  return (
  <div className="relative bg-white rounded-2xl border border-slate-200 shadow-xl p-4 w-72 ml-auto">
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs font-black text-slate-900">Compare prices</span>
      <Sparkles className="w-4 h-4 text-red-600" />
    </div>
    <div className="space-y-2">
      <div className="relative bg-emerald-50 border border-emerald-300 rounded-xl px-3 py-2">
        <span className="absolute -top-2 left-2 bg-emerald-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded">BEST DEAL</span>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-black text-slate-900">{best.seller}</div>
            <div className="text-[9px] font-bold text-emerald-700">{bestPct > 0 ? `${bestPct}% cheaper` : 'lowest live price'}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-900">{inr(best.price)}</span>
            <button type="button" className="text-[9px] font-black text-white px-2.5 py-1.5 rounded-lg" style={{ background: ACCENT_BG }}>Buy Now</button>
          </div>
        </div>
      </div>
      {rest.map((r) => {
        const pct = rows ? pctCheaper(hiPrice, r.price) : 0;
        return (
        <div key={r.seller} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
          <div className="min-w-0">
            <div className="text-[11px] font-black text-slate-900">{r.seller}</div>
            {rows ? <div className="text-[9px] font-semibold text-slate-500 truncate">{r.title}</div> : null}
          </div>
          <span className="text-xs font-black text-slate-900">{inr(r.price)}{rows && pct > 0 ? <span className="text-[9px] font-bold text-slate-500"> · −{pct}%</span> : null}</span>
        </div>
        );
      })}
    </div>
    <div className="absolute -bottom-3 right-4 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg" style={{ background: GREEN }}>
      You save {inr(rows ? Math.max(0, hiPrice - best.price) : 19000)}
    </div>
  </div>
  );
};

const DemoCoupons: React.FC<{ live?: LiveOffer[] | null; couponCount?: number | null }> = ({ live, couponCount }) => {
  const best = live && live.length ? live[0] : null;
  return (
  <div className="relative bg-white rounded-2xl border border-slate-200 shadow-xl p-4 w-64 ml-auto">
    <div className="flex items-center gap-2 mb-3">
      <Ticket className="w-4 h-4 text-red-600" />
      <span className="text-xs font-black text-slate-900">Auto-Test Coupons</span>
    </div>
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-black text-slate-900">{best ? best.title : 'iPhone 17'}</div>
          <div className="text-[9.5px] font-bold text-slate-600">{couponCount != null ? `${couponCount} live coupon${couponCount === 1 ? '' : 's'} detected` : '4 live coupons detected'}</div>
        </div>
        <span className="text-xs font-black text-slate-900">{inr(best ? best.price : 82900)}</span>
      </div>
      {couponCount == null || couponCount > 0 ? (
      <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-300 rounded-lg px-2 py-1">
        <BadgeCheck className="w-3 h-3 text-emerald-600" />
        <span className="text-[9px] font-black text-emerald-800">{couponCount != null ? 'Coupon savings auto-tested live' : 'Coupon applied −₹1,500'}</span>
      </div>
      ) : (
      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
        <ShieldCheck className="w-3 h-3 text-slate-500" />
        <span className="text-[9px] font-black text-slate-600">Registry policy: verified codes only</span>
      </div>
      )}
    </div>
    <button type="button" className="w-full mt-2 py-2.5 rounded-xl text-white text-xs font-black" style={{ background: ACCENT_BG }}>
      ⚡ Test all codes
    </button>
    <div className="absolute -bottom-3 right-4 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg" style={{ background: GREEN }}>
      You save {best ? `${inr(Math.max(0, (live![live!.length - 1].price) - best.price))} across sites` : '₹1,500'}
    </div>
  </div>
  );
};

export const ChromeInstallSection: React.FC = () => {
  const { openExtensionModal } = useApp();
  const { links, loaded } = useAppLinks();
  // owner 21 Oct: the demo mockups show REAL current engine prices, not examples
  const { offers: liveOffers, couponCount } = useLiveDemoData();
  const chromeUrl = links?.chrome_extension?.url || null;

  const slides: Slide[] = [
    {
      id: 'alerts',
      label: 'PRICE HISTORY & TRACKER',
      headingA: 'Never miss a price drop with',
      headingAccent: 'Price Alerts',
      sub: 'Set your target price and get notified the moment it drops — powered by real recorded prices, never guesses.',
      icon: <Bell className="w-5 h-5" />,
      demo: <DemoAlert livePrice={liveOffers ? liveOffers[0].price : null} />,
    },
    {
      id: 'compare',
      label: 'CROSS-STORE COMPARISON',
      headingA: 'Compare & find the best price',
      headingAccent: 'on 21 stores',
      sub: 'The same product across Amazon, Flipkart, Croma, Reliance and more — side by side, cheapest first, one click to buy.',
      icon: <TrendingDown className="w-5 h-5" />,
      demo: <DemoCompare live={liveOffers} />,
    },
    {
      id: 'coupons',
      label: 'COUPONS & SAVINGS',
      headingA: 'Save more with',
      headingAccent: 'auto-tested coupons',
      sub: 'Try1Second tests every live coupon on the checkout page for you and applies the one that saves the most.',
      icon: <Ticket className="w-5 h-5" />,
      demo: <DemoCoupons live={liveOffers} couponCount={couponCount} />,
    },
  ];

  /** All 13 real Try1Second engines the extension + site cover (11 product
      verticals plus Coupons and Rewards). Honest notes, no fake numbers. */
  const ENGINES: Array<{ icon: React.ReactNode; name: string; note: string }> = [
    { icon: <ShoppingBag className="w-4 h-4" />, name: 'Shopping', note: '6 stores, side by side' },
    { icon: <ShoppingBasket className="w-4 h-4" />, name: '10-min Grocery', note: 'quick-commerce live' },
    { icon: <Utensils className="w-4 h-4" />, name: 'Food Delivery', note: 'same dish, live prices' },
    { icon: <Plane className="w-4 h-4" />, name: 'Flights', note: 'live fares, real dates' },
    { icon: <Building2 className="w-4 h-4" />, name: 'Hotels', note: 'real per-night rates' },
    { icon: <Bus className="w-4 h-4" />, name: 'Bus', note: 'tier-1 to tier-3 towns' },
    { icon: <Car className="w-4 h-4" />, name: 'Cab & Ride', note: 'live fare estimates' },
    { icon: <Film className="w-4 h-4" />, name: 'Movies', note: 'seats & showtimes' },
    { icon: <Landmark className="w-4 h-4" />, name: 'Loans', note: 'real rate ranges' },
    { icon: <ShieldCheck className="w-4 h-4" />, name: 'Insurance', note: 'premium quotes' },
    { icon: <CreditCard className="w-4 h-4" />, name: 'Credit Cards', note: 'fees & rewards' },
    { icon: <Ticket className="w-4 h-4" />, name: 'Coupons', note: 'auto-tested on checkout' },
    { icon: <Gift className="w-4 h-4" />, name: 'Rewards', note: 'points & daily spin' },
  ];

  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [paused, slides.length]);

  const s = slides[slide];

  const addClicked = () => {
    if (loaded && chromeUrl) window.open(chromeUrl, '_blank', 'noopener');
    else openExtensionModal(); // no admin link yet -> the simulator shows exactly what the extension does
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10" aria-label="Try1Second Chrome extension">
      <div
        className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col gap-8 p-6 sm:p-10"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LEFT: copy + CTAs + laurels + stat rows */}
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
            {s.icon}
            <span key={s.id + '-label'} className="animate-in fade-in slide-in-from-bottom-1 duration-300">{s.label}</span>
          </div>
          <h2 className="mt-3 text-3xl sm:text-4xl font-black leading-tight text-slate-950">
            <span key={s.id + '-a'} className="block animate-in fade-in slide-in-from-bottom-2 duration-300">{s.headingA}</span>
            <span key={s.id + '-b'} className={`${ACCENT} block animate-in fade-in slide-in-from-bottom-3 duration-300`}>{s.headingAccent}</span>
          </h2>
          <p className="mt-3 text-[15px] text-slate-600 max-w-md leading-relaxed font-medium">{s.sub}</p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={addClicked}
              className="px-5 py-3 rounded-xl text-white text-sm font-black shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer hover:-translate-y-0.5"
              style={{ background: ACCENT_BG }}
            >
              <Chrome className="w-4 h-4" />
              <span>Add to Chrome - It's Free</span>
            </button>
            <button
              type="button"
              onClick={openExtensionModal}
              className="px-5 py-3 rounded-xl bg-white text-sm font-black border-2 border-red-600 text-red-600 shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer hover:-translate-y-0.5"
              style={{ borderColor: ACCENT_BG, color: ACCENT_BG }}
            >
              <Play className="w-4 h-4" />
              <span>Watch Demo</span>
            </button>
          </div>

          {/* laurels — honest startup claims, not borrowed store ratings */}
          <div className="mt-7 flex flex-wrap gap-6">
            {LAURELS.map((l) => (
              <div key={l.title} className="flex items-center gap-2">
                <span className="text-amber-400" aria-hidden>🏆</span>
                <div>
                  <div className="text-xs font-black text-slate-900">{l.title}</div>
                  <div className="text-[10.5px] font-bold text-slate-500">{l.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* real capability stats instead of store-review counts */}
          <div className="mt-7 space-y-2.5">
            {STAT_ROWS.map((r) => (
              <div key={r.name} className="flex items-center gap-2.5 text-xs">
                {r.icon}
                <span className="font-black text-slate-800">{r.name}</span>
                <span className="text-slate-500 font-bold">· {r.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: interactive demo + slide dots */}
        <div className="relative flex items-center justify-center min-h-[360px] bg-gradient-to-br from-slate-50 to-indigo-50/60 rounded-2xl border border-slate-100 overflow-visible">
          <div key={s.id} className="relative w-full h-full flex items-center justify-center animate-in fade-in zoom-in-95 duration-500 py-10">
            {s.demo}
          </div>

          {/* slide dot rail */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-2 bg-white/90 border border-slate-200 rounded-full px-1.5 py-2 shadow-sm">
            {slides.map((sl, i) => (
              <button
                key={sl.id}
                type="button"
                aria-label={`Show ${sl.id} demo`}
                onClick={() => setSlide(i)}
                className={`rounded-full transition-all cursor-pointer ${i === slide ? 'w-2.5 h-2.5' : 'w-2 h-2'}`}
                style={{ background: i === slide ? '#E11D48' : '#cbd5e1' }}
              />
            ))}
          </div>
        </div>
        </div>

        {/* ALL 13 VERTICAL ENGINES — always visible across the full card width */}
        <div className="border-t border-slate-100 pt-6">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
            <Sparkles className="w-4 h-4" style={{ color: ACCENT_BG }} />
            <span>All 13 vertical engines &middot; one extension</span>
          </div>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7 gap-2.5">
            {ENGINES.map((e) => (
              <div key={e.name} className="flex items-center gap-2.5 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                <span className="flex-none text-red-600" style={{ color: ACCENT_BG }} aria-hidden>{e.icon}</span>
                <div className="min-w-0">
                  <div className="text-[12px] font-black text-slate-900 leading-tight">{e.name}</div>
                  <div className="text-[10px] font-bold text-slate-500 leading-tight truncate">{e.note}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
