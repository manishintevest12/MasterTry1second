import React from 'react';
import { Sparkles, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { EXCLUSIVE_OFFERS } from '../data/mockData';
import { useApp } from '../context/AppContext';

export const OffersHub: React.FC = () => {
  const { setVertical, setActiveNavTab, addPoints } = useApp();

  const handleClaim = (offer: typeof EXCLUSIVE_OFFERS[0]) => {
    addPoints(1, `Claimed ${offer.title}`);
    setVertical(offer.vertical as any);
    setActiveNavTab('compare');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            Exclusive Partner Cashback Offers
          </h3>
          <p className="text-xs text-slate-500">
            Pre-negotiated deals for Try1Second users. Every redirection activates +1 OmniPoint.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {EXCLUSIVE_OFFERS.map((offer) => (
          <div
            key={offer.id}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-red-300 hover:shadow-md transition-all relative overflow-hidden"
          >
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-extrabold uppercase text-slate-400 tracking-wider text-[10px]">
                  {offer.merchant}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-black uppercase">
                  {offer.badge}
                </span>
              </div>

              <h4 className="text-sm font-bold text-slate-900 leading-snug mb-1">
                {offer.title}
              </h4>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                {offer.tagline}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">Reward Value:</span>
                <strong className="text-sm font-bold text-emerald-600 font-mono">
                  {offer.cashbackAmount}
                </strong>
              </div>

              <button
                type="button"
                onClick={() => handleClaim(offer)}
                className="py-1.5 px-3.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>Claim (+1 Pt)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
