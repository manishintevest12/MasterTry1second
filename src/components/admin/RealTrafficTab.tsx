import React, { useCallback, useEffect, useState } from 'react';
import { Activity, MousePointerClick, Zap, Database } from 'lucide-react';

/**
 * REAL platform traffic (owner 24 Oct): every number comes from the MySQL
 * searches / affiliate_clicks tables via /api/admin/traffic/real. The previous
 * mock 12-month traffic/GMV/revenue charts are removed — no fabricated data.
 */
interface DailySearch { day: string; count: number; avg_latency_ms: number | null; with_results: number | null }
interface TrafficResp {
  windowDays: number;
  dailySearches: DailySearch[];
  byVertical: { vertical: string; count: number }[];
  topQueries: { raw_query: string; vertical: string | null; count: number }[];
  dailyClicks: { day: string; count: number }[];
  clicksByNetwork: { network_id: string; count: number }[];
  searchesWindow: number;
  searchesWithResults: number;
}

const card = 'bg-white rounded-2xl border border-slate-200 shadow-xs';

export const RealTrafficTab: React.FC = () => {
  const [token] = useState(() => localStorage.getItem('t1s_admin_token') || '');
  const [days, setDays] = useState(30);
  const [data, setData] = useState<TrafficResp | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/traffic/real?days=${days}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (d.success) setData(d.traffic);
    } catch { /* keep */ }
    setLoading(false);
  }, [token, days]);
  useEffect(() => { void load(); }, [load]);

  const totalClicks = (data?.clicksByNetwork || []).reduce((s, n) => s + Number(n.count || 0), 0);
  const avgLat = data?.dailySearches?.length
    ? Math.round(data.dailySearches.reduce((s, r) => s + Number(r.avg_latency_ms || 0), 0) / data.dailySearches.length)
    : 0;
  const maxSearches = Math.max(1, ...(data?.dailySearches || []).map((r) => Number(r.count || 0)));

  const tiles = [
    { label: `Searches (${days}d)`, value: (data?.searchesWindow ?? 0).toLocaleString('en-IN'), icon: Activity },
    { label: 'With Results', value: (data?.searchesWithResults ?? 0).toLocaleString('en-IN'), icon: Database },
    { label: 'Avg Latency', value: `${avgLat} ms`, icon: Zap },
    { label: 'Outbound Clicks', value: totalClicks.toLocaleString('en-IN'), icon: MousePointerClick },
  ];

  return (
    <div className="space-y-4">
      <div className={`${card} p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3`}>
        <div>
          <h3 className="text-base font-bold text-slate-900">Platform Traffic (Real)</h3>
          <p className="text-xs text-slate-500">
            Har number live MySQL se: <code className="px-1 bg-slate-100 rounded">searches</code> (user searches) + <code className="px-1 bg-slate-100 rounded">affiliate_clicks</code> (merchant exits). Koi mock/GMV number nahi.
          </p>
        </div>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}
          className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 self-start">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className={`${card} p-4`}>
            <div className="flex items-center gap-2 text-slate-400"><t.icon className="w-4 h-4" /><span className="text-[10px] font-bold uppercase tracking-wider">{t.label}</span></div>
            <div className="mt-1.5 text-xl font-bold text-slate-900 font-mono">{t.value}</div>
          </div>
        ))}
      </div>

      <div className={`${card} p-5`}>
        <h4 className="text-sm font-bold text-slate-900 mb-3">Daily Searches vs Outbound Clicks</h4>
        <div className="flex items-end gap-1.5 h-40 overflow-x-auto">
          {(data?.dailySearches || []).map((r) => {
            const clicks = Number(data?.dailyClicks?.find((c) => String(c.day) === String(r.day))?.count || 0);
            return (
              <div key={r.day} className="flex flex-col items-center gap-1 min-w-[34px]" title={`${r.day}: ${r.count} searches, ${clicks} clicks`}>
                <div className="w-6 flex flex-col justify-end h-32">
                  <div className="w-full rounded-t bg-orange-400" style={{ height: `${(Number(r.count) / maxSearches) * 100}%` }} />
                  <div className="w-full bg-red-600 rounded-b-sm" style={{ height: `${Math.min(100, (clicks / maxSearches) * 100)}%` }} />
                </div>
                <span className="text-[9px] text-slate-400 font-mono">{String(r.day).slice(5)}</span>
              </div>
            );
          })}
          {!(data?.dailySearches || []).length && !loading && (
            <p className="text-xs text-slate-400 py-10">Is window me koi search log nahi mila.</p>
          )}
        </div>
        <div className="flex gap-4 mt-2 text-[10px] text-slate-500">
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-orange-400 rounded-sm inline-block" /> Searches</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-red-600 rounded-sm inline-block" /> Outbound clicks</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`${card} p-5`}>
          <h4 className="text-sm font-bold text-slate-900 mb-3">Searches by Vertical</h4>
          <div className="space-y-2">
            {(data?.byVertical || []).map((v) => (
              <div key={v.vertical} className="flex items-center justify-between text-xs">
                <span className="capitalize text-slate-700 font-medium">{v.vertical}</span>
                <span className="font-mono font-bold text-slate-900">{Number(v.count).toLocaleString('en-IN')}</span>
              </div>
            ))}
            {!(data?.byVertical || []).length && <p className="text-xs text-slate-400">No data.</p>}
          </div>
        </div>
        <div className={`${card} p-5`}>
          <h4 className="text-sm font-bold text-slate-900 mb-3">Top Real Queries</h4>
          <div className="space-y-2">
            {(data?.topQueries || []).map((q, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-slate-700 truncate max-w-[70%]">{q.raw_query}</span>
                <span className="font-mono text-slate-500">{q.count}×</span>
              </div>
            ))}
            {!(data?.topQueries || []).length && <p className="text-xs text-slate-400">No data.</p>}
          </div>
        </div>
      </div>

      <div className={`${card} p-5`}>
        <h4 className="text-sm font-bold text-slate-900 mb-3">Clicks by Network (real)</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {(data?.clicksByNetwork || []).map((n) => (
            <div key={n.network_id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-[10px] uppercase font-bold text-slate-400">{n.network_id}</div>
              <div className="text-base font-bold font-mono text-slate-900">{Number(n.count).toLocaleString('en-IN')}</div>
            </div>
          ))}
          {!(data?.clicksByNetwork || []).length && <p className="text-xs text-slate-400">Koi outbound click abhi record nahi hua.</p>}
        </div>
      </div>
    </div>
  );
};
