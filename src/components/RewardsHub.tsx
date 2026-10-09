import React from 'react';
import { Gift, Tag, Sparkles, CreditCard, RotateCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { RewardsSubTab } from '../types';
import { CouponsHub } from './CouponsHub';
import { OffersHub } from './OffersHub';
import { SpinAndEarnWheel } from './SpinAndEarnWheel';
import { CardOptimizer } from './CardOptimizer';

export const RewardsHub: React.FC = () => {
  const { rewardsSubTab, setRewardsSubTab, userPoints, spinsAvailable, spinCostPoints } = useApp();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Segmented Sub-Nav: Coupons, Offers, Spin & Earn, Credit Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto scrollbar-none">
          {/* Spin & Earn */}
          <button
            type="button"
            onClick={() => setRewardsSubTab('spin')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              rewardsSubTab === 'spin'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <RotateCw className="w-4 h-4" />
            <span>Spin & Earn ({spinCostPoints} Pts)</span>
            {spinsAvailable > 0 && (
              <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.2 rounded-full animate-bounce">
                {spinsAvailable} Ready!
              </span>
            )}
          </button>

          {/* Coupons */}
          <button
            type="button"
            onClick={() => setRewardsSubTab('coupons')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              rewardsSubTab === 'coupons'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Coupons</span>
          </button>

          {/* Offers */}
          <button
            type="button"
            onClick={() => setRewardsSubTab('offers')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              rewardsSubTab === 'offers'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Offers</span>
          </button>

          {/* Credit Card Marketplace */}
          <button
            type="button"
            onClick={() => setRewardsSubTab('cards')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              rewardsSubTab === 'cards'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Credit Card Marketplace</span>
          </button>
        </div>

        {/* Live Wallet Counter Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
          <span className="text-slate-500 font-semibold">Wallet:</span>
          <strong className="text-red-600 font-mono font-black text-sm">{userPoints} pts</strong>
          <span className="text-slate-400 text-[11px]">(+1 pt per new referral)</span>
        </div>
      </div>

      {/* Subtab Contents */}
      <div>
        {rewardsSubTab === 'spin' && <SpinAndEarnWheel />}
        {rewardsSubTab === 'coupons' && <CouponsHub />}
        {rewardsSubTab === 'offers' && <OffersHub />}
        {rewardsSubTab === 'cards' && <CardOptimizer />}
      </div>
    </div>
  );
};
