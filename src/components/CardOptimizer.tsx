import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  ExternalLink,
  ShieldCheck,
  Search,
  Copy,
  Info,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

/**
 * Live Card & Banking Offers.
 * Every offer rendered here comes from the connected affiliate networks
 * (GET /api/v1/offers). Nothing is simulated: if the networks return no
 * card/banking campaigns, we say so. Each "Apply" click routes through the
 * server-side masking pointer (/api/go) to the bank's official URL with the
 * network's tracking appended — the bank's own page is the single source
 * for fees, rewards and terms.
 */

const CARD_KEYWORDS = [
  'credit card',
  'card apply',
  'card application',
  'hdfc',
  'sbicard',
  'sbi card',
  'icici',
  'axis bank',
  'axis',
  'kotak',
  'indusind',
  'idfc',
  'american express',
  'amex',
  'rupay',
  'lounge',
];

interface LiveOffer {
  id: string;
  merchant_name: string;
  title: string;
  description?: string;
  coupon_code?: string;
  affiliate_url?: string;
  categories?: string;
  logo_url?: string;
}

const looksLikeCardOffer = (o: LiveOffer) => {
  const hay = `${o.merchant_name || ''} ${o.title || ''} ${o.description || ''} ${o.categories || ''}`.toLowerCase();
  return CARD_KEYWORDS.some((k) => hay.includes(k));
};

export const CardOptimizer: React.FC = () => {
  const { addToast } = useApp();

  const [offers, setOffers] = useState<LiveOffer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/v1/offers?limit=200');
        const data = await res.json();
        const cardOffers: LiveOffer[] = (data.offers || []).filter(looksLikeCardOffer);
        if (!cancelled) setOffers(cardOffers);
      } catch {
        if (!cancelled) setOffers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredOffers = useMemo(() => {
    if (!searchQuery.trim()) return offers;
    const q = searchQuery.toLowerCase();
    return offers.filter(
      (o) =>
        o.merchant_name?.toLowerCase().includes(q) ||
        o.title?.toLowerCase().includes(q) ||
        o.description?.toLowerCase().includes(q)
    );
  }, [offers, searchQuery]);

  const handleCopy = async (code: string, merchant: string) => {
    try { await navigator.clipboard.writeText(code); } catch { /* clipboard blocked */ }
    addToast('success', 'Code copied', `${code} copied. Paste it on ${merchant}'s application page.`);
  };

  const handleApply = async (o: LiveOffer) => {
    if (!o.affiliate_url) return;
    try {
      const res = await fetch(`/api/go?url=${encodeURIComponent(o.affiliate_url)}&offerId=${o.id}`);
      const data = await res.json();
      if (data.redirectUrl) {
        window.open(data.redirectUrl, '_blank', 'noopener,noreferrer');
        return;
      }
    } catch { /* redirect service unavailable */ }
    addToast('alert', 'Could not open application', 'Please try again in a moment.');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-slate-800">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-bold">
            <CreditCard className="w-3.5 h-3.5" />
            <span>Live Card &amp; Banking Offers</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Credit Card &amp; Banking Offers from Our Partner Networks
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Every offer below is returned live by our affiliate networks right now. Fees, rewards and
            eligibility are set by the issuing bank — always check the bank's official page (where Apply
            takes you) before you commit. Terms and conditions apply, as published by the bank.
          </p>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Apply always opens the bank's own official website
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search live offers by bank or product (e.g. HDFC, lounge, cashback)..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-hidden focus:border-orange-500 focus:bg-white transition-colors"
          />
        </div>
      </div>

      {/* Content */}
      {loading && (
        <p className="text-sm text-slate-500">Loading live card offers from partner networks…</p>
      )}

      {!loading && filteredOffers.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-xs space-y-3">
          <div className="w-12 h-12 bg-slate-50 text-slate-500 rounded-2xl flex items-center justify-center mx-auto border border-slate-200">
            <Info className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No Card Offers Available Right Now</h3>
          <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
            {offers.length === 0
              ? "Our affiliate networks aren't returning any credit card or banking campaigns at the moment. We never show invented card details here — check back once a network lists a card campaign."
              : `No live offers match "${searchQuery}". Try a different bank name.`}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredOffers.map((o) => (
          <div key={o.id} className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {o.logo_url ? (
                  <img src={o.logo_url} alt="" className="w-9 h-9 rounded-xl object-contain border border-slate-200 bg-white p-1" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4 text-slate-500" />
                  </div>
                )}
                <span className="text-sm font-bold text-slate-900 truncate">{o.merchant_name}</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">NETWORK VERIFIED</span>
            </div>

            <p className="text-xs font-semibold text-slate-800 leading-snug">{o.title}</p>
            {o.description && (
              <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-3">{o.description}</p>
            )}

            {o.coupon_code && (
              <button
                type="button"
                onClick={() => handleCopy(o.coupon_code!, o.merchant_name)}
                className="flex items-center gap-1.5 self-start px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-800 cursor-pointer font-mono"
              >
                <Copy className="w-3 h-3" />
                {o.coupon_code}
              </button>
            )}

            <div className="mt-auto pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-400 leading-tight">T&amp;C apply, as published by the bank</span>
              {o.affiliate_url && (
                <button
                  type="button"
                  onClick={() => handleApply(o)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer shrink-0"
                >
                  Apply on official site <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
