import React from 'react';
import { User, X, Gift, Sparkles, ShieldCheck, Zap, RotateCw, LogOut } from 'lucide-react';
import { useApp } from '../context/AppContext';

/** Inline Google "G" logo (official four-colour mark, single path set). */
const GoogleG: React.FC = () => (
  <svg viewBox="0 0 48 48" className="w-4 h-4" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.82 7.18l7.73 6c4.51-4.18 7.13-10.36 7.13-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C1.92 16.46 0 20.04 0 24c0 3.96 1.92 7.54 4.85 9.78l5.68-5.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

export const ProfileModal: React.FC = () => {
  const {
    isProfileOpen,
    setIsProfileOpen,
    userPoints,
    spinsAvailable,
    wonRewards,
    setActiveNavTab,
    addPoints,
    authUser,
    authBusy,
    authError,
    loginWithGoogle,
    logoutUser,
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

        {authUser ? (
          <>
            {/* Signed-in header — real Google account identity */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-14 h-14 rounded-full bg-slate-950 border-2 border-amber-300 text-amber-300 flex items-center justify-center text-lg font-black shadow-md font-mono">
                {authUser.displayName?.trim()?.[0]?.toUpperCase() || authUser.email[0]?.toUpperCase() || '1S'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-base font-black text-slate-900 truncate">
                    {authUser.displayName || 'Try1Second Member'}
                  </h3>
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded-sm uppercase">
                    {authUser.role === 'admin' ? 'Admin' : 'Tier 1'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium truncate">
                  {authUser.email}
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
                <span>Go to Spin &amp; Earn Wheel</span>
              </button>

              <button
                type="button"
                onClick={() => addPoints(10, 'Profile Reward Boost')}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Claim Daily Check-in (+10 Pts)
              </button>

              <button
                type="button"
                onClick={logoutUser}
                className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-500 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Log out
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Signed-out — Login with Google */}
            <div className="text-center mb-5">
              <div className="w-14 h-14 mx-auto rounded-full bg-slate-950 border-2 border-amber-300 text-amber-300 flex items-center justify-center text-lg font-black shadow-md font-mono mb-3">
                1S
              </div>
              <h3 className="text-base font-black text-slate-900">Welcome to Try1Second</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Sign in to save your rewards, spins and vouchers across devices.
              </p>
            </div>

            <button
              type="button"
              disabled={authBusy}
              onClick={async () => { await loginWithGoogle(); }}
              className="w-full py-3 bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm rounded-xl border border-slate-300 shadow-xs transition-colors flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60"
            >
              <GoogleG />
              <span>{authBusy ? 'Signing in…' : 'Login with Google'}</span>
            </button>

            {authError && (
              <p className="mt-3 text-xs text-red-600 font-medium text-center">{authError}</p>
            )}

            <p className="mt-4 text-[11px] text-slate-400 font-medium text-center leading-relaxed">
              Your Google email is used only for sign-in. We never post or share anything on your behalf.
            </p>
          </>
        )}
      </div>
    </div>
  );
};
