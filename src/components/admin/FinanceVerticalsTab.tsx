/**
 * Manual finance inventory (owner 27 Oct): "muje option do loan, credit card, insurance,
 * account verticals ka manually v add krne ka".
 *
 * The four finance verticals are scraped, so a gated source (BankBazaar etc.) could leave
 * them empty and the owner had no way to publish a lender/card he holds a direct deal
 * with. This tab writes the entry into the SAME offers table the scraped rows use
 * (source_id 'admin_manual'), which means it appears in the live feed, comparison cards
 * and lead forms with no second pipeline.
 */
import { useEffect, useState } from 'react';
import { Plus, Save, Trash2, Loader2, Wallet, CreditCard, ShieldCheck, Landmark, ImagePlus, Link2 } from 'lucide-react';
import { downscaleImage } from '../../lib/imageResize';

interface Row {
  id: number; vertical: string; title: string; seller: string; rate_label: string;
  highlights: string; price: number | null; url: string; city: string | null; active: boolean;
  image_url: string; affiliate_url: string;
}

const VERTICALS = [
  { key: 'loans', label: 'Loans', icon: Wallet, hint: 'Personal / home / car / business loan' },
  { key: 'creditcards', label: 'Credit Cards', icon: CreditCard, hint: 'Card with annual fee + joining perks' },
  { key: 'insurance', label: 'Insurance', icon: ShieldCheck, hint: 'Health / term / motor plan' },
  { key: 'account', label: 'Accounts', icon: Landmark, hint: 'Savings / demat / current account' },
];

const inputCls = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10';
const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1';

const blank = { id: undefined as number | undefined, vertical: 'loans', title: '', seller: '', rate_label: '', price: '', highlights: '', url: '', city: '', active: true, image_url: '', affiliate_url: '' };

