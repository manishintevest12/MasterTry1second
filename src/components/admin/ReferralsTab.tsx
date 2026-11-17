import { useCallback, useEffect, useState } from 'react';
import { Loader2, Users, Gift, Copy, Check } from 'lucide-react';

/**
 * Admin → Referrals (owner 17 Nov: "ye system admin se v connected hai? usko connect kro").
 *
 * The referral engine has been writing codes, referrals and point events since 23 Oct with no admin window into it.
 * This tab reads /api/admin/referrals, which counts the same tables the engine writes - users.referral_code,
 * referrals, referral_point_events - so nothing here is an estimate.
 */
interface Row { userId: number; code: string | null; email: string | null; referred: number }
interface Recent { referrer: string; referee: string; at: string | null }
interface Report {
  ok: boolean; days: number; members: number; usersWithCode: number; referrals: number;
  pending: number; awardablePoints: number; topReferrers: Row[]; recent: Recent[];
}

const Stat = ({ label, value, hint, Icon }: { label: string; value: string; hint: string; Icon: any }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-3">
    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
      <Icon className="w-3 h-3 text-[#E7000B]" /> {label}
    </div>
    <p className="text-xl font-black text-slate-900 mt-1">{value}</p>
    <p className="text-[10px] text-slate-400">{hint}</p>
  </div>
);

export default function ReferralsTab() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const load = useCallback(async (span: number) => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/admin/referrals?days=${span}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('t1s_admin_token') || ''}` },
      });
      const d = await res.json();
      if (!res.ok || !d?.ok) throw new Error(d?.error || `HTTP ${res.status}`);
      setData(d);
    } catch (e: any) {
      setError(String(e?.message || e).slice(0, 160));
      setData(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(days); }, [days, load]);

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(`https://www.try1second.com/r/${code}`);
      setCopied(code);
      window.setTimeout(() => setCopied(''), 1500);
    } catch { /* clipboard blocked: the code is on screen anyway */ }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Gift className="w-4 h-4 text-[#E7000B]" /> Referrals
          </h2>
          <p className="text-[11px] text-slate-500">
            One unique code per member. Each invite is credited once, to one referrer, and never to the inviter themselves.
          </p>
        </div>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}
          className="text-xs font-bold rounded-lg border border-slate-300 px-2 py-1.5 bg-white">
          {[7, 30, 90, 365].map((d) => <option key={d} value={d}>Last {d} days</option>)}
        </select>
      </div>

      {loading && <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Reading the referral ledger…</div>}
      {error && <p className="text-xs font-bold text-red-600">{error}</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Stat label="Members" value={data.members.toLocaleString('en-IN')} hint="accounts holding a code" Icon={Users} />
            <Stat label="Codes issued" value={data.usersWithCode.toLocaleString('en-IN')} hint="unique T1S- codes" Icon={Gift} />
            <Stat label="Referred friends" value={data.referrals.toLocaleString('en-IN')} hint="valid, credited once" Icon={Users} />
            <Stat label="Points awarded" value={data.awardablePoints.toLocaleString('en-IN')} hint="1 per valid referral" Icon={Gift} />
            <Stat label="Pending" value={data.pending.toLocaleString('en-IN')} hint="not yet validated" Icon={Loader2} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <p className="px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-500 border-b border-slate-100">Top referrers</p>
              {data.topReferrers.length === 0 && <p className="px-3 py-6 text-xs text-slate-400">No referral has been credited yet.</p>}
              <table className="w-full text-[11px]">
                <tbody>
                  {data.topReferrers.map((r) => (
                    <tr key={r.userId} className="border-b border-slate-50 last:border-0">
                      <td className="px-3 py-2 font-mono font-bold text-slate-800">{r.code || `#${r.userId}`}</td>
                      <td className="px-3 py-2 text-slate-500 max-w-[160px] truncate">{r.email || '-'}</td>
                      <td className="px-3 py-2 text-right font-black text-slate-900">{r.referred}</td>
                      <td className="px-2 py-2 text-right">
                        {r.code && (
                          <button onClick={() => copy(r.code!)} className="text-slate-400 hover:text-[#E7000B]" title="Copy invite link">
                            {copied === r.code ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <p className="px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-500 border-b border-slate-100">Recent credits (last {data.days} days)</p>
              {data.recent.length === 0 && <p className="px-3 py-6 text-xs text-slate-400">Nothing credited in this window.</p>}
              <table className="w-full text-[11px]">
                <tbody>
                  {data.recent.map((r, i) => (
                    <tr key={i} className="border-b border-slate-50 last:border-0">
                      <td className="px-3 py-2 font-mono font-bold text-slate-800">{r.referrer}</td>
                      <td className="px-3 py-2 text-slate-500 max-w-[170px] truncate">{r.referee}</td>
                      <td className="px-3 py-2 text-right text-slate-400">{r.at ? String(r.at).slice(0, 10) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
