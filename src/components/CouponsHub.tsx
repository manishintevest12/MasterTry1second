import React, { useEffect, useState } from 'react';
import { Tag, Copy, Check, ExternalLink, Filter, RefreshCw, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';

/** Coupons hub — REAL coupon codes only (GET /api/v1/offers?has_coupon=true).
 *  A code is shown only when an affiliate network actually returned it.
 *  No hardcoded demo coupons; honest empty state otherwise. */
interface RealCoupon {
  id: number;
  network_source: string;
  merchant_name: string;
  merchant_logo: string | null;
  title: string;
  description: string | null;
  coupon_code: string | null;
  discount_value: number | null;
  discount_type: string | null;
  affiliate_url: string | null;
  categories: string | null;
  expires_at: string | null;
  status: string;
  commission_note: string | null;
}

export const CouponsHub: React.FC = () => {
  const { addPoints, setActiveNavTab } = useApp();
  const [coupons, setCoupons] = useState<RealCoupon[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/v1/offers?has_coupon=true&limit=50');
        const data = await res.json();
        if (!cancelled) setCoupons(data.offers || []);
      } catch {
        if (!cancelled) setCoupons([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const sources = ['all', ...Array.from(new Set(coupons.map((c) => c.network_source)))];
  const filteredCoupons =
    selectedSource === 'all' ? coupons : coupons.filter((c) => c.network_source === selectedSource);

  const discountText = (c: RealCoupon) => {
    if (c.discount_value != null && c.discount_type === 'percentage') return `${c.discount_value}% OFF`;
    if (c.discount_value != null) return `₹${c.discount_value} OFF`;
    return c.title;
  };

  const handleCopy = (coupon: RealCoupon) => {
    if (navigator.clipboard && coupon.coupon_code) {
      navigator.clipboard.writeText(coupon.coupon_code);
      setCopiedId(coupon.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleUseDeal = async (coupon: RealCoupon) => {
    handleCopy(coupon);
    if (coupon.affiliate_url) {
      try {
        const res = await fetch(`/api/go?url=${encodeURIComponent(coupon.affiliate_url)}&offerId=${coupon.id}`);
        const data = await res.json();
        if (data.redirectUrl) window.open(data.redirectUrl, '_blank', 'noopener');
      } catch {
        /* redirect unavailable */
      }
    }
    addPoints(1, `Applied coupon ${coupon.coupon_code}`);
    setActiveNavTab('compare');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading verified coupons…
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Tag className="w-5 h-5 text-orange-600" />
          <h2 className="text-2xl font-bold text-slate-900">
            Coupons &amp; Promo Codes
          </h2>
        </div>
        <p className="text-xs text-slate-500">
          Only codes actually returned by connected affiliate networks are shown — nothing is invented or pre-seeded.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-4 mb-6 scrollbar-none">
        {sources.map((src) => (
          <button
            key={src}
            onClick={() => setSelectedSource(src)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              selectedSource === src
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {src === 'all' ? `All Networks (${coupons.length})` : src}
          </button>
        ))}
      </div>

      {filteredCoupons.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-4" />
          <p className="text-base font-bold text-slate-800">No verified coupon codes right now</p>
          <p className="text-xs text-slate-500 mt-2 max-w-lg mx-auto leading-relaxed">
            Coupon codes appear here the moment a connected network (e.g. Admitad) returns them and they pass
            freshness checks. We never display placeholder or guessed codes. Check the Offers tab for live
            partner cashback programs.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCoupons.map((coupon) => (
            <div
              key={coupon.id}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-orange-300 hover:shadow-md transition-all"
            >
              <div className="bg-gradient-to-r from-orange-500 to-red-500 px-4 py-2 flex items-center justify-between">
                <span className="text-white text-xs font-bold uppercase tracking-wide">
                  {coupon.merchant_name}
                </span>
                <span className="text-white/80 text-[10px] font-semibold uppercase">{coupon.network_source}</span>
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-black text-slate-900">{discountText(coupon)}</span>
                  {coupon.expires_at && (
                    <span className="text-[10px] text-slate-400 font-medium">
                      till {new Date(coupon.expires_at).toLocaleDateString('en-GB').replace(/\//g, '-')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 line-clamp-2 mb-3">
                  {coupon.description || 'Network-verified code. Terms apply at merchant checkout.'}
                </p>

                <div className="flex items-center justify-between border-t border-dashed border-slate-200 pt-3">
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                    <span className="font-mono text-xs font-bold text-slate-800 tracking-wider">
                      {coupon.coupon_code}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(coupon)}
                      className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors"
                      title="Copy code"
                    >
                      {copiedId === coupon.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleUseDeal(coupon)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-bold hover:bg-slate-800 transition-colors"
                    >
                      Use Deal <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
