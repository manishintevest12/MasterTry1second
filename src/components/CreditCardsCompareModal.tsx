import React from 'react';
import { X } from 'lucide-react';

/** Side-by-side credit-card comparison (2-3 cards). Every cell shows what the issuer
 *  published; "Not stated" is honest — nothing is filled in from assumptions. */
const spec = (it: any, ...ks: string[]): string => {
  for (const k of ks) {
    const v = it?.specs?.[k] ?? it?.specs?.[k.toLowerCase()];
    if (v && String(v).trim() && String(v) !== 'undefined') return String(v);
  }
  return '';
};

const ROWS: Array<{ label: string; get: (it: any) => string }> = [
  { label: 'Issuer', get: (it) => spec(it, 'bank') || it.provider || it.subtitle || '—' },
  { label: 'Network', get: (it) => spec(it, 'network') || '—' },
  { label: 'Joining fee', get: (it) => spec(it, 'joining fee') || '—' },
  { label: 'Annual (renewal) fee', get: (it) => spec(it, 'annual fee') || '—' },
  { label: 'Reward rate', get: (it) => spec(it, 'reward rate') || '—' },
  { label: 'Interest (APR)', get: (it) => spec(it, 'apr') || '—' },
  { label: 'Forex markup', get: (it) => spec(it, 'forex markup') || '—' },
  { label: 'Domestic lounge', get: (it) => spec(it, 'domestic lounge') || 'Not stated' },
  { label: 'International lounge', get: (it) => spec(it, 'international lounge') || 'Not stated' },
  { label: 'Fuel surcharge waiver', get: (it) => spec(it, 'fuel surcharge waiver') || 'Not stated' },
  { label: 'Welcome benefit', get: (it) => spec(it, 'welcome benefit') || 'Not stated' },
  { label: 'Best for', get: (it) => spec(it, 'best for') || '—' },
  { label: 'Editor score', get: (it) => (Number(it.rating) ? `${Number(it.rating).toFixed(1)}/5` : '—') },
];

export const CreditCardsCompareModal: React.FC<{
  open: boolean;
  cards: any[];
  onClose: () => void;
  onRemove: (id: string) => void;
}> = ({ open, cards, onClose, onRemove }) => {
  if (!open || cards.length === 0) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-4xl rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[88vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="text-sm font-extrabold text-slate-900">Credit Card Comparison</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"><X className="w-4 h-4 text-slate-500" /></button>
        </div>
        <div className="overflow-auto p-5">
          <div className="grid gap-4" style={{ gridTemplateColumns: `160px repeat(${cards.length}, minmax(150px, 1fr))` }}>
            <div />
            {cards.map((c) => (
              <div key={c.id} className="relative">
                {c.imageUrl && <img src={c.imageUrl} alt={c.title} className="w-full h-[76px] object-contain rounded-lg border border-slate-200 bg-slate-50 p-1 mb-2" />}
                <p className="text-xs font-extrabold text-slate-900 leading-snug pr-5">{String(c.title).slice(0, 70)}</p>
                <button type="button" onClick={() => onRemove(c.id)} className="absolute top-1.5 right-1.5 p-1 rounded-full hover:bg-slate-100 cursor-pointer"><X className="w-3.5 h-3.5 text-slate-400" /></button>
              </div>
            ))}
            {ROWS.map((row) => (
              <React.Fragment key={row.label}>
                <div className="py-2 pr-3 text-[11px] font-bold text-slate-500 border-t border-slate-100">{row.label}</div>
                {cards.map((c) => (
                  <div key={c.id} className="py-2 px-1 text-xs font-semibold text-slate-800 border-t border-slate-100 align-top break-words">{row.get(c)}</div>
                ))}
              </React.Fragment>
            ))}
          </div>
          <p className="mt-4 text-[10px] text-slate-400">All facts as published by the issuer / observed on the review site. Final eligibility, fees and offers are decided by the bank on your application.</p>
        </div>
      </div>
    </div>
  );
};
