import React, { useState } from 'react';
import { Copy, Check, ExternalLink, Clock } from 'lucide-react';

/** One real deal (coupon / bank offer / gift card / card / loan / insurance / movie offer). */
export interface PublicDeal {
  id: number; merchantKey: string; merchantName: string; kind: string; title: string;
  description: string | null; code: string | null; discountText: string | null;
  minOrder: number | null; terms: string | null; validTill: string | null; goUrl: string;
  imageUrl: string | null;
}

export const KIND_LABEL: Record<string, string> = {
  coupon: 'Coupon', bank_offer: 'Bank offer', credit_card: 'Credit card', gift_card: 'Gift card',
  loan: 'Loan', insurance: 'Insurance', movie: 'Movie offer', cashback: 'Cashback', sale: 'Sale',
};

const daysLeft = (d: string | null): number | null => {
  if (!d) return null;
  const ms = Date.parse(`${d}T23:59:59`) - Date.now();
  return Number.isFinite(ms) ? Math.ceil(ms / 86_400_000) : null;
};

export const DealCard: React.FC<{ deal: PublicDeal; compact?: boolean; onUsed?: (d: PublicDeal) => void }> = ({ deal, compact, onUsed }) => {
  const [copied, setCopied] = useState(false);
  const left = daysLeft(deal.validTill);

  const copy = async () => {
    if (!deal.code) return;
    try { await navigator.clipboard.writeText(deal.code); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ }
  };
  const go = async () => {
    await copy();
    window.open(deal.goUrl, '_blank', 'noopener,noreferrer');
    onUsed?.(deal);
  };

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 flex flex-col justify-between hover:border-red-300 hover:shadow-md transition-all ${compact ? 'p-3' : 'p-4'}`}>
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 truncate">{deal.merchantName}</span>
          <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[10px] font-black uppercase shrink-0">{KIND_LABEL[deal.kind] || deal.kind}</span>
        </div>
        {deal.imageUrl && (
          <div className="mt-1.5 mb-1.5 rounded-lg overflow-hidden bg-slate-50 border border-slate-100">
            <img src={deal.imageUrl} alt={deal.title} loading="lazy" className="w-full h-28 object-contain mix-blend-multiply" />
          </div>
        )}
        <h4 className={`font-bold text-slate-900 leading-snug ${compact ? 'text-xs' : 'text-sm'}`}>{deal.title}</h4>
        {deal.discountText && <p className="text-xs font-bold text-emerald-600 mt-1">{deal.discountText}</p>}
        {!compact && deal.description && <p className="text-xs text-slate-500 mt-1.5 leading-relaxed line-clamp-3">{deal.description}</p>}
        {deal.minOrder != null && deal.minOrder > 0 && <p className="text-[11px] text-slate-500 mt-1">Min. order ₹{deal.minOrder.toLocaleString('en-IN')}</p>}
      </div>

      <div className="mt-3 space-y-2">
        {deal.code && (
          <button type="button" onClick={copy} className="w-full flex items-center justify-between px-3 py-2 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 cursor-pointer">
            <span className="font-mono font-black text-sm tracking-wider text-amber-900">{deal.code}</span>
            <span className="flex items-center gap-1 text-[11px] font-bold text-amber-800">{copied ? <><Check className="w-3.5 h-3.5" />Copied</> : <><Copy className="w-3.5 h-3.5" />Copy</>}</span>
          </button>
        )}
        <div className="flex items-center gap-2">
          <button type="button" onClick={go} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer">
            {deal.code ? 'Copy & shop' : 'Get this deal'} <ExternalLink className="w-3.5 h-3.5" />
          </button>
          {left != null && left >= 0 && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold shrink-0 ${left <= 2 ? 'text-red-600' : 'text-slate-500'}`}>
              <Clock className="w-3 h-3" />{left === 0 ? 'Ends today' : `${left}d left`}
            </span>
          )}
        </div>
        {!compact && deal.terms && <p className="text-[10px] text-slate-400 leading-snug line-clamp-2">T&amp;C: {deal.terms}</p>}
      </div>
    </div>
  );
};
