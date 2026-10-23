import React, { useCallback, useEffect, useState } from 'react';
import { Users, Copy, Check, Share2, Gift } from 'lucide-react';

/**
 * Refer & Earn (owner 23 Oct): real referral codes. Every signed-in user gets a
 * T1S-XXXXXX code minted server-side (idempotent); sharing the link earns the
 * REFERRER +1 valid point the moment a new user applies the code. Unsigned-in
 * visitors see a sign-in prompt; the whole flow is engine-idempotent (a code
 * can only ever be credited once per referee).
 */

export const ReferAndEarn: React.FC = () => {
  const [token] = useState(() => localStorage.getItem('try1_session') || '');
  const [code, setCode] = useState('');
  const [link, setLink] = useState('');
  const [referredCount, setReferredCount] = useState(0);
  const [referredByCode, setReferredByCode] = useState<string | null>(null);
  const [points, setPoints] = useState(0);
  const [applyCode, setApplyCode] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/rewards/referral/me', { headers: { Authorization: `Bearer ${token}` } });
      const data = res.ok ? await res.json() : null;
      if (data?.success) {
        setCode(data.code || '');
        setLink(data.link || '');
        setReferredCount(data.referredCount || 0);
        setReferredByCode(data.referredByCode || null);
        setPoints(data.points || 0);
      }
    } catch {
      /* offline: leave empty */
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  // Apply a friend's code (only needed once per account)
  const apply = async () => {
    const c = applyCode.trim().toUpperCase();
    if (!c) return;
    setMsg(null);
    try {
      const res = await fetch('/api/rewards/referral/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: c }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Could not apply the code');
      setMsg({ ok: true, text: data.awarded ? `Done! ${c} credited +1 point to your friend.` : `You already used ${c}.` });
    } catch (e: unknown) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not apply the code' });
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link || code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard denied: code is still visible to select manually */
    }
  };

  if (!token) {
    return (
      <div className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <Gift className="w-10 h-10 text-red-600 mx-auto" />
        <h3 className="mt-3 text-lg font-black text-slate-900">Refer & Earn — 1 point per friend</h3>
        <p className="mt-2 text-xs text-slate-500 leading-relaxed">
          Sign in to get your personal Try1Second referral code. Every friend who joins with it adds 1 point to your wallet
          for guaranteed vouchers on the spin wheel.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* My code card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-red-600" />
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">Your referral code</h3>
        </div>
        {loading ? (
          <div className="mt-4 h-14 bg-slate-100 rounded-xl animate-pulse" />
        ) : (
          <>
            <div className="mt-4 flex items-center gap-2">
              <code className="flex-1 text-center bg-slate-50 border border-slate-200 rounded-xl py-3.5 text-xl font-black tracking-widest text-red-600">
                {code || '—'}
              </code>
              <button
                type="button"
                onClick={copy}
                className="px-4 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-slate-500 break-all">{link}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-center">
              <div className="bg-slate-50 rounded-xl border border-slate-200 py-3">
                <p className="text-lg font-black text-slate-900">{referredCount}</p>
                <p className="text-[10px] font-bold uppercase text-slate-500">Friends joined</p>
              </div>
              <div className="bg-slate-50 rounded-xl border border-slate-200 py-3">
                <p className="text-lg font-black text-slate-900">{points}</p>
                <p className="text-[10px] font-bold uppercase text-slate-500">Valid points</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Apply a friend's code (once per account) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-2">
          <Share2 className="w-4 h-4 text-red-600" />
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">
            {referredByCode ? `You joined with ${referredByCode}` : 'Have a friend\u2019s code?'}
          </h3>
        </div>
        {!referredByCode && (
          <div className="mt-3 flex gap-2">
            <input
              value={applyCode}
              onChange={(e) => setApplyCode(e.target.value)}
              placeholder="T1S-XXXXXX"
              className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-red-500/40"
            />
            <button
              type="button"
              onClick={apply}
              className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black cursor-pointer"
            >
              Apply
            </button>
          </div>
        )}
        {msg && (
          <p className={`mt-2 text-xs font-bold ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</p>
        )}
      </div>
    </div>
  );
};
