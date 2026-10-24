import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Link2 } from 'lucide-react';

/**
 * REAL integration status (owner 24 Oct): what is actually configured right
 * now — from /api/admin/integrations. The mock "API integrations" cards with
 * invented test results are gone.
 */
const card = 'bg-white rounded-2xl border border-slate-200 shadow-xs';

interface Integration {
  key: string; label: string;
  ok: boolean;
  detail: string;
}

export const IntegrationsTab: React.FC = () => {
  const [token] = useState(() => localStorage.getItem('t1s_admin_token') || '');
  const [rows, setRows] = useState<Integration[]>([]);
  const [links, setLinks] = useState<{ network_source: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/integrations', { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (!d.success) return;
      const i = d.integrations || {};
      setRows([
        { key: 'mysql', label: 'MySQL Database', ok: i.mysql?.status === 'mysql', detail: i.mysql?.status === 'mysql' ? 'Connected (production DB)' : 'File fallback — DB env/privileges missing' },
        { key: 'linkinr', label: 'LinkInR (INR Deals)', ok: Boolean(i.linkinr?.enabled), detail: i.linkinr ? `${i.linkinr.campaigns} campaigns loaded` : 'not loaded' },
        { key: 'cuelinks', label: 'Cuelinks', ok: Boolean(i.cuelinks?.enabled), detail: i.cuelinks?.enabled ? `pub ${i.cuelinks.publisherId} · cid ${i.cuelinks.cid}${i.cuelinks.apiKeyConfigured ? ' · API key set' : ' · API key missing'}` : 'not configured' },
        { key: 'amazon', label: 'Amazon Associates', ok: Boolean(i.amazonAssociates?.tag), detail: i.amazonAssociates?.tag ? `tag: ${i.amazonAssociates.tag}` : 'tag missing' },
        { key: 'ekaro', label: 'Ekaro (EarnKaro converter)', ok: Boolean(i.ekaro?.apiKeyConfigured), detail: i.ekaro?.apiKeyConfigured ? 'API key configured' : 'EKARO_API_KEY missing — grocery exits go direct' },
        { key: 'admitad', label: 'Admitad', ok: Boolean(i.admitad?.credentialsConfigured), detail: i.admitad?.credentialsConfigured ? 'credentials set' : 'credentials missing' },
        { key: 'vcommission', label: 'VCommission', ok: Boolean(i.vcommission?.credentialsConfigured), detail: i.vcommission?.credentialsConfigured ? 'credentials set' : 'VCOMMISSION_API_KEY missing' },
      ]);
      setLinks(i.syncedAffiliateLinks || []);
    } catch { /* keep */ }
    setLoading(false);
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className={`${card} p-4`}>
        <h3 className="text-base font-bold text-slate-900">Integrations — Live Status</h3>
        <p className="text-xs text-slate-500">
          Ye cards LIVE configuration hai — jo configured hai wahi dikhega. Koi fake ping/response number nahi.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rows.map((r) => (
          <div key={r.key} className={`${card} p-4 flex items-center justify-between gap-3`}>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900">{r.label}</div>
              <div className="text-[11px] text-slate-500 truncate">{r.detail}</div>
            </div>
            {r.ok
              ? <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold"><CheckCircle2 className="w-3.5 h-3.5" /> LIVE</span>
              : <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 border border-slate-200 text-[10px] font-bold"><XCircle className="w-3.5 h-3.5" /> NOT SET</span>}
          </div>
        ))}
      </div>
      <div className={`${card} p-4`}>
        <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5"><Link2 className="w-4 h-4 text-slate-400" /> Synced affiliate_links (MySQL)</h4>
        {links.length ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {links.map((l) => (
              <div key={l.network_source} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[10px] uppercase font-bold text-slate-400">{l.network_source}</div>
                <div className="text-base font-bold font-mono text-slate-900">{Number(l.count).toLocaleString('en-IN')}</div>
              </div>
            ))}
          </div>
        ) : <p className="text-xs text-slate-400">affiliate_links table khali hai — network sync chalane par yahan offers aayenge.</p>}
      </div>
      {loading && <p className="text-xs text-slate-400">Loading live status…</p>}
    </div>
  );
};
