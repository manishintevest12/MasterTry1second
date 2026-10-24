import React, { useCallback, useEffect, useState } from 'react';
import { Globe2, ToggleLeft, RefreshCw } from 'lucide-react';

/**
 * REAL data sources (owner 24 Oct): the live source registry + health stats
 * from /api/admin/sources. The mock "custom scraper simulator" is removed —
 * this shows the actual acquisition workers and their real state.
 */
interface SourceRow {
  id: string; label: string; vertical: string; enabled: boolean; priority: number;
  health: { state?: string; totalAttempts?: number; totalSuccesses?: number; avgLatencyMs?: number; lastError?: string };
}

const card = 'bg-white rounded-2xl border border-slate-200 shadow-xs';

export const SourcesTab: React.FC = () => {
  const [token] = useState(() => localStorage.getItem('t1s_admin_token') || '');
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/sources', { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (d.success) setSources(d.sources || []);
    } catch { /* keep */ }
    setLoading(false);
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  const toggle = async (id: string, enabled: boolean) => {
    await fetch(`/api/admin/sources/${encodeURIComponent(id)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ enabled: !enabled }),
    });
    void load();
  };

  const enabled = sources.filter((s) => s.enabled).length;

  return (
    <div className="space-y-4">
      <div className={`${card} p-4`}>
        <h3 className="text-base font-bold text-slate-900">Live Data Sources (Real Registry)</h3>
        <p className="text-xs text-slate-500">
          {enabled} / {sources.length} sources enabled. Attempts/successes/latency seedha source_health se — koi simulated run nahi.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sources.map((s) => (
          <div key={s.id} className={`${card} p-4 flex items-start justify-between gap-3`}>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Globe2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-sm font-bold text-slate-900 truncate">{s.label || s.id}</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 capitalize">{s.vertical} · priority {s.priority}</div>
              <div className="text-[11px] font-mono text-slate-400 mt-1">
                {s.health?.totalAttempts ?? 0} attempts · {s.health?.totalSuccesses ?? 0} ok
                {s.health?.avgLatencyMs ? ` · ${Math.round(s.health.avgLatencyMs)}ms avg` : ''}
              </div>
              {s.health?.lastError && <div className="text-[10px] text-red-500 mt-1 truncate" title={s.health.lastError}>last error: {s.health.lastError}</div>}
            </div>
            <button onClick={() => toggle(s.id, s.enabled)}
              className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                s.enabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'
              }`}>
              <ToggleLeft className="w-3.5 h-3.5" />{s.enabled ? 'ON' : 'OFF'}
            </button>
          </div>
        ))}
        {!sources.length && !loading && <div className={`${card} p-6 text-center text-xs text-slate-400 col-span-2`}>Registry load nahi hua.</div>}
      </div>
      <button onClick={() => void load()} className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700">
        <RefreshCw className="w-3.5 h-3.5" /> Refresh
      </button>
    </div>
  );
};
