import React, { useState } from 'react';
import { Check, ChevronDown, Eye, GitCompareArrows, Landmark, Plane, Star, Utensils, Wallet, Zap } from 'lucide-react';
import type { OfferGroup } from '../utils/offerGroups';
import type { ComparisonItem } from '../types';
import { useApp } from '../context/AppContext';

/**
 * Credit-card result card (matches the owner's reference design). Everything on it
 * comes from the acquisition pipeline: fees, reward rate, APR, image, rating, and the
 * Apply deeplink (a masking pointer; affiliate params are injected server-side in /api/out).
 */
const spec = (it: ComparisonItem, ...ks: string[]): string => {
  for (const k of ks) {
    const v = it.specs?.[k] ?? it.specs?.[k.toLowerCase()];
    if (v && String(v).trim() && String(v) !== 'undefined') return String(v);
  }
  return '';
};

const BANK_STYLE: Record<string, { bg: string; color: string }> = {
  'hdfc bank': { bg: 'bg-blue-950', color: 'text-white' },
  'axis bank': { bg: 'bg-rose-950', color: 'text-white' },
  'sbi card': { bg: 'bg-sky-900', color: 'text-white' },
  'icici bank': { bg: 'bg-orange-700', color: 'text-white' },
  'idfc first bank': { bg: 'bg-purple-800', color: 'text-white' },
  'kotak mahindra bank': { bg: 'bg-red-800', color: 'text-white' },
  'indusind bank': { bg: 'bg-red-900', color: 'text-white' },
  'au small finance bank': { bg: 'bg-orange-600', color: 'text-white' },
  'yes bank': { bg: 'bg-yellow-600', color: 'text-slate-950' },
  'rbl bank': { bg: 'bg-rose-700', color: 'text-white' },
  'bank of baroda': { bg: 'bg-yellow-700', color: 'text-slate-950' },
  'american express': { bg: 'bg-sky-800', color: 'text-white' },
  'standard chartered': { bg: 'bg-blue-800', color: 'text-white' },
  'hsbc': { bg: 'bg-red-700', color: 'text-white' },
};
const bankStyle = (bank: string) => BANK_STYLE[bank.trim().toLowerCase()] || { bg: 'bg-slate-800', color: 'text-white' };

const bestForIcon = (bf: string) => {
  const s = bf.toLowerCase();
  if (/travel|lounge|flight|air/.test(s)) return <Plane className="w-3.5 h-3.5" />;
  if (/dining|food|swiggy|zomato/.test(s)) return <Utensils className="w-3.5 h-3.5" />;
  if (/fuel|petrol/.test(s)) return <Zap className="w-3.5 h-3.5" />;
  if (/cashback|shopping/.test(s)) return <Wallet className="w-3.5 h-3.5" />;
  return <Landmark className="w-3.5 h-3.5" />;
};

interface Props {
  group: OfferGroup;
  selectedForCompare: boolean;
  onToggleCompare: (item: ComparisonItem) => void;
}

