import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Wallet,
  Plus,
  Trash2,
  TrendingUp,
  CalendarDays,
  Store,
  Info,
  LogIn,
  BarChart3,
  ReceiptText,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const today = () => new Date().toISOString().slice(0, 10);

interface Entry {
  id: number;
  merchant: string;
  amount: number;
  itemTitle?: string | null;
  vertical?: string | null;
  entryDate: string;
  source: string;
}

interface Summary {
  total: number;
  entries: number;
  byMerchant: { merchant: string; total: number; count: number }[];
  byMonth: { month: string; total: number }[];
}

const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
};

/** Pure-SVG horizontal bars: spend per website. One colour (#E7000B) — the brand carries the meaning. */
const MerchantBars: React.FC<{ byMerchant: Summary['byMerchant'] }> = ({ byMerchant }) => {
  const top = byMerchant.slice(0, 8);
  if (!top.length) return null;
  const max = Math.max(...top.map((m) => m.total), 1);
  return (
    <div className="space-y-3">
      {top.map((m) => (
        <div key={m.merchant} className="flex items-center gap-3">
          <div className="w-28 shrink-0 truncate text-xs font-bold text-slate-700" title={m.merchant}>{m.merchant}</div>
          <div className="h-6 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#E7000B] transition-all"
              style={{ width: `${Math.max(4, Math.round((m.total / max) * 100))}%` }}
            />
          </div>
          <div className="w-24 shrink-0 text-right text-xs font-bold text-slate-800">{inr(m.total)}</div>
          <div className="w-12 shrink-0 text-right text-[10px] text-slate-400">{m.count}×</div>
        </div>
      ))}
    </div>
  );
};

