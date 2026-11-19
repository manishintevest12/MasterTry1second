import { useCallback, useEffect, useState } from 'react';
import { Loader2, Search, Eye, MousePointerClick, ExternalLink, Share2, Repeat, AlertTriangle } from 'lucide-react';

/**
 * Admin → Funnel (owner 19 Nov growth brief): the measured chain, not a vanity number.
 *
 * Reads /api/admin/funnel, which aggregates `funnel_events` (server/growth/funnel.ts). Every number here is
 * a count of rows the product actually wrote - a search submitted, a results screen rendered, a card
 * clicked, an exit that really reached the merchant, a share - so the panel shows where users LEAVE
 * instead of only how many arrived.
 */
interface Report {
  ok: boolean;
  days: number;
  totals: { events: number; sessions: number; searches: number; resultsViews: number; cardClicks: number; outbound: number; shares: number };
  conversion: { searchToResults: number; searchToCard: number; cardToOutbound: number; searchToShare: number };
  zeroResult: { searches: number; empty: number; rate: number };
  byEvent: { event: string; count: number; sessions: number }[];
  byVertical: { vertical: string; searches: number; clicks: number; outbound: number; ctr: number }[];
  daily: { day: string; search: number; results_view: number; card_click: number; outbound_click: number; share: number }[];
  repeatSessions: { sessions: number; returning: number; rate: number };
  note?: string;
}

const Stat = ({ label, value, hint, Icon }: { label: string; value: string; hint: string; Icon: any }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-3">
    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
      <Icon className="w-3 h-3 text-[#E7000B]" /> {label}
    </div>
    <p className="text-xl font-black text-slate-900 mt-1">{value}</p>
    <p className="text-[10px] text-slate-400">{hint}</p>
  </div>
);

const pct = (n: number) => `${n.toFixed(1)}%`;
const num = (n: number) => (n || 0).toLocaleString('en-IN');

