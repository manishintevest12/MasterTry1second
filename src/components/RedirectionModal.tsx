import React, { useEffect, useState } from 'react';
import {
  ExternalLink,
  Sparkles,
  CheckCircle2,
  X,
  ArrowRight,
  Wallet,
  Tag,
  Copy,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { buildAffiliateDeepLink } from '../utils/deepLinkHelper';
import { formatPrice, isRateVertical } from '../utils/formatPrice';
import { DealCard, type PublicDeal } from './DealCard';

export const RedirectionModal: React.FC = () => {
  const { redirectionState, closeRedirection, userPoints, userLocation, affiliateIds, openSpendLens } = useApp();
  const [sellerDeals, setSellerDeals] = useState<PublicDeal[]>([]);
  const [bestCoupon, setBestCoupon] = useState<PublicDeal | null>(null);
  const [couponCopied, setCouponCopied] = useState(false);
  const sellerName = redirectionState.quote?.sellerName || '';
  const open = redirectionState.isOpen;

  // The seller's own live coupons / bank offers (registry + affiliate rows), so the
  // customer knows what to apply at checkout. The endpoint also returns the single
  // BEST coupon — the owner rule (21 Oct): show it prominently with copy-to-clipboard.
  useEffect(() => {
    if (!open || !sellerName) { setSellerDeals([]); setBestCoupon(null); return; }
    let cancelled = false;
    fetch(`/api/deals/for-seller?seller=${encodeURIComponent(sellerName)}&limit=4`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setSellerDeals(d.deals || []);
        setBestCoupon((d.best && d.best.coupon) || null);
      })
      .catch(() => { if (!cancelled) { setSellerDeals([]); setBestCoupon(null); } });
    return () => { cancelled = true; };
  }, [open, sellerName]);

  useEffect(() => { setCouponCopied(false); }, [bestCoupon]);

  const copyCoupon = async (code: string) => {
    try { await navigator.clipboard.writeText(code); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = code; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    }
    setCouponCopied(true);
    setTimeout(() => setCouponCopied(false), 2000);
  };

  if (!redirectionState.isOpen || !redirectionState.item || !redirectionState.quote) {
    return null;
  }

  const { item, quote, step } = redirectionState;

  const handleProceed = () => {
    // Owner 24 Oct: no pointer at all (source published no link and no honest
    // merchant-search fallback) -> close instead of opening a blank tab.
    if (!String(quote.url || '')) { closeRedirection(); return; }
    // Masking pointer (Module 4): server-side hop already carries attribution;
    // never wrap it in a client-side tracking template.
    if (String(quote.url || '').startsWith('/api/out')) {
      window.open(quote.url, '_blank', 'noopener,noreferrer');
      closeRedirection();
      return;
    }
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
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[92vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 text-center relative overflow-hidden">
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
              Your Best Offer is Ready!
            </h3>
            <p className="text-xs text-slate-600 mb-4 max-w-xs mx-auto leading-relaxed">
              {isRateVertical(item.vertical)
                ? <>Opening <strong>{item.title}</strong> on the lender's page, starting at <strong>{formatPrice(item.vertical, quote.price)} p.a.</strong> (indicative; the final rate is set by the lender).</>
                : <>Your deal for <strong>{item.title}</strong> at <strong>{formatPrice(item.vertical, quote.price)}</strong> is locked with zero extra fees.</>}
            </p>

            {bestCoupon && (
              <div className="mb-4 p-3 rounded-xl border-2 border-dashed border-emerald-400 bg-emerald-50 text-left">
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700 mb-1.5 flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  Your best coupon for {quote.sellerName}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-base font-extrabold text-slate-900 tracking-wide truncate">
                      {bestCoupon.code || bestCoupon.title}
                    </p>
                    <p className="text-[11px] text-slate-600 leading-snug line-clamp-2">
                      {bestCoupon.discountText || bestCoupon.title}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => bestCoupon.code && copyCoupon(bestCoupon.code)}
                    className={`shrink-0 px-3 py-2 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      couponCopied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {couponCopied ? 'Copied!' : 'Copy code'}
                  </button>
                </div>
              </div>
            )}

            {sellerDeals.length > 0 ? (
              <div className="text-left mb-5">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">
                  Save more at {quote.sellerName}
                </p>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {sellerDeals.map((d) => <DealCard key={d.id} deal={d} compact />)}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-orange-50 rounded-xl border border-orange-200 text-xs text-orange-950 mb-6 flex items-center justify-between">
                <span className="text-[11px]">Want Prize Wheel Spins?</span>
                <strong className="text-xs font-bold text-orange-700">
                  Earn 1 Point per Friend Referred!
                </strong>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                openSpendLens({ merchant: quote.sellerName, amount: quote.price, itemTitle: item.title, vertical: item.vertical });
                closeRedirection();
              }}
              className="w-full mb-2 py-2 px-4 bg-red-50 hover:bg-red-100 text-[#E7000B] text-[11px] font-bold rounded-xl border border-red-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              title="Prefill this purchase in Spend Lens — you confirm the amount, nothing is auto-saved"
            >
              <Wallet className="w-3.5 h-3.5" />
              Log this purchase in Spend Lens
            </button>

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
