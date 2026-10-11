import React, { useCallback, useEffect, useState } from 'react';
import { Award, Megaphone, Plus, Trash2, Save, X, RefreshCw, Globe } from 'lucide-react';

/**
 * Admin → Top Picks & Ads (marketing placements).
 * - Top Picks: manually curated sponsored picks per vertical; a pick appears on
 *   the customer site ONLY when added here.
 * - Ads: Google AdSense (client id + slot id) or custom HTML for the feed_top slot.
 */

const VERTICALS = ['flights', 'hotels', 'bus', 'ecommerce', 'grocery', 'food', 'movie', 'loans', 'insurance', 'cab'] as const;

interface TopPick {
  id: number;
  vertical: string;
  partner_name: string;
  partner_code: string | null;
  badge_text: string | null;
  headline: string;
  offer_text: string | null;
  price_badge: string | null;
  perks: string[];
  cta_text: string | null;
  destination_url: string;
  image_url: string | null;
  logo_bg: string | null;
  logo_text: string | null;
  rating: number;
  position: number;
  is_active: number;
}

interface AdSlot {
  id: number;
  slot_key: string;
  provider: string;
  adsense_client: string | null;
  adsense_slot: string | null;
  custom_html: string | null;
  is_active: number;
}

const emptyPick = {
  vertical: 'flights' as string,
  partner_name: '',
  partner_code: '',
  badge_text: 'Sponsored Top Pick',
  headline: '',
  offer_text: '',
  price_badge: '',
  perks: '',
  cta_text: 'View Deal',
  destination_url: '',
  image_url: '',
  logo_bg: 'bg-slate-900',
  logo_text: '',
  rating: 0,
  position: 0,
  is_active: true,
};

const inputCls = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10';
const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1';

