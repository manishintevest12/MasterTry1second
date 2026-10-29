import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ImageIcon, Plus, Trash2, ToggleLeft, ToggleRight, ArrowUp, ArrowDown, ExternalLink,
  Pencil, Copy, X, ChevronRight, Play, Activity, CheckCircle2, AlertTriangle, LayoutGrid, Save,
} from 'lucide-react';

/**
 * HomeBannersTab — the end-to-end banner control room.
 *
 * OWNER 23-24 Oct: dynamic strips between home sections, and pools for the Rewards and
 * Quick Apps sections (section column in MySQL `home_banners`).
 * OWNER 29 OCT ("ye sab banner manage karne ke liye admin mai end to end system banao"):
 *   - one place that shows HOW MANY banners each pool has, how many are live, and where they show
 *   - cadence per pool (insert a strip after every N results) saved to app_settings via
 *     /api/admin/home-banners/slots — server-owned, so web + the Android app agree and the
 *     number can be retuned without a release
 *   - real editing (not delete-and-re-add): image, link, title, subtitle, gradient, pool, order
 *   - duplicate into another pool, activate/pause a whole pool at once
 *   - image health check (a dead URL renders a blank card, so it must be visible here first)
 *   - a live preview that mirrors the actual strip on the site
 */

type Banner = {
  id: number;
  imageUrl: string;
  link: string;
  title: string | null;
  subtitle: string | null;
  section: string;
  isActive: boolean;
  position: number;
  gradientStart: string | null;
  gradientEnd: string | null;
};

type Slot = { section: string; label: string; where: string; everyN: number; fallbackToHome: boolean; enabled: boolean };

const SECTIONS: { id: string; label: string; where: string }[] = [
  { id: 'home', label: 'Home', where: 'Wide strip between home sections' },
  { id: 'quickapps', label: 'Quick Apps', where: 'Results grid — after every N apps' },
  { id: 'rewards', label: 'Rewards', where: 'Top picks, coupons and offers lists — after every N results' },
];

const VERTICALS = [
  'movies', 'flights', 'hotels', 'bus', 'cab', 'ecommerce', 'grocery', 'food',
  'loans', 'insurance', 'creditcards',
];

const GRADIENT_PRESETS: { label: string; start: string; end: string }[] = [
  { label: 'Default (per-vertical)', start: '', end: '' },
  { label: 'Brand red → orange', start: '#E11D48', end: '#FF6600' },
  { label: 'Movie rose-red', start: '#E11D48', end: '#9F1239' },
  { label: 'Food orange', start: '#F97316', end: '#C2410C' },
  { label: 'Emerald green', start: '#10B981', end: '#065F46' },
];

const STRIP_GRADIENTS: Record<string, [string, string]> = {
  movies: ['#E11D48', '#9F1239'],
  food: ['#F97316', '#C2410C'],
  ecommerce: ['#E11D48', '#FF6600'],
  grocery: ['#10B981', '#065F46'],
};
const BADGE: Record<string, string> = { movies: 'MOVIE PICK', food: 'FOOD PICK', ecommerce: 'MEGA DEAL', grocery: 'GROCERY DEAL' };
const CTA: Record<string, string> = { movies: 'Book Now', food: 'Order Now', ecommerce: 'Grab Deal', grocery: 'Order Now' };

const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-red-500/40';