/** One bar row: the step, how many reached it, and the rate from the step before. */
const Step = ({ label, value, of, rate, Icon }: { label: string; value: number; of: number; rate: number; Icon: any }) => {
  const width = of > 0 ? Math.max(2, Math.round((value / of) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-40 flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
        <Icon className="w-3.5 h-3.5 text-slate-400" /> {label}
      </div>
      <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full bg-[#E7000B]" style={{ width: `${width}%` }} />
      </div>
      <div className="w-24 text-right text-[11px] font-bold text-slate-900">{num(value)}</div>
      <div className="w-16 text-right text-[11px] font-semibold text-slate-400">{pct(rate)}</div>
    </div>
  );
};

export default function FunnelTab() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (span: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/funnel?days=${span}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('t1s_admin_token') || ''}` },
      });
      const d = await res.json();
      if (!res.ok || !d?.ok) throw new Error(d?.error || `HTTP ${res.status}`);
      setData(d);
    } catch (e: any) {
      setError(String(e?.message || e).slice(0, 160));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(days); }, [days, load]);

  const maxDay = Math.max(1, ...(data?.daily || []).map((d) => Math.max(d.search, d.card_click, d.outbound_click)));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <MousePointerClick className="w-5 h-5 text-[#E7000B]" /> Funnel
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Search → results → card click → merchant exit → share. Counted from real events, so the drop-off
            shown here is the one to fix.
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="text-xs font-bold border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}
      {data?.note && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
          {data.note}
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Reading funnel_events…</div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <Stat label="Searches" value={num(data.totals.searches)} hint={`${num(data.totals.sessions)} sessions`} Icon={Search} />
            <Stat label="Results views" value={num(data.totals.resultsViews)} hint={`${pct(data.conversion.searchToResults)} of searches`} Icon={Eye} />
            <Stat label="Card clicks" value={num(data.totals.cardClicks)} hint={`${pct(data.conversion.searchToCard)} of searches`} Icon={MousePointerClick} />
            <Stat label="Merchant exits" value={num(data.totals.outbound)} hint={`${pct(data.conversion.cardToOutbound)} of card clicks`} Icon={ExternalLink} />
            <Stat label="Shares" value={num(data.totals.shares)} hint={`${pct(data.conversion.searchToShare)} of searches`} Icon={Share2} />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <span>Where users leave</span>
              <span>reached / rate</span>
            </div>
            <Step label="Searched" value={data.totals.searches} of={data.totals.searches || 1} rate={100} Icon={Search} />
            <Step label="Saw results" value={data.totals.resultsViews} of={data.totals.searches || 1} rate={data.conversion.searchToResults} Icon={Eye} />
            <Step label="Clicked a card" value={data.totals.cardClicks} of={data.totals.searches || 1} rate={data.conversion.searchToCard} Icon={MousePointerClick} />
            <Step label="Left for merchant" value={data.totals.outbound} of={data.totals.searches || 1} rate={data.totals.searches ? Math.round((data.totals.outbound / data.totals.searches) * 1000) / 10 : 0} Icon={ExternalLink} />
            <Step label="Shared" value={data.totals.shares} of={data.totals.searches || 1} rate={data.conversion.searchToShare} Icon={Share2} />
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">Zero-result rate</p>
              <p className="text-2xl font-black text-slate-900">{pct(data.zeroResult.rate)}</p>
              <p className="text-[11px] text-slate-500 mt-1">
                {num(data.zeroResult.empty)} of {num(data.zeroResult.searches)} searches finished with nothing to show.
                This is the drop-off the fallback work targets.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1.5">
                <Repeat className="w-3.5 h-3.5" /> Repeat sessions
              </p>
              <p className="text-2xl font-black text-slate-900">{pct(data.repeatSessions.rate)}</p>
              <p className="text-[11px] text-slate-500 mt-1">
                {num(data.repeatSessions.returning)} of {num(data.repeatSessions.sessions)} sessions came back on another day.
              </p>
            </div>
          </div>

          {data.byVertical.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 border-b border-slate-100">
                By vertical
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide text-slate-400">
                    <th className="text-left px-4 py-2 font-bold">Vertical</th>
                    <th className="text-right px-4 py-2 font-bold">Searches</th>
                    <th className="text-right px-4 py-2 font-bold">Card clicks</th>
                    <th className="text-right px-4 py-2 font-bold">Exits</th>
                    <th className="text-right px-4 py-2 font-bold">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byVertical.slice(0, 14).map((v) => (
                    <tr key={v.vertical} className="border-t border-slate-50">
                      <td className="px-4 py-1.5 font-bold text-slate-800 capitalize">{v.vertical}</td>
                      <td className="px-4 py-1.5 text-right text-slate-600">{num(v.searches)}</td>
                      <td className="px-4 py-1.5 text-right text-slate-600">{num(v.clicks)}</td>
                      <td className="px-4 py-1.5 text-right text-slate-600">{num(v.outbound)}</td>
                      <td className="px-4 py-1.5 text-right font-semibold text-slate-900">{pct(v.ctr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.daily.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-3">Daily: searches vs exits</p>
              <div className="flex items-end gap-1.5 h-24">
                {data.daily.map((d) => (
                  <div key={d.day} className="flex-1 flex flex-col justify-end items-center gap-0.5" title={`${d.day}: ${d.search} searches, ${d.card_click} clicks, ${d.outbound_click} exits`}>
                    <div className="w-full flex items-end gap-0.5 h-20">
                      <div className="flex-1 rounded-t bg-slate-300" style={{ height: `${Math.max(2, (d.search / maxDay) * 100)}%` }} />
                      <div className="flex-1 rounded-t bg-[#E7000B]" style={{ height: `${Math.max(1, (d.outbound_click / maxDay) * 100)}%` }} />
                    </div>
                    <span className="text-[8px] text-slate-400">{d.day.slice(5)}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-2">Grey = searches, red = merchant exits.</p>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
