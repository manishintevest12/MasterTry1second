/**
 * AdSense revenue (owner 27 Oct): "admin mai ek section ye v bnao ki adsence se hume kitna
 * revenue aaya hai."
 *
 * Shows ONLY the owner's real earnings: pulled live from the AdSense Management API when the
 * OAuth env vars are set, or imported from the AdSense UI CSV export. If neither exists the
 * panel says exactly which env var is missing instead of showing zeros that look like data.
 */
import { useEffect, useState } from 'react';
import { IndianRupee, RefreshCw, Upload, Loader2, TrendingUp, TrendingDown, AlertTriangle, Activity, MousePointerClick, Eye, Percent } from 'lucide-react';

const money = (micros: number, currency = 'INR') => {
  const v = (Number(micros) || 0) / 1e6;
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(v);
  } catch { return `${currency} ${v.toFixed(2)}`; }
};

const card = 'rounded-2xl border border-slate-200 p-4';
const label = 'text-[10px] font-bold uppercase tracking-wider text-slate-400';
const big = 'text-xl font-black text-slate-900 mt-1';

export const AdsenseRevenueTab: React.FC = () => {
  const [token] = useState(() => localStorage.getItem('t1s_admin_token') || '');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'sync' | 'csv' | null>(null);
  const [csv, setCsv] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const load = async () => {
    try {
      const res = await fetch('/api/admin/adsense-revenue?days=90', { headers });
      const d = await res.json();
      if (d.success) setData(d);
      else setMsg({ ok: false, text: d.error || 'Could not load AdSense revenue' });
    } catch { setMsg({ ok: false, text: 'Could not load AdSense revenue' }); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const sync = async () => {
    setBusy('sync'); setMsg(null);
    try {
      const res = await fetch('/api/admin/adsense-revenue/sync', { method: 'POST', headers, body: JSON.stringify({ days: 30 }) });
      const d = await res.json();
      setMsg({ ok: Boolean(d.success), text: d.success ? `AdSense se ${d.rows} din ka data aa gaya.` : String(d.error || 'Sync failed') });
      await load();
    } catch { setMsg({ ok: false, text: 'Sync failed' }); }
    finally { setBusy(null); }
  };

  const importCsv = async () => {
    if (!csv.trim()) return setMsg({ ok: false, text: 'CSV paste karo ya file chuno.' });
    setBusy('csv'); setMsg(null);
    try {
      const res = await fetch('/api/admin/adsense-revenue/csv', { method: 'POST', headers, body: JSON.stringify({ csv, currency: 'INR' }) });
      const d = await res.json();
      setMsg({ ok: Boolean(d.success), text: d.success ? `${d.rows} din import ho gaye${d.skipped ? ` (${d.skipped} lines skip)` : ''}.` : String(d.error || 'Import failed') });
      if (d.success) { setCsv(''); await load(); }
    } catch { setMsg({ ok: false, text: 'Import failed' }); }
    finally { setBusy(null); }
  };

  const onFile = async (file: File) => {
    const text = await file.text();
    setCsv(text.slice(0, 1_900_000));
    setMsg({ ok: true, text: `${file.name} load ho gaya — "Import CSV" dabao.` });
  };

  const s = data?.summary;
  const days: any[] = data?.days || [];
  const max = Math.max(1, ...days.map((d) => Number(d.earnings_micros) || 0));
  const cur = s?.currency || 'INR';
  const hasData = (s?.daysWithData || 0) > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-900">AdSense revenue</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Google AdSense se asli kamai — daily, weekly, monthly. Data sirf aapke apne account se aata hai.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={sync} disabled={busy !== null || !data?.api?.configured}
            title={data?.api?.configured ? 'Pull the last 30 days from the AdSense API' : 'API connect nahi hai — neeche CSV import karo'}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
            {busy === 'sync' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Sync from AdSense
          </button>
          <button onClick={() => void load()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer">
            <Activity className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {msg ? <div className={`text-xs font-semibold px-3 py-2 rounded-lg ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{msg.text}</div> : null}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Loading real AdSense numbers…</div>
      ) : (
        <>
          {!hasData ? (
            <div className={`${card} bg-amber-50 border-amber-200`}>
              <p className="text-xs font-bold text-amber-800 inline-flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Abhi koi AdSense revenue data nahi hai</p>
              <p className="text-[11px] text-amber-700 mt-1 leading-relaxed">
                Ye section jhoothi numbers nahi dikhata. Do raste hain:
              </p>
              <ol className="text-[11px] text-amber-800 mt-1.5 space-y-1 list-decimal list-inside">
                <li><strong>Turant:</strong> AdSense → <em>Reports</em> → date range chuno → <em>Export → CSV</em> → yahan upload/paste karke Import dabao.</li>
                <li><strong>Permanent (live):</strong> hPanel env me <code>{data?.api?.missing?.join(', ') || 'ADSENSE_*'}</code> add karo — phir "Sync from AdSense" apne aap daily khinch layega.</li>
              </ol>
            </div>
          ) : null}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { k: 'Today (accruing)', v: s.today, hint: 'Aaj ka estimate — din khatam hone par badhega' },
              { k: 'Yesterday', v: s.yesterday, hint: 'Pichla poora din' },
              { k: 'Last 7 days', v: s.last7, hint: 'Rolling week' },
              { k: 'Last 30 days', v: s.last30, hint: 'Rolling month' },
            ].map((c) => (
              <div key={c.k} className={`${card} bg-white`}>
                <p className={label}>{c.k}</p>
                <p className={big}>{money(c.v, cur)}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{c.hint}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className={`${card} bg-white`}>
              <p className={label}>This month</p>
              <p className={big}>{money(s.thisMonth, cur)}</p>
              {s.changePct !== null ? (
                <p className={`text-[10px] mt-0.5 inline-flex items-center gap-1 ${s.changePct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {s.changePct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {s.changePct >= 0 ? '+' : ''}{s.changePct}% vs {money(s.prevMonth, cur)} pichle month
                </p>
              ) : <p className="text-[10px] text-slate-400 mt-0.5">Pichle month ka data nahi, comparison nahi</p>}
            </div>
            <div className={`${card} bg-white`}>
              <p className={label}>Lifetime (stored)</p>
              <p className={big}>{money(s.lifetime, cur)}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{s.daysWithData} din ka data · last {s.lastDataDay || '—'}</p>
            </div>
            <div className={`${card} bg-white`}>
              <p className={label}>Page RPM (30d)</p>
              <p className={big}>{money(s.rpm30, cur)}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 inline-flex items-center gap-1"><Eye className="w-3 h-3" />{Number(s.pageViews30 || 0).toLocaleString('en-IN')} page views · <MousePointerClick className="w-3 h-3" />{Number(s.clicks30 || 0).toLocaleString('en-IN')} clicks</p>
            </div>
            <div className={`${card} bg-white`}>
              <p className={label}>Best day</p>
              <p className={big}>{s.bestDay ? money(s.bestDay.amount, cur) : '—'}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{s.bestDay?.day || 'no data yet'}</p>
            </div>
          </div>

          {hasData ? (
            <div className={`${card} bg-white`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-800 inline-flex items-center gap-1.5"><IndianRupee className="w-3.5 h-3.5" /> Daily earnings</p>
                <p className="text-[10px] text-slate-400">
                  source: {days.some((d) => d.source === 'adsense_api') ? 'AdSense API (live)' : 'CSV import'}
                  {s.staleDays !== null && s.staleDays > 1 ? ` · ${s.staleDays} din purana — sync/import karo` : ''}
                </p>
              </div>
              <div className="mt-3 flex items-end gap-[3px] h-28">
                {[...days].reverse().slice(-45).map((d) => {
                  const h = Math.max(2, Math.round((Number(d.earnings_micros) / max) * 100));
                  return (
                    <div key={`${d.day}-${d.source}`} className="flex-1 group relative">
                      <div className="w-full rounded-t bg-rose-500/80 group-hover:bg-rose-600" style={{ height: `${h}%`, minHeight: 2 }} title={`${d.day}: ${money(d.earnings_micros, d.currency)}`} />
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-slate-400 text-left">
                      <th className="py-1 font-semibold">Day</th>
                      <th className="py-1 font-semibold text-right">Earnings</th>
                      <th className="py-1 font-semibold text-right">Page views</th>
                      <th className="py-1 font-semibold text-right">Impressions</th>
                      <th className="py-1 font-semibold text-right">Clicks</th>
                      <th className="py-1 font-semibold text-right">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.slice(0, 30).map((d) => (
                      <tr key={`${d.day}-${d.source}`} className="border-t border-slate-100">
                        <td className="py-1 font-semibold text-slate-700">{d.day}</td>
                        <td className="py-1 text-right font-bold text-slate-900">{money(d.earnings_micros, d.currency)}</td>
                        <td className="py-1 text-right text-slate-500">{Number(d.page_views || 0).toLocaleString('en-IN')}</td>
                        <td className="py-1 text-right text-slate-500">{Number(d.impressions || 0).toLocaleString('en-IN')}</td>
                        <td className="py-1 text-right text-slate-500">{Number(d.clicks || 0).toLocaleString('en-IN')}</td>
                        <td className="py-1 text-right text-slate-400">{d.source === 'adsense_api' ? 'API' : 'CSV'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className={`${card} bg-white space-y-2`}>
            <p className="text-xs font-bold text-slate-800 inline-flex items-center gap-1.5"><Upload className="w-3.5 h-3.5" /> Import AdSense CSV</p>
            <p className="text-[11px] text-slate-500">
              AdSense → <strong>Reports</strong> → date range → <strong>Export → CSV</strong>. File yahan upload karo (ya text paste karo). "Date" + "Estimated earnings" columns kaafi hain.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> Choose CSV
                <input type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }} />
              </label>
              <button onClick={importCsv} disabled={busy !== null}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer disabled:opacity-50">
                {busy === 'csv' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Percent className="w-3.5 h-3.5" />} Import CSV
              </button>
              <span className="text-[10px] text-slate-400">{csv ? `${csv.length.toLocaleString('en-IN')} chars loaded` : 'no file loaded'}</span>
            </div>
            <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={4}
              placeholder={'Date,Page views,Impressions,Clicks,Page RPM,Estimated earnings\n2026-10-01,1240,2100,14,12.40,15.38'}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[11px] font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
          </div>

          <div className={`${card} ${data?.api?.configured ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50'}`}>
            <p className="text-xs font-bold text-slate-800">Live API status</p>
            <p className="text-[11px] text-slate-600 mt-1">
              {data?.api?.configured
                ? `Connected (account ${data.api.account}). ${data.api.parked ? `Temporarily paused: ${data.api.park_reason} — retry ${data.api.retry_after}` : 'Auto-sync ready.'}`
                : <>Not connected. hPanel me add karo: <code className="text-[10px]">{data?.api?.missing?.join(', ')}</code> (AdSense Management API approval + OAuth refresh token chahiye). Tab tak CSV import 100% kaam karta hai.</>}
            </p>
            {data?.slots_configured !== undefined ? (
              <p className="text-[10px] text-slate-500 mt-1">{data.slots_configured} AdSense ad unit(s) live on the site.</p>
            ) : null}
            {data?.recent_syncs?.length ? (
              <div className="mt-2 space-y-0.5">
                {data.recent_syncs.map((r: any, i: number) => (
                  <p key={i} className="text-[10px] text-slate-500">
                    {String(r.created_at).slice(0, 19).replace('T', ' ')} · {r.kind} · {r.ok ? 'ok' : 'failed'}{r.rows_seen ? ` · ${r.rows_seen} rows` : ''}{r.message ? ` · ${r.message}` : ''}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
};
