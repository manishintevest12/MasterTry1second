import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ImageIcon, Plus, Trash2, ToggleLeft, ToggleRight, ArrowUp, ArrowDown, ExternalLink } from 'lucide-react';

/**
 * HomeBannersTab (owner 23 Oct): admin control for the dynamic banner strips
 * rendered between EVERY home section on web + Flutter app. Wide landscape
 * format (length zyda, breadth kam). Each banner links either to a site
 * vertical (e.g. 'movies') or an external https URL. Seeded with the owner's
 * Jailer movie banner → Movies vertical.
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
};

export const HomeBannersTab: React.FC = () => {
  const [token] = useState(() => localStorage.getItem('t1s_admin_token') || '');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const [rows, setRows] = useState<Banner[]>([]);
  const [imageUrl, setImageUrl] = useState('');
  const [link, setLink] = useState('movies');
  const [section, setSection] = useState('home');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/home-banners', { headers });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not load banners');
      setRows(data.banners || []);
    } catch (e: unknown) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not load banners' });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  // Upload a banner image through the merchant-logo registry (same stable
  // public URL flow the admin already uses for logos).
  const pickFile = () => fileRef.current?.click();
  const onFile = async (f: File | null) => {
    if (!f) return;
    setBusy(true);
    setMsg(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(f);
      });
      const res = await fetch('/api/admin/merchant-logos', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: `banner-${Date.now()}`, logo: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Upload failed');
      setImageUrl(data.url || '');
      setMsg({ ok: true, text: 'Image uploaded — now fill the link and save.' });
    } catch (e: unknown) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Upload failed' });
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/home-banners', {
        method: 'POST',
        headers,
        body: JSON.stringify({ imageUrl: imageUrl.trim(), link: link.trim(), title: title.trim() || null, section, position: rows.length }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not save banner');
      setImageUrl('');
      setLink('movies');
      setTitle('');
      setSection('home');
      setMsg({ ok: true, text: 'Banner saved — live on web + app instantly.' });
      await load();
    } catch (e: unknown) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not save banner' });
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (b: Banner) => {
    await fetch('/api/admin/home-banners', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: b.id, imageUrl: b.imageUrl, link: b.link, title: b.title, subtitle: b.subtitle, section: b.section, isActive: !b.isActive, position: b.position }),
    });
    await load();
  };

  const move = async (b: Banner, delta: number) => {
    await fetch('/api/admin/home-banners', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: b.id, imageUrl: b.imageUrl, link: b.link, title: b.title, subtitle: b.subtitle, section: b.section, isActive: b.isActive, position: Math.max(0, b.position + delta) }),
    });
    await load();
  };

  const remove = async (b: Banner) => {
    await fetch(`/api/admin/home-banners/${b.id}`, { method: 'DELETE', headers });
    await load();
  };

  const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-red-500/40';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-red-600" /> Home Banners
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Wide landscape strips shown between every home section (web + Android app) — and now also inside the Rewards and Quick Apps
          sections (owner 24 Oct: pick the section per banner). Link to a vertical id (movies, flights, hotels, ecommerce, grocery,
          food, bus, cab, loans, insurance, creditcards) or a full https URL.
        </p>
      </div>

      {/* Add form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="text-[11px] font-black uppercase text-slate-500">Banner image (wide/landscape)</label>
          <div className="flex gap-2 mt-1">
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…/banner.jpg" className={inputCls} />
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0] || null)} />
            <button type="button" onClick={pickFile} disabled={busy} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-black cursor-pointer disabled:opacity-50">
              Upload
            </button>
          </div>
          {imageUrl && <img src={imageUrl} alt="preview" className="mt-2 h-20 w-auto rounded-lg border border-slate-200 object-cover" />}
        </div>
        <div>
          <label className="text-[11px] font-black uppercase text-slate-500">Where it shows (section)</label>
          <select value={section} onChange={(e) => setSection(e.target.value)} className={inputCls + ' mt-1'}>
            <option value="home">Home (between home sections)</option>
            <option value="rewards">Rewards section</option>
            <option value="quickapps">Quick Apps section</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] font-black uppercase text-slate-500">Link (vertical id or https URL)</label>
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="movies" className={inputCls + ' mt-1'} />
        </div>
        <div>
          <label className="text-[11px] font-black uppercase text-slate-500">Title (optional)</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Jailer" className={inputCls + ' mt-1'} />
        </div>
        <div className="sm:col-span-2 flex items-center gap-3">
          <button type="button" onClick={save} disabled={busy || !imageUrl} className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
            <Plus className="w-4 h-4" /> Add banner
          </button>
          {msg && <p className={`text-xs font-bold ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</p>}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
      ) : rows.length === 0 ? (
        <p className="text-xs text-slate-500">No banners yet — add one above.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((b) => (
            <div key={b.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-4">
              <img src={b.imageUrl} alt={b.title || 'banner'} className="h-14 w-32 rounded-lg object-cover border border-slate-100 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-slate-900 truncate">{b.title || 'Untitled banner'}</p>
                <p className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                  <ExternalLink className="w-3 h-3" /> {b.link}
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase ${b.section === 'home' ? 'bg-slate-100 text-slate-600' : 'bg-red-50 text-red-700'}`}>
                    {b.section}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button type="button" onClick={() => void move(b, -1)} className="p-2 rounded-lg hover:bg-slate-100 cursor-pointer"><ArrowUp className="w-4 h-4 text-slate-500" /></button>
                <button type="button" onClick={() => void move(b, 1)} className="p-2 rounded-lg hover:bg-slate-100 cursor-pointer"><ArrowDown className="w-4 h-4 text-slate-500" /></button>
                <button type="button" onClick={() => void toggle(b)} className="p-2 rounded-lg hover:bg-slate-100 cursor-pointer">
                  {b.isActive ? <ToggleRight className="w-5 h-5 text-emerald-600" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                </button>
                <button type="button" onClick={() => void remove(b)} className="p-2 rounded-lg hover:bg-red-50 cursor-pointer"><Trash2 className="w-4 h-4 text-red-600" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
