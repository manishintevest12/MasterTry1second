import React, { useState, useEffect, useCallback } from 'react';
import {
  Radar,
  Zap,
  ArrowRight,
  RotateCw,
  Clock,
  ShieldCheck,
  Activity,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { VerticalId } from '../types';

interface SourceStatus {
  id: string;
  name: string;
  method: string;
  verticals: string[];
  enabled: boolean;
  health: string;
  lastSuccessAt: string | null;
  totalAttempts: number;
  totalSuccesses: number;
  classification: string;
}

interface ProvenanceLog {
  offer_id: number;
  source_id: string;
  source_method: string;
  source_url: string;
  fetched_at: string;
  extracted_fields: number;
}

// Owner 24 Oct: the old RadarView faked a "price discrepancy stream" with
// random deltas and hardcoded detections. It now mirrors the Flutter
// RadarScreen: REAL engine state from /api/status (source health) and
// /api/provenance (actual acquisition events logged by the engine).
export const RadarView: React.FC = () => {
  const { setVertical, setActiveNavTab, refreshLivePrices } = useApp();

  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [logs, setLogs] = useState<ProvenanceLog[]>([]);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    try {
      const [statusRes, provRes] = await Promise.all([
        fetch('/api/status').then((r) => r.json()).catch(() => null),
        fetch('/api/provenance').then((r) => r.json()).catch(() => null),
      ]);
      setSources((statusRes?.sources as SourceStatus[]) || []);
      setLogs(((provRes?.logs as ProvenanceLog[]) || []).slice(0, 40));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 20000);
    return () => clearInterval(timer);
  }, [load]);

  const live = sources.filter((s) => s.health === 'HEALTHY' || s.health === 'OK').length;
  const degraded = sources.filter((s) => s.health === 'DEGRADED').length;
  const enabled = sources.filter((s) => s.enabled).length;

  const handleInspect = (v?: string) => {
    if (v) setVertical(v as VerticalId);
    setActiveNavTab('compare');
  };

  const healthColor = (h: string) =>
    h === 'HEALTHY' || h === 'OK'
      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
      : h === 'DEGRADED'
        ? 'bg-amber-100 text-amber-800 border-amber-200'
        : 'bg-slate-100 text-slate-600 border-slate-200';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 text-red-700 text-xs font-bold border border-red-200 mb-2">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
            <span>{enabled} LIVE SOURCES CONNECTED</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-2">
            <Radar className="w-7 h-7 text-red-600" />
            Try1Second Live Scanner Radar
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Engine ka REAL activity feed — source health aur provenance events seedha MySQL/engine state se, har 20s refresh. Koi synthetic number nahi.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={refreshLivePrices}
            className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Live Price Scan</span>
          </button>
        </div>
      </div>

      {/* Real engine stats */}
      <div className="grid grid-cols-3 gap-3.5 max-w-2xl">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Live Sources</div>
          <div className="text-2xl font-black text-emerald-600 font-mono">{live}</div>
          <div className="text-[10px] text-slate-400">HEALTHY right now</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Degraded</div>
          <div className="text-2xl font-black text-amber-500 font-mono">{degraded}</div>
          <div className="text-[10px] text-slate-400">auto-retry circuit active</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Enabled</div>
          <div className="text-2xl font-black text-sky-600 font-mono">{enabled}</div>
          <div className="text-[10px] text-slate-400">configured in registry</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Animated Radar Sweep Console (5 cols) */}
        <div className="lg:col-span-5 bg-[#090b10] border border-slate-800 rounded-2xl p-6 text-white flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden">
          <div className="w-full flex items-center justify-between text-xs text-slate-400 mb-4 pb-3 border-b border-slate-800/80">
            <span className="font-mono text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              RADAR SWEEP ACTIVE
            </span>
            <span className="font-mono text-[11px]">{busy ? 'SYNCING…' : 'REAL-TIME'}</span>
          </div>

          {/* Radar Circles with Rotating Scanner Line */}
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 my-4 rounded-full border border-emerald-500/30 flex items-center justify-center bg-radial from-emerald-950/20 via-slate-950 to-black">
            <div className="absolute w-48 h-48 rounded-full border border-emerald-500/20" />
            <div className="absolute w-32 h-32 rounded-full border border-emerald-500/20" />
            <div className="absolute w-16 h-16 rounded-full border border-emerald-500/20" />

            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-full h-px bg-emerald-500/20" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-full w-px bg-emerald-500/20" />
            </div>

            <div className="absolute inset-0 rounded-full overflow-hidden animate-[spin_4s_linear_infinite] pointer-events-none">
              <div className="w-1/2 h-1/2 bg-gradient-to-br from-emerald-400/40 via-emerald-400/10 to-transparent origin-bottom-right" />
            </div>

            <div className="w-3 h-3 bg-emerald-400 rounded-full shadow-[0_0_12px_#34d399]" />
          </div>

          <div className="mt-2 text-xs text-slate-400 font-mono">
            {enabled} sources · {live} healthy · {logs.length} recent provenance events
          </div>
        </div>

        {/* Real source health list (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-red-600" />
              <span>Source Health (Live Engine State)</span>
            </h3>
            <span className="text-[11px] font-semibold text-slate-400">refreshes every 20s</span>
          </div>

          <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
            {sources.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                {busy ? 'Engine state load ho rahi hai…' : 'Source registry abhi khali hai.'}
              </div>
            ) : (
              sources.map((s) => (
                <div
                  key={s.id}
                  className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">{s.name}</span>
                      <span className={`px-1.5 py-0.5 rounded border text-[9px] font-black uppercase ${healthColor(s.health)}`}>
                        {s.health}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                      {s.method} · {s.verticals.slice(0, 3).join(', ')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono text-slate-500">
                      {s.totalSuccesses}/{s.totalAttempts} ok
                    </span>
                    <button
                      type="button"
                      onClick={() => handleInspect(s.verticals[0])}
                      className="py-1 px-2.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>Compare</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Real provenance stream */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Acquisition Provenance Stream (Real Events)</span>
          </h3>
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            last 200 engine events
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {logs.length === 0 ? (
            <div className="col-span-full py-10 text-center text-xs text-slate-400">
              {busy ? 'Provenance logs load ho rahe hain…' : 'Abhi koi acquisition event log nahi hua — pehli search ke baad events yahan stream honge.'}
            </div>
          ) : (
            logs.map((l, i) => (
              <div key={`${l.offer_id}-${l.source_id}-${i}`} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-800 truncate">{l.source_id}</span>
                  <span className="text-slate-400 font-mono shrink-0">{String(l.fetched_at || '').replace('T', ' ').slice(5, 16)}</span>
                </div>
                <div className="text-slate-500 mt-0.5 truncate">
                  {l.source_method} · {l.extracted_fields} fields · offer #{l.offer_id}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
