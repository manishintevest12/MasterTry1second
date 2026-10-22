import React, { useState, useEffect, useCallback } from 'react';
import { Car, Save, CheckCircle2, AlertCircle, Info } from 'lucide-react';

/**
 * Cab App Booking tab (admin, owner request 22 Oct).
 * Uber/Ola rows on the Cab & Ride vertical carry an in-app booking link
 * (/api/cab/book): the server resolves pickup/drop coordinates and opens the
 * provider's own app with the trip prefilled, so the user sees the REAL fare
 * and books directly in the provider app. This tab manages the affiliate
 * attribution end to end — the Uber client_id and extra query params appended
 * to every booking deep link. Everything is stored server-side (app_settings)
 * and injected at click time; nothing is baked into the client.
 */

interface CabDeeplinkConfig {
  uberClientId: string;
  uberExtraParams: string;
  olaExtraParams: string;
  uberEnabled: boolean;
  olaEnabled: boolean;
}

const DEFAULT: CabDeeplinkConfig = {
  uberClientId: '',
  uberExtraParams: 'utm_source=try1second&utm_medium=cab',
  olaExtraParams: 'utm_source=try1second&utm_medium=cab',
  uberEnabled: true,
  olaEnabled: true,
};

export const CabBookLinksTab: React.FC = () => {
  const [cfg, setCfg] = useState<CabDeeplinkConfig>(DEFAULT);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saved, setSaved] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/cab-deeplinks').then((x) => x.json()).catch(() => ({ config: DEFAULT }));
      setCfg({ ...DEFAULT, ...(r.config || {}) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true); setSaved(false); setError('');
    try {
      const res = await fetch('/api/admin/cab-deeplinks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      const data = await res.json();
      if (data.success) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
      else setError(data.error || 'Save failed.');
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-300';

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-rose-50 text-rose-600"><Car className="w-5 h-5" /></div>
        <div>
          <h2 className="text-lg font-black text-slate-900">Cab App Booking</h2>
          <p className="text-xs text-slate-500">Uber/Ola Book buttons open the provider's own app with the trip prefilled — real in-app fare, direct booking, your affiliate params attached.</p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5">
            <label className="block">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Uber Client ID (attribution)</span>
              <input className={`${field} mt-1.5`} value={cfg.uberClientId}
                onChange={(e) => setCfg({ ...cfg, uberClientId: e.target.value })}
                placeholder="e.g. your-uber-client-id" />
              <span className="text-[11px] text-slate-400 block mt-1">Sent as client_id on m.uber.com/looking links. Leave empty to omit — links still work, just unattributed.</span>
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Uber extra params (affiliate)</span>
              <input className={`${field} mt-1.5`} value={cfg.uberExtraParams}
                onChange={(e) => setCfg({ ...cfg, uberExtraParams: e.target.value })}
                placeholder="utm_source=try1second&utm_medium=cab&sub_id=xyz" />
              <span className="text-[11px] text-slate-400 block mt-1">Appended to every Uber booking link. k=v pairs joined by &amp; — malformed pairs are dropped server-side.</span>
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Ola extra params (affiliate)</span>
              <input className={`${field} mt-1.5`} value={cfg.olaExtraParams}
                onChange={(e) => setCfg({ ...cfg, olaExtraParams: e.target.value })}
                placeholder="utm_source=try1second&utm_medium=cab&sub_id=xyz" />
              <span className="text-[11px] text-slate-400 block mt-1">Appended to every book.olacabs.com booking link.</span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              {(['uberEnabled', 'olaEnabled'] as const).map((k) => (
                <label key={k} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 cursor-pointer">
                  <span className="text-sm font-bold text-slate-700">{k === 'uberEnabled' ? 'Uber in-app booking' : 'Ola in-app booking'}</span>
                  <input type="checkbox" className="w-5 h-5 accent-rose-600" checked={cfg[k]}
                    onChange={(e) => setCfg({ ...cfg, [k]: e.target.checked })} />
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button type="button" onClick={save} disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-black flex items-center gap-2 cursor-pointer disabled:opacity-50">
              <Save className="w-4 h-4" />{saving ? 'Saving…' : 'Save settings'}
            </button>
            {saved && <span className="flex items-center gap-1 text-sm font-bold text-emerald-600"><CheckCircle2 className="w-4 h-4" />Saved</span>}
            {error && <span className="flex items-center gap-1 text-sm font-bold text-rose-600"><AlertCircle className="w-4 h-4" />{error}</span>}
          </div>

          <div className="flex items-start gap-2 rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-500">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <p>Every booking click routes through <code className="font-bold">/api/cab/book → /api/out</code> on the server: coordinates are resolved honestly (caller-supplied or cached OpenStreetMap geocoding — never simulated), your params are injected, and the click is tracked. If a location can't be resolved, the user gets an honest notice instead of a broken link.</p>
          </div>
        </>
      )}
    </div>
  );
};
