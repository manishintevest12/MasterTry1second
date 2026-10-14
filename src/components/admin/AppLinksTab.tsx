import React, { useCallback, useEffect, useState } from 'react';
import { Chrome, Smartphone, Apple, Save, Trash2, RefreshCw, ExternalLink } from 'lucide-react';

/**
 * Admin → App Links.
 * Paste the Chrome Web Store / Play Store / App Store (or direct download) URL.
 * The website footer and the Flutter app read these from GET /api/app-links, so
 * visitors reach the install page in one click. A button is shown ONLY when a
 * link is saved here and active.
 */

type LinkKey = 'chrome_extension' | 'android_app' | 'ios_app';

const ITEMS: { key: LinkKey; label: string; hint: string; icon: React.ReactNode }[] = [
  { key: 'chrome_extension', label: 'Chrome Extension', hint: 'Chrome Web Store listing or a direct .zip download URL', icon: <Chrome className="w-4 h-4 text-red-600" /> },
  { key: 'android_app', label: 'Android App', hint: 'Google Play listing or a direct .apk download URL', icon: <Smartphone className="w-4 h-4 text-emerald-600" /> },
  { key: 'ios_app', label: 'iOS App', hint: 'Apple App Store / TestFlight link', icon: <Apple className="w-4 h-4 text-slate-800" /> },
];

interface Row { url: string; version: string; is_active: boolean; saved: boolean }
const blank = (): Row => ({ url: '', version: '', is_active: true, saved: false });

const inputCls = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10';
const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1';

export const AppLinksTab: React.FC = () => {
  const [token] = useState(() => localStorage.getItem('t1s_admin_token') || '');
  const [rows, setRows] = useState<Record<LinkKey, Row>>({ chrome_extension: blank(), android_app: blank(), ios_app: blank() });
  const [busyKey, setBusyKey] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/app-links', { headers });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not load links');
      const next: Record<LinkKey, Row> = { chrome_extension: blank(), android_app: blank(), ios_app: blank() };
      for (const r of data.links || []) {
        if (r.link_key in next) next[r.link_key as LinkKey] = { url: r.url || '', version: r.version || '', is_active: Boolean(Number(r.is_active)), saved: true };
      }
      setRows(next);
    } catch (e: any) {
      setMsg({ ok: false, text: String(e?.message || e) });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const patch = (k: LinkKey, p: Partial<Row>) => setRows((r) => ({ ...r, [k]: { ...r[k], ...p } }));

  const save = async (k: LinkKey) => {
    setBusyKey(k); setMsg(null);
    try {
      const row = rows[k];
      const res = await fetch('/api/admin/app-links', { method: 'POST', headers, body: JSON.stringify({ link_key: k, url: row.url, version: row.version, is_active: row.is_active }) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Save failed');
      setMsg({ ok: true, text: `${ITEMS.find((i) => i.key === k)!.label} link saved. It is now live in the footer and the mobile app.` });
      await load();
    } catch (e: any) {
      setMsg({ ok: false, text: String(e?.message || e) });
    } finally {
      setBusyKey('');
    }
  };

  const remove = async (k: LinkKey) => {
    setBusyKey(k); setMsg(null);
    try {
      await fetch(`/api/admin/app-links/${k}`, { method: 'DELETE', headers });
      setMsg({ ok: true, text: 'Link removed. The footer button is hidden until you add a new one.' });
      await load();
    } catch (e: any) {
      setMsg({ ok: false, text: String(e?.message || e) });
    } finally {
      setBusyKey('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900">Download Links: Extension &amp; Mobile Apps</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Paste the page where people install each app. Visitors click the buttons in the website footer (and in the mobile app) and land straight on this link. Leave a link empty to hide its button.
          </p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-60">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {msg && (
        <div className={`px-3 py-2 rounded-lg text-xs font-semibold border ${msg.ok ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{msg.text}</div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {ITEMS.map((it) => {
          const row = rows[it.key];
          return (
            <div key={it.key} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center">{it.icon}</span>
                  <div>
                    <span className="text-sm font-bold text-slate-900 block leading-tight">{it.label}</span>
                    <span className="text-[11px] text-slate-500">{it.hint}</span>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${row.saved && row.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {row.saved ? (row.is_active ? 'Live' : 'Hidden') : 'Not set'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-3">
                <div>
                  <label className={labelCls}>Link (https://)</label>
                  <input className={inputCls} value={row.url} placeholder="https://chromewebstore.google.com/detail/..." onChange={(e) => patch(it.key, { url: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Version (optional)</label>
                  <input className={inputCls} value={row.version} placeholder="v1.1.1" maxLength={30} onChange={(e) => patch(it.key, { version: e.target.value })} />
                </div>
              </div>

              <div className="flex items-center justify-between mt-3">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={row.is_active} onChange={(e) => patch(it.key, { is_active: e.target.checked })} />
                  Show button on website &amp; app
                </label>
                <div className="flex items-center gap-2">
                  {row.saved && row.url && (
                    <a href={row.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-900">
                      Test link <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {row.saved && (
                    <button type="button" onClick={() => remove(it.key)} disabled={busyKey === it.key} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50 cursor-pointer disabled:opacity-60">
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  )}
                  <button type="button" onClick={() => save(it.key)} disabled={busyKey === it.key || !row.url.trim()} className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 cursor-pointer disabled:opacity-50">
                    <Save className="w-3.5 h-3.5" /> {busyKey === it.key ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
