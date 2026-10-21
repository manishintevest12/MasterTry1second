import React, { useCallback, useEffect, useState } from 'react';
import { Tag, Trash2, Save, RefreshCw, Pencil, X } from 'lucide-react';
import { AffiliateProfilesPanel } from './AffiliateProfilesPanel';

/**
 * Admin → Deals: the single place where merchant offers, coupon codes and bank / credit-card /
 * gift-card / loan / insurance / movie offers are managed. Customers see them in the Offers
 * section and on the redirect page. No affiliate ID is typed here: the click goes through the
 * server-side /api/out pointer and the affiliate profile (Admin → Affiliate) is attached there.
 */
interface DealRow {
  id: number; merchant_key: string; merchant_name: string; kind: string; title: string;
  description: string | null; code: string | null; discount_text: string | null; min_order: number | null;
  terms: string | null; dest_url: string; valid_till: string | null; sort_weight: number; is_active: number | boolean;
  source?: string;
}

const KIND_LABEL: Record<string, string> = {
  coupon: 'Coupon code', bank_offer: 'Bank offer', credit_card: 'Credit card', gift_card: 'Gift card',
  loan: 'Loan', insurance: 'Insurance', account: 'Bank account (Savings/Current/Demat)', movie: 'Movie offer', cashback: 'Cashback', sale: 'Sale / event',
};
const MERCHANTS = ['Flipkart', 'Amazon', 'Myntra', 'Ajio', 'Tata CLiQ', 'Meesho', 'BookMyShow', 'District', 'TicketNew', 'PVR INOX', 'Cinepolis', 'SBI', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak', 'Bank of Maharashtra', 'BankBazaar', 'Paisabazaar', 'Policybazaar', 'Money View', 'KreditBee', 'Navi'];
const empty = { id: 0, merchant_name: '', kind: 'coupon', title: '', code: '', discount_text: '', min_order: '', description: '', terms: '', dest_url: '', valid_till: '', sort_weight: '0', is_active: true };

const inputCls = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10';
const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1';

export const DealsTab: React.FC = () => {
  const [token] = useState(() => localStorage.getItem('t1s_admin_token') || '');
  const [rows, setRows] = useState<DealRow[]>([]);
  const [kinds, setKinds] = useState<string[]>(Object.keys(KIND_LABEL));
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [form, setForm] = useState<any>(empty);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/deals', { headers });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not load deals');
      setRows(data.deals || []); if (data.kinds) setKinds(data.kinds);
    } catch (e: any) { setMsg({ ok: false, text: e?.message || 'Could not load deals' }); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const body = { ...form, id: form.id || undefined, merchant_key: form.merchant_name, min_order: form.min_order === '' ? null : Number(form.min_order), sort_weight: Number(form.sort_weight) || 0 };
      const res = await fetch('/api/admin/deals', { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not save deal');
      setMsg({ ok: true, text: form.id ? 'Deal updated.' : 'Deal added. It is live on the Offers page and the redirect page now.' });
      setForm(empty); await load();
    } catch (e: any) { setMsg({ ok: false, text: e?.message || 'Could not save deal' }); }
    finally { setBusy(false); }
  };

  const remove = async (id: number) => {
    if (!window.confirm('Delete this deal?')) return;
    const res = await fetch(`/api/admin/deals/${id}`, { method: 'DELETE', headers });
    if (res.ok) { await load(); } else setMsg({ ok: false, text: 'Could not delete deal' });
  };

  const edit = (r: DealRow) => setForm({
    id: r.id, merchant_name: r.merchant_name, kind: r.kind, title: r.title, code: r.code || '', discount_text: r.discount_text || '',
    min_order: r.min_order ?? '', description: r.description || '', terms: r.terms || '', dest_url: r.dest_url,
    valid_till: r.valid_till ? String(r.valid_till).slice(0, 10) : '', sort_weight: String(r.sort_weight ?? 0), is_active: Number(r.is_active) === 1 || r.is_active === true,
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2"><Tag className="w-5 h-5 text-red-600" /><h3 className="text-lg font-bold text-slate-900">Deals &amp; Coupons</h3></div>
        <p className="text-xs text-slate-500 mt-1">
          Add real offers here: Flipkart / Amazon / Myntra / Ajio coupons and bank offers, BookMyShow / District / TicketNew movie offers, credit-card, gift-card, loan and insurance offers.
          Affiliate IDs are attached automatically on the server when a customer clicks, so just paste the merchant page link.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-slate-900">Auto-acquired merchant deals</h4>
          <p className="text-xs text-slate-500 mt-0.5">Myntra, Tata CLiQ and Amazon offers/coupons are pulled live via cffi every 6 hours and auto-expire after 3 days. Your manual deals stay on top of them.</p>
        </div>
        <button type="button" onClick={() => { setSyncing(true); fetch('/api/admin/deals/sync', { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('t1s_admin_token') || ''}` } }).then((r) => r.json()).then((d) => { setSyncing(false); setSyncMsg(d.success ? `Myntra ${d.outcomes?.find((o: any) => o.provider === 'myntra')?.deals ?? '—'}, Tata CLiQ ${d.outcomes?.find((o: any) => o.provider === 'tatacliq')?.deals ?? '—'}, Amazon ${d.outcomes?.find((o: any) => o.provider === 'amazon')?.deals ?? '—'} deals synced` : d.error || 'Sync failed'); void load(); }).catch(() => { setSyncing(false); setSyncMsg('Sync failed'); }); }}
          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer">
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
      </div>
      {syncMsg && <div className="text-xs font-semibold text-slate-600">{syncMsg}</div>}
      <AffiliateProfilesPanel />

      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-900">{form.id ? `Edit deal #${form.id}` : 'Add a deal'}</h4>
          {form.id ? <button onClick={() => setForm(empty)} className="text-xs text-slate-500 flex items-center gap-1 cursor-pointer"><X className="w-3 h-3" />Cancel edit</button> : null}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div><label className={labelCls}>Merchant / company</label>
            <input list="deal-merchants" className={inputCls} value={form.merchant_name} onChange={(e) => set('merchant_name', e.target.value)} placeholder="Flipkart, HDFC Bank, BookMyShow..." />
            <datalist id="deal-merchants">{MERCHANTS.map((m) => <option key={m} value={m} />)}</datalist></div>
          <div><label className={labelCls}>Type</label>
            <select className={inputCls} value={form.kind} onChange={(e) => set('kind', e.target.value)}>{kinds.map((k) => <option key={k} value={k}>{KIND_LABEL[k] || k}</option>)}</select></div>
          <div><label className={labelCls}>Coupon code {form.kind === 'coupon' ? '(required)' : '(optional)'}</label>
            <input className={inputCls} value={form.code} onChange={(e) => set('code', e.target.value)} placeholder="SAVE10" /></div>
          <div className="md:col-span-2"><label className={labelCls}>Title</label>
            <input className={inputCls} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Extra 10% off on HDFC Credit Cards" maxLength={200} /></div>
          <div><label className={labelCls}>Discount text</label>
            <input className={inputCls} value={form.discount_text} onChange={(e) => set('discount_text', e.target.value)} placeholder="10% off up to ₹1,500" maxLength={80} /></div>
          <div className="md:col-span-2"><label className={labelCls}>Merchant page link (https)</label>
            <input className={inputCls} value={form.dest_url} onChange={(e) => set('dest_url', e.target.value)} placeholder="https://www.flipkart.com/..." /></div>
          <div><label className={labelCls}>Valid till</label>
            <input type="date" className={inputCls} value={form.valid_till} onChange={(e) => set('valid_till', e.target.value)} /></div>
          <div><label className={labelCls}>Min. order (₹)</label>
            <input type="number" className={inputCls} value={form.min_order} onChange={(e) => set('min_order', e.target.value)} /></div>
          <div><label className={labelCls}>Priority (-100 to 100)</label>
            <input type="number" className={inputCls} value={form.sort_weight} onChange={(e) => set('sort_weight', e.target.value)} /></div>
          <div className="flex items-end"><label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input type="checkbox" checked={!!form.is_active} onChange={(e) => set('is_active', e.target.checked)} /> Active</label></div>
          <div className="md:col-span-3"><label className={labelCls}>Details</label>
            <textarea className={inputCls} rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={600} /></div>
          <div className="md:col-span-3"><label className={labelCls}>Terms &amp; conditions</label>
            <textarea className={inputCls} rows={2} value={form.terms} onChange={(e) => set('terms', e.target.value)} maxLength={600} /></div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"><Save className="w-3.5 h-3.5" />{busy ? 'Saving…' : form.id ? 'Update deal' : 'Add deal'}</button>
          {msg && <span className={`text-xs font-semibold ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</span>}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h4 className="text-sm font-bold text-slate-900">All deals ({rows.length})</h4>
          <button onClick={() => void load()} className="text-xs text-slate-500 flex items-center gap-1 cursor-pointer"><RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
        </div>
        {rows.length === 0 ? <p className="p-6 text-xs text-slate-500 text-center">No deals yet. Add the first one above.</p> : (
          <div className="divide-y divide-slate-100">
            {rows.map((r) => {
              const expired = r.valid_till && String(r.valid_till).slice(0, 10) < new Date().toISOString().slice(0, 10);
              const live = (Number(r.is_active) === 1 || r.is_active === true) && !expired;
              return (
                <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="text-xs text-slate-900">{r.merchant_name}</strong>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-600">{KIND_LABEL[r.kind] || r.kind}</span>
                      {r.code && <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-dashed border-amber-300 text-[10px] font-mono font-bold text-amber-800">{r.code}</span>}
                      <span className={`text-[10px] font-bold ${live ? 'text-emerald-600' : 'text-slate-400'}`}>{live ? 'LIVE' : expired ? 'EXPIRED' : 'OFF'}</span>
                      {r.source === 'auto' && <span className="px-1.5 py-0.5 rounded bg-sky-50 text-[10px] font-bold text-sky-700">AUTO</span>}
                    </div>
                    <p className="text-xs text-slate-600 truncate">{r.title}{r.discount_text ? ` · ${r.discount_text}` : ''}</p>
                  </div>
                  <button onClick={() => edit(r)} className="p-1.5 text-slate-500 hover:text-slate-900 cursor-pointer"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => void remove(r.id)} className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
