import React, { useCallback, useEffect, useState } from 'react';
import { Link2, Trash2, Save, Search } from 'lucide-react';

/**
 * Affiliate IDs, stored on the server. Add each company's tracking-link template ONCE (it holds
 * your own affiliate / publisher ID). Every customer click then goes through /api/out and the
 * server wraps the merchant page with the matching template. No ID is ever shown in the browser.
 */
interface Profile { slug: string; company_domain: string; vertical?: string | null; display_name?: string | null; network: string; affiliate_id?: string | null; monetization?: string | null; template: string | null; campaign_key: string | null; active: number | boolean;
  effective_source?: string; effective_id_masked?: string; effective_label?: string }
interface AutoCampaign { name: string; domain: string; payout: string; type: string; categories: string }
interface Coverage {
  manual: Profile[];
  linkinr: { enabled: boolean; campaigns: AutoCampaign[] };
  amazon: { tag: string };
  cuelinks: { enabled: boolean; publisherId: string; cid: string };
  ekaro: { enabled: boolean; domainsCached: number };
  capturedLinks: { network: string; domain: string; template: string; campaign: string }[];
}

const inputCls = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10';
const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1';
const blank = { slug: '', company_domain: '', network: 'cuelinks', template: '', campaign_key: '', affiliate_id: '', monetization: 'affiliate' };

