import React from 'react';
import {
  ExternalLink,
  Sparkles,
  CheckCircle2,
  X,
  ArrowRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { buildAffiliateDeepLink } from '../utils/deepLinkHelper';

export const RedirectionModal: React.FC = () => {
  const { redirectionState, closeRedirection, userPoints, userLocation, affiliateIds } = useApp();

  if (!redirectionState.isOpen || !redirectionState.item || !redirectionState.quote) {
    return null;
  }

  const { item, quote, step } = redirectionState;

  const handleProceed = () => {
    // Find matching affiliate ID config if exists
    const matchingAff = affiliateIds.find(
      (a) => a.merchantOrNetwork.toLowerCase().includes(quote.sellerName.toLowerCase()) ||
             quote.sellerName.toLowerCase().includes(a.merchantOrNetwork.toLowerCase())
    );

    const trackingDeepLink = buildAffiliateDeepLink({
      rawUrl: quote.url,
      sellerName: quote.sellerName,
      affiliateNetwork: matchingAff?.merchantOrNetwork || 'Direct',
      affiliateId: matchingAff?.affiliateId || 'TRY1_PARTNER',
      subIdParam: matchingAff?.subIdParam,
      userId: 'usr-active-session',
      pincode: userLocation.pincode,
    });

    window.open(trackingDeepLink, '_blank', 'noopener,noreferrer');
    closeRedirection();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center relative overflow-hidden">
        {/* Close Button */}
        <button
          type="button"
          onClick={closeRedirection}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Lockup */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="px-2.5 py-2 rounded-xl bg-orange-600 text-white font-black flex items-center justify-center text-xs shadow-xs tracking-tight">
            Try1Sec
          </div>
          <div className="flex items-center text-slate-300">
            <ArrowRight className="w-5 h-5 animate-pulse" />
          </div>
          <div className="px-2.5 py-2 rounded-xl bg-slate-900 text-white font-black flex items-center justify-center text-xs shadow-xs truncate max-w-[120px]">
            {quote.sellerName}
          </div>
        </div>

        {step === 'redirecting' ? (
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Securing Best Price with {quote.sellerName}
            </h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Generating direct merchant deep-link token and locking in your verified best price in 1 second...
            </p>

            <div className="flex justify-center my-6">
              <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>

            <span className="text-[11px] text-slate-400 font-mono">
              Redirecting via secure partner gateway in 1 second...
            </span>
          </div>
        ) : (
          <div className="animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-bold text-emerald-800 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Lowest Direct Price Verified!</span>
            </div>

            <h3 className="text-xl font-extrabold text-slate-900 mb-1">
              Deep-Link Ready!
            </h3>
            <p className="text-xs text-slate-600 mb-4 max-w-xs mx-auto leading-relaxed">
              Your deal for <strong>{item.title}</strong> at <strong>₹{quote.price.toLocaleString('en-IN')}</strong> is locked with zero extra fees.
            </p>

            <div className="p-3 bg-orange-50 rounded-xl border border-orange-200 text-xs text-orange-950 mb-6 flex items-center justify-between">
              <span className="text-[11px]">Want Prize Wheel Spins?</span>
              <strong className="text-xs font-bold text-orange-700">
                Earn 1 Point per Friend Referred!
              </strong>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={closeRedirection}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Keep Browsing
              </button>

              <button
                type="button"
                onClick={handleProceed}
                className="flex-1 py-2.5 px-4 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Go to {quote.sellerName}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