export const HomeBannersTab: React.FC = () => {
  const [token] = useState(() => localStorage.getItem('t1s_admin_token') || '');
  const headers = useMemo(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }), [token]);

  const [rows, setRows] = useState<Banner[]>([]);
  const [slots, setSlots] = useState<Record<string, Slot>>({});
  const [inventory, setInventory] = useState<Record<string, { total: number; active: number }>>({});
  const [tab, setTab] = useState('home');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [health, setHealth] = useState<Record<number, { ok: boolean; reason?: string }>>({});
  const [healthBusy, setHealthBusy] = useState(false);

  // form (id = 0 → create, otherwise edit that banner)
  const [editId, setEditId] = useState(0);
  const [imageUrl, setImageUrl] = useState('');
  const [linkMode, setLinkMode] = useState<'vertical' | 'url'>('vertical');
  const [link, setLink] = useState('movies');
  const [section, setSection] = useState('home');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [gradientIdx, setGradientIdx] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bannerRes, slotRes] = await Promise.all([
        fetch('/api/admin/home-banners', { headers }),
        fetch('/api/admin/home-banners/slots', { headers }),
      ]);
      const bannerData = await bannerRes.json();
      if (!bannerRes.ok || !bannerData.success) throw new Error(bannerData.error || 'Could not load banners');
      setRows(bannerData.banners || []);
      const slotData = slotRes.ok ? await slotRes.json() : null;
      if (slotData?.success) {
        setSlots(slotData.slots || {});
        setInventory(Object.fromEntries((slotData.inventory || []).map((i: any) => [i.section, { total: i.total, active: i.active }])));
      }
    } catch (e: unknown) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not load banners' });
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => { void load(); }, [load]);

  const resetForm = () => {
    setEditId(0); setImageUrl(''); setLink('movies'); setLinkMode('vertical');
    setTitle(''); setSubtitle(''); setSection(tab); setGradientIdx(0); setIsActive(true);
  };

  const startEdit = (b: Banner) => {
    setEditId(b.id);
    setImageUrl(b.imageUrl);
    const isUrl = /^https?:\/\//.test(b.link);
    setLinkMode(isUrl ? 'url' : 'vertical');
    setLink(b.link);
    setSection(b.section);
    setTitle(b.title || '');
    setSubtitle(b.subtitle || '');
    const gi = GRADIENT_PRESETS.findIndex((g) => g.start && g.start === (b.gradientStart || ''));
    setGradientIdx(gi >= 0 ? gi : 0);
    setIsActive(b.isActive);
    setMsg(null);
    formRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const pickFile = () => fileRef.current?.click();
  const onFile = async (f: File | null) => {
    if (!f) return;
    setBusy(true); setMsg(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(f);
      });
      const res = await fetch('/api/admin/merchant-logos', { method: 'POST', headers, body: JSON.stringify({ name: `banner-${Date.now()}`, logo: dataUrl }) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Upload failed');
      setImageUrl(data.url || '');
      setMsg({ ok: true, text: 'Image uploaded — set the link and save.' });
    } catch (e: unknown) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Upload failed' });
    } finally { setBusy(false); }
  };

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const g = GRADIENT_PRESETS[gradientIdx];
      const res = await fetch('/api/admin/home-banners', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: editId || undefined,
          imageUrl: imageUrl.trim(),
          link: link.trim(),
          title: title.trim() || null,
          subtitle: subtitle.trim() || null,
          section,
          isActive,
          position: editId ? (rows.find((r) => r.id === editId)?.position ?? rows.length) : rows.filter((r) => r.section === section).length,
          gradientStart: g.start || null,
          gradientEnd: g.end || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not save banner');
      setMsg({ ok: true, text: editId ? 'Banner updated — live on web + app instantly.' : 'Banner added — live on web + app instantly.' });
      resetForm();
      await load();
    } catch (e: unknown) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not save banner' });
    } finally { setBusy(false); }
  };

  const patchBanner = async (b: Banner, over: Partial<Banner>) => {
    const next = { ...b, ...over };
    await fetch('/api/admin/home-banners', {
      method: 'POST', headers,
      body: JSON.stringify({
        id: next.id, imageUrl: next.imageUrl, link: next.link, title: next.title, subtitle: next.subtitle,
        section: next.section, isActive: next.isActive, position: next.position,
        gradientStart: next.gradientStart, gradientEnd: next.gradientEnd,
      }),
    });
    await load();
  };

  const move = async (b: Banner, delta: number) => patchBanner(b, { position: Math.max(0, b.position + delta) });

  const duplicate = async (b: Banner, targetSection: string) => {
    setBusy(true);
    try {
      await fetch(`/api/admin/home-banners/${b.id}/duplicate`, { method: 'POST', headers, body: JSON.stringify({ section: targetSection }) });
      setMsg({ ok: true, text: `Copied into ${targetSection}.` });
      await load();
    } finally { setBusy(false); }
  };

  const remove = async (b: Banner) => {
    setBusy(true);
    try {
      await fetch(`/api/admin/home-banners/${b.id}`, { method: 'DELETE', headers });
      if (editId === b.id) resetForm();
      await load();
    } finally { setBusy(false); }
  };

  const pauseAll = async (sectionId: string, active: boolean) => {
    setBusy(true);
    try {
      for (const b of rows.filter((r) => r.section === sectionId && r.isActive !== active)) {
        await patchBanner(b, { isActive: active });
      }
      setMsg({ ok: true, text: active ? 'Section resumed.' : 'Section paused — the strip hides everywhere.' });
    } finally { setBusy(false); }
  };

  const saveSlot = async (sectionId: string, patch: Partial<Slot>) => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/home-banners/slots', {
        method: 'POST', headers, body: JSON.stringify({ slots: { [sectionId]: patch } }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not save placement');
      setSlots(data.slots || {});
      setMsg({ ok: true, text: 'Placement saved — web + app pick it up on their next load.' });
    } catch (e: unknown) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not save placement' });
    } finally { setBusy(false); }
  };

  const checkHealth = async () => {
    setHealthBusy(true);
    try {
      const res = await fetch('/api/admin/home-banners/health', { headers });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Health check failed');
      setHealth(Object.fromEntries((data.results || []).map((r: any) => [r.id, { ok: r.ok, reason: r.reason }])));
      setMsg({ ok: true, text: data.broken ? `${data.broken} banner image(s) need attention.` : 'All banner images load correctly.' });
    } catch (e: unknown) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Health check failed' });
    } finally { setHealthBusy(false); }
  };

  const shown = rows.filter((r) => r.section === tab);
  const slot = slots[tab];
  const previewGrad = useMemo<[string, string]>(() => {
    const g = GRADIENT_PRESETS[gradientIdx];
    if (g.start && g.end) return [g.start, g.end];
    return STRIP_GRADIENTS[link] || ['#DC2626', '#7F1D1D'];
  }, [gradientIdx, link]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-red-600" /> Banners — end to end
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Every banner pool in one place: what is live, where it shows, and after how many results it repeats.
          Link to a vertical id ({VERTICALS.join(', ')}) or a full https URL. Changes go live on web and the Android app
          on the next load — no release needed.
        </p>
      </div>

      {/* ---- Pools: inventory + cadence ---- */}
      <div className="grid gap-3 md:grid-cols-3">
        {SECTIONS.map((s) => {
          const inv = inventory[s.id] || { total: 0, active: 0 };
          const cfg = slots[s.id];
          return (
            <div key={s.id} className={`rounded-2xl border p-4 bg-white ${tab === s.id ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'}`}>
              <button type="button" onClick={() => { setTab(s.id); setSection(s.id); }} className="w-full text-left cursor-pointer">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-slate-900 flex items-center gap-1.5"><LayoutGrid className="w-4 h-4 text-red-600" /> {s.label}</p>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{inv.active}/{inv.total} live</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">{s.where}</p>
              </button>
              <div className="mt-3 flex items-center gap-2">
                <label className="text-[10px] font-black uppercase text-slate-500">Every</label>
                <input
                  type="number" min={0} max={60}
                  value={cfg?.everyN ?? (s.id === 'home' ? 0 : 12)}
                  onChange={(e) => void saveSlot(s.id, { everyN: Number(e.target.value) })}
                  className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-xs text-center"
                  aria-label={`${s.label} banner cadence`}
                />
                <span className="text-[10px] text-slate-500">{s.id === 'home' ? '(0 = page decides)' : 'results'}</span>
                <button
                  type="button"
                  onClick={() => void saveSlot(s.id, { enabled: !(cfg?.enabled !== false) })}
                  className="ml-auto cursor-pointer"
                  title={cfg?.enabled !== false ? 'Pause this pool' : 'Resume this pool'}
                >
                  {cfg?.enabled !== false ? <ToggleRight className="w-5 h-5 text-emerald-600" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                </button>
              </div>
              {s.id !== 'home' && (
                <label className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cfg?.fallbackToHome !== false}
                    onChange={(e) => void saveSlot(s.id, { fallbackToHome: e.target.checked })}
                    className="accent-red-600"
                  />
                  Borrow homepage banners when this pool is empty
                </label>
              )}
            </div>
          );
        })}
      </div>

      {/* ---- Add / edit form with live preview ---- */}
      <div ref={formRef} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-black text-slate-900">{editId ? `Editing banner #${editId}` : 'Add a banner'}</p>
          {editId > 0 && (
            <button type="button" onClick={resetForm} className="text-[11px] font-black text-slate-500 hover:text-slate-900 flex items-center gap-1 cursor-pointer">
              <X className="w-3.5 h-3.5" /> Cancel edit
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-[11px] font-black uppercase text-slate-500">Banner image (wide/landscape)</label>
            <div className="flex gap-2 mt-1">
              <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…/banner.jpg" className={inputCls} />
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0] || null)} />
              <button type="button" onClick={pickFile} disabled={busy} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-black cursor-pointer disabled:opacity-50">Upload</button>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-black uppercase text-slate-500">Pool (where it shows)</label>
            <select value={section} onChange={(e) => setSection(e.target.value)} className={inputCls + ' mt-1'}>
              {SECTIONS.map((s) => <option key={s.id} value={s.id}>{s.label} — {s.where}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-black uppercase text-slate-500">Link target</label>
            <div className="flex gap-2 mt-1">
              <select value={linkMode} onChange={(e) => { const m = e.target.value as 'vertical' | 'url'; setLinkMode(m); setLink(m === 'vertical' ? 'movies' : ''); }} className="px-2 py-2 border border-slate-200 rounded-lg text-xs">
                <option value="vertical">Vertical</option>
                <option value="url">https URL</option>
              </select>
              {linkMode === 'vertical' ? (
                <select value={link} onChange={(e) => setLink(e.target.value)} className={inputCls}>
                  {VERTICALS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              ) : (
                <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" className={inputCls} />
              )}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-black uppercase text-slate-500">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Love Story" className={inputCls + ' mt-1'} />
          </div>

          <div>
            <label className="text-[11px] font-black uppercase text-slate-500">Sub-text</label>
            <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Drama/Romantic · 4K+ Likes" className={inputCls + ' mt-1'} />
          </div>

          <div>
            <label className="text-[11px] font-black uppercase text-slate-500">Colour</label>
            <select value={gradientIdx} onChange={(e) => setGradientIdx(Number(e.target.value))} className={inputCls + ' mt-1'}>
              {GRADIENT_PRESETS.map((g, i) => <option key={g.label} value={i}>{g.label}</option>)}
            </select>
          </div>

          <div className="flex items-end">
            <button type="button" onClick={() => setIsActive((v) => !v)} className="flex items-center gap-2 text-xs font-black text-slate-700 cursor-pointer">
              {isActive ? <ToggleRight className="w-5 h-5 text-emerald-600" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
              {isActive ? 'Live' : 'Paused'}
            </button>
          </div>
        </div>

        {/* Live preview — mirrors the real strip so the owner sees exactly what ships. */}
        <div>
          <p className="text-[11px] font-black uppercase text-slate-500 mb-1">Preview (same strip as the site)</p>
          <div className="rounded-2xl overflow-hidden shadow-md" style={{ background: `linear-gradient(120deg, ${previewGrad[0]} 0%, ${previewGrad[1]} 100%)` }}>
            <div className="flex items-center gap-3 sm:gap-5 px-3 py-3 sm:px-6 sm:py-4">
              {imageUrl
                ? <img src={imageUrl} alt="preview" className="shrink-0 w-[96px] h-[72px] sm:w-[150px] sm:h-[100px] object-cover rounded-xl" />
                : <div className="shrink-0 w-[96px] h-[72px] sm:w-[150px] sm:h-[100px] rounded-xl bg-white/15 flex items-center justify-center text-white/70"><ImageIcon className="w-6 h-6" /></div>}
              <div className="min-w-0 flex-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/25 text-[9px] sm:text-[10px] font-black tracking-wider text-white">
                  <Play className="w-2.5 h-2.5 text-red-500 fill-red-500" /> {BADGE[link] || 'TOP PICK'}
                </span>
                <div className="mt-1.5 truncate text-white font-extrabold text-[13px] sm:text-lg">{title || 'Love Story Abhimanyu Ki'}</div>
                <div className="mt-0.5 truncate text-slate-300 text-[10.5px] sm:text-sm">{subtitle || 'Drama/Romantic · 4K+ Likes'}</div>
              </div>
              <span className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-red-600 text-white text-[11px] sm:text-sm font-bold">
                {CTA[link] || 'Open'} <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="button" onClick={() => void save()} disabled={busy || !imageUrl || !link} className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
            {editId ? <><Save className="w-4 h-4" /> Update banner</> : <><Plus className="w-4 h-4" /> Add banner</>}
          </button>
          {msg && <p className={`text-xs font-bold ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</p>}
        </div>
      </div>

      {/* ---- Inventory for the selected pool ---- */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-black text-slate-900">
            {SECTIONS.find((s) => s.id === tab)?.label} pool · {shown.length} banner{shown.length === 1 ? '' : 's'}
            {slot?.enabled === false && <span className="ml-2 text-[10px] font-black text-amber-600 uppercase">paused</span>}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => void pauseAll(tab, true)} disabled={busy} className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-black cursor-pointer disabled:opacity-50">Resume all</button>
            <button type="button" onClick={() => void pauseAll(tab, false)} disabled={busy} className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-black cursor-pointer disabled:opacity-50">Pause all</button>
            <button type="button" onClick={() => void checkHealth()} disabled={healthBusy} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
              <Activity className="w-3.5 h-3.5" /> {healthBusy ? 'Checking…' : 'Check images'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
        ) : shown.length === 0 ? (
          <p className="text-xs text-slate-500">
            No banners in this pool yet — add one above.
            {tab !== 'home' && slots[tab]?.fallbackToHome !== false && ' Until then this section borrows the homepage banners.'}
          </p>
        ) : (
          <div className="space-y-3">
            {shown.map((b) => {
              const h = health[b.id];
              return (
                <div key={b.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center gap-4">
                  <img src={b.imageUrl} alt={b.title || 'banner'} className="h-14 w-32 rounded-lg object-cover border border-slate-100 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-slate-900 truncate">{b.title || 'Untitled banner'}</p>
                    {b.subtitle && <p className="text-[11px] text-slate-500 truncate">{b.subtitle}</p>}
                    <p className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                      <ExternalLink className="w-3 h-3" /> {b.link}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {b.isActive
                        ? <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">live</span>
                        : <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">paused</span>}
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">pos {b.position}</span>
                      {h && (h.ok
                        ? <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" /> image ok</span>
                        : <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 flex items-center gap-0.5" title={h.reason}><AlertTriangle className="w-2.5 h-2.5" /> {h.reason || 'broken'}</span>)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button type="button" onClick={() => startEdit(b)} className="p-2 rounded-lg hover:bg-slate-100 cursor-pointer" title="Edit"><Pencil className="w-4 h-4 text-slate-600" /></button>
                    <button type="button" onClick={() => void move(b, -1)} className="p-2 rounded-lg hover:bg-slate-100 cursor-pointer" title="Move up"><ArrowUp className="w-4 h-4 text-slate-500" /></button>
                    <button type="button" onClick={() => void move(b, 1)} className="p-2 rounded-lg hover:bg-slate-100 cursor-pointer" title="Move down"><ArrowDown className="w-4 h-4 text-slate-500" /></button>
                    <select
                      onChange={(e) => { if (e.target.value) void duplicate(b, e.target.value); e.currentTarget.value = ''; }}
                      className="px-2 py-1.5 border border-slate-200 rounded-lg text-[11px] font-black text-slate-600 cursor-pointer"
                      title="Copy into another pool"
                      defaultValue=""
                    >
                      <option value="">Copy to…</option>
                      {SECTIONS.filter((s) => s.id !== b.section).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                    <button type="button" onClick={() => void patchBanner(b, { isActive: !b.isActive })} className="p-2 rounded-lg hover:bg-slate-100 cursor-pointer" title={b.isActive ? 'Pause' : 'Make live'}>
                      {b.isActive ? <ToggleRight className="w-5 h-5 text-emerald-600" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                    </button>
                    <button type="button" onClick={() => void remove(b)} className="p-2 rounded-lg hover:bg-red-50 cursor-pointer" title="Delete"><Trash2 className="w-4 h-4 text-red-600" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