export const FinanceVerticalsTab: React.FC = () => {
  const [token] = useState(() => localStorage.getItem('t1s_admin_token') || '');
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState<any>(blank);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const load = async () => {
    try {
      const res = await fetch('/api/admin/finance-offers', { headers });
      const d = await res.json();
      if (d.success) setRows(d.offers || []);
      else setMsg({ ok: false, text: d.error || 'Could not load entries' });
    } catch { setMsg({ ok: false, text: 'Could not load entries' }); }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  // Photo upload (owner 27 Oct): the file goes to the existing admin merchant-logo
  // store, and the entry keeps /api/logos/<key> — a stable absolute URL the web card,
  // Flutter app and emails can all render (never a blob: URL that dies on reload).
  const uploadPhoto = async (file: File) => {
    // OWNER 11 Nov (second report of the same red "Upload failed"): the message was generic, so a stale
    // tab, an unreadable phone photo (HEIC) and a body the server dropped all looked identical. Every
    // failure below now names its cause, and the payload is squeezed to a few tens of KB before it leaves
    // the browser so no limit anywhere can drop it.
    const fail = (text: string) => setMsg({ ok: false, text });
    if (!file.type.startsWith('image/')) return fail('Sirf image file (png/jpg/webp/heic) chalti hai');
    if (file.size > 20 * 1024 * 1024) return fail('Photo 20MB se choti honi chahiye');
    setUploading(true);
    try {
      // Squeeze to <= 512px, then again at 320/256 if the encoded string is still large. A real photo
      // lands at 30-70 KB, well under every limit on the path.
      let dataUrl = await downscaleImage(file, 512, 0.85);
      if (dataUrl.length > 220_000) dataUrl = await downscaleImage(file, 320, 0.75);
      if (dataUrl.length > 220_000) dataUrl = await downscaleImage(file, 256, 0.7);
      if (!/^data:image\/(jpeg|png|webp);base64,/.test(dataUrl)) {
        return fail('Ye photo browser me convert nahi hui (iPhone HEIC?) — PNG/JPG chuno ya neeche https image link paste karo');
      }
      if (dataUrl.length > 220_000) {
        return fail('Photo compress nahi ho payi — chhoti image chuno ya neeche https image link paste karo');
      }
      const name = (form.title || file.name || 'finance').toString().trim();
      // Unique key per product: the server's slug helper keeps only the FIRST word, which made every
      // finance photo overwrite one shared 'finance' image.
      const slug = `${form.vertical}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
      const key = `fin-${slug || 'card'}-${Date.now().toString(36)}`;
      const res = await fetch('/api/admin/merchant-logos', {
        method: 'POST', headers,
        body: JSON.stringify({ name: `finance ${name}`, key, logo: dataUrl }),
      });
      const raw = await res.text();
      let d: any = null;
      try { d = JSON.parse(raw); } catch { d = null; }
      if (res.ok && d?.success) {
        set('image_url', `/api/logos/${d.name_key}`);
        setMsg({ ok: true, text: `Photo uploaded (${Math.round(dataUrl.length / 1024)} KB) — card pe dikhegi.` });
        return;
      }
      // Honest, specific failure: status + server text, or the size we tried.
      const why = d?.error || (raw || '').replace(/<[^>]+>/g, ' ').trim().slice(0, 120);
      fail(`Upload failed (HTTP ${res.status}${why ? `: ${why}` : ''}) — chhoti image try karo ya neeche https image link paste karo`);
    } catch (e: any) {
      fail(`Upload failed: ${String(e?.message || e).slice(0, 80)} — neeche https image link paste karo to bhi photo lag jayegi`);
    } finally { setUploading(false); }
  };

  const save = async () => {
    if (!form.title.trim()) return setMsg({ ok: false, text: 'Product name likho (e.g. HDFC Personal Loan)' });
    if (!/^https:\/\//i.test(form.url.trim())) return setMsg({ ok: false, text: 'Apply/partner URL https:// se shuru hona chahiye' });
    setBusy(true);
    try {
      const res = await fetch('/api/admin/finance-offers', { method: 'POST', headers, body: JSON.stringify({ ...form, id: form.id || undefined }) });
      const d = await res.json();
      if (d.success) {
        setMsg({ ok: true, text: form.id ? 'Entry updated — live feed me turant update ho jayegi.' : 'Entry added — ye live feed me dikhegi (scraped rows ke saath).' });
        setForm({ ...blank, vertical: form.vertical });
        await load();
      } else setMsg({ ok: false, text: d.error || 'Save failed' });
    } catch { setMsg({ ok: false, text: 'Save failed' }); }
    finally { setBusy(false); }
  };

  const remove = async (id: number) => {
    if (!confirm('Ye entry live feed se hata denge. Pakka?')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/finance-offers/${id}`, { method: 'DELETE', headers });
      const d = await res.json();
      if (d.success) { setMsg({ ok: true, text: 'Entry removed' }); await load(); }
      else setMsg({ ok: false, text: d.error || 'Delete failed' });
    } catch { setMsg({ ok: false, text: 'Delete failed' }); }
    finally { setBusy(false); }
  };

  const edit = (r: Row) => {
    setForm({ id: r.id, vertical: r.vertical, title: r.title, seller: r.seller, rate_label: r.rate_label, price: r.price ?? '', highlights: r.highlights, url: r.url, city: r.city || '', active: r.active, image_url: r.image_url || '', affiliate_url: r.affiliate_url || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const active = VERTICALS.find((v) => v.key === form.vertical) || VERTICALS[0];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Plus className="w-4 h-4" /> Finance verticals — manually add</h3>
        <p className="text-[11px] text-slate-500 mt-1">
          Loans / Credit Cards / Insurance / Accounts ka apna lender, card ya plan yahan add karo. Entry usi offers table me jaati hai jise scrape rows use karti hain — live feed, comparison card aur lead form sab me automatic dikhegi. Koi source gate ho jaye to bhi vertical khali nahi rahega.
        </p>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {VERTICALS.map((v) => {
            const Icon = v.icon;
            const on = form.vertical === v.key;
            return (
              <button key={v.key} type="button" onClick={() => set('vertical', v.key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${on ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                <Icon className="w-3.5 h-3.5" /> {v.label}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-slate-400 mt-1.5">{active.hint}</p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2"><label className={labelCls}>Product name *</label><input className={inputCls} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="HDFC Personal Loan" /></div>
          <div><label className={labelCls}>Bank / insurer / broker</label><input className={inputCls} value={form.seller} onChange={(e) => set('seller', e.target.value)} placeholder="HDFC Bank" /></div>
          <div><label className={labelCls}>Rate / fee shown</label><input className={inputCls} value={form.rate_label} onChange={(e) => set('rate_label', e.target.value)} placeholder="10.25% p.a. · ₹0 joining" /></div>
          <div><label className={labelCls}>Numeric value (sorting)</label><input className={inputCls} value={form.price} onChange={(e) => set('price', e.target.value)} placeholder="10.25" /></div>
          <div><label className={labelCls}>City (optional)</label><input className={inputCls} value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Indore" /></div>
          <div className="md:col-span-2"><label className={labelCls}>Apply / partner URL *</label><input className={inputCls} value={form.url} onChange={(e) => set('url', e.target.value)} placeholder="https://www.hdfcbank.com/personal/loan" /></div>
          <div className="md:col-span-2">
            <label className={labelCls}>Photo (card image)</label>
            <div className="flex items-center gap-2">
              {form.image_url ? <img src={form.image_url} alt="preview" className="w-10 h-10 rounded-lg object-cover border border-slate-200" /> : null}
              <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 cursor-pointer hover:border-slate-300">
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                {form.image_url ? 'Change photo' : 'Upload photo'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadPhoto(f); }} />
              </label>
              {form.image_url ? <button type="button" onClick={() => set('image_url', '')} className="text-[11px] text-slate-400 cursor-pointer">remove</button> : null}
            </div>
            <input className={`${inputCls} mt-1.5`} value={form.image_url} onChange={(e) => set('image_url', e.target.value)} placeholder="…ya https:// image link paste karo" />
            <p className="text-[10px] text-slate-400 mt-1">
              Photo upload se pehle browser me hi compress hoti hai (512 px, ~30-70 KB) — isliye bade phone photo bhi chalti hai.
              Agar upload phir bhi fail ho to neeche wale box me kisi image ka https link paste kar do, entry usi photo se live ho jayegi.
            </p>
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Affiliate / tracking link</label>
            <input className={inputCls} value={form.affiliate_url} onChange={(e) => set('affiliate_url', e.target.value)} placeholder="https://track.network/click?affid=123&url={url}" />
            <p className="text-[10px] text-slate-400 mt-1">Khali chhod do to system apna network (Amazon / Cuelinks / LinkInR / Ekaro / direct) khud lagayega. Bharte ho to <strong>{'{url}'}</strong> zaroori hai — wahan asli apply page jaata hai.</p>
          </div>
          <div className="md:col-span-4"><label className={labelCls}>Highlights (one line)</label><input className={inputCls} value={form.highlights} onChange={(e) => set('highlights', e.target.value)} placeholder="Instant approval · 7.5L max · no foreclosure charge" /></div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer disabled:opacity-60">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}{form.id ? 'Update entry' : 'Add to live feed'}
          </button>
          {form.id ? <button onClick={() => setForm({ ...blank, vertical: form.vertical })} className="text-[11px] text-slate-500 cursor-pointer">Cancel edit</button> : null}
          {msg ? <span className={`text-[11px] font-semibold ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</span> : null}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Manual entries ({rows.length})</h4>
        {rows.length === 0 ? (
          <p className="text-[11px] text-slate-500">Abhi koi manual entry nahi. Upar se add karo — live feed me turant dikhegi.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((r) => (
              <div key={r.id} className="flex items-start gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <strong className="text-xs text-slate-900">{r.title}</strong>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-slate-100 text-slate-600">{r.vertical}</span>
                    {r.active ? null : <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-amber-50 text-amber-700">inactive</span>}
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">{r.seller}{r.rate_label ? ` · ${r.rate_label}` : ''}{r.city ? ` · ${r.city}` : ''}</p>
                  {r.highlights ? <p className="text-[10px] text-slate-400 truncate">{r.highlights}</p> : null}
                  <p className="text-[10px] flex items-center gap-2 mt-0.5">
                    <span className={r.image_url ? 'text-emerald-600 font-semibold' : 'text-slate-400'}>{r.image_url ? 'Photo ✓' : 'no photo'}</span>
                    <span className={r.affiliate_url ? 'text-emerald-600 font-semibold' : 'text-slate-400'}>{r.affiliate_url ? 'Affiliate link ✓' : 'no affiliate link'}</span>
                  </p>
                </div>
                <button onClick={() => edit(r)} className="text-[11px] text-slate-500 cursor-pointer">Edit</button>
                <button onClick={() => void remove(r.id)} className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