export const PlacementsTab: React.FC = () => {
  const [token] = useState(() => localStorage.getItem('t1s_admin_token') || '');
  const [picks, setPicks] = useState<TopPick[]>([]);
  const [slots, setSlots] = useState<AdSlot[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPickForm, setShowPickForm] = useState(false);
  const [form, setForm] = useState({ ...emptyPick });
  const [adForm, setAdForm] = useState({ provider: 'adsense', adsense_client: '', adsense_slot: '', custom_html: '', is_active: true });

  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [p, s] = await Promise.all([
        fetch('/api/admin/top-picks', { headers: authHeaders }).then((r) => r.json()),
        fetch('/api/admin/ad-slots', { headers: authHeaders }).then((r) => r.json()),
      ]);
      setPicks(p.picks || []);
      setSlots(s.slots || []);
    } catch {
      setMessage('Could not load placements — is the backend running?');
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const savePick = async () => {
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/top-picks', {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({
          ...form,
          perks: form.perks.split(',').map((p) => p.trim()).filter(Boolean),
          rating: Number(form.rating) || 0,
          position: Number(form.position) || 0,
        }),
      });
      const data = await res.json();
      if (!data.success) { setMessage(data.error || 'Save failed'); return; }
      setShowPickForm(false);
      setForm({ ...emptyPick });
      setMessage('Top pick saved — it is now live on the customer site.');
      load();
    } catch {
      setMessage('Save failed — network error');
    } finally {
      setBusy(false);
    }
  };

  const removePick = async (id: number) => {
    if (!window.confirm('Delete this top pick?')) return;
    await fetch(`/api/admin/top-picks/${id}`, { method: 'DELETE', headers: authHeaders });
    setMessage('Top pick deleted.');
    load();
  };

  const togglePick = async (p: TopPick) => {
    await fetch('/api/admin/top-picks', {
      method: 'POST', headers: authHeaders,
      body: JSON.stringify({ ...p, is_active: !p.is_active }),
    });
    load();
  };

  const saveAd = async () => {
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/ad-slots', {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ slot_key: 'feed_top', ...adForm }),
      });
      const data = await res.json();
      if (!data.success) { setMessage(data.error || 'Save failed'); return; }
      setMessage('Ad slot saved — it appears above the first search result when active.');
      load();
    } catch {
      setMessage('Save failed — network error');
    } finally {
      setBusy(false);
    }
  };

  const currentAd = slots.find((s) => s.slot_key === 'feed_top');

  return (
    <div className="space-y-8">
      {/* ===== TOP PICKS ===== */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">Top Picks (Sponsored Sidebar)</h3>
            <span className="text-[10px] text-slate-400 font-semibold">{picks.length} configured</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" title="Refresh">
              <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => { setForm({ ...emptyPick }); setShowPickForm(true); setMessage(''); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
            >
              <Plus className="w-3.5 h-3.5" /> Add Top Pick
            </button>
          </div>
        </div>

        {showPickForm && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-start justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl p-6 w-full max-w-2xl space-y-4 my-8">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-slate-900">New Top Pick</h4>
                <button onClick={() => setShowPickForm(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Vertical *</label>
                  <select value={form.vertical} onChange={(e) => setForm({ ...form, vertical: e.target.value })} className={inputCls}>
                    {VERTICALS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Partner Name *</label>
                  <input value={form.partner_name} onChange={(e) => setForm({ ...form, partner_name: e.target.value })} className={inputCls} placeholder="e.g. MakeMyTrip" />
                </div>
              </div>

              <div>
                <label className={labelCls}>Headline *</label>
                <input value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} className={inputCls} placeholder="e.g. Flat ₹2,500 Off International Flights" />
              </div>

              <div>
                <label className={labelCls}>Offer Text</label>
                <input value={form.offer_text} onChange={(e) => setForm({ ...form, offer_text: e.target.value })} className={inputCls} placeholder="Short offer description" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Price Badge</label>
                  <input value={form.price_badge} onChange={(e) => setForm({ ...form, price_badge: e.target.value })} className={inputCls} placeholder="From ₹2,899" />
                </div>
                <div>
                  <label className={labelCls}>Rating (0 = hide)</label>
                  <input type="number" step="0.1" min="0" max="5" value={form.rating} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Position (low = first)</label>
                  <input type="number" value={form.position} onChange={(e) => setForm({ ...form, position: Number(e.target.value) })} className={inputCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Perks (comma separated, max 3 shown)</label>
                <input value={form.perks} onChange={(e) => setForm({ ...form, perks: e.target.value })} className={inputCls} placeholder="Free cancellation, Zero convenience fee" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Destination URL *</label>
                  <input value={form.destination_url} onChange={(e) => setForm({ ...form, destination_url: e.target.value })} className={inputCls} placeholder="https://..." />
                </div>
                <div>
                  <label className={labelCls}>CTA Text</label>
                  <input value={form.cta_text} onChange={(e) => setForm({ ...form, cta_text: e.target.value })} className={inputCls} placeholder="View Deal" />
                </div>
                <div>
                  <label className={labelCls}>Badge Text</label>
                  <input value={form.badge_text} onChange={(e) => setForm({ ...form, badge_text: e.target.value })} className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Image URL (optional)</label>
                  <input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} className={inputCls} placeholder="https://..." />
                </div>
                <div>
                  <label className={labelCls}>Logo Text</label>
                  <input value={form.logo_text} onChange={(e) => setForm({ ...form, logo_text: e.target.value })} className={inputCls} placeholder="MMT" />
                </div>
                <div>
                  <label className={labelCls}>Logo BG class</label>
                  <input value={form.logo_bg} onChange={(e) => setForm({ ...form, logo_bg: e.target.value })} className={inputCls} placeholder="bg-slate-900" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} id="pick-active" />
                <label htmlFor="pick-active" className="text-xs text-slate-600">Active (visible on customer site)</label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button onClick={() => setShowPickForm(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600">Cancel</button>
                <button onClick={savePick} disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-50">
                  <Save className="w-3.5 h-3.5" /> Save Top Pick
                </button>
              </div>
            </div>
          </div>
        )}

        {picks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <p className="text-xs text-slate-500">No top picks configured. Add one and it appears instantly in the matching vertical's sidebar.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {picks.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-slate-400">{p.vertical}</span>
                    <span className="text-xs font-bold text-slate-900 truncate">{p.partner_name}</span>
                    {!p.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-bold">INACTIVE</span>}
                  </div>
                  <p className="text-xs text-slate-500 truncate">{p.headline}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => togglePick(p)} className="text-[10px] font-bold px-2 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
                    {p.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => removePick(p.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ===== ADS ===== */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Megaphone className="w-4 h-4 text-orange-500" />
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">Ad Slot — Above First Search Result</h3>
          <span className="text-[10px] text-slate-400 font-semibold">{currentAd ? `configured (${currentAd.provider})` : 'not configured'}</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <input type="radio" checked={adForm.provider === 'adsense'} onChange={() => setAdForm({ ...adForm, provider: 'adsense' })} />
              Google AdSense
            </label>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <input type="radio" checked={adForm.provider === 'custom_html'} onChange={() => setAdForm({ ...adForm, provider: 'custom_html' })} />
              Custom HTML
            </label>
          </div>

          {adForm.provider === 'adsense' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>AdSense Publisher ID (ca-pub-…)</label>
                <input value={adForm.adsense_client} onChange={(e) => setAdForm({ ...adForm, adsense_client: e.target.value })} className={inputCls} placeholder="ca-pub-1234567890123456" />
              </div>
              <div>
                <label className={labelCls}>Ad Unit Slot ID (numeric)</label>
                <input value={adForm.adsense_slot} onChange={(e) => setAdForm({ ...adForm, adsense_slot: e.target.value })} className={inputCls} placeholder="1234567890" />
              </div>
            </div>
          ) : (
            <div>
              <label className={labelCls}>Custom HTML (shown above the first result)</label>
              <textarea value={adForm.custom_html} onChange={(e) => setAdForm({ ...adForm, custom_html: e.target.value })} rows={5} className={inputCls + ' font-mono'} placeholder="<div>Your ad HTML</div>" />
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={adForm.is_active} onChange={(e) => setAdForm({ ...adForm, is_active: e.target.checked })} id="ad-active" />
              <label htmlFor="ad-active" className="text-xs text-slate-600">Active</label>
            </div>
            <button onClick={saveAd} disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-50">
              <Globe className="w-3.5 h-3.5" /> Save Ad Slot
            </button>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            No special API needed for AdSense — just an approved Google AdSense account. Copy the publisher id (ca-pub-…)
            from AdSense → Account → Settings → Account information, and the ad unit's numeric slot id.
            The site loads Google's adsbygoogle.js automatically once configured.
          </p>
        </div>
      </section>

      {message && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700">{message}</div>
      )}
    </div>
  );
};
