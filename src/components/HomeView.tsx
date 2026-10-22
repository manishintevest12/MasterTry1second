import React, { lazy, Suspense } from 'react';
import {
  Zap,
  TrendingDown,
  Clock,
  ShieldCheck,
  Plane,
  Building2,
  Bus,
  ShoppingBag,
  Utensils,
  Film,
  Landmark,
  Car,
  Sparkles,
  ArrowRight,
  Radar,
  Gift,
  ShoppingBasket,
  Ticket,
  CreditCard,
  Wallet } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { VERTICAL_META } from '../data/mockData';
import { VerticalId } from '../types';
import { PriceLens, PriceLensAndAssistant } from './PriceLensAndAssistant';
// PageSpeed round-3: the install section's code + live-price fetches leave the
// eager bundle; the Deferred wrapper mounts it only near the viewport.
const ChromeInstallSection = lazy(() => import('./ChromeInstallSection').then((m) => ({ default: m.ChromeInstallSection })));
import { Deferred } from './Deferred';
const HomeShowcase = lazy(() => import('./HomeShowcase'));
const UpcomingMovies = lazy(() => import('./UpcomingMovies'));

const VERTICAL_ICONS: Record<string, React.ElementType> = {
  flights: Plane,
  hotels: Building2,
  bus: Bus,
  ecommerce: ShoppingBag,
  grocery: Zap,
  food: Utensils,
  movie: Film,
  loans: Landmark,
  insurance: ShieldCheck,
  cab: Car,
};

const VERTICAL_COVER_IMAGES: Record<string, string> = {
  flights: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=600&auto=format&fit=crop&q=80',
  hotels: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=600&auto=format&fit=crop&q=80',
  bus: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&auto=format&fit=crop&q=80',
  ecommerce: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
  grocery: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80',
  food: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop&q=80',
  movie: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&auto=format&fit=crop&q=80',
  loans: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop&q=80',
  insurance: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&auto=format&fit=crop&q=80',
  cab: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=600&auto=format&fit=crop&q=80',
};

