/**
 * Manual coupons / offers / cashback (owner 27 Oct): "admin mai offer coupon cashback ye sb
 * v add kr ske manually jisme image upload affiliate sb ho aur wo coupon, offer redirection
 * page pr copy v ho."
 *
 * Every row is per merchant (picked from the affiliate registry) with its own photo, its own
 * affiliate/tracking template and an optional date window. The /redirect exit page reads the
 * live rows for that merchant and shows them with a Copy button, right next to AdSense.
 */
import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2, Loader2, Ticket, Gift, Percent, ImagePlus, Download, Copy, Check } from 'lucide-react';

interface Row {
  id: number; merchant_slug: string; merchant_domain: string; kind: string; title: string;
  code: string | null; discount_label: string | null; description: string | null;
  image_url: string | null; url: string | null; affiliate_url: string | null;
  starts_at: string | null; ends_at: string | null; priority: number; active: boolean;
  clicks?: number; copies?: number;
}
interface Merchant { slug: string; display_name: string; company_domain: string; vertical: string }

const KINDS = [
  { key: 'coupon', label: 'Coupon code', icon: Ticket },
  { key: 'offer', label: 'Offer', icon: Gift },
  { key: 'cashback', label: 'Cashback', icon: Percent },
];

const inputCls = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10';
const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1';

const blank = {
  id: undefined as number | undefined, merchant_slug: '', merchant_domain: '', kind: 'coupon',
  title: '', code: '', discount_label: '', description: '', image_url: '', url: '',
  affiliate_url: '', starts_at: '', ends_at: '', priority: 100, active: true,
};

