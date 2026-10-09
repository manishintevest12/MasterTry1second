import React from 'react';
import {
  Home,
  Compass,
  Zap,
  Sparkles,
  ArrowLeftRight,
  Gift,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MainNavTab } from '../types';

export const FixedBottomBar: React.FC = () => {
  const { activeNavTab, setActiveNavTab, spinsAvailable } = useApp();

  const handleNavClick = (tab: MainNavTab) => {
    setActiveNavTab(tab);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  return (
    <nav
      aria-label="Fixed Bottom Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] py-1.5 px-4"
    >
      <div className="max-w-md sm:max-w-xl mx-auto flex items-center justify-around">
        {/* 1. HOME / EXPLORE */}
        <button
          type="button"
          onClick={() => handleNavClick('home')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeNavTab === 'home'
              ? 'text-red-600 font-extrabold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Home className={`w-5 h-5 ${activeNavTab === 'home' ? 'text-red-600 stroke-[2.5]' : ''}`} />
          <span className="text-[11px] font-bold mt-1">Home</span>
        </button>

        {/* 2. QUICK APPS (Replaced Stores Radar) */}
        <button
          type="button"
          onClick={() => handleNavClick('quickapps')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer relative ${
            activeNavTab === 'quickapps'
              ? 'text-red-600 font-extrabold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <Zap className={`w-5 h-5 ${activeNavTab === 'quickapps' ? 'text-red-600 fill-red-500/20 stroke-[2.5]' : ''}`} />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
          </div>
          <span className="text-[11px] font-bold mt-1">Quick Apps</span>
        </button>

        {/* 3. AI INSIGHTS (Prominent Blue Pill Highlighted Badge as in screenshot) */}
        <button
          type="button"
          onClick={() => handleNavClick('insights')}
          className={`flex flex-col items-center justify-center py-1 px-3.5 rounded-2xl transition-all cursor-pointer ${
            activeNavTab === 'insights'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 scale-105'
              : 'text-blue-600 hover:bg-blue-50'
          }`}
        >
          <Sparkles className={`w-5 h-5 ${activeNavTab === 'insights' ? 'text-white' : 'text-blue-600'}`} />
          <span className="text-[11px] font-black tracking-tight mt-0.5 uppercase">
            AI Insights
          </span>
        </button>

        {/* 4. COMPARE */}
        <button
          type="button"
          onClick={() => handleNavClick('compare')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeNavTab === 'compare'
              ? 'text-red-600 font-extrabold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <ArrowLeftRight className={`w-5 h-5 ${activeNavTab === 'compare' ? 'text-red-600 stroke-[2.5]' : ''}`} />
          <span className="text-[11px] font-bold mt-1">Compare</span>
        </button>

        {/* 5. REWARDS (Coupons, Offers, Spin & Earn, Credit Card) */}
        <button
          type="button"
          onClick={() => handleNavClick('rewards')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer relative ${
            activeNavTab === 'rewards'
              ? 'text-red-600 font-extrabold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <Gift className={`w-5 h-5 ${activeNavTab === 'rewards' ? 'text-red-600 stroke-[2.5]' : ''}`} />
            {spinsAvailable > 0 && (
              <span className="absolute -top-1 -right-2 bg-amber-500 text-white text-[9px] font-black px-1 rounded-full animate-bounce">
                Spin!
              </span>
            )}
          </div>
          <span className="text-[11px] font-bold mt-1">Rewards</span>
        </button>
      </div>
    </nav>
  );
};