export const AffiliateProfilesPanel: React.FC = () => {
  const [token] = useState(() => localStorage.getItem('t1s_admin_token') || '');
  const [rows, setRows] = useState<Profile[]>([]);
  const [networks, setNetworks] = useState<string[]>(['cuelinks', 'vcommission', 'admitad', 'optimise', 'direct']);
  const [form, setForm] = useState<any>(blank);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [cov, setCov] = useState<Coverage | null>(null);
  const [covQ, setCovQ] = useState('');
  const loadCoverage = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/affiliate/coverage', { headers });
      const d = await res.json();
      if (d.success) setCov(d as Coverage);
    } catch { /* keep list */ }
  }, [token]);
  useEffect(() => { void loadCoverage(); }, [loadCoverage]);
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
        <div><label className={labelCls}>Your affiliate ID</label><input className={inputCls} value={form.affiliate_id || ''} onChange={(e) => set('affiliate_id', e.target.value)} placeholder="e.g. try1second-21 (khali chhod do agar abhi nahi mila)" /></div>
        <div><label className={labelCls}>Monetization</label><select className={inputCls} value={form.monetization || 'affiliate'} onChange={(e) => set('monetization', e.target.value)}>
          <option value="affiliate">Affiliate (ID / template)</option>
          <option value="adsense">AdSense (koi affiliate program nahi)</option>
        </select></div>
        <div className="md:col-span-4"><label className={labelCls}>Tracking link template</label><input className={inputCls} value={form.template} onChange={(e) => set('template', e.target.value)} placeholder="https://track.vcommission.com/click?campaign_id=...&pub_id=...&url={url}" /></div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"><Save className="w-3.5 h-3.5" />Save affiliate ID</button>
        <p className="text-[10px] text-slate-400 md:col-span-4">Template khali chhod sakte ho — merchant registry me rehta hai, affiliate ID aane par yahin paste karo. Monetization = AdSense wale merchants (Blinkit/Zepto/Instamart/BigBasket) exit page ke AdSense se kamate hain, direct hop se jaate hain.</p>
        {msg && <span className={`text-xs font-semibold ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</span>}
      </div>
      <div className="border-t border-slate-100 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-xs font-bold text-slate-900">Existing partnerships (automatic)</h4>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${cov?.linkinr.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
            LinkInR {cov ? `${cov.linkinr.campaigns.length} campaigns` : ''}
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${cov?.ekaro.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>Ekaro {cov?.ekaro.enabled ? 'active' : 'key missing'}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold">Amazon {cov?.amazon.tag || 'off'}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${cov?.cuelinks.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>Cuelinks {cov?.cuelinks.enabled ? `pub ${cov.cuelinks.publisherId}` : 'off'}</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">Ye partners automatic monetized hain. Kisi bhi ek ko change karna ho to Override dabao — uska form upar fill ho jayega, apna template Save karo (manual hamesha automatic ke upar jaata hai).</p>
        <div className="flex items-center gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs" placeholder="Search partner (oyo, makemytrip, flipkart...)" value={covQ} onChange={(e) => setCovQ(e.target.value)} />
          </div>
        </div>
        <div className="mt-2 max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
          {((cov?.linkinr.campaigns || []).filter((c) => !covQ || `${c.name} ${c.domain} ${c.categories}`.toLowerCase().includes(covQ.toLowerCase())) || []).map((c) => (
            <div key={c.domain} className="flex items-center gap-2 px-3 py-1.5">
              <div className="min-w-0 flex-1"><strong className="text-xs text-slate-900">{c.name}</strong> <span className="text-[10px] text-slate-400">{c.domain}</span>
                <p className="text-[10px] text-slate-500">{c.payout} · {c.type} · {c.categories.slice(0, 40)}</p></div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 font-bold">LinkInR</span>
              <button onClick={() => { setForm({ ...blank, slug: c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), company_domain: c.domain, campaign_key: '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-[11px] text-slate-500 hover:text-slate-900 cursor-pointer font-semibold">Override</button>
            </div>
          ))}
          {cov && cov.linkinr.campaigns.length === 0 && <p className="text-[11px] text-slate-400 px-3 py-2">No LinkInR campaigns loaded.</p>}
        </div>
        {!!cov?.capturedLinks.length && (
          <p className="text-[10px] text-slate-400 mt-2">Sync-worker captured templates: {cov.capturedLinks.map((l) => l.domain).join(', ')}</p>
        )}
      </div>
      {rows.length > 0 && (
        <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
          {rows.map((r) => (
            <div key={r.slug} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <strong className="text-xs text-slate-900">{r.display_name || r.slug}</strong>
                  <span className="text-[11px] text-slate-500">{r.company_domain} · {r.network}</span>
                  {(() => {
                    // Owner 27 Oct: badge reflects the affiliate id that ACTUALLY fires —
                    // including automatic layers (Amazon tag, Cuelinks, LinkInR, Ekaro).
                    const src = r.effective_source || ((r.monetization || 'affiliate') === 'adsense' ? 'adsense' : r.template ? 'affiliate_configs' : 'direct');
                    const map: Record<string, { label: string; cls: string }> = {
                      affiliate_configs: { label: 'Affiliate (manual)', cls: 'bg-emerald-50 text-emerald-700' },
                      amazon_associates: { label: 'Amazon tag', cls: 'bg-emerald-50 text-emerald-700' },
                      cuelinks: { label: 'Cuelinks', cls: 'bg-emerald-50 text-emerald-700' },
                      linkinr: { label: 'LinkInR', cls: 'bg-emerald-50 text-emerald-700' },
                      ekaro: { label: 'Ekaro (click)', cls: 'bg-sky-50 text-sky-700' },
                      adsense: { label: 'AdSense', cls: 'bg-amber-50 text-amber-700' },
                      direct: { label: 'ID pending', cls: 'bg-slate-100 text-slate-500' },
                    };
                    const m = map[src] || map.direct;
                    return (
                      <>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${m.cls}`}>{m.label}</span>
                        {r.effective_id_masked ? <span className="text-[9px] font-mono text-slate-400">{r.effective_id_masked}</span> : null}
                      </>
                    );
                  })()}
                </div>
                <p className="text-[10px] font-mono text-slate-400 truncate">
                  {r.template
                    ? r.template.replace(/(pub_id|cid|aff|affid|pid|id|tag)=[^&]+/gi, '$1=••••')
                    : r.affiliate_id
                      ? `id: ${r.affiliate_id}`
                      : (r.effective_label || 'koi affiliate ID nahi — aate hi yahan paste karo')}
                </p>
              </div>
              <button onClick={() => { setForm({ slug: r.slug, company_domain: r.company_domain, network: r.network, template: r.template || '', campaign_key: r.campaign_key || '', affiliate_id: r.affiliate_id || '', monetization: r.monetization || 'affiliate' }); }} className="text-[11px] text-slate-500 cursor-pointer">Edit</button>
              <button onClick={() => void remove(r.slug)} className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