export const PromoOffersTab: React.FC = () => {
  const [token] = useState(() => localStorage.getItem('t1s_admin_token') || '');
  const [rows, setRows] = useState<Row[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [form, setForm] = useState<any>(blank);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const load = async () => {
    try {
      const res = await fetch('/api/admin/promo-offers', { headers });
      const d = await res.json();
      if (d.success) setRows(d.offers || []);
      else setMsg({ ok: false, text: d.error || 'Could not load offers' });
    } catch { setMsg({ ok: false, text: 'Could not load offers' }); }
  };
  // Merchant list comes from the affiliate registry so slug + domain always match the
  // merchant the exit page will ask about.
  const loadMerchants = async () => {
    try {
      const res = await fetch('/api/admin/affiliate-profiles', { headers });
      const d = await res.json();
      if (d.success) setMerchants((d.profiles || []).map((p: any) => ({
        slug: p.slug, display_name: p.display_name || p.slug, company_domain: p.company_domain || '', vertical: p.vertical || '',
      })));
    } catch { /* registry unavailable: manual typing still works */ }
  };
  useEffect(() => { void load(); void loadMerchants(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const pickMerchant = (slug: string) => {
    const m = merchants.find((x) => x.slug === slug);
    setForm((f: any) => ({ ...f, merchant_slug: slug, merchant_domain: m?.company_domain || f.merchant_domain }));
  };

  const uploadPhoto = async (file: File) => {
    if (!file.type.startsWith('image/')) return setMsg({ ok: false, text: 'Sirf image file (png/jpg/webp)' });
    if (file.size > 4 * 1024 * 1024) return setMsg({ ok: false, text: 'Photo 4MB se choti honi chahiye' });
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result || ''));
        fr.onerror = () => reject(new Error('read failed'));
        fr.readAsDataURL(file);
      });
      const res = await fetch('/api/admin/merchant-logos', {
        method: 'POST', headers,
        body: JSON.stringify({ name: `promo-${form.merchant_slug || 'm'}-${form.title || 'offer'}`, logo: dataUrl }),
      });
      const d = await res.json();
      // Same { ok } vs { success } mismatch as the finance tab: accept either key.
      if (d.success || d.ok) { set('image_url', `/api/logos/${d.name_key}`); setMsg({ ok: true, text: 'Photo uploaded.' }); }
      else setMsg({ ok: false, text: d.error || 'Upload failed' });
    } catch { setMsg({ ok: false, text: 'Upload failed' }); }
    finally { setUploading(false); }
  };

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/admin/promo-offers', { method: 'POST', headers, body: JSON.stringify({ ...form, id: form.id || undefined }) });
      const d = await res.json();
      if (d.success) {
        setMsg({ ok: true, text: form.id ? 'Offer updated — exit page pe turant naya version.' : 'Offer added — ab ye redirect page pe dikhega (Copy button ke saath).' });
        setForm({ ...blank, kind: form.kind });
        await load();
      } else setMsg({ ok: false, text: d.error || 'Save failed' });
    } catch { setMsg({ ok: false, text: 'Save failed' }); }
    finally { setBusy(false); }
  };

  const remove = async (id: number) => {
    if (!confirm('Ye offer delete karna hai?')) return;
    try {
      const res = await fetch(`/api/admin/promo-offers/${id}`, { method: 'DELETE', headers });
      const d = await res.json();
      if (d.success) { setMsg({ ok: true, text: 'Deleted.' }); await load(); }
      else setMsg({ ok: false, text: d.error || 'Delete failed' });
    } catch { setMsg({ ok: false, text: 'Delete failed' }); }
  };

  // Excel: the partner map + every coupon (owner asked for a downloadable sheet).
  const downloadExcel = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/admin/affiliate-partners.xlsx', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `try1second-partners-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setMsg({ ok: true, text: 'Excel download ho gaya — Partners + Coupons sheets.' });
    } catch { setMsg({ ok: false, text: 'Excel download failed' }); }
    finally { setExporting(false); }
  };

  const byMerchant = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.merchant_slug, (m.get(r.merchant_slug) || 0) + 1);
    return m;
  }, [rows]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Offers, coupons &amp; cashback</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Merchant-wise codes jo <strong>/redirect</strong> page pe user ko dikhte hain, Copy button ke saath.
            Photo + apna affiliate link dono optional hain — na do to merchant ka normal deeplink chalta hai.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={downloadExcel} disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer disabled:opacity-60">
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Download Excel (partners + coupons)
          </button>
          <button onClick={() => setForm(blank)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> New offer
          </button>
        </div>
      </div>

      {msg ? (
        <div className={`text-xs font-semibold px-3 py-2 rounded-lg ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{msg.text}</div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="md:col-span-2">
            <label className={labelCls}>Merchant</label>
            <select className={inputCls} value={form.merchant_slug} onChange={(e) => pickMerchant(e.target.value)}>
              <option value="">— registry se chuno —</option>
              {merchants.map((m) => <option key={m.slug} value={m.slug}>{m.display_name} ({m.company_domain})</option>)}
            </select>
            <input className={`${inputCls} mt-1.5`} value={form.merchant_domain} onChange={(e) => set('merchant_domain', e.target.value)} placeholder="ya domain: agoda.com" />
          </div>
          <div>
            <label className={labelCls}>Type</label>
            <select className={inputCls} value={form.kind} onChange={(e) => set('kind', e.target.value)}>
              {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
            </select>
          </div>
          <div className="md:col-span-3">
            <label className={labelCls}>Title</label>
            <input className={inputCls} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Flat ₹500 off on domestic hotels" />
          </div>

          <div>
            <label className={labelCls}>Code (copyable)</label>
            <input className={inputCls} value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="T1S500" />
          </div>
          <div>
            <label className={labelCls}>Discount label</label>
            <input className={inputCls} value={form.discount_label} onChange={(e) => set('discount_label', e.target.value)} placeholder="₹500 OFF / 10% cashback" />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Starts (optional)</label>
            <input type="date" className={inputCls} value={form.starts_at} onChange={(e) => set('starts_at', e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Ends (optional)</label>
            <input type="date" className={inputCls} value={form.ends_at} onChange={(e) => set('ends_at', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Priority</label>
            <input type="number" className={inputCls} value={form.priority} onChange={(e) => set('priority', e.target.value)} placeholder="100" />
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
              <input type="checkbox" checked={Boolean(form.active)} onChange={(e) => set('active', e.target.checked)} /> Active
            </label>
          </div>

          <div className="md:col-span-3">
            <label className={labelCls}>Description (optional)</label>
            <input className={inputCls} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Min booking ₹4,000 · valid on 3+ nights" />
          </div>
          <div className="md:col-span-3">
            <label className={labelCls}>Offer page (optional, https)</label>
            <input className={inputCls} value={form.url} onChange={(e) => set('url', e.target.value)} placeholder="https://www.agoda.com/offers/…" />
            <p className="text-[10px] text-slate-400 mt-1">Khali chhodo to merchant ka normal deeplink hi chalta hai.</p>
          </div>

          <div className="md:col-span-3">
            <label className={labelCls}>Photo</label>
            <div className="flex items-center gap-2">
              {form.image_url ? <img src={form.image_url} alt="preview" className="w-10 h-10 rounded-lg object-cover border border-slate-200" /> : null}
              <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 cursor-pointer hover:border-slate-300">
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                {form.image_url ? 'Change photo' : 'Upload photo'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadPhoto(f); }} />
              </label>
              {form.image_url ? <button type="button" onClick={() => set('image_url', '')} className="text-[11px] text-slate-400 cursor-pointer">remove</button> : null}
            </div>
            <input className={`${inputCls} mt-1.5`} value={form.image_url} onChange={(e) => set('image_url', e.target.value)} placeholder="…ya https:// image link" />
          </div>
          <div className="md:col-span-3">
            <label className={labelCls}>Affiliate / tracking link (optional)</label>
            <input className={inputCls} value={form.affiliate_url} onChange={(e) => set('affiliate_url', e.target.value)} placeholder="https://track.network/click?affid=123&url={url}" />
            <p className="text-[10px] text-slate-400 mt-1">Khali = system ka apna network chain. Bharte ho to <strong>{'{url}'}</strong> zaroori hai.</p>
          </div>
        </div>

        <button onClick={save} disabled={busy}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer disabled:opacity-60">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {form.id ? 'Update offer' : 'Add offer'}
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {rows.length === 0 ? (
          <p className="p-4 text-xs text-slate-400">Abhi koi offer nahi. Upar se add karo — pehla code redirect page pe aayega.</p>
        ) : rows.map((r) => {
          const Icon = KINDS.find((k) => k.key === r.kind)?.icon || Gift;
          return (
            <div key={r.id} className="flex items-center gap-3 p-3">
              {r.image_url
                ? <img src={r.image_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-200" />
                : <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center"><Icon className="w-4 h-4 text-slate-400" /></div>}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800 truncate">{r.title}</p>
                <p className="text-[10px] text-slate-500 truncate">
                  {r.merchant_slug} · {r.kind}{r.discount_label ? ` · ${r.discount_label}` : ''}
                  {r.code ? ` · code ${r.code}` : ''}{r.ends_at ? ` · till ${r.ends_at}` : ''}
                </p>
                <p className="text-[10px] flex items-center gap-2 mt-0.5">
                  <span className={r.active ? 'text-emerald-600 font-semibold' : 'text-slate-400'}>{r.active ? 'active' : 'paused'}</span>
                  <span className={r.image_url ? 'text-emerald-600' : 'text-slate-400'}>{r.image_url ? 'photo ✓' : 'no photo'}</span>
                  <span className={r.affiliate_url ? 'text-emerald-600' : 'text-slate-400'}>{r.affiliate_url ? 'affiliate ✓' : 'auto link'}</span>
                  <span className="text-slate-400 inline-flex items-center gap-1"><Copy className="w-2.5 h-2.5" />{r.copies || 0}</span>
                </p>
              </div>
              <button onClick={() => setForm({ ...blank, ...r, code: r.code || '', discount_label: r.discount_label || '', description: r.description || '', image_url: r.image_url || '', url: r.url || '', affiliate_url: r.affiliate_url || '', starts_at: r.starts_at || '', ends_at: r.ends_at || '' })}
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 cursor-pointer">Edit</button>
              <button onClick={() => remove(r.id)} className="text-slate-300 hover:text-red-600 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
            </div>
          );
        })}
      </div>

      {byMerchant.size > 0 ? (
        <p className="text-[10px] text-slate-400 inline-flex items-center gap-1"><Check className="w-3 h-3 text-emerald-500" />
          {rows.length} offers across {byMerchant.size} merchants — sab live redirection page pe.</p>
      ) : null}
    </div>
  );
};
