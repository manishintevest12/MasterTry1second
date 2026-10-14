import React, { useCallback, useEffect, useState } from 'react';
import { Bell, Trash2, Send, RefreshCw, Megaphone } from 'lucide-react';

/**
 * Admin → Notifications: push announcements straight into every visitor's
 * notifications drawer (bell in the header). Optionally target one signed-in
 * user by their numeric user id. https-only links; nothing is ever fabricated —
 * the drawer shows exactly the title and message typed here.
 */

interface NotifRow {
  id: number;
  user_id: number | null;
  kind: string;
  title: string;
  body: string;
  image: string | null;
  cta_url: string | null;
  is_active: number | boolean;
  created_by: string;
  created_at: string;
}

const inputCls = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10';
const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1';

export const NotificationsTab: React.FC = () => {
  const [token] = useState(() => localStorage.getItem('t1s_admin_token') || '');
  const [rows, setRows] = useState<NotifRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', image: '', ctaUrl: '', userId: '' });

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/notifications', { headers });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not load notifications');
      setRows(data.notifications || []);
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || 'Could not load notifications' });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const push = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      setMsg({ ok: false, text: 'Title and message are both required.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: form.title.trim(),
          body: form.body.trim(),
          image: form.image.trim() || null,
          ctaUrl: form.ctaUrl.trim() || null,
          userId: form.userId.trim() ? Number(form.userId.trim()) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not push notification');
      setMsg({ ok: true, text: `Pushed! It is live in every visitor's bell right now.` });
      setForm({ title: '', body: '', image: '', ctaUrl: '', userId: '' });
      await load();
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || 'Could not push notification' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/notifications/${id}`, { method: 'DELETE', headers });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not remove');
      await load();
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || 'Could not remove notification' });
    } finally {
      setBusy(false);
    }
  };

  const timeAgo = (iso: string) => {
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return '';
    const mins = Math.max(1, Math.round((Date.now() - t) / 60000));
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    return hrs < 24 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
            <Megaphone className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Notification Push</h3>
            <p className="text-[11px] text-slate-500">Send an announcement to the notifications bell of every visitor.</p>
          </div>
        </div>
        <button onClick={() => void load()} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 cursor-pointer" title="Reload">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Compose */}
      <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
        <div>
          <label className={labelCls}>Title</label>
          <input
            className={inputCls}
            value={form.title}
            maxLength={200}
            placeholder="e.g. Big Billion Sale prices are now live on Try1second"
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </div>
        <div>
          <label className={labelCls}>Message</label>
          <textarea
            className={`${inputCls} min-h-[72px] resize-y`}
            value={form.body}
            maxLength={1000}
            placeholder="What should visitors know? This exact text appears in their notification drawer."
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Image URL (optional, https)</label>
            <input
              className={inputCls}
              value={form.image}
              placeholder="https://…"
              onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelCls}>Link / CTA URL (optional, https)</label>
            <input
              className={inputCls}
              value={form.ctaUrl}
              placeholder="https://www.try1second.com/…"
              onChange={(e) => setForm((f) => ({ ...f, ctaUrl: e.target.value }))}
            />
          </div>
        </div>
        <div className="w-full sm:w-72">
          <label className={labelCls}>Target user id (optional — blank sends to everyone)</label>
          <input
            className={inputCls}
            value={form.userId}
            placeholder="e.g. 42"
            onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value.replace(/\D/g, '') }))}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={busy || loading}
            onClick={() => void push()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            Push Notification
          </button>
          {msg && (
            <span className={`text-xs font-bold ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</span>
          )}
        </div>
      </div>

      {/* Live list */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700">Sent notifications</span>
          <span className="text-[11px] text-slate-400">{rows.filter((r) => Number(r.is_active) === 1).length} active</span>
        </div>
        {rows.length === 0 ? (
          <p className="p-4 text-xs text-slate-500">Nothing pushed yet. Compose the first announcement above.</p>
        ) : (
          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {rows.map((r) => (
              <div key={r.id} className="px-4 py-2.5 flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${r.kind === 'price_drop' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                  <Bell className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 truncate">{r.title}</p>
                  <p className="text-[11px] text-slate-500 line-clamp-1">{r.body}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {r.kind === 'price_drop' ? 'Auto (price drop)' : r.user_id ? `Targeted · user ${r.user_id}` : 'Broadcast'} · {timeAgo(r.created_at)} · by {r.created_by}
                    {Number(r.is_active) !== 1 ? ' · REMOVED' : ''}
                  </p>
                </div>
                {Number(r.is_active) === 1 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void remove(r.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer shrink-0"
                    title="Remove from all bells"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
