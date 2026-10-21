/**
 * Leads dashboard (owner 21 Oct): every finance enquiry (Loans / Insurance /
 * Credit Cards / Accounts) and partner inquiry, persisted server-side in MySQL.
 * Replaces the old client-state-only flow where leads never reached admin.
 */
import React, { useCallback, useEffect, useState } from 'react';

interface Lead {
  id: number; source: string; vertical: string | null; service_type: string | null;
  account_type: string | null; first_name: string; last_name: string; age: number | null;
  salary: number | null; location: string | null; phone: string | null; email: string | null;
  business: string | null; website: string | null; category: string | null; message: string | null;
  status: string; created_at: string;
}
const STATUSES = ['new', 'contacted', 'converted', 'closed'];
const inputCls = 'px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10';

export const LeadsTab: React.FC = () => {
  const [token] = useState(() => localStorage.getItem('t1s_admin_token') || '');
  const [rows, setRows] = useState<Lead[]>([]);
  const [src, setSrc] = useState('');
  const [vert, setVert] = useState('');
  const [loading, setLoading] = useState(false);
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (src) qs.set('source', src);
      if (vert) qs.set('vertical', vert);
      const res = await fetch(`/api/admin/leads?${qs}`, { headers });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not load leads');
      setRows(data.leads || []);
    } catch { setRows([]); }
    finally { setLoading(false); }
  }, [token, src, vert]);
  useEffect(() => { void load(); }, [load]);

  const setStatus = async (id: number, status: string) => {
    await fetch(`/api/admin/leads/${id}`, { method: 'PATCH', headers, body: JSON.stringify({ status }) });
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-sm font-black text-slate-900 mr-2">Leads ({rows.length})</h3>
        <select className={inputCls} value={src} onChange={(e) => setSrc(e.target.value)}>
          <option value="">All sources</option>
          <option value="lead_form">Lead form</option>
          <option value="partner_inquiry">Partner inquiry</option>
          <option value="cpl">CPL</option>
        </select>
        <select className={inputCls} value={vert} onChange={(e) => setVert(e.target.value)}>
          <option value="">All verticals</option>
          <option value="loans">Loans</option>
          <option value="insurance">Insurance</option>
          <option value="creditcards">Credit cards</option>
          <option value="account">Accounts</option>
        </select>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              {['Date', 'Source', 'Vertical', 'Name', 'Age', 'Salary', 'Location', 'Contact', 'Service / business', 'Status'].map((h) => (
                <th key={h} className="px-2.5 py-2 text-left font-bold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={10} className="px-3 py-4 text-slate-500">Loading…</td></tr> :
             !rows.length ? <tr><td colSpan={10} className="px-3 py-4 text-slate-500">No leads yet.</td></tr> :
             rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-2.5 py-2 whitespace-nowrap text-slate-500">{String(r.created_at || '').slice(0, 16).replace('T', ' ')}</td>
                <td className="px-2.5 py-2"><span className="px-1.5 py-0.5 rounded bg-slate-100 font-bold text-[10px]">{r.source}</span></td>
                <td className="px-2.5 py-2">{r.vertical || '—'}</td>
                <td className="px-2.5 py-2 font-bold">{r.source === 'partner_inquiry' ? (r.business || '—') : `${r.first_name} ${r.last_name}`}</td>
                <td className="px-2.5 py-2">{r.age ?? '—'}</td>
                <td className="px-2.5 py-2">{r.salary != null ? `₹${Number(r.salary).toLocaleString('en-IN')}` : '—'}</td>
                <td className="px-2.5 py-2">{r.location || '—'}</td>
                <td className="px-2.5 py-2">{r.phone || r.email || '—'}</td>
                <td className="px-2.5 py-2 max-w-[220px] truncate text-slate-600" title={r.service_type || r.category || ''}>{r.service_type || r.category || (r.source === 'partner_inquiry' ? (r.website || '—') : '—')}</td>
                <td className="px-2.5 py-2">
                  <select className={inputCls} value={r.status} onChange={(e) => setStatus(r.id, e.target.value)}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-500">Leads from Loans, Insurance, Credit Cards and Accounts forms are stored in MySQL (server-side only) and visible to the matching merchant dashboards.</p>
    </div>
  );
};
