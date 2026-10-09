import React from 'react';
import {
  Sparkles,
  TrendingDown,
  CheckCircle2,
  Info,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        let icon = <Info className="w-4 h-4 text-blue-500" />;
        let borderClass = 'border-slate-200 bg-white';

        if (toast.type === 'points') {
          icon = <Sparkles className="w-4 h-4 text-orange-500" />;
          borderClass = 'border-orange-200 bg-white';
        } else if (toast.type === 'alert') {
          icon = <TrendingDown className="w-4 h-4 text-emerald-500" />;
          borderClass = 'border-emerald-200 bg-white';
        } else if (toast.type === 'success') {
          icon = <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
          borderClass = 'border-emerald-200 bg-white';
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-lg ${borderClass} animate-in slide-in-from-bottom-3 duration-200`}
          >
            <div className="shrink-0 mt-0.5">{icon}</div>

            <div className="flex-1 min-w-0">
              <h5 className="text-xs font-bold text-slate-900 leading-tight">
                {toast.title}
              </h5>
              <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                {toast.message}
              </p>
            </div>

            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 shrink-0 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
