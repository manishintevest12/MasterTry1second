import React, { useEffect, useState } from 'react';
import { Sparkles, ArrowRight, ShieldCheck, Zap, Tag, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';

/** Real partner offers from the affiliate aggregator (GET /api/v1/offers).
 *  Cards render only what the network actually returned — no fabricated cashback. */
interface RealOffer {
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

export const OffersHub: React.FC = () => {
  const { addPoints, setVertical, setActiveNavTab, addToast } = useApp();
  const [offers, setOffers] = useState<RealOffer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/v1/offers?limit=24');
        const data = await res.json();
        if (!cancelled) setOffers(data.offers || []);
      } catch {
        if (!cancelled) setOffers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const rewardLabel = (o: RealOffer) => {
    if (o.coupon_code) return `Code: ${o.coupon_code}`;
    if (o.discount_value != null) {
      return o.discount_type === 'percentage' ? `${o.discount_value}% off` : `Flat ₹${o.discount_value}`;
    }
    if (o.commission_note) return `Payout: ${o.commission_note}`;
    return 'Merchant cashback program';
  };

  /** Verified affiliate redirect: the backend resolves the destination and logs the click. */
  const handleClaim = async (offer: RealOffer) => {
    if (!offer.affiliate_url) return;
    if (offer.coupon_code) {
      try { await navigator.clipboard.writeText(offer.coupon_code); } catch { /* clipboard blocked */ }
      addToast('success', 'Coupon code copied', `${offer.coupon_code} copied. Paste it at ${offer.merchant_name} checkout.`);
    }
    try {
      const res = await fetch(`/api/go?url=${encodeURIComponent(offer.affiliate_url)}&offerId=${offer.id}`);
      const data = await res.json();
      if (data.redirectUrl) {
        window.open(data.redirectUrl, '_blank', 'noopener');
        addPoints(1, `Redirected to ${offer.merchant_name}`);
      }
    } catch {
      /* redirect service unavailable */
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading live partner offers…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            Live Partner Offers
          </h3>
          <p className="text-xs text-slate-500">
            Real offers synced from connected affiliate networks. Redirects are tracked and earn +1 OmniPoint.
          </p>
        </div>
        <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
          {offers.length > 0 ? `${offers.length} live offers` : 'no offers synced'}
        </span>
      </div>

      {offers.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">No partner offers synced yet</p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Offers appear here automatically once an affiliate network sync returns live campaigns.
            Nothing is shown as an offer until the network actually returns it.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {offers.map((offer) => (
            <div
              key={offer.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-red-300 hover:shadow-md transition-all relative overflow-hidden"
            >
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-extrabold uppercase text-slate-400 tracking-wider text-[10px]">
                    {offer.merchant_name}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-black uppercase">
                    {offer.network_source}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-slate-900 leading-snug mb-1">
                  {offer.title}
                </h4>
                <p className="text-xs text-slate-500 mb-4 leading-relaxed line-clamp-3">
                  {offer.description || 'Live partner program — see merchant site for terms.'}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">Reward:</span>
                  <strong className="text-sm font-bold text-emerald-600 font-mono">
                    {rewardLabel(offer)}
                  </strong>
                </div>

                <button
                  onClick={() => handleClaim(offer)}
                  disabled={!offer.affiliate_url}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Grab Deal <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {offer.expires_at && (
                <span className="absolute top-0 right-0 bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-bl-lg font-semibold">
                  till {new Date(offer.expires_at).toLocaleDateString('en-GB').replace(/\//g, '-')}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
