import React, { useState } from 'react';
import { Tag, Copy, Check, ExternalLink, Filter } from 'lucide-react';
import { INITIAL_COUPONS, VERTICAL_META } from '../data/mockData';
import { VerticalId, CouponItem } from '../types';
import { useApp } from '../context/AppContext';

export const CouponsHub: React.FC = () => {
  const { addPoints, setActiveNavTab, setVertical } = useApp();
  const [selectedVertical, setSelectedVertical] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredCoupons =
    selectedVertical === 'all'
      ? INITIAL_COUPONS
      : INITIAL_COUPONS.filter((c) => c.vertical === selectedVertical);

  const handleCopy = (coupon: CouponItem) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(coupon.code);
      setCopiedId(coupon.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleUseDeal = (coupon: CouponItem) => {
    handleCopy(coupon);
    setVertical(coupon.vertical);
    setActiveNavTab('compare');
    addPoints(1, `Applied coupon ${coupon.code}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Tag className="w-5 h-5 text-orange-600" />
          <h2 className="text-2xl font-bold text-slate-900">
            Exclusive Coupons & Promo Offers
          </h2>
        </div>
        <p className="text-xs text-slate-500">
          Verified codes across all 10 verticals. Copy any coupon or apply directly to trigger price savings and reward points.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-4 mb-6 scrollbar-none">
        <button
          onClick={() => setSelectedVertical('all')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
            selectedVertical === 'all'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}
        >
          All Offers ({INITIAL_COUPONS.length})
        </button>
        {Object.entries(VERTICAL_META).map(([vKey, meta]) => (
          <button
            key={vKey}
            onClick={() => setSelectedVertical(vKey)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              selectedVertical === vKey
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {meta.name}
          </button>
        ))}
      </div>

      {/* Coupons Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCoupons.map((coupon) => {
          const vMeta = VERTICAL_META[coupon.vertical];
          return (
            <div
              key={coupon.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-16 h-16 bg-orange-50 -mr-8 -mt-8 rounded-full pointer-events-none" />

              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-slate-500 uppercase tracking-wider text-[11px]">
                    {coupon.store} · {vMeta?.name}
                  </span>
                  <span className="text-[11px] font-medium text-amber-600">
                    {coupon.expiry}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-slate-900 mb-1">
                  {coupon.discountText}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  {coupon.description}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                {/* Code Pill */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg font-mono text-xs font-bold text-slate-900">
                  <span>{coupon.code}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(coupon)}
                    title="Copy code"
                    className="text-slate-400 hover:text-slate-700 cursor-pointer ml-1"
                  >
                    {copiedId === coupon.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* Apply Button */}
                <button
                  type="button"
                  onClick={() => handleUseDeal(coupon)}
                  className="py-1.5 px-3 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>Apply & Earn</span>
                  <span className="text-[10px] text-white/80">+1 Pt</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
