/**
 * WarpLoader (owner 22 Oct): the one site-wide loading experience.
 * Copy: "Comparing prices across the web at warp speed... Your ultimate steal
 * is arriving in 3, 2, 1..." — an engaging animated loader with a live 3-2-1
 * countdown, pulsing warp core and shimmering skeleton cards. The page keeps
 * loading in the background the whole time: results render automatically the
 * moment they arrive, so the user reads the countdown and the steal is there.
 * Brand: RED #E11D48 accents on neutral slate surfaces, responsive everywhere.
 */
import React, { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';

/** Ticking 3 -> 2 -> 1 countdown that loops while loading. */
export const WarpCountdown: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [n, setN] = useState(3);
  useEffect(() => {
    const t = setInterval(() => setN((v) => (v > 1 ? v - 1 : 3)), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`} aria-hidden>
      <span key={n} className="t1s-warp-tick font-black tabular-nums">{n}</span>
    </span>
  );
};

/** Compact one-line banner for strip-style placements (top of feed, panels). */
export const WarpBanner: React.FC = () => (
  <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50/80 px-3.5 py-2.5 text-[12px] font-semibold text-red-700 animate-pulse-subtle">
    <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
      <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60 animate-ping" />
      <Zap className="relative h-3.5 w-3.5 text-red-600" />
    </span>
    <span className="leading-snug">
      Please wait, we are getting the best deal for you. Comparing live prices across the web...
    </span>
  </div>
);

/**
 * Full results loader: headline + animated 3-2-1 countdown core + progress
 * shimmer + skeleton card grid. Shown while the live search fetches; the
 * moment real results land this unmounts and cards replace it.
 */
export const WarpResultsLoader: React.FC<{ query?: string }> = ({ query }) => {
  const [progress, setProgress] = useState(8);
  useEffect(() => {
    // Eases toward 92% but never completes — real results end the loader.
    const t = setInterval(() => setProgress((p) => Math.min(92, p + Math.max(0.4, (92 - p) * 0.08))), 450);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <style>{`
        @keyframes t1s-warp-tick-kf { 0% { transform: scale(1.6); opacity: 0; } 25% { transform: scale(1); opacity: 1; } 85% { opacity: 1; } 100% { transform: scale(0.82); opacity: 0.25; } }
        .t1s-warp-tick { animation: t1s-warp-tick-kf 1s ease-in-out infinite; }
        @keyframes t1s-shimmer-kf { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
        .t1s-shimmer { background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 37%, #f1f5f9 63%); background-size: 800px 100%; animation: t1s-shimmer-kf 1.4s linear infinite; }
        @keyframes t1s-pulse-subtle-kf { 0%, 100% { opacity: 1; } 50% { opacity: 0.78; } }
        .animate-pulse-subtle { animation: t1s-pulse-subtle-kf 1.8s ease-in-out infinite; }
        @keyframes t1s-core-glow-kf { 0%, 100% { box-shadow: 0 0 0 6px rgba(225,29,72,0.12); } 50% { box-shadow: 0 0 0 14px rgba(225,29,72,0.05); } }
        .t1s-core-glow { animation: t1s-core-glow-kf 1.6s ease-in-out infinite; }
      `}</style>
      <div className="px-6 sm:px-10 pt-10 pb-8 text-center">
        {/* Warp core: pulsing red ring + ticking countdown */}
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-red-600 t1s-core-glow">
          <WarpCountdown className="text-4xl text-white" />
        </div>
        <h3 className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug">
          Comparing prices across the web at warp speed{query ? <> for <span className="text-red-600">“{query}”</span></> : ''}...
        </h3>
        <p className="mt-2 text-sm sm:text-[15px] font-bold text-slate-800 max-w-md mx-auto leading-relaxed">
          Please wait, we are getting the best deal for you.
        </p>
        <p className="mt-1 text-xs sm:text-[13px] text-slate-500 max-w-md mx-auto leading-relaxed animate-pulse-subtle">
          Your ultimate steal is arriving in <span className="font-bold text-red-600 tabular-nums">3, 2, 1...</span>
          {' '}Live prices from every seller land on this page automatically. Nothing is missing: the scan is still running, so there is nothing for you to redo.
        </p>
        {/* Progress shimmer */}
        <div className="mt-6 max-w-md mx-auto">
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-600 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-red-500" /> Warp scan in progress</span>
            <span className="tabular-nums">{Math.round(progress)}%</span>
          </div>
        </div>
      </div>
      {/* Skeleton card grid — the page never looks dead while loading */}
      <div className="px-4 sm:px-8 pb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-5xl mx-auto">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="t1s-shimmer h-28 rounded-xl border border-slate-200" style={{ animationDelay: `${i * 0.12}s` }} />
        ))}
      </div>
    </div>
  );
};
