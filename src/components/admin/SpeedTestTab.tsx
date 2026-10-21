import React, { useCallback, useEffect, useState } from 'react';
import { Gauge, RefreshCw } from 'lucide-react';

/**
 * Admin → Site Speed: Lighthouse performance widget (owner 21 Oct, design per owner's
 * reference image). Two circular rings — Desktop + Mobile — with the score inside,
 * "Last scanned" timestamp, and a "Run speed test" button that calls PageSpeed Insights
 * server-side (60s per-strategy gap enforced server-side; no API key stored).
 */
interface Score {
  strategy: 'desktop' | 'mobile';
  score: number | null;
  lcp_ms: number | null;
  tbt_ms: number | null;
  cls: number | null;
  url: string;
  scanned_at: string;
  error?: string | null;
}

/** Ring colors per the reference image: green ≥90, amber 50-89, red below 50. */
export function ringColors(score: number | null): { main: string; track: string; text: string } {
  if (score == null) return { main: '#dadce0', track: '#f1f3f4', text: '#5f6368' };
  if (score >= 90) return { main: '#00a859', track: '#dcf5e6', text: '#00a859' };
  if (score >= 50) return { main: '#e39f00', track: '#fdf2d9', text: '#b07d00' };
  return { main: '#d93025', track: '#fce8e6', text: '#d93025' };
}

function fmtScanned(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch { return iso; }
}

const R = 34;
const CIRC = 2 * Math.PI * R;

const ScoreRing: React.FC<{ score: Score }> = ({ score }) => {
  const c = ringColors(score.score);
  const pct = score.score == null ? 0 : Math.max(0, Math.min(100, score.score));
  return (
    <div className="flex flex-col items-center gap-2 min-w-[120px]">
      <svg width="96" height="96" viewBox="0 0 96 96" role="img" aria-label={`${score.strategy} score ${score.score ?? 'unknown'}`}>
        <circle cx="48" cy="48" r={R} fill="none" stroke={c.track} strokeWidth="8" />
        <circle
          cx="48" cy="48" r={R} fill="none" stroke={c.main} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - pct / 100)}
          transform="rotate(-90 48 48)" />
        <text x="48" y="54" textAnchor="middle" style={{ fontSize: 24, fontWeight: 700, fill: c.text }}>
          {score.score == null ? '—' : score.score}
        </text>
      </svg>
      <div className="text-sm font-bold text-slate-900">{score.strategy === 'desktop' ? 'Desktop' : 'Mobile'}</div>
      <div className="text-xs text-slate-400">Last scanned:</div>
      <div className="text-xs text-slate-500">{score.scanned_at ? fmtScanned(score.scanned_at) : 'never'}</div>
      {score.error
        ? <div className="text-[10px] text-red-600 max-w-[140px] text-center leading-tight">{score.error}</div>
        : (score.score != null && (
          <div className="text-[10px] text-slate-400 text-center leading-tight">
            LCP {score.lcp_ms != null ? `${(score.lcp_ms / 1000).toFixed(1)}s` : '—'} · TBT {score.tbt_ms != null ? `${score.tbt_ms}ms` : '—'} · CLS {score.cls != null ? score.cls.toFixed(2) : '—'}
          </div>
        ))}
    </div>
  );
};

export const SpeedTestTab: React.FC = () => {
  const [token] = useState(() => localStorage.getItem('t1s_admin_token') || '');
  const [scores, setScores] = useState<Score[]>([]);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/speedtest', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok && data.success) setScores(data.scores || []);
    } catch { /* widget just shows empty state until first run */ }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const run = async () => {
    setRunning(true); setMsg(null);
    try {
      const res = await fetch('/api/admin/speedtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: 'https://www.try1second.com' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Speed test failed');
      setScores(data.scores || []);
      setMsg({ ok: true, text: 'Speed test complete.' });
    } catch (e: any) { setMsg({ ok: false, text: e?.message || 'Speed test failed' }); }
    finally { setRunning(false); }
  };

  const desktop = scores.find((s) => s.strategy === 'desktop');
  const mobile = scores.find((s) => s.strategy === 'mobile');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Gauge className="w-5 h-5 text-red-600" />
        <h3 className="text-lg font-bold text-slate-900">Performance</h3>
        <span className="text-[10px] text-slate-400 ml-1">Lighthouse via PageSpeed Insights</span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-900">Performance</h4>
          <button
            onClick={run}
            disabled={running}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-slate-300 bg-white text-slate-800 text-xs font-bold hover:bg-slate-50 disabled:opacity-50 cursor-pointer">
            <RefreshCw className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
            {running ? 'Running…' : 'Run speed test'}
          </button>
        </div>

        <div className="mt-5 flex items-center justify-center md:justify-start gap-6 md:gap-10">
          <ScoreRing score={{ strategy: 'desktop', score: desktop?.score ?? null, lcp_ms: desktop?.lcp_ms ?? null, tbt_ms: desktop?.tbt_ms ?? null, cls: desktop?.cls ?? null, url: desktop?.url || '', scanned_at: desktop?.scanned_at || '', error: desktop?.error || null }} />
          <div className="h-40 w-px bg-slate-200" />
          <ScoreRing score={{ strategy: 'mobile', score: mobile?.score ?? null, lcp_ms: mobile?.lcp_ms ?? null, tbt_ms: mobile?.tbt_ms ?? null, cls: mobile?.cls ?? null, url: mobile?.url || '', scanned_at: mobile?.scanned_at || '', error: mobile?.error || null }} />
        </div>

        {msg && <div className={`mt-3 text-xs font-semibold ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</div>}
        <p className="mt-3 text-[10px] text-slate-400">
          Owner target is 95+. Desktop &amp; mobile run in parallel server-side (PageSpeed Insights free quota; one re-run per strategy per 60s).
        </p>
      </div>
    </div>
  );
};
