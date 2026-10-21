/**
 * Merchant logo uploads (owner 21 Oct): the brand logos scraped via favicon are often
 * a blurry globe. The owner uploads the right logo once; it is stored base64 in MySQL
 * (merchant_logos) and rendered on every card of that brand across the site/app.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';

interface LogoRow { name_key: string; name: string; logo: string; updated_at: string; }

const inputCls = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10';
const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1';

/** Client-side resize to max 256px so uploads stay tiny (MySQL-safe base64). */
function fileToDataUrl(file: File, max = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Could not read the file'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Not a valid image'));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        if (!ctx) return reject(new Error('Canvas unavailable'));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h); // white pad so transparent logos show on cards
        ctx.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/png'));
      };
      img.src = String(fr.result);
    };
    fr.readAsDataURL(file);
  });
}

export const MerchantLogosTab: React.FC = () => {
  const [token] = useState(() => localStorage.getItem('t1s_admin_token') || '');
  const [rows, setRows] = useState<LogoRow[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingLogo, setPendingLogo] = useState<string | null>(null);
  const [pendingName, setPendingName] = useState('');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/merchant-logos', { headers });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not load logos');
      setRows(data.logos || []);
    } catch (e: any) { setMsg({ ok: false, text: e?.message }); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setMsg(null);
    try {
      const dataUrl = await fileToDataUrl(f);
      setPendingLogo(dataUrl);
      if (!pendingName && !name) setName(f.name.replace(/\.(png|jpe?g|webp|svg)$/i, '').replace(/[_-]+/g, ' '));
    } catch (err: any) { setMsg({ ok: false, text: err?.message || 'Could not read image' }); }
    if (fileRef.current) fileRef.current.value = '';
  };

  const save = async () => {
    const n = (pendingName || name).trim();
    if (!n) { setMsg({ ok: false, text: 'Enter the merchant name (e.g. Bank of Maharashtra)' }); return; }
    if (!pendingLogo) { setMsg({ ok: false, text: 'Choose a logo image first' }); return; }
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/admin/merchant-logos', { method: 'POST', headers, body: JSON.stringify({ name: n, logo: pendingLogo }) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not save logo');
      setMsg({ ok: true, text: `Logo saved for "${n}" — live within 5 minutes everywhere` });
      setPendingLogo(null); setPendingName(''); setName('');
      await load();
    } catch (e: any) { setMsg({ ok: false, text: e?.message }); }
    finally { setBusy(false); }
  };

  const del = async (key: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/merchant-logos/${encodeURIComponent(key)}`, { method: 'DELETE', headers });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not delete');
      await load();
    } catch (e: any) { setMsg({ ok: false, text: e?.message }); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-black text-slate-900">Merchant Logo Upload</h3>
        <p className="text-[11px] text-slate-500 mt-0.5 mb-3">
          Logos fix blurry/globe icons on result cards (Ola, small banks, food brands). Upload once — renders everywhere within 5 minutes. Images are auto-resized to 256px.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className={labelCls}>Merchant / brand name</label>
            <input className={inputCls} value={pendingName || name} onChange={(e) => { setPendingName(e.target.value); setName(e.target.value); }} placeholder="Bank of Maharashtra" />
          </div>
          <div>
            <label className={labelCls}>Logo image (PNG/JPG)</label>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={pick} className="block w-full text-xs text-slate-600 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-slate-900 file:text-white text-xs" />
          </div>
          <div className="flex items-center gap-3">
            {pendingLogo && <img src={pendingLogo} alt="preview" className="w-11 h-11 rounded-xl bg-white border border-slate-200 object-contain" />}
            <button type="button" onClick={save} disabled={busy} className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold disabled:opacity-50 cursor-pointer">
              {busy ? 'Saving…' : 'Save logo'}
            </button>
          </div>
        </div>
        {msg && <p className={`text-[11px] mt-2 font-medium ${msg.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{msg.text}</p>}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-black text-slate-900 mb-2">Uploaded logos ({rows.length})</h3>
        {loading ? <p className="text-xs text-slate-500">Loading…</p> : !rows.length ? (
          <p className="text-xs text-slate-500">No logos uploaded yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {rows.map((r) => (
              <div key={r.name_key} className="flex items-center gap-2.5 rounded-lg border border-slate-200 p-2.5">
                <img src={r.logo} alt={r.name} className="w-10 h-10 rounded-lg bg-white object-contain border border-slate-100" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 truncate">{r.name}</p>
                  <p className="text-[10px] text-slate-400">updated {String(r.updated_at || '').slice(0, 10)}</p>
                </div>
                <button type="button" onClick={() => del(r.name_key)} className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer">Delete</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
