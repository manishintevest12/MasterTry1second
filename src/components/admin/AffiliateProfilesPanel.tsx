import React, { useCallback, useEffect, useState } from 'react';
import { Link2, Trash2, Save } from 'lucide-react';

/**
 * Affiliate IDs, stored on the server. Add each company's tracking-link template ONCE (it holds
 * your own affiliate / publisher ID). Every customer click then goes through /api/out and the
 * server wraps the merchant page with the matching template. No ID is ever shown in the browser.
 */
interface Profile { slug: string; company_domain: string; network: string; template: string; campaign_key: string | null; active: number | boolean }

const inputCls = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10';
const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1';
const blank = { slug: '', company_domain: '', network: 'cuelinks', template: '', campaign_key: '' };

export const AffiliateProfilesPanel: React.FC = () => {
  const [token] = useState(() => localStorage.getItem('t1s_admin_token') || '');
  const [rows, setRows] = useState<Profile[]>([]);
  const [networks, setNetworks] = useState<string[]>(['cuelinks', 'vcommission', 'admitad', 'optimise', 'direct']);
  const [form, setForm] = useState<any>(blank);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/affiliate-profiles', { headers });
      const d = await res.json();
      if (d.success) { setRows(d.profiles || []); if (d.networks) setNetworks(d.networks); }
    } catch { /* keep list */ }
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const save = async () => {
    setMsg(null);
    const res = await fetch('/api/admin/affiliate-profiles', { method: 'POST', headers, body: JSON.stringify(form) });
    const d = await res.json();
    if (!res.ok || !d.success) return setMsg({ ok: false, text: d.error || 'Could not save' });
    setMsg({ ok: true, text: 'Saved. New clicks to this company now carry your affiliate ID.' });
    setForm(blank); void load();
  };
  const remove = async (slug: string) => {
    if (!window.confirm(`Remove the affiliate profile for ${slug}?`)) return;
    await fetch(`/api/admin/affiliate-profiles/${encodeURIComponent(slug)}`, { method: 'DELETE', headers }); void load();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
      <div className="flex items-center gap-2"><Link2 className="w-4 h-4 text-red-600" /><h4 className="text-sm font-bold text-slate-900">Affiliate IDs (applied on the server)</h4></div>
      <p className="text-xs text-slate-500">
        Paste your network&apos;s tracking link for a company and put <code className="px-1 bg-slate-100 rounded">{'{url}'}</code> where the merchant page goes.
        Example: <code className="px-1 bg-slate-100 rounded break-all">{'https://linksredirect.com/?cid=YOUR_ID&source=linkkit&url={url}'}</code>. Optional: <code className="px-1 bg-slate-100 rounded">{'{subid}'}</code>, <code className="px-1 bg-slate-100 rounded">{'{campaign}'}</code>.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div><label className={labelCls}>Company name</label><input className={inputCls} value={form.slug} onChange={(e) => set('slug', e.target.value)} placeholder="flipkart" /></div>
        <div><label className={labelCls}>Website</label><input className={inputCls} value={form.company_domain} onChange={(e) => set('company_domain', e.target.value)} placeholder="flipkart.com" /></div>
        <div><label className={labelCls}>Network</label><select className={inputCls} value={form.network} onChange={(e) => set('network', e.target.value)}>{networks.map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
        <div><label className={labelCls}>Campaign (optional)</label><input className={inputCls} value={form.campaign_key} onChange={(e) => set('campaign_key', e.target.value)} /></div>
        <div className="md:col-span-4"><label className={labelCls}>Tracking link template</label><input className={inputCls} value={form.template} onChange={(e) => set('template', e.target.value)} placeholder="https://track.vcommission.com/click?campaign_id=...&pub_id=...&url={url}" /></div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"><Save className="w-3.5 h-3.5" />Save affiliate ID</button>
        {msg && <span className={`text-xs font-semibold ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</span>}
      </div>
      {rows.length > 0 && (
        <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
          {rows.map((r) => (
            <div key={r.slug} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1"><strong className="text-xs text-slate-900">{r.slug}</strong> <span className="text-[11px] text-slate-500">{r.company_domain} · {r.network}</span>
                <p className="text-[10px] font-mono text-slate-400 truncate">{r.template.replace(/(pub_id|cid|aff|affid|pid|id)=[^&]+/gi, '$1=••••')}</p></div>
              <button onClick={() => { setForm({ slug: r.slug, company_domain: r.company_domain, network: r.network, template: r.template, campaign_key: r.campaign_key || '' }); }} className="text-[11px] text-slate-500 cursor-pointer">Edit</button>
              <button onClick={() => void remove(r.slug)} className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
