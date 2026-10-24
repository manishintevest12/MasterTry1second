import React, { useCallback, useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';

/**
 * REAL admin audit log (owner 24 Oct): actual admin actions from the MySQL
 * audit_logs table via /api/admin/audit-logs. The mock user-login/session
 * list (fake users, IPs, point balances) is removed — user sessions are not
 * tracked, so we show the real action log instead.
 */
interface LogRow { actor: string; action: string; target: string | null; details: string; created_at: string }

const card = 'bg-white rounded-2xl border border-slate-200 shadow-xs';

export const AuditLogTab: React.FC = () => {
  const [token] = useState(() => localStorage.getItem('t1s_admin_token') || '');
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/audit-logs', { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (d.success) setLogs(d.logs || []);
    } catch { /* keep */ }
    setLoading(false);
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className={`${card} p-4`}>
        <h3 className="text-base font-bold text-slate-900">Audit Log (Real)</h3>
        <p className="text-xs text-slate-500">
          Admin actions ka real record — MySQL audit_logs se. User session/login tracking abhi platform me nahi hota, isliye fake session list ki jagah yahi sahi hai.
        </p>
      </div>
      <div className={`${card} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-semibold">Time</th>
                <th className="py-3 px-4 font-semibold">Actor</th>
                <th className="py-3 px-4 font-semibold">Action</th>
                <th className="py-3 px-4 font-semibold">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((l, i) => (
                <tr key={i} className="hover:bg-slate-50/80">
                  <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">{String(l.created_at || '').replace('T', ' ').slice(0, 19)}</td>
                  <td className="py-2.5 px-4 font-medium text-slate-800">{l.actor}</td>
                  <td className="py-2.5 px-4"><span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-600">{l.action}</span></td>
                  <td className="py-2.5 px-4 text-slate-500 font-mono truncate max-w-xs">{l.target || '—'}</td>
                </tr>
              ))}
              {!logs.length && !loading && <tr><td colSpan={4} className="py-6 text-center text-slate-400"><span className="inline-flex items-center gap-1.5"><ScrollText className="w-3.5 h-3.5" /> Koi admin action log nahi hua.</span></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