/** Pure-SVG monthly trend line + area fill. */
const MonthTrend: React.FC<{ byMonth: Summary['byMonth'] }> = ({ byMonth }) => {
  if (byMonth.length < 2) {
    return <p className="text-xs text-slate-500">Add purchases from at least two different months to see your trend line.</p>;
  }
  const w = 560, h = 180, pad = 36;
  const max = Math.max(...byMonth.map((m) => m.total), 1);
  const x = (i: number) => pad + (i * (w - 2 * pad)) / (byMonth.length - 1);
  const y = (v: number) => h - pad - ((v / max) * (h - 2 * pad));
  const line = byMonth.map((m, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(m.total).toFixed(1)}`).join(' ');
  const area = `${line} L${x(byMonth.length - 1).toFixed(1)},${h - pad} L${x(0).toFixed(1)},${h - pad} Z`;
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full min-w-[420px]" role="img" aria-label="Monthly spend trend">
        <path d={area} fill="#E7000B" opacity="0.08" />
        <path d={line} stroke="#E7000B" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {byMonth.map((m, i) => (
          <g key={m.month}>
            <circle cx={x(i)} cy={y(m.total)} r="4" fill="#E7000B" />
            <text x={x(i)} y={h - 12} textAnchor="middle" fontSize="10" fill="#94a3b8">{monthLabel(m.month)}</text>
            <text x={x(i)} y={y(m.total) - 10} textAnchor="middle" fontSize="10" fontWeight="700" fill="#334155">{inr(m.total)}</text>
          </g>
        ))}
      </svg>
    </div>
  );
};

export const SpendLensView: React.FC = () => {
  const { authUser, loginWithGoogle, addToast, pendingSpendEntry, clearSpendPrefill } = useApp();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ merchant: '', amount: '', itemTitle: '', entryDate: today() });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('try1_session') || '';
      const res = await fetch('/api/spend', { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (res.ok && d.success) { setEntries(d.entries || []); setSummary(d.summary || null); }
    } catch { /* honest empty state below */ }
    setLoading(false);
  }, []);

  useEffect(() => { if (authUser) load(); else setLoading(false); }, [authUser, load]);

  // Redirect prefill: a SUGGESTION the user confirms (never auto-saved).
  useEffect(() => {
    if (pendingSpendEntry) {
      setForm({
        merchant: pendingSpendEntry.merchant || '',
        amount: pendingSpendEntry.amount ? String(pendingSpendEntry.amount) : '',
        itemTitle: pendingSpendEntry.itemTitle || '',
        entryDate: today(),
      });
      clearSpendPrefill();
    }
  }, [pendingSpendEntry, clearSpendPrefill]);

  const thisMonth = useMemo(() => {
    const ym = today().slice(0, 7);
    return (summary?.byMonth || []).find((m) => m.month === ym)?.total || 0;
  }, [summary]);

  const add = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.merchant.trim() || !form.amount) { addToast('alert', 'Missing details', 'Enter the website and the amount you spent.'); return; }
    setBusy(true);
    try {
      const token = localStorage.getItem('try1_session') || '';
      const res = await fetch('/api/spend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          merchant: form.merchant.trim(),
          amount: Number(form.amount),
          itemTitle: form.itemTitle.trim() || null,
          entryDate: form.entryDate,
          source: 'manual',
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || 'Could not save the purchase');
      setEntries(d.entries || []); setSummary(d.summary || null);
      setForm({ merchant: '', amount: '', itemTitle: '', entryDate: today() });
      addToast('success', 'Purchase logged', 'Your Spend Lens graphs are updated with your confirmed purchase.');
    } catch (e: any) {
      addToast('alert', 'Not saved', String(e?.message || e));
    } finally { setBusy(false); }
  };

  const remove = async (id: number) => {
    try {
      const token = localStorage.getItem('try1_session') || '';
      const res = await fetch(`/api/spend/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || 'Could not delete');
      setEntries(d.entries || []); setSummary(d.summary || null);
    } catch (e: any) {
      addToast('alert', 'Not deleted', String(e?.message || e));
    }
  };

  if (!authUser) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-[#E7000B] flex items-center justify-center text-white shadow-lg shadow-red-600/20"><Wallet size={30} /></div>
        <h1 className="mt-5 text-2xl font-extrabold text-slate-900">Spend Lens</h1>
        <p className="mt-2 text-sm text-slate-600">On which website did you spend how much — as a graph. Only your confirmed purchases, nothing guessed.</p>
        <button
          onClick={() => loginWithGoogle()}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"
        >
          <LogIn size={16} /> Sign in with Google to start
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-[#E7000B] flex items-center justify-center text-white"><Wallet size={22} /></div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Spend Lens</h1>
          <p className="text-xs text-slate-500">Which website did you spend how much on? Only purchases you confirm — we never guess from clicks.</p>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Wallet, label: 'TOTAL SPEND', value: loading ? '…' : inr(summary?.total || 0) },
          { icon: ReceiptText, label: 'PURCHASES', value: loading ? '…' : String(summary?.entries || 0) },
          { icon: Store, label: 'TOP WEBSITE', value: loading ? '…' : (summary?.byMerchant[0]?.merchant || '—') },
          { icon: CalendarDays, label: 'THIS MONTH', value: loading ? '…' : inr(thisMonth) },
        ].map((t) => (
          <div key={t.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-slate-400"><t.icon size={14} /><span className="text-[10px] font-bold tracking-wide">{t.label}</span></div>
            <div className="mt-1.5 truncate text-lg font-extrabold text-slate-900">{t.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid md:grid-cols-2 gap-4">
        {/* Spend by website */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 font-bold text-slate-800"><BarChart3 size={16} className="text-[#E7000B]" /> Spend by website</div>
          <div className="mt-4">
            {loading ? <p className="text-xs text-slate-400">Loading…</p>
              : summary?.byMerchant.length ? <MerchantBars byMerchant={summary.byMerchant} />
              : <p className="text-xs text-slate-500">No purchases logged yet — add your first one and this chart builds from real entries only.</p>}
          </div>
        </div>

        {/* Monthly trend */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 font-bold text-slate-800"><TrendingUp size={16} className="text-[#E7000B]" /> Monthly trend</div>
          <div className="mt-4">
            {loading ? <p className="text-xs text-slate-400">Loading…</p>
              : <MonthTrend byMonth={summary?.byMonth || []} />}
          </div>
        </div>
      </div>

      {/* Add purchase */}
      <form onSubmit={add} className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2 font-bold text-slate-800"><Plus size={16} className="text-[#E7000B]" /> Log a purchase</div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <input value={form.merchant} onChange={(e) => setForm({ ...form, merchant: e.target.value })} placeholder="Website / store (e.g. Amazon.in)" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-[#E7000B] focus:outline-none" />
          <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^0-9]/g, '') })} placeholder="Amount (₹)" inputMode="numeric" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-[#E7000B] focus:outline-none" />
          <input value={form.itemTitle} onChange={(e) => setForm({ ...form, itemTitle: e.target.value })} placeholder="Item (optional)" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-[#E7000B] focus:outline-none" />
          <input type="date" max={today()} value={form.entryDate} onChange={(e) => setForm({ ...form, entryDate: e.target.value })} className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-600 focus:border-[#E7000B] focus:outline-none" />
        </div>
        <button disabled={busy} className="mt-3 rounded-xl bg-[#E7000B] px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">
          {busy ? 'Saving…' : 'Add to Spend Lens'}
        </button>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400"><Info size={12} /> Only purchases you confirm are counted. We never estimate spend from clicks or sessions.</p>
      </form>

      {/* Entries */}
      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
        <div className="font-bold text-slate-800">Your logged purchases</div>
        {entries.length === 0 && !loading ? (
          <p className="mt-3 text-xs text-slate-500">Nothing here yet — nothing is fabricated either.</p>
        ) : (
          <div className="mt-3 divide-y divide-slate-100">
            {entries.map((en) => (
              <div key={en.id} className="flex items-center gap-3 py-2.5">
                <div className="w-32 shrink-0 truncate text-sm font-bold text-slate-800">{en.merchant}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs text-slate-500">{en.itemTitle || '—'}</div>
                  <div className="text-[10px] text-slate-400">{en.entryDate} {en.source === 'redirect' ? '· from a Buy click' : ''}</div>
                </div>
                <div className="text-sm font-extrabold text-slate-900">{inr(en.amount)}</div>
                <button onClick={() => remove(en.id)} className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-[#E7000B]" title="Remove"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SpendLensView;
