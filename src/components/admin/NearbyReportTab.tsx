import { useCallback, useEffect, useState } from 'react';
import { Loader2, MapPin, Camera, ExternalLink, Search } from 'lucide-react';

/**
 * Admin → Nearby report (owner 13 Nov: "iska report admin mai nearby section mai hoga").
 *
 * Every number here is read from the nearby_events ledger the API writes on each search, so it can never be a
 * guess: searches, rows served, how many rows carried a real photo, how many carried a tracked exit, plus the
 * category and city split.
 */
interface Report {
  ok: boolean; days: number; searches: number; exits: number; rows: number;
  withPhoto: number; withExit: number; photoCoveragePct: number;
  byCategory: { category: string; searches: number; rows: number }[];
  topCities: { city: string; searches: number }[];
  daily: { day: string; searches: number }[];
}

const stat = (label: string, value: string, hint: string, Icon: any) => (
  <div className="rounded-xl border border-slate-200 bg-white p-3">
    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
      <Icon className="w-3 h-3 text-[#E7000B]" /> {label}
    </div>
    <p className="text-xl font-black text-slate-900 mt-1">{value}</p>
    <p className="text-[10px] text-slate-400">{hint}</p>
  </div>
);

export default function NearbyReportTab() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (span: number) => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/admin/nearby-report?days=${span}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('t1s_admin_token') || ''}` },
      });
      const d = await res.json();
      if (!res.ok || !d?.ok) throw new Error(d?.error || `HTTP ${res.status}`);
      setData(d);
    } catch (e: any) {
      setError(String(e?.message || e).slice(0, 140));
      setData(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(days); }, [days, load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#E7000B]" /> Nearby report
          </h2>
          <p className="text-[11px] text-slate-500">Live ledger of every nearby search: coverage, photos, tracked exits, categories and cities.</p>
        </div>
        <div className="flex gap-1">
          {[1, 7, 30].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer ${
                days === d ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}
      {loading ? <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div> : null}

      {data && !loading ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
            {stat('Searches', String(data.searches), `last ${data.days} day(s)`, Search)}
            {stat('Rows served', String(data.rows), 'cards returned', MapPin)}
            {stat('Photo coverage', `${data.photoCoveragePct}%`, `${data.withPhoto} rows with a photo`, Camera)}
            {stat('Tracked exits', String(data.withExit), 'rows with an /api/out pointer', ExternalLink)}
            {stat('Exit clicks', String(data.exits), 'clicks recorded', ExternalLink)}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">By category</h3>
              <ul className="mt-2 space-y-1">
                {data.byCategory.length === 0 ? <li className="text-[11px] text-slate-400">No searches yet.</li> : null}
                {data.byCategory.map((c) => (
                  <li key={c.category} className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-700 capitalize">{c.category}</span>
                    <span className="text-slate-500">{c.searches} searches · {c.rows} rows</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Top cities</h3>
              <ul className="mt-2 space-y-1">
                {data.topCities.length === 0 ? <li className="text-[11px] text-slate-400">No cities yet.</li> : null}
                {data.topCities.map((c) => (
                  <li key={c.city} className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-700">{c.city}</span>
                    <span className="text-slate-500">{c.searches}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Daily searches</h3>
              <ul className="mt-2 space-y-1">
                {data.daily.length === 0 ? <li className="text-[11px] text-slate-400">Nothing in this window.</li> : null}
                {data.daily.map((d) => (
                  <li key={d.day} className="flex items-center justify-between text-[11px]">
                    <span className="font-mono text-slate-600">{d.day}</span>
                    <span className="text-slate-500">{d.searches}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
