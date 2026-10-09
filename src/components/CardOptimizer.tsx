import React, { useState } from 'react';
import {
  CreditCard,
  Sparkles,
  Check,
  ArrowRight,
  ShieldCheck,
  ExternalLink,
  Star,
  Search,
  Filter,
  Zap,
  Building2,
  Gift,
  Clock,
  ChevronRight,
  TrendingUp,
  Percent,
} from 'lucide-react';
import { INITIAL_CREDIT_CARDS, VERTICAL_META } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { CreditCardReward, VerticalId } from '../types';

export const CardOptimizer: React.FC = () => {
  const { setVertical, setActiveNavTab, addToast } = useApp();

  const [selectedBank, setSelectedBank] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [spendAmount, setSpendAmount] = useState<number>(35000);
  const [redirectingCardId, setRedirectingCardId] = useState<string | null>(null);

  // Banks list
  const banks = [
    { id: 'all', name: 'All Partners' },
    { id: 'HDFC', name: 'HDFC Bank' },
    { id: 'SBI', name: 'SBI Card' },
    { id: 'ICICI', name: 'ICICI Bank' },
    { id: 'AXIS', name: 'Axis Bank' },
    { id: 'AMEX', name: 'American Express' },
    { id: 'IDFC', name: 'IDFC FIRST' },
  ];

  // Categories list
  const categories = [
    { id: 'all', name: 'All Cards' },
    { id: 'cashback', name: 'Cashback & Spends' },
    { id: 'travel', name: 'Travel & Lounges' },
    { id: 'lifetime_free', name: 'Lifetime Free (₹0)' },
    { id: 'fuel_dining', name: 'Dining & Grocery' },
    { id: 'rupay', name: 'RuPay UPI' },
  ];

  // Filtering
  const filteredCards = INITIAL_CREDIT_CARDS.filter((card) => {
    if (selectedBank !== 'all' && card.bankCode !== selectedBank) {
      return false;
    }
    if (selectedCategory !== 'all' && card.category !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        card.cardName.toLowerCase().includes(q) ||
        card.bank.toLowerCase().includes(q) ||
        card.highlight.toLowerCase().includes(q) ||
        card.rewardRate.toLowerCase().includes(q) ||
        card.keyPerks?.some((p) => p.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  const handleApplyRedirect = (card: CreditCardReward) => {
    setRedirectingCardId(card.id);
    addToast(
      'success',
      `Redirecting to ${card.bank} Secure Portal`,
      `Applying exclusive Try1Second affiliate partnership rate for ${card.cardName}...`
    );

    setTimeout(() => {
      window.open(card.applyUrl, '_blank', 'noopener,noreferrer');
      setRedirectingCardId(null);
    }, 900);
  };

  const getBankBadgeStyle = (code?: string) => {
    switch (code) {
      case 'HDFC':
        return 'bg-blue-900 text-white';
      case 'SBI':
        return 'bg-sky-800 text-white';
      case 'ICICI':
        return 'bg-amber-600 text-white';
      case 'AXIS':
        return 'bg-rose-900 text-white';
      case 'AMEX':
        return 'bg-slate-900 text-amber-300';
      case 'IDFC':
        return 'bg-red-800 text-white';
      default:
        return 'bg-slate-900 text-white';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Top Affiliate Marketplace Hero */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-bold">
            <CreditCard className="w-3.5 h-3.5" />
            <span>Official Partner Affiliate Marketplace</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            Apply for Co-Branded & Cashback Partner Credit Cards
          </h1>

          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Maximize your savings across all 10 Try1Second verticals. Apply directly with our verified banking partners (HDFC, SBI, ICICI, Axis, Amex) to unlock welcome bonuses up to ₹10,000, airport lounge access, and 5% to 10% direct statement returns.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-slate-300">
            <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              100% Secure Bank Handshake
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-amber-300">
              <Gift className="w-4 h-4 text-amber-300" />
              Exclusive Welcome Rewards
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-sky-300">
              <Zap className="w-4 h-4 text-sky-300" />
              Instant Paperless Approval
            </span>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute right-0 top-0 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cards by name, bank, or perk (e.g. Amazon Pay, Lounge, Swiggy, 5% Cashback)..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-hidden focus:border-orange-500 focus:bg-white transition-colors"
          />
        </div>

        {/* Bank Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5" />
            <span>Banks:</span>
          </span>
          {banks.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setSelectedBank(b.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                selectedBank === b.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-t border-slate-100 pt-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Category:</span>
          </span>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                selectedCategory === c.id
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'bg-orange-50 hover:bg-orange-100 text-orange-800'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Spend Calculator Strip */}
      <div className="bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 rounded-2xl border border-orange-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-orange-600" />
              <h3 className="text-sm font-extrabold text-slate-900">
                Monthly Online Spend Return Simulator
              </h3>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Slide your estimated monthly shopping, travel, food, and grocery spend to see your cash return:
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-600">Monthly Spends:</span>
            <input
              type="range"
              min="5000"
              max="150000"
              step="5000"
              value={spendAmount}
              onChange={(e) => setSpendAmount(Number(e.target.value))}
              className="w-36 accent-orange-600 cursor-pointer"
            />
            <span className="font-mono font-black text-sm text-slate-900 tabular-nums bg-white px-2 py-1 rounded-md border border-orange-200">
              ₹{spendAmount.toLocaleString('en-IN')}/mo
            </span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-orange-200/60 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3 rounded-xl border border-orange-100 shadow-2xs">
            <span className="text-[11px] text-slate-500 block">Est. Annual Return</span>
            <span className="text-lg font-mono font-bold text-emerald-600 tabular-nums">
              ₹{Math.round(spendAmount * 12 * 0.05).toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">at 5% flat return</span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-orange-100 shadow-2xs">
            <span className="text-[11px] text-slate-500 block">Travel & Lounge Value</span>
            <span className="text-lg font-mono font-bold text-blue-600 tabular-nums">
              ₹{Math.round(spendAmount * 12 * 0.08).toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">at 8% travel miles</span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-orange-100 shadow-2xs">
            <span className="text-[11px] text-slate-500 block">Free Lounge Visits</span>
            <span className="text-lg font-mono font-bold text-slate-900 tabular-nums">
              Up to 16/Yr
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Airport & Railway</span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-orange-100 shadow-2xs">
            <span className="text-[11px] text-slate-500 block">Total Combined Savings</span>
            <span className="text-lg font-mono font-bold text-orange-600 tabular-nums">
              ₹{Math.round(spendAmount * 12 * 0.1).toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Deals + Card Cash</span>
          </div>
        </div>
      </div>

      {/* Credit Card Marketplace Listings Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>
            Showing <strong>{filteredCards.length}</strong> partner credit card opportunities
          </span>
          <span className="text-[11px]">
            Direct affiliate redirection with verified zero application charges
          </span>
        </div>

        {filteredCards.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
            <CreditCard className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">No partner cards match your filter</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Try adjusting your bank selection or search query to find relevant cards.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedBank('all');
                setSelectedCategory('all');
                setSearchQuery('');
              }}
              className="px-4 py-2 bg-orange-600 text-white rounded-xl text-xs font-bold hover:bg-orange-700 cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredCards.map((card) => {
              const isRedirecting = redirectingCardId === card.id;

              return (
                <div
                  key={card.id}
                  className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group"
                >
                  {/* Top highlight bar */}
                  {card.isPopular && (
                    <div className="absolute top-0 right-0 bg-gradient-to-l from-orange-600 to-amber-500 text-white text-[10px] font-black uppercase px-3 py-1 rounded-bl-xl tracking-wider shadow-xs">
                      Popular Pick
                    </div>
                  )}

                  <div>
                    {/* Header: Bank & Card Name */}
                    <div className="flex items-start justify-between gap-3 mb-4 pr-16">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${getBankBadgeStyle(
                              card.bankCode
                            )}`}
                          >
                            {card.bank}
                          </span>
                          {card.rating && (
                            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                              <strong className="text-slate-900">{card.rating}</strong>
                              <span className="text-slate-400">({card.reviewCount})</span>
                            </span>
                          )}
                        </div>

                        <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-orange-600 transition-colors">
                          {card.cardName}
                        </h3>
                      </div>
                    </div>

                    {/* Reward Rate Pill */}
                    <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Percent className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span className="text-xs font-extrabold text-emerald-900">
                          {card.rewardRate}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                        Cash Value
                      </span>
                    </div>

                    {/* Welcome Bonus / Joining Perk */}
                    {card.joiningPerks && (
                      <div className="mb-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2 text-xs">
                        <Gift className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-amber-900 font-bold block">
                            Welcome Perk:
                          </strong>
                          <span className="text-amber-800 text-[11px] leading-snug">
                            {card.joiningPerks}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Key Perks Checklist */}
                    {card.keyPerks && card.keyPerks.length > 0 && (
                      <div className="space-y-1.5 mb-4">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                          Card Features & Perks:
                        </span>
                        {card.keyPerks.map((perk, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-slate-600">
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span className="leading-snug">{perk}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Best Stacking Verticals */}
                    <div className="mb-4 pt-3 border-t border-slate-100">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                        Best For Stacking in Try1Second:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {card.bestVerticals.map((v) => {
                          const meta = VERTICAL_META[v];
                          return (
                            <button
                              key={v}
                              type="button"
                              onClick={() => {
                                setVertical(v);
                                setActiveNavTab('compare');
                              }}
                              className="px-2 py-1 text-xs font-semibold bg-orange-50 text-orange-800 hover:bg-orange-100 rounded-md border border-orange-200/80 transition-colors flex items-center gap-1 cursor-pointer"
                              title={`Compare live ${meta?.name || v} with this card discount`}
                            >
                              <span>{meta?.name || v}</span>
                              <ChevronRight className="w-3 h-3 text-orange-500" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Fee & Outbound Application CTA */}
                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                          Annual Fee
                        </span>
                        <strong className="text-slate-800 text-xs font-bold">
                          {card.annualFee}
                        </strong>
                      </div>

                      <div className="text-right">
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                          Joining Fee
                        </span>
                        <strong className="text-slate-800 text-xs font-bold">
                          {card.joiningFee || '₹0'}
                        </strong>
                      </div>
                    </div>

                    {/* The Main Affiliate "Apply Now (Partner Site)" Action Button */}
                    <button
                      type="button"
                      disabled={isRedirecting}
                      onClick={() => handleApplyRedirect(card)}
                      className="w-full py-3 px-4 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
                    >
                      {isRedirecting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Connecting to {card.bank}...</span>
                        </>
                      ) : (
                        <>
                          <span>Apply Now on {card.bank} Partner Portal</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                      <span className="flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        Zero Extra Fee
                      </span>
                      <span>Min CIBIL: {card.creditScoreRequired || '700+'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
