import React from 'react';
import { User, X, Gift, Sparkles, ShieldCheck, Zap, RotateCw } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const ProfileModal: React.FC = () => {
  const {
    isProfileOpen,
    setIsProfileOpen,
    userPoints,
    spinsAvailable,
    wonRewards,
    setActiveNavTab,
    addPoints,
  } = useApp();

  if (!isProfileOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-2xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 relative">
        <button
          type="button"
          onClick={() => setIsProfileOpen(false)}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Avatar & Member Tier */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-14 h-14 rounded-full bg-slate-950 border-2 border-amber-300 text-amber-300 flex items-center justify-center text-lg font-black shadow-md font-mono">
            1S
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-base font-black text-slate-900">
                Standard Member
              </h3>
              <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded-sm uppercase">
                Tier 1
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              k.manishkumar2009@gmail.com
            </p>
          </div>
        </div>

        {/* Wallet & Points Details */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold">Reward Balance:</span>
            <strong className="text-lg font-mono font-black text-red-600">
              {userPoints} OmniPoints
            </strong>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Spins Unlocked:</span>
            <strong className="text-emerald-700 font-bold">
              {spinsAvailable} Free Spin{spinsAvailable > 1 ? 's' : ''}
            </strong>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Claimed Vouchers:</span>
            <strong className="text-slate-800 font-bold">
              {wonRewards.length} Active
            </strong>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              setActiveNavTab('rewards');
              setIsProfileOpen(false);
            }}
            className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCw className="w-4 h-4" />
            <span>Go to Spin & Earn Wheel</span>
          </button>

          <button
            type="button"
            onClick={() => addPoints(10, 'Profile Reward Boost')}
            className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Claim Daily Check-in (+10 Pts)
          </button>
        </div>
      </div>
    </div>
  );
};
