import { useState, useMemo, FC, useEffect, useCallback } from 'react';
import {
  Search,
  Download,
  ExternalLink,
  TrendingUp,
  Building2,
  AlertCircle,
  IndianRupee,
  MousePointerClick,
  BarChart3,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { VerticalId } from '../../types';

interface LiveClick {
  domain: string;
  network: string;
  at: string;
  merchant: string | null;
  offer: string | null;
}

interface LiveConversion {
  network: string;
  value: number | null;
  commission: number | null;
  at: string;
  domain: string | null;
}

interface TrafficPayload {
  success: boolean;
  days: number;
  searches: number;
  leads: number;
  leadsApproved: number;
  clicks: number;
  clicksToday: number;
  clicksByDay: Array<{ day: string; n: number }>;
  topDomains: Array<{ domain: string; n: number }>;
  recentClicks: LiveClick[];
  conversions: LiveConversion[];
}

// Owner 24 Oct: this tab used to render a MOCK order book (fake buyer names,
// invented order values). It now shows the REAL traffic MySQL records — the
// /api/out click log, verified S2S conversions, and vertical-scoped searches
// and leads. E-commerce order-level data belongs to the merchant's own panel;
// we never invent it here.
export const MerchantOrdersTab: FC = () => {
  const { authenticatedVendor, addToast } = useApp();

  const [traffic, setTraffic] = useState<TrafficPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState<string>('all');
  const [days, setDays] = useState<number>(30);

  const vendorVertical = (authenticatedVendor?.vertical || 'food') as VerticalId;

  const loadTraffic = useCallback(async (windowDays: number) => {
    setLoading(true);
    try {
      // Same missing-token bug as the analytics tab: requireAuth 401 turned the traffic panel into zeros.
      const res = await fetch(`/api/vendor/traffic?vertical=${encodeURIComponent(vendorVertical)}&days=${windowDays}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('t1s_merchant_token') || ''}` },
      });
      const data = await res.json();
      if (data.success) setTraffic(data);
      else addToast('alert', 'Live Traffic Unavailable', data.error || 'Could not load live traffic.');
    } catch {
      addToast('alert', 'Live Traffic Unavailable', 'Server se live traffic load nahi ho payi.');
    } finally {
      setLoading(false);
    }
  }, [vendorVertical, addToast]);

  useEffect(() => { void loadTraffic(days); }, [loadTraffic, days]);

  const networks = useMemo(() => {
    const set = new Set<string>((traffic?.recentClicks || []).map((c) => c.network || 'direct'));
    return Array.from(set).sort();
  }, [traffic]);

  const filteredClicks = useMemo(() => {
    const clicks = traffic?.recentClicks || [];
    const q = searchQuery.toLowerCase().trim();
    return clicks.filter((c) => {
      const matchesNetwork = selectedNetwork === 'all' || c.network === selectedNetwork;
      const matchesQuery =
        !q ||
        String(c.domain || '').toLowerCase().includes(q) ||
        String(c.merchant || '').toLowerCase().includes(q) ||
        String(c.offer || '').toLowerCase().includes(q);
      return matchesNetwork && matchesQuery;
    });
  }, [traffic, searchQuery, selectedNetwork]);

  const conversions = traffic?.conversions || [];
  const totalCommission = conversions.reduce((sum, c) => sum + Number(c.commission || 0), 0);

  const handleExportCsv = () => {
    if (filteredClicks.length === 0) {
      addToast('alert', 'No Clicks Found', 'No live clicks match your active filters.');
      return;
    }
    const headers = ['Merchant Domain', 'Merchant', 'Offer / Title', 'Network', 'Clicked At'];
    const rows = filteredClicks.map((c) => [
      `"${c.domain}"`,
      `"${String(c.merchant || '—').replace(/"/g, '""')}"`,
      `"${String(c.offer || '—').replace(/"/g, '""')}"`,
      `"${c.network}"`,
      `"${String(c.at || '').replace('T', ' ').slice(0, 19)}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `try1second-live-clicks-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('success', 'Export Ready', `${filteredClicks.length} live click records exported.`);
  };

  const kpi = (label: string, value: string, sub: string, Icon: typeof TrendingUp) => (
    <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-1">
      <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
        <span>{label}</span>
        <Icon className="w-4 h-4 text-orange-600" />
      </div>
      <div className="text-xl font-black text-slate-900 font-mono">{value}</div>
      <span className="text-[10px] text-slate-500 block">{sub}</span>
    </div>
  );

  return (
    <div className="space-y-6 text-slate-900">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <MousePointerClick className="w-5 h-5 text-orange-600" />
            Live Traffic & Conversions (Real)
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
            Sirf REAL MySQL records — /api/out se hue outbound clicks, verified S2S conversions, aur aapke vertical (
            <span className="font-bold uppercase">{vendorVertical}</span>) ki actual searches aur leads. Koi mock
            order book nahi.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs font-semibold"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            type="button"
            onClick={() => void loadTraffic(days)}
            className="px-3 py-2 text-xs font-bold text-orange-700 bg-orange-50 border border-orange-200 rounded-xl hover:bg-orange-100"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Real KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {kpi('Outbound Clicks', String(traffic?.clicks ?? 0), `last ${days} days · platform-wide`, MousePointerClick)}
        {kpi('Clicks Today', String(traffic?.clicksToday ?? 0), 'real /api/out clicks aaj', BarChart3)}
        {kpi(`Searches (${vendorVertical})`, String(traffic?.searches ?? 0), `real searches · last ${days} days`, Search)}
        {kpi(`Leads (${vendorVertical})`, String(traffic?.leads ?? 0), 'real submitted enquiries', Building2)}
        {kpi('Verified Conversions', String(conversions.length), `₹${totalCommission.toLocaleString('en-IN')} commission verified`, CheckCircle2)}
      </div>

      {/* Filters */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search merchant, domain ya offer..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-orange-500"
          />
        </div>
        <select
          value={selectedNetwork}
          onChange={(e) => setSelectedNetwork(e.target.value)}
          className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs font-semibold"
        >
          <option value="all">All Networks ({(traffic?.recentClicks || []).length})</option>
          {networks.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleExportCsv}
          className="px-3 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 rounded-xl flex items-center justify-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      {/* Recent real clicks */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Real Outbound Clicks (latest 200)</h3>
          {loading && <span className="text-[10px] font-semibold text-orange-600 animate-pulse">loading live…</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 text-[11px] uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-semibold">Merchant Domain</th>
                <th className="py-3 px-4 font-semibold">Merchant</th>
                <th className="py-3 px-4 font-semibold">Offer / Landing</th>
                <th className="py-3 px-4 font-semibold">Network</th>
                <th className="py-3 px-4 font-semibold">Clicked At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClicks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                    {loading ? 'Live clicks load ho rahe hain…' : 'Is window me abhi koi real outbound click record nahi hua.'}
                  </td>
                </tr>
              ) : (
                filteredClicks.map((c, i) => (
                  <tr key={`${c.domain}-${c.at}-${i}`} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4">
                      <span className="font-bold text-slate-900 inline-flex items-center gap-1.5">
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                        {c.domain}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-700">{c.merchant || '—'}</td>
                    <td className="py-2.5 px-4 text-slate-600 max-w-[280px] truncate">{c.offer || 'Direct merchant page'}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                        {c.network || 'direct'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap font-mono">{String(c.at || '').replace('T', ' ').slice(0, 19)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Verified conversions */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-emerald-600" />
            Verified Conversions (S2S records)
          </h3>
          <span className="text-[10px] text-slate-500 max-w-md text-right">
            Note: networks ke apne dashboards (Cuelinks/Admitad etc.) me jo commissions aati hain wo authoritative hain;
            yahan sirf wo conversions dikhte hain jo verified server-side report se confirm hue hain.
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 text-[11px] uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-semibold">Merchant Domain</th>
                <th className="py-3 px-4 font-semibold">Network</th>
                <th className="py-3 px-4 font-semibold">Order Value</th>
                <th className="py-3 px-4 font-semibold">Commission</th>
                <th className="py-3 px-4 font-semibold">Confirmed At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {conversions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                    <span className="inline-flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                      Abhi koi verified conversion record nahi — network dashboard se report sync hone par yahan aayegi.
                    </span>
                  </td>
                </tr>
              ) : (
                conversions.map((c, i) => (
                  <tr key={`conv-${i}`} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 font-bold text-slate-900">{c.domain || '—'}</td>
                    <td className="py-2.5 px-4 text-slate-700 uppercase font-semibold">{c.network}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-900">₹{Number(c.value || 0).toLocaleString('en-IN')}</td>
                    <td className="py-2.5 px-4 font-mono text-emerald-700 font-bold">₹{Number(c.commission || 0).toLocaleString('en-IN')}</td>
                    <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap font-mono">{String(c.at || '').replace('T', ' ').slice(0, 19)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
