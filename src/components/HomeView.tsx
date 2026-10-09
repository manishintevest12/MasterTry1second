import React, { useState } from 'react';
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
  Search,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { VERTICAL_META } from '../data/mockData';
import { VerticalId } from '../types';
import { AutocompleteInput } from './AutocompleteInput';

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
    items,
    simulatePriceDrop,
    setSearchQuery,
    triggerLiveLocationScrape,
    quickAppPartners,
    trackQuickAppRedirection,
  } = useApp();
  const [homeSearch, setHomeSearch] = useState<string>('');

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
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-950/70 border border-red-800/60 text-xs font-bold text-red-300 mb-6">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span>TRY1SECOND ENGINE ACTIVE</span>
            <span className="text-red-700">·</span>
            <span className="text-amber-400 font-mono">14.2M+ SCANNER RADAR</span>
          </div>

          {/* Metric Bar Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 mb-8">
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

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] mb-4">
              One Second Is All It Takes to{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-rose-500 to-amber-400">
                Find the Lowest Price
              </span>
            </h1>

            <p className="text-slate-300 text-xs sm:text-sm sm:leading-relaxed max-w-2xl mb-6">
              Instant price discovery across 10 verticals without jumping between 20 apps. Select any category below or search anything below for live comparison.
            </p>

            {/* Universal Instant Autocomplete Search Bar */}
            <div className="bg-white rounded-2xl p-1.5 shadow-2xl border border-white/20 max-w-2xl mb-8">
              <AutocompleteInput
                value={homeSearch}
                onChange={setHomeSearch}
                onSelect={(val, sugg) => {
                  let targetV: VerticalId = 'ecommerce';
                  if (sugg?.type === 'city') targetV = 'flights';
                  else if (sugg?.type === 'food') targetV = 'food';
                  else if (sugg?.type === 'grocery') targetV = 'grocery';
                  else if (sugg?.type === 'product') targetV = 'ecommerce';
                  else if (sugg?.type === 'location') targetV = 'cab';
                  else if (sugg?.type === 'date') targetV = 'flights';

                  setVertical(targetV);
                  setSearchQuery(val);
                  triggerLiveLocationScrape(val);
                  setActiveNavTab('compare');
                }}
                type="all"
                placeholder="Search any product, city, dish, flight, or dark-store grocery item across 10 verticals..."
                className="w-full"
                inputClassName="text-xs sm:text-sm font-bold text-slate-900 placeholder:text-slate-400 py-2.5"
                icon={<Search className="w-5 h-5 text-orange-500" />}
              />
            </div>

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

      {/* QUICK APPS SECTION - COMPANY LOGOS ONLY */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
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

      {/* 2. 10 INSTANT LAUNCH VERTICALS GRID (Matches bottom label in screenshot) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-red-600 rounded-full animate-ping" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
              10 Instant Launch Verticals · 1-Click Search
            </h2>
          </div>
          <span className="text-[11px] text-slate-500 hidden sm:block">
            Click any card to launch real-time metasearch
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {Object.entries(VERTICAL_META).map(([vKey, meta]) => {
            const Icon = VERTICAL_ICONS[vKey] || Zap;
            const coverImg = VERTICAL_COVER_IMAGES[vKey] || 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=600&auto=format&fit=crop&q=80';
            const verticalItems = items.filter((it) => it.vertical === vKey);
            const lowestPrice = Math.min(...verticalItems.map((i) => i.primaryPrice));

            return (
              <button
                key={vKey}
                onClick={() => handleLaunch(vKey as VerticalId)}
                className="bg-white rounded-2xl border border-slate-200 hover:border-red-400 hover:shadow-lg transition-all duration-200 text-left group cursor-pointer flex flex-col justify-between overflow-hidden shadow-2xs"
              >
                {/* Photo Header */}
                <div className="relative h-28 w-full overflow-hidden bg-slate-900">
                  <img
                    src={coverImg}
                    alt={meta.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=600&auto=format&fit=crop&q=80';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent pointer-events-none" />

                  {/* Icon badge */}
                  <div className="absolute top-2.5 left-2.5 w-7 h-7 rounded-lg bg-slate-900/80 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-xs">
                    <Icon className="w-4 h-4 text-amber-400" />
                  </div>

                  {/* Lowest Price tag on image */}
                  <div className="absolute bottom-2 right-2.5 bg-black/60 backdrop-blur-md text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border border-white/20">
                    From ₹{lowestPrice.toLocaleString('en-IN')}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-3.5 flex flex-col justify-between flex-1">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 group-hover:text-red-600 transition-colors">
                      {meta.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-snug">
                      {meta.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Instant Sync</span>
                    <span className="font-extrabold text-red-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                      <span>Compare</span>
                      <span>→</span>
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. LIVE RADAR SNIPPET */}
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
    </div>
  );
};
