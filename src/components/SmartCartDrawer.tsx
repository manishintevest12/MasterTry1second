import React, { useState } from 'react';
import { ShoppingCart, X, Plus, Minus, Trash2, Loader2, Trophy, AlertTriangle, ExternalLink } from 'lucide-react';
import { useApp, type SmartCartCompare } from '../context/AppContext';

/** Smart Cart drawer (owner rule): the basket is totalled at EVERY grocery
 *  store server-side (POST /api/smart-cart/compare) and ranked by FULL-basket
 *  cost; 'Shop at <store>' hops through /api/out like every other deal link. */
export const SmartCartDrawer: React.FC = () => {
  const { smartCart, updateSmartCartQty, removeFromSmartCart, clearSmartCart, isSmartCartOpen, setIsSmartCartOpen, userLocation, addToast } = useApp();
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<SmartCartCompare | null>(null);
  const [error, setError] = useState('');

  if (!isSmartCartOpen) return null;

  const compare = async () => {
    if (!smartCart.length) return;
    setComparing(true); setError(''); setResult(null);
    try {
      const res = await fetch('/api/smart-cart/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: smartCart, pincode: userLocation.pincode, city: userLocation.city }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Comparison failed');
      setResult(data.comparison);
    } catch (e: any) {
      setError(e?.message || 'Could not compare the basket right now.');
    } finally {
      setComparing(false);
    }
  };

  const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-slate-900/50 backdrop-blur-xs" onClick={() => setIsSmartCartOpen(false)}>
      <div
        className="w-full sm:w-[430px] h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-orange-600" />
            <h3 className="text-sm font-black text-slate-900">Smart Cart</h3>
            <span className="text-[10px] font-bold text-slate-500">({smartCart.length}/12 products)</span>
          </div>
          <button type="button" onClick={() => setIsSmartCartOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Basket list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {smartCart.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-8">
              Search groceries and tap <span className="font-bold">+ Cart</span> on any product.
              Smart Cart then totals your whole basket at every store and sends you to the cheapest one.
            </p>
          ) : smartCart.map((it) => (
            <div key={it.name} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{it.name}</p>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => updateSmartCartQty(it.name, it.qty - 1)} className="p-1 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 cursor-pointer">
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-6 text-center text-xs font-black tabular-nums">{it.qty}</span>
                <button type="button" onClick={() => updateSmartCartQty(it.name, it.qty + 1)} className="p-1 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 cursor-pointer">
                  <Plus className="w-3 h-3" />
                </button>
                <button type="button" onClick={() => removeFromSmartCart(it.name)} className="p-1 ml-1 rounded-md text-slate-300 hover:text-red-600 cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          {/* Comparison result */}
          {comparing && (
            <div className="flex items-center justify-center gap-2 py-6 text-xs font-bold text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Checking every store's total…
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
            </div>
          )}
          {result && (
            <div className="space-y-2 pt-2">
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-wide">Basket totals by store</p>
              {result.best && (
                <div className="rounded-xl border-2 border-emerald-500 bg-emerald-50 px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Trophy className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-black text-emerald-900">{result.best.seller}</span>
                      <span className="text-[9px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">CHEAPEST FULL BASKET</span>
                    </div>
                    <span className="text-sm font-black text-emerald-900 tabular-nums">{rupees(result.best.total)}</span>
                  </div>
                  {result.savingsVsWorst != null && result.savingsVsWorst > 0 && (
                    <p className="text-[10px] font-bold text-emerald-700 mt-1">Saves {rupees(result.savingsVsWorst)} vs the dearest full basket</p>
                  )}
                  <a
                    href={result.best.itemized.find((x) => x.url)?.url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => addToast('success', 'Smart Cart', `Shopping at ${result.best?.seller} — open each item from the list too.`)}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black cursor-pointer"
                  >
                    Shop at {result.best.seller} <ExternalLink className="w-3 h-3" />
                  </a>
                  <div className="mt-2 space-y-1">
                    {result.best.itemized.map((x) => (
                      <div key={x.name} className="flex items-center justify-between text-[10px] text-emerald-900">
                        <span className="truncate max-w-[240px]">{x.qty} × {x.name}</span>
                        <span className="flex items-center gap-2 font-bold tabular-nums">
                          {rupees(x.price)}
                          {x.url && <a href={x.url} target="_blank" rel="noopener noreferrer" className="underline text-emerald-700 cursor-pointer">Open</a>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {result.stores.filter((s) => !s.complete).slice(0, 6).map((s) => (
                <div key={s.seller} className="rounded-xl border border-slate-200 px-3 py-2 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-700">{s.seller}</p>
                    <p className="text-[10px] text-amber-700 font-bold">Missing {s.itemsMissing} item{s.itemsMissing > 1 ? 's' : ''}: {s.missing.slice(0, 3).join(', ')}{s.missing.length > 3 ? '…' : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-800 tabular-nums">{rupees(s.total)}</p>
                    <p className="text-[9px] text-slate-400 font-bold">{s.itemsCovered}/{result.items.length} items</p>
                  </div>
                </div>
              ))}
              {result.notFound.length > 0 && (
                <p className="text-[10px] text-slate-500 font-bold">
                  No store returned: {result.notFound.join(', ')} — try a shorter product name.
                </p>
              )}
              {!result.best && (
                <p className="text-[10px] text-amber-700 font-bold">
                  No single store carries the full basket right now — the partial totals above show what each store is missing.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {smartCart.length > 0 && (
          <div className="border-t border-slate-200 px-4 py-3 flex items-center gap-2 bg-slate-50">
            <button
              type="button"
              onClick={() => { clearSmartCart(); setResult(null); }}
              className="px-3 py-2 rounded-xl border border-slate-200 text-[11px] font-bold text-slate-500 hover:bg-slate-100 cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={comparing}
              onClick={compare}
              className="flex-1 px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-black transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              {comparing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShoppingCart className="w-3.5 h-3.5" />}
              Compare basket across stores
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
