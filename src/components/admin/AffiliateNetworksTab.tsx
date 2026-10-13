import React, { useState, useEffect, useCallback } from 'react';
import {
  Link2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  KeyRound,
  ExternalLink,
  Info,
} from 'lucide-react';

/**
 * Affiliate Networks tab (admin).
 * Shows the server-side state of each affiliate network (VCommission, Cuelinks,
 * Admitad, Optimise, direct merchants) as reported by GET /api/v1/providers,
 * plus a manual sync trigger (POST /api/v1/sync) and the live offer count.
 *
 * API keys NEVER pass through this page or the database: they are read from
 * environment variables on the server (hPanel → Node.js app → Env Vars), per
 * the platform's secret-handling rule. This tab only reports configured status.
 */

interface ProviderInfo {
  id: string;
  label: string;
  configured: boolean;
}

interface SyncOutcome {
  provider?: string;
  status?: string;
  offers?: number;
  error?: string;
}

export const AffiliateNetworksTab: React.FC = () => {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [offerCount, setOfferCount] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncOutcomes, setSyncOutcomes] = useState<SyncOutcome[] | null>(null);
  const [syncError, setSyncError] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pr, of] = await Promise.all([
        fetch('/api/v1/providers').then((r) => r.json()).catch(() => ({ providers: [] })),
        fetch('/api/v1/offers?limit=1').then((r) => r.json()).catch(() => ({ count: null })),
      ]);
      setProviders(pr.providers || []);
      setOfferCount(typeof of.count === 'number' ? of.count : null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncError('');
    setSyncOutcomes(null);
    try {
      const res = await fetch('/api/v1/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSyncOutcomes(data.outcomes || []);
        await load();
      } else {
        setSyncError(data.error || 'Sync failed.');
      }
    } catch (e: any) {
      setSyncError(String(e?.message || e));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-orange-600" />
            Affiliate Networks
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Server-side status of every connected affiliate network feeding the offers, coupons and card sections.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-right shadow-xs">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Live offers stored</span>
            <span className="text-base font-black text-slate-900 font-mono">{offerCount ?? '—'}</span>
          </div>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-bold cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync all networks now'}
          </button>
        </div>
      </div>

      {/* Keys explainer */}
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900 font-medium flex items-start gap-2.5">
        <KeyRound className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Network API keys (VCOMMISSION_API_KEY, CUELINKS_API_KEY, ADMITAD_CLIENT_ID/SECRET, OPTIMISE_API_KEY) are set as
          environment variables on the server — hPanel → Node.js app → Env Vars. Keys never enter this admin UI or the
          database. After changing an env var, restart the Node app, then sync here.
        </span>
      </div>

      {/* Providers */}
      {loading && <p className="text-sm text-slate-500">Loading network status…</p>}

      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {providers.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{p.label}</p>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">{p.id}</p>
                <p className="text-[11px] mt-1.5 leading-snug">
                  {p.configured ? (
                    <span className="text-emerald-700 font-semibold">API key detected on server</span>
                  ) : (
                    <span className="text-slate-500">Not configured — set its env vars on the server to enable it.</span>
                  )}
                </p>
              </div>
              {p.configured ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-slate-300 shrink-0" />
              )}
            </div>
          ))}
          {providers.length === 0 && (
            <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs">
              <Info className="w-6 h-6 text-slate-400 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No affiliate providers registered on the server right now.</p>
            </div>
          )}
        </div>
      )}

      {/* Sync results */}
      {syncOutcomes && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900">Last sync results</h3>
          {syncOutcomes.length === 0 && <p className="text-xs text-slate-500">No provider outcomes returned.</p>}
          {syncOutcomes.map((o, i) => (
            <div key={i} className="flex items-start justify-between gap-3 text-xs border-t border-slate-100 pt-2.5 first:border-0 first:pt-0">
              <span className="font-bold text-slate-800">{o.provider || 'provider'}</span>
              <span className={o.error ? 'text-red-600 font-mono' : 'text-slate-600 font-mono text-right'}>
                {o.error ? String(o.error).slice(0, 120) : `${o.status || 'ok'} · ${o.offers ?? 0} offers`}
              </span>
            </div>
          ))}
        </div>
      )}
      {syncError && (
        <p className="text-xs text-red-600 font-semibold">Sync failed: {syncError}</p>
      )}

      <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
        <ExternalLink className="w-3 h-3" />
        Offers fetched here power the Offers Hub, Coupons and Cards sections — nothing is listed without a network-verified source.
      </p>
    </div>
  );
};
