import React, { useRef, useEffect } from 'react';
import {
  Clock,
  ChevronDown,
  Bell,
  Sparkles,
  Plane,
  Building2,
  Bus,
  ShoppingBag,
  Zap,
  Utensils,
  Film,
  Landmark,
  ShieldCheck,
  Car,
  TrendingDown,
  Heart,
  Train,
  Pill,
  Receipt,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { VERTICAL_META } from '../data/mockData';
import { VerticalId, MainNavTab } from '../types';
import { Try1SecondLogo } from './Try1SecondLogo';

export const Navbar: React.FC = () => {
  const {
    activeNavTab,
    setActiveNavTab,
    vertical,
    setVertical,
    userPoints,
    spinsAvailable,
    trackedItemIds,
    isCompareMenuOpen,
    setIsCompareMenuOpen,
    isNotificationsOpen,
    setIsNotificationsOpen,
    isProfileOpen,
    setIsProfileOpen,
    simulatePriceDrop,
    openExtensionModal,
  } = useApp();

  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsCompareMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setIsCompareMenuOpen]);

  const handleNavClick = (tab: MainNavTab) => {
    setActiveNavTab(tab);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  const handleSelectVertical = (vId: VerticalId) => {
    setVertical(vId);
    setActiveNavTab('compare');
    setIsCompareMenuOpen(false);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  const getVerticalIcon = (id: string) => {
    switch (id) {
      case 'flights':
        return <Plane className="w-4 h-4 text-orange-500" />;
      case 'hotels':
        return <Building2 className="w-4 h-4 text-blue-500" />;
      case 'bus':
        return <Bus className="w-4 h-4 text-emerald-500" />;
      case 'ecommerce':
        return <ShoppingBag className="w-4 h-4 text-purple-500" />;
      case 'grocery':
        return <Zap className="w-4 h-4 text-amber-500" />;
      case 'food':
        return <Utensils className="w-4 h-4 text-rose-500" />;
      case 'movie':
        return <Film className="w-4 h-4 text-indigo-500" />;
      case 'loans':
        return <Landmark className="w-4 h-4 text-teal-500" />;
      case 'insurance':
        return <ShieldCheck className="w-4 h-4 text-sky-500" />;
      case 'cab':
        return <Car className="w-4 h-4 text-yellow-500" />;
      case 'trains':
        return <Train className="w-4 h-4 text-blue-600" />;
      case 'pharmacy':
        return <Pill className="w-4 h-4 text-emerald-500" />;
      case 'bills_utilities':
        return <Receipt className="w-4 h-4 text-amber-500" />;
      default:
        return <Zap className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          {/* ZONE 1: Try1Second Brand Logo (Pixel-accurate to screenshot) */}
          <button
            type="button"
            onClick={() => handleNavClick('home')}
            className="flex items-center text-left group cursor-pointer focus:outline-hidden"
          >
            <Try1SecondLogo size="md" />
          </button>

          {/* ZONE 2: Middle Meta Stats / Engine Status (Quiet) */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-slate-50 border border-slate-200 rounded-full text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-slate-800">TRY1SECOND ENGINE ACTIVE</span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500 font-mono">14.2M+ Scanner Radar</span>
          </div>

          {/* ZONE 3: Compare 10 Verticals, Alerts, Profile Avatar */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Compare 10 Verticals Red Pill Button (Exact to screenshot) */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setIsCompareMenuOpen(!isCompareMenuOpen)}
                className="h-10 px-4 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-full text-xs font-black shadow-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                <Clock className="w-4 h-4 text-white" />
                <span className="tracking-wide">Compare</span>
                <span className="text-[10px] font-bold bg-white/20 text-white px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                  10 Verticals
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-white/90 transition-transform ${
                    isCompareMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Compare Verticals Dropdown Popover */}
              {isCompareMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-2 py-1.5 border-b border-slate-100 mb-2">
                    <span className="text-xs font-extrabold text-slate-900 block">
                      Select Comparison Vertical
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Instant 1-second price scan & redirection
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(VERTICAL_META).map(([vKey, meta]) => {
                      const isCurrent = vertical === vKey && activeNavTab === 'compare';
                      return (
                        <button
                          key={vKey}
                          onClick={() => handleSelectVertical(vKey as VerticalId)}
                          className={`flex items-center gap-2 p-2 rounded-xl text-left transition-colors cursor-pointer text-xs ${
                            isCurrent
                              ? 'bg-red-50 text-red-700 font-bold border border-red-200'
                              : 'hover:bg-slate-50 text-slate-700 font-medium'
                          }`}
                        >
                          <div className="shrink-0">{getVerticalIcon(vKey)}</div>
                          <span className="truncate">{meta.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">150+ Platforms Synced</span>
                    <button
                      onClick={() => {
                        setActiveNavTab('radar');
                        setIsCompareMenuOpen(false);
                      }}
                      className="text-red-600 font-bold hover:underline"
                    >
                      Open Radar →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Browser Extension Button */}
            <button
              type="button"
              onClick={openExtensionModal}
              className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold transition-all cursor-pointer shadow-2xs hover:border-red-300"
              title="Launch Try1Second Chrome/Edge Extension & Auto Coupon Tester"
            >
              <Zap className="w-3.5 h-3.5 text-red-600 fill-red-500" />
              <span>Extension</span>
              <span className="text-[9px] bg-red-100 text-red-700 font-extrabold px-1.5 py-0.2 rounded-full uppercase">
                V3
              </span>
            </button>

            {/* My Price Tracker Hub Button */}
            <button
              type="button"
              onClick={() => handleNavClick('tracker')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                activeNavTab === 'tracker'
                  ? 'bg-red-50 text-red-700 border-red-300 shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
              }`}
              title="My Price Tracker & Multi-SKU Watchlist Hub"
            >
              <Heart className="w-3.5 h-3.5 text-rose-600 fill-rose-500" />
              <span className="hidden sm:inline">Price Tracker</span>
              {trackedItemIds.length > 0 && (
                <span className="px-1.5 py-0.2 bg-red-600 text-white text-[10px] rounded-full font-mono font-bold leading-none">
                  {trackedItemIds.length}
                </span>
              )}
            </button>

            {/* Notification Alerts Bell (Exact to screenshot) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="relative flex flex-col items-center justify-center w-10 h-10 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors cursor-pointer"
                title="View price alerts & tracking notifications"
              >
                <Bell className="w-4 h-4 text-slate-700" />
                <span className="text-[9px] font-bold text-slate-500 leading-none mt-0.5">
                  Alerts
                </span>
                {trackedItemIds.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-white" />
                )}
              </button>
            </div>

            {/* Profile Avatar Button (Exact to screenshot) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2 pl-1 pr-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full transition-colors cursor-pointer"
              >
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-slate-900 border-2 border-slate-200 overflow-hidden flex items-center justify-center text-white text-xs font-bold shrink-0">
                  <span className="text-amber-400 font-mono">1S</span>
                </div>
                <div className="text-left hidden sm:block">
                  <span className="text-xs font-bold text-slate-900 block leading-tight">
                    Standard...
                  </span>
                  <span className="text-[10px] font-semibold text-red-600 block leading-none">
                    {userPoints} pts
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
