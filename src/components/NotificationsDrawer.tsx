import React from 'react';
import { Bell, X, TrendingDown, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const NotificationsDrawer: React.FC = () => {
  const {
    isNotificationsOpen,
    setIsNotificationsOpen,
    toasts,
    items,
    trackedItemIds,
    setVertical,
    setActiveNavTab,
  } = useApp();

  if (!isNotificationsOpen) return null;

  const trackedItems = items.filter((it) => trackedItemIds.includes(it.id));

  const handleOpenItem = (vertical: any) => {
    setVertical(vertical);
    setActiveNavTab('compare');
    setIsNotificationsOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-2xs animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-white h-full shadow-2xl flex flex-col justify-between p-5 border-l border-slate-200">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Price Alerts & Updates
                </h3>
                <span className="text-[11px] text-slate-500">
                  {trackedItems.length} active watchlists
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsNotificationsOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* List of active tracked items */}
          <div className="mt-4 space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Active Watchlist
            </span>

            {trackedItems.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-100/70 transition-colors"
              >
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="font-extrabold uppercase text-slate-400">
                    {item.vertical}
                  </span>
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded-sm flex items-center gap-0.5">
                    <TrendingDown className="w-3 h-3 text-emerald-600" />
                    Tracking Active
                  </span>
                </div>

                <h4 className="text-xs font-bold text-slate-900 leading-tight">
                  {item.title}
                </h4>

                <div className="mt-2 flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-slate-900">
                    ₹{item.primaryPrice.toLocaleString('en-IN')}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleOpenItem(item.vertical)}
                    className="text-[11px] font-bold text-red-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>View Deal</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}

            {toasts.length > 0 && (
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Recent Activity
                </span>
                {toasts.map((t) => (
                  <div key={t.id} className="text-xs p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <strong className="text-slate-900 block font-bold mb-0.5">{t.title}</strong>
                    <span className="text-[11px] text-slate-500 leading-snug">{t.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setActiveNavTab('radar');
            setIsNotificationsOpen(false);
          }}
          className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
        >
          Open Live Scanner Radar
        </button>
      </div>
    </div>
  );
};
