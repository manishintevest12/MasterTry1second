import React, { useCallback, useEffect, useState } from 'react';
import { MousePointerClick, Search, Network, BadgeIndianRupee, ExternalLink } from 'lucide-react';

/**
 * REAL affiliate click & conversion reporting (owner 24 Oct): every number here
 * comes from the MySQL affiliate_clicks / affiliate_conversions tables via
 * /api/admin/affiliate/*. No mock records, no invented commissions — commissions
 * are confirmed by the network dashboard and imported from an authorized report.
 */
interface ClickRow {
  id: number; offer_id: number | null; network_id: string; vendor_domain: string;
  destination_url: string; click_id: string; created_at: string;
}
interface ConvRow {
  id: number; click_id: string; network_id: string; vendor_domain: string | null;
  order_value: string | null; commission: string | null; confirmed_at: string | null;
  source_report: string; created_at: string;
}
interface Summary {
  windowDays: number; total: number;
  byNetwork: { network_id: string; count: number }[];
  byVendor: { vendor_domain: string; count: number }[];
  daily: { day: string; count: number }[];
}

const card = 'bg-white rounded-2xl border border-slate-200 shadow-xs';

export const AffiliateClicksTab: React.FC<{ view?: 'clicks' | 'payouts' }> = ({ view = 'clicks' }) => {
  const [token] = useState(() => localStorage.getItem('t1s_admin_token') || '');
  const [days, setDays] = useState(30);
  const [vendor, setVendor] = useState('');
  const [clicks, setClicks] = useState<ClickRow[]>([]);
  const [conversions, setConversions] = useState<ConvRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const q = new URLSearchParams({ days: String(days), limit: '200' });
      if (vendor.trim()) q.set('vendor', vendor.trim());
      const res = await fetch(`/api/admin/affiliate/clicks?${q}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (!d.success) throw new Error(d.error || 'failed');
      setClicks(d.clicks || []); setSummary(d.summary || null);
      const rc = await fetch('/api/admin/affiliate/conversions', { headers: { Authorization: `Bearer ${token}` } });
      const dc = await rc.json();
      setConversions(dc.conversions || []);
    } catch { setErr('Click log load nahi hua — dobara try karein.'); }
    setLoading(false);
  }, [token, days, vendor]);

  useEffect(() => { void load(); }, [load]);

  const tiles = [
    { label: 'Total Clicks (window)', value: (summary?.total ?? 0).toLocaleString('en-IN'), icon: MousePointerClick },
    { label: 'Networks Live', value: String(summary?.byNetwork?.length ?? 0), icon: Network },
    { label: 'Imported Conversions', value: conversions.length.toLocaleString('en-IN'), icon: BadgeIndianRupee },
  ];

  return (
    <div className="space-y-4">
      <div className={`${card} p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3`}>
        <div>
          <h3 className="text-base font-bold text-slate-900">
            {view === 'payouts' ? 'Network-wise Real Clicks & Payout Status' : 'Live Affiliate Clicks (Real Data)'}
          </h3>
          <p className="text-xs text-slate-500">
            Har row MySQL <code className="px-1 bg-slate-100 rounded">affiliate_clicks</code> se hai — user ke asli outbound clicks.
            Commission network dashboard (LinkInR / Cuelinks / Amazon) me confirm hoti hai.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={vendor} onChange={(e) => setVendor(e.target.value)}
              placeholder="Vendor domain (agoda...)"
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-orange-500 w-48 sm:w-56"
            />
          </div>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className={`${card} p-4`}>
            <div className="flex items-center gap-2 text-slate-400"><t.icon className="w-4 h-4" /><span className="text-[10px] font-bold uppercase tracking-wider">{t.label}</span></div>
            <div className="mt-1.5 text-xl font-bold text-slate-900 font-mono">{t.value}</div>
          </div>
        ))}
        <div className={`${card} p-4`}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Top Vendor</div>
          <div className="mt-1.5 text-sm font-bold text-slate-900 truncate">{summary?.byVendor?.[0]?.vendor_domain || '—'}</div>
          <div className="text-[10px] text-slate-400">{summary?.byVendor?.[0] ? `${summary.byVendor[0].count} clicks` : 'no clicks yet'}</div>
        </div>
      </div>

      {err && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</div>}

      {view === 'payouts' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(summary?.byNetwork || []).map((n) => (
            <div key={n.network_id} className={`${card} p-5 space-y-3`}>
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-base capitalize">{n.network_id}</h4>
                <span className="px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200 text-xs font-mono font-bold">
                  {n.count.toLocaleString('en-IN')} clicks
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Commission is network ke dashboard me confirm hoti hai (validation 1–7 din, hotel stays ke baad).
                Confirm hote hi authorized report se import hoke niche &ldquo;Imported Conversions&rdquo; me dikhegi — abhi tak koi fabricated amount nahi dikhaya jaata.
              </p>
            </div>
          ))}
          {!(summary?.byNetwork || []).length && !loading && (
            <div className={`${card} p-6 text-center text-xs text-slate-500 col-span-2`}>Is window me koi click record nahi hua.</div>
          )}
        </div>
      ) : (
        <div className={`${card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-semibold">Time</th>
                  <th className="py-3 px-4 font-semibold">Vendor</th>
                  <th className="py-3 px-4 font-semibold">Network</th>
                  <th className="py-3 px-4 font-semibold">Click ID</th>
                  <th className="py-3 px-4 font-semibold">Offer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clicks.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">{String(c.created_at || '').replace('T', ' ').slice(0, 19)}</td>
                    <td className="py-2.5 px-4 font-bold text-orange-600">{c.vendor_domain}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-bold uppercase text-slate-600">{c.network_id}</span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-500">{c.click_id}</td>
                    <td className="py-2.5 px-4 text-slate-400 font-mono">{c.offer_id ?? '—'}</td>
                  </tr>
                ))}
                {!clicks.length && !loading && (
                  <tr><td colSpan={5} className="py-6 text-center text-slate-400">Koi click record nahi mila (is filter/window me).</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className={`${card} p-4`}>
        <h4 className="text-sm font-bold text-slate-900 mb-1">Imported Conversions (authorized reports only)</h4>
        <p className="text-[11px] text-slate-500 mb-3">Yahan sirf wo conversions aate hain jo network ke authorized report se import hue hain — koi estimated/fake commission nahi.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Vendor</th>
                <th className="py-2.5 px-3 font-semibold">Network</th>
                <th className="py-2.5 px-3 font-semibold text-right">Order Value</th>
                <th className="py-2.5 px-3 font-semibold text-right">Commission</th>
                <th className="py-2.5 px-3 font-semibold">Confirmed</th>
                <th className="py-2.5 px-3 font-semibold">Source Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {conversions.map((v) => (
                <tr key={v.id}>
                  <td className="py-2 px-3 font-bold text-slate-800">{v.vendor_domain || '—'}</td>
                  <td className="py-2 px-3 uppercase text-slate-600">{v.network_id}</td>
                  <td className="py-2 px-3 text-right font-mono text-slate-900">{v.order_value ? `₹${Number(v.order_value).toLocaleString('en-IN')}` : '—'}</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">{v.commission ? `+₹${Number(v.commission).toLocaleString('en-IN')}` : '—'}</td>
                  <td className="py-2 px-3 text-slate-500">{v.confirmed_at ? String(v.confirmed_at).slice(0, 10) : 'pending'}</td>
                  <td className="py-2 px-3 text-slate-500">{v.source_report}</td>
                </tr>
              ))}
              {!conversions.length && (
                <tr><td colSpan={6} className="py-6 text-center text-slate-400">Abhi koi conversion import nahi hua. Network dashboard me confirm hone ke baad yahan aayegi.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 flex items-center gap-1">
        <ExternalLink className="w-3 h-3" />
        Sub-id format <code className="px-1 bg-slate-100 rounded">try1second-&lt;clickId&gt;</code> — network report me isi se click match hota hai.
      </p>
    </div>
  );
};