export const CreditCardCard: React.FC<Props> = ({ group, selectedForCompare, onToggleCompare }) => {
  const { startRedirection } = useApp();
  // One card per credit card: quotes from different review sites share the same published
  // bank fee, so the lead item IS the card. Rows still exist for multi-site provenance.
  const item = group.lead;
  const [detailsOpen, setDetailsOpen] = useState(false);

  const bank = spec(item, 'bank') || item.provider || item.subtitle || '';
  const st = bankStyle(bank);
  const network = spec(item, 'network');
  const joining = spec(item, 'joining fee');
  const annual = spec(item, 'annual fee');
  const reward = spec(item, 'reward rate');
  const apr = spec(item, 'apr');
  const forex = spec(item, 'forex markup');
  const domLounge = spec(item, 'domestic lounge');
  const intlLounge = spec(item, 'international lounge');
  const bestFor = spec(item, 'best for');
  const welcome = spec(item, 'welcome benefit');
  const fuel = spec(item, 'fuel surcharge waiver');
  const annualInr = Number(spec(item, 'annual fee inr'));
  const lifetimeFree = annualInr === 0 || /lifetime free/i.test(annual || joining || '');
  const rating = Number(item.rating) || 0;
  const score = Math.round(rating * 20); // 0-100 ring (5-star scale -> 100)

  const quote = item.sellerQuotes.find((q) => q.isLowest) || item.sellerQuotes[0];
  const feeLine = lifetimeFree ? 'Lifetime Free' : (annual ? `₹${(annualInr || 0).toLocaleString('en-IN')} / yr` : 'Fee on application');

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Left: card art + score ring */}
          <div className="flex sm:flex-col items-center sm:items-start gap-4 sm:w-44 shrink-0">
            {item.imageUrl ? (
              <img src={item.imageUrl} alt={item.title} loading="lazy" className="w-36 h-24 sm:w-40 sm:h-[106px] object-contain rounded-xl border border-slate-200 bg-slate-50 p-1.5" />
            ) : (
              <div className="w-36 h-24 sm:w-40 sm:h-[106px] rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 text-xs">Card art unavailable</div>
            )}
            <div className="flex items-center gap-3">
              <div className="relative w-14 h-14 shrink-0">
                <svg viewBox="0 0 56 56" className="w-14 h-14 -rotate-90">
                  <circle cx="28" cy="28" r="24" fill="none" strokeWidth="6" className="stroke-slate-100" />
                  <circle cx="28" cy="28" r="24" fill="none" strokeWidth="6" strokeLinecap="round"
                    className={score >= 80 ? 'stroke-emerald-500' : score >= 60 ? 'stroke-amber-400' : 'stroke-rose-400'}
                    strokeDasharray={`${(score / 100) * 150.8} 150.8`} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-sm font-extrabold text-slate-900 leading-none">{score}</span>
                  <span className="text-[8px] text-slate-400 font-semibold">/100</span>
                </div>
              </div>
              {rating > 0 && (
                <div className="leading-tight">
                  <div className="flex items-center gap-1 text-xs font-bold text-slate-800"><Star className="w-3 h-3 fill-amber-400 text-amber-400" />{rating.toFixed(1)}</div>
                  <div className="text-[10px] text-slate-400">Editor score</div>
                </div>
              )}
            </div>
          </div>

          {/* Middle: identity + fee facts */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${st.bg} ${st.color}`}>
                <Landmark className="w-3 h-3" />{bank || 'Issuer'}
              </span>
              {network && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">{network}</span>}
              {lifetimeFree && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">LIFETIME FREE</span>}
              {bestFor && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 text-slate-600 border border-slate-200">{bestForIcon(bestFor)}{bestFor}</span>
              )}
            </div>
            <h3 className="mt-2 text-[15px] sm:text-base font-extrabold text-slate-900 leading-snug">{item.title}</h3>
            {item.description && <p className="mt-1 text-xs text-slate-500 line-clamp-2">{item.description}</p>}

            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Joining</div>
                <div className="text-xs font-bold text-slate-800 truncate" title={joining || undefined}>{joining || '—'}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Annual</div>
                <div className="text-xs font-bold text-slate-800 truncate" title={annual || undefined}>{annual || '—'}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Rewards</div>
                <div className="text-xs font-bold text-slate-800 truncate" title={reward || undefined}>{reward || '—'}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">APR</div>
                <div className="text-xs font-bold text-slate-800 truncate" title={apr || undefined}>{apr || '—'}</div>
              </div>
            </div>

            {detailsOpen && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs border-t border-slate-100 pt-3">
                {[['Welcome benefit', welcome], ['Domestic lounge', domLounge], ['International lounge', intlLounge], ['Forex markup', forex], ['Fuel surcharge waiver', fuel], ['Best for', bestFor]].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-dashed border-slate-100 pb-1">
                    <span className="text-slate-400">{k}</span>
                    <span className="text-right text-slate-700 font-medium line-clamp-2">{v || 'Not stated by issuer'}</span>
                  </div>
                ))}
                <div className="sm:col-span-2 text-[10px] text-slate-400 pt-1">{item.sentimentSummary}</div>
              </div>
            )}
          </div>

          {/* Right: fee + actions */}
          <div className="sm:w-40 shrink-0 flex sm:flex-col gap-3 sm:border-l border-slate-100 sm:pl-4">
            <div>
              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Annual fee</div>
              <div className={`text-xl font-extrabold ${lifetimeFree ? 'text-emerald-600' : 'text-slate-900'}`}>{feeLine}</div>
              {group.rows.length > 1 && (
                <div className="text-[10px] text-slate-400 mt-0.5">Seen on {group.rows.length} sites</div>
              )}
            </div>
            <div className="flex sm:flex-col gap-2">
              <button
                type="button"
                onClick={() => onToggleCompare(item)}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${selectedForCompare ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'}`}
              >
                {selectedForCompare ? <Check className="w-3.5 h-3.5" /> : <GitCompareArrows className="w-3.5 h-3.5" />}
                {selectedForCompare ? 'Added' : 'Compare'}
              </button>
              <button
                type="button"
                onClick={() => setDetailsOpen((o) => !o)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-slate-300 hover:border-slate-400 text-slate-700 bg-white transition-all cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />Details
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
              </button>
              {quote && (
                <button
                  type="button"
                  onClick={() => startRedirection(item, quote)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-extrabold bg-red-600 hover:bg-red-700 text-white transition-all cursor-pointer shadow-sm"
                >
                  Apply Now
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