export const HomeView: React.FC = () => {
  const {
    setVertical,
    setActiveNavTab,
    setRewardsSubTab,
    items,
    quickAppPartners,
    trackQuickAppRedirection,
  } = useApp();

  const handleLaunch = (vId: VerticalId) => {
    setVertical(vId);
    setActiveNavTab('compare');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-10 pb-12">
      {/* 1. DARK HERO SECTION (Exact to User Screenshot) */}
      <section className="relative bg-[#0d0714] text-white pt-10 pb-16 px-4 sm:px-6 lg:px-8 overflow-hidden border-b border-purple-950/40">
        {/* Subtle grid pattern backdrop */}
        <div className="absolute inset-0 bg-[radial-gradient(#2a1b40_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

        <div className="max-w-6xl mx-auto relative z-10">
          {/* Engine Active Pill Banner */}
          <div className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-950/70 border border-red-800/60 text-xs font-bold text-red-300 sm:mb-6">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span>TRY1SECOND ENGINE ACTIVE</span>
            <span className="text-red-700">·</span>
            <span className="text-amber-400 font-mono">14.2M+ SCANNER RADAR</span>
          </div>

          {/* Metric Bar Row */}
          <div className="hidden sm:grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 sm:mb-8">
            <div className="bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 backdrop-blur-xs flex items-center gap-2.5">
              <span className="text-red-400 text-sm">(((•)))</span>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">Live Scans</span>
                <span className="text-xs sm:text-sm font-black text-white font-mono">1,42,85,557+</span>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 backdrop-blur-xs flex items-center gap-2.5">
              <span className="text-amber-400 text-sm">⊞</span>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">Connected</span>
                <span className="text-xs sm:text-sm font-black text-amber-300 font-mono">150+ Platforms</span>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 backdrop-blur-xs flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">Latency</span>
                <span className="text-xs sm:text-sm font-black text-emerald-400 font-mono">0.4s Metasearch</span>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 backdrop-blur-xs flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">Markup</span>
                <span className="text-xs sm:text-sm font-black text-sky-300 font-mono">0% Direct Pay</span>
              </div>
            </div>
          </div>

          {/* Main Headline */}
          <div className="max-w-4xl">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold tracking-wider uppercase mb-2">
              <Sparkles className="w-4 h-4" />
              <span>India's Unified Multi-Vertical Metasearch Engine</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] mb-6">
              One Second Is All It Takes to{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-rose-500 to-amber-400">
                Find the Lowest Price
              </span>
            </h1>

            {/* PRICE LENS: between the headline and the two launch buttons */}
            <PriceLens />

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => handleLaunch('flights')}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-xs font-black shadow-lg shadow-red-600/30 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Launch 10-Vertical Search</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setActiveNavTab('radar')}
                className="px-5 py-3 bg-white/10 hover:bg-white/15 border border-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
              >
                <Radar className="w-4 h-4 text-emerald-400" />
                <span>Open Live Scanner Radar</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* AI ASSISTANT (text/voice) */}
      <PriceLensAndAssistant />

      {/* QUICK APPS SECTION - COMPANY LOGOS ONLY (deferred: below fold) */}
      <Deferred minHeight={180}>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-red-600 fill-red-500" />
                <span>Quick Apps</span>
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveNavTab('quickapps')}
              className="text-[11px] font-bold text-red-600 hover:text-red-700 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>View All Apps ({quickAppPartners.length})</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Company Logos Only */}
          <div className="flex items-center gap-3.5 overflow-x-auto pb-1 scrollbar-none pt-1">
            {quickAppPartners.map((partner) => (
              <button
                key={`home-qapp-${partner.id}`}
                type="button"
                onClick={() => {
                  trackQuickAppRedirection(partner.id);
                  const targetUrl = partner.deepLink || partner.webUrl;
                  try {
                    window.open(targetUrl, '_blank', 'noopener,noreferrer');
                  } catch {
                    if (partner.webUrl) window.open(partner.webUrl, '_blank', 'noopener,noreferrer');
                  }
                }}
                title={partner.name}
                className="w-13 h-13 sm:w-14 sm:h-14 shrink-0 rounded-2xl p-0.5 bg-slate-50 border border-slate-200 hover:border-red-500 shadow-2xs hover:shadow-md hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer overflow-hidden group"
              >
                <img
                  src={partner.iconUrl}
                  alt={partner.name}
                  width={52}
                  height={52}
                  className="w-full h-full object-cover rounded-[14px]"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      partner.name
                    )}&background=ea580c&color=fff&size=120`;
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      </section>
      </Deferred>

      {/* 2. INSTANT LAUNCH VERTICALS GRID — heading count derives from VERTICAL_META (auto-grows) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-red-600 rounded-full animate-ping" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
              {Object.keys(VERTICAL_META).length} Instant Launch Verticals · 1-Click Search
            </h2>
          </div>
          <span className="text-[11px] text-slate-500 hidden sm:block">
            Click any card to launch real-time metasearch
          </span>
        </div>

        {/* Owner reference design (21 Oct): 13 compact action cards — icon + bold
            title + one-line description, white surface, light-grey border, red icons.
            12 verticals (heading count stays registry-driven) + Coupons + Rewards. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-3">
          {([
            { id: 'ecommerce', icon: ShoppingBag, title: 'Shopping', desc: '6 stores, side by side', action: () => handleLaunch('ecommerce') },
            { id: 'grocery', icon: ShoppingBasket, title: '10-min Grocery', desc: 'quick-commerce live', action: () => handleLaunch('grocery') },
            { id: 'food', icon: Utensils, title: 'Food Delivery', desc: 'same dish, live prices', action: () => handleLaunch('food') },
            { id: 'flights', icon: Plane, title: 'Flights', desc: 'live fares, real dates', action: () => handleLaunch('flights') },
            { id: 'hotels', icon: Building2, title: 'Hotels', desc: 'real per-night rates', action: () => handleLaunch('hotels') },
            { id: 'bus', icon: Bus, title: 'Bus', desc: 'tier-1 to tier-3 towns', action: () => handleLaunch('bus') },
            { id: 'cab', icon: Car, title: 'Cab & Ride', desc: 'live fare estimates', action: () => handleLaunch('cab') },
            { id: 'movie', icon: Film, title: 'Movies', desc: 'seats & showtimes', action: () => handleLaunch('movie') },
            { id: 'loans', icon: Landmark, title: 'Loans', desc: 'real rate ranges', action: () => handleLaunch('loans') },
            { id: 'insurance', icon: ShieldCheck, title: 'Insurance', desc: 'premium quotes', action: () => handleLaunch('insurance') },
            { id: 'creditcards', icon: CreditCard, title: 'Credit Cards', desc: 'fees & rewards', action: () => handleLaunch('creditcards') },
            { id: 'account', icon: Wallet, title: 'Accounts', desc: 'savings, current & demat', action: () => handleLaunch('account') },
            { id: 'coupons', icon: Ticket, title: 'Coupons', desc: 'auto-tested on checkout', action: () => { setRewardsSubTab('coupons'); setActiveNavTab('rewards'); } },
            { id: 'rewards', icon: Gift, title: 'Rewards', desc: 'points & daily spin', action: () => { setRewardsSubTab('spin'); setActiveNavTab('rewards'); } },
          ] as const).map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                onClick={card.action}
                className="bg-white rounded-2xl border border-slate-200 hover:border-red-400 hover:shadow-lg transition-all duration-200 text-left cursor-pointer group p-3.5 flex items-start gap-3 shadow-2xs"
              >
                <Icon className="w-5 h-5 text-red-600 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                <span className="min-w-0">
                  <span className="block text-[13px] font-extrabold text-slate-900 group-hover:text-red-600 transition-colors leading-tight">
                    {card.title}
                  </span>
                  <span className="block text-[11px] text-slate-500 mt-0.5 leading-snug">
                    {card.desc}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2b. HOME SHOWCASE (owner spec 21 Oct): eight curated sections under the
           launch grid — Picked Just for You, Special Offers For You, Go Big,
           Best in Tech & Gadgets, Steals, Famous Places to Visit, Best Cards, Top Destinations.
           All items are real; redirects go through /api/out (Amazon tag and
           Myntra INR-Deals/Cuelinks injected server-side). Deferred + lazy. */}
      {/* 2b. UPCOMING MOVIES (owner 22 Oct): real BMS upcoming tab — posters,
          release dates, Watch Trailer. Sits right below the launch grid. */}
      <Deferred minHeight={260}>
      <Suspense fallback={null}>
      <UpcomingMovies />
      </Suspense>
      </Deferred>

      <Deferred minHeight={420}>
      <Suspense fallback={null}>
      <HomeShowcase />
      </Suspense>
      </Deferred>

      {/* 3. CHROME EXTENSION INSTALL SECTION (deferred: fetches start only near viewport) */}
      <Deferred minHeight={620}>
      <Suspense fallback={null}>
      <ChromeInstallSection />
      </Suspense>
      </Deferred>

      {/* 4. LIVE RADAR SNIPPET (deferred) */}
      <Deferred minHeight={240}>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white rounded-2xl p-6 sm:p-8 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6 shadow-md">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Real-Time Redirection Tracker Active</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black">
              Earn 1 Point for Every Referral. Spin at 100 Points.
            </h3>
            <p className="text-xs text-slate-400 max-w-xl">
              Invite friends using your personal Try1Second referral link. Every friend who joins accredits 1 point directly to your wallet for guaranteed vouchers on the wheel.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setActiveNavTab('rewards')}
              className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Gift className="w-4 h-4" />
              <span>Open Rewards Hub</span>
            </button>
          </div>
        </div>
      </section>
      </Deferred>
    </div>
  );
};
