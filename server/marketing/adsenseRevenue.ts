/**
 * AdSense revenue (owner 27 Oct): "admin mai ek section ye v bnao ki adsence se hume kitna
 * revenue aaya hai."
 *
 * HONEST DATA ONLY (owner standing rule: admin shows 100% genuine numbers, no mock data).
 * Two real inputs, both the owner's own:
 *   1. AdSense Management API v2 (live, needs an approved account + OAuth refresh token):
 *      ADSENSE_ACCOUNT_ID, ADSENSE_OAUTH_CLIENT_ID, ADSENSE_OAUTH_CLIENT_SECRET,
 *      ADSENSE_REFRESH_TOKEN (+ optional ADSENSE_CURRENCY, default INR).
 *   2. The daily CSV export from the AdSense UI (works today, no approval needed) — pasted
 *      or uploaded in Admin -> AdSense Revenue.
 * Everything is cached in MySQL (adsense_daily) as integer micros, so totals never drift.
 * When neither exists the section says exactly what is missing instead of showing zeros
 * that look like real earnings.
 *
 * Self-healing (owner rule): a dead grant (400/401/403) parks the API until credentials
 * change, a 429/quota parks it until the reported reset, and every successful pull clears
 * the circuit. The panel always shows which source the numbers came from and how stale
 * they are.
 */
import crypto from 'crypto';
import { getStore } from '../common/db';

export type RevenueSource = 'adsense_api' | 'adsense_csv';

export interface DayRow {
  day: string;
  source: RevenueSource;
  currency: string;
  earnings_micros: number;
  impressions: number;
  clicks: number;
  page_views: number;
  rpm_micros: number;
}

/** Currency text ('₹1,234.56', '1,234.56', 'USD 12.5') -> integer micros, exact. */
export function moneyToMicros(raw: unknown): number {
  const s = String(raw ?? '').trim();
  if (!s) return 0;
  const neg = /^\(.*\)$/.test(s) || s.trim().startsWith('-');
  const digits = s.replace(/[^0-9.]/g, '');
  if (!digits) return 0;
  const [intPart = '0', fracPart = ''] = digits.split('.');
  const frac = (fracPart + '000000').slice(0, 6);
  const v = Number(intPart || '0') * 1_000_000 + Number(frac || '0');
  if (!Number.isFinite(v)) return 0;
  return neg ? -Math.round(v) : Math.round(v);
}

/** '1,234' / '1 234' / '12' -> integer. */
export function countOf(raw: unknown): number {
  const s = String(raw ?? '').trim().replace(/[^0-9-]/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

/** AdSense CSV/UI dates: 2026-10-01, 10/1/2026, 1 Oct 2026, Oct 1, 2026, 2026/10/01. */
export function parseAdsenseDate(raw: unknown): string | null {
  const s = String(raw ?? '').trim().replace(/^"|"$/g, '');
  if (!s) return null;
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(s); // Google UI default is MM/DD/YYYY
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  m = /^(\d{1,2})[ -]([A-Za-z]{3,})[ -](\d{4})$/.exec(s); // 1 Oct 2026
  if (m) {
    const mi = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    if (mi >= 0) return `${m[3]}-${String(mi + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  m = /^([A-Za-z]{3,})[ .]+(\d{1,2}),?[ ]+(\d{4})$/.exec(s); // Oct 1, 2026
  if (m) {
    const mi = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
    if (mi >= 0) return `${m[3]}-${String(mi + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

/** RFC-4180-ish CSV split (quotes, embedded commas/newlines). */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cell += '"'; i++; } else q = false;
      } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cell); cell = ''; }
    else cell += ch;
  }
  out.push(cell);
  return out.map((c) => c.trim());
}

const HEADER_ALIASES: Record<string, string[]> = {
  day: ['date', 'day', 'din'],
  earnings: ['estimated earnings', 'earnings', 'revenue', 'estimated revenue', 'total earnings'],
  impressions: ['impressions', 'ad impressions'],
  clicks: ['clicks', 'ad clicks'],
  page_views: ['page views', 'pageviews', 'views'],
  rpm: ['page rpm', 'rpm', 'page rpm (inr)', 'rpm (inr)', 'page rpm (usd)'],
  currency: ['currency', 'currency code'],
};

function headerIndex(headers: string[], key: string): number {
  const wanted = HEADER_ALIASES[key] || [];
  const norm = headers.map((h) => h.toLowerCase().replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim());
  for (const w of wanted) {
    const i = norm.findIndex((h) => h === w || h.startsWith(`${w} `));
    if (i >= 0) return i;
  }
  return -1;
}

/**
 * Parse an AdSense report CSV (or pasted TSV/plain rows) into day rows. Tolerates: extra
 * columns, currency symbols, thousand separators, quoted cells, day-first or month-first
 * dates, and Google's footer lines ("Total", blank lines).
 */
export function parseAdsenseCsv(text: string, currencyDefault = 'INR'): { rows: DayRow[]; skipped: number; error?: string } {
  const raw = String(text || '').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return { rows: [], skipped: 0, error: 'Empty file' };
  const delim = lines[0].includes('\t') && !lines[0].includes(',') ? '\t' : ',';
  const headers = (delim === '\t' ? lines[0].split('\t').map((c) => c.trim()) : splitCsvLine(lines[0]));
  const iDay = headerIndex(headers, 'day');
  const iEarn = headerIndex(headers, 'earnings');
  if (iDay < 0 || iEarn < 0) {
    return { rows: [], skipped: 0, error: 'Could not find "Date" and "Estimated earnings" columns — export the report from AdSense with a Date column.' };
  }
  const iImp = headerIndex(headers, 'impressions');
  const iClicks = headerIndex(headers, 'clicks');
  const iViews = headerIndex(headers, 'page_views');
  const iRpm = headerIndex(headers, 'rpm');
  const iCur = headerIndex(headers, 'currency');

  const byDay = new Map<string, DayRow>();
  let skipped = 0;
  for (const line of lines.slice(1)) {
    const cells = delim === '\t' ? line.split('\t').map((c) => c.trim()) : splitCsvLine(line);
    const day = parseAdsenseDate(cells[iDay]);
    if (!day) { skipped++; continue; }
    if (/^(total|totals|sum)/i.test(String(cells[iDay]))) { skipped++; continue; }
    const row: DayRow = {
      day, source: 'adsense_csv',
      currency: (iCur >= 0 ? String(cells[iCur] || '').trim().toUpperCase() : '') || currencyDefault,
      earnings_micros: moneyToMicros(cells[iEarn]),
      impressions: iImp >= 0 ? countOf(cells[iImp]) : 0,
      clicks: iClicks >= 0 ? countOf(cells[iClicks]) : 0,
      page_views: iViews >= 0 ? countOf(cells[iViews]) : 0,
      rpm_micros: iRpm >= 0 ? moneyToMicros(cells[iRpm]) : 0,
    };
    const prev = byDay.get(day);
    if (prev) {
      prev.earnings_micros += row.earnings_micros;
      prev.impressions += row.impressions;
      prev.clicks += row.clicks;
      prev.page_views += row.page_views;
      prev.rpm_micros = Math.max(prev.rpm_micros, row.rpm_micros);
    } else byDay.set(day, row);
  }
  return { rows: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)), skipped };
}

// ---------------- storage ----------------

let ensured = false;
async function ensureTables(): Promise<void> {
  if (ensured) return;
  await getStore().execute(`CREATE TABLE IF NOT EXISTS adsense_daily (
    day DATE NOT NULL, source VARCHAR(20) NOT NULL DEFAULT 'adsense_api', currency VARCHAR(8) NOT NULL DEFAULT 'INR',
    earnings_micros BIGINT NOT NULL DEFAULT 0, impressions BIGINT NOT NULL DEFAULT 0, clicks BIGINT NOT NULL DEFAULT 0,
    page_views BIGINT NOT NULL DEFAULT 0, rpm_micros BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (day, source), KEY idx_adsense_day (day)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(() => {});
  await getStore().execute(`CREATE TABLE IF NOT EXISTS adsense_sync_log (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, kind VARCHAR(20) NOT NULL, ok TINYINT(1) NOT NULL,
    rows_seen INT NOT NULL DEFAULT 0, message VARCHAR(400) NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_adsense_sync (created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(() => {});
  ensured = true;
}

export async function upsertDays(rows: DayRow[]): Promise<number> {
  await ensureTables();
  if (!rows.length) return 0;
  for (const r of rows) {
    await getStore().execute(
      `INSERT INTO adsense_daily (day, source, currency, earnings_micros, impressions, clicks, page_views, rpm_micros)
       VALUES (?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE currency=VALUES(currency), earnings_micros=VALUES(earnings_micros),
         impressions=VALUES(impressions), clicks=VALUES(clicks), page_views=VALUES(page_views), rpm_micros=VALUES(rpm_micros)`,
      [r.day, r.source, r.currency, r.earnings_micros, r.impressions, r.clicks, r.page_views, r.rpm_micros],
    ).catch(() => {});
  }
  return rows.length;
}

async function logSync(kind: string, ok: boolean, rowsSeen: number, message?: string): Promise<void> {
  await ensureTables();
  await getStore().execute('INSERT INTO adsense_sync_log (kind, ok, rows_seen, message) VALUES (?,?,?,?)',
    [kind, ok ? 1 : 0, rowsSeen, String(message || '').slice(0, 400)]).catch(() => {});
}

/**
 * Daily rows, one row per day: the API row wins when it exists (it is the source of truth),
 * otherwise the CSV row is used — so an owner who imported CSV first and then connected the
 * API never sees double counting.
 */
export async function dailyRows(sinceDays = 90): Promise<DayRow[]> {
  await ensureTables();
  const since = new Date(Date.now() - sinceDays * 86400000).toISOString().slice(0, 10);
  const rows = await getStore().query<any>(
    'SELECT day, source, currency, earnings_micros, impressions, clicks, page_views, rpm_micros FROM adsense_daily WHERE day >= ? ORDER BY day DESC',
    [since],
  ).catch(() => []);
  const byDay = new Map<string, DayRow>();
  const csv: DayRow[] = [];
  for (const r of rows) {
    const day = r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day).slice(0, 10);
    const row: DayRow = {
      day, source: r.source, currency: r.currency || 'INR',
      earnings_micros: Number(r.earnings_micros) || 0, impressions: Number(r.impressions) || 0,
      clicks: Number(r.clicks) || 0, page_views: Number(r.page_views) || 0, rpm_micros: Number(r.rpm_micros) || 0,
    };
    if (row.source === 'adsense_api') byDay.set(day, row);
    else csv.push(row);
  }
  for (const r of csv) if (!byDay.has(r.day)) byDay.set(r.day, r);
  return [...byDay.values()].sort((a, b) => b.day.localeCompare(a.day));
}

export interface Summary {
  currency: string;
  today: number; yesterday: number;
  last7: number; last30: number; thisMonth: number; prevMonth: number; lifetime: number;
  impressions30: number; clicks30: number; pageViews30: number;
  rpm30: number; changePct: number | null;
  bestDay: { day: string; amount: number } | null;
  daysWithData: number;
  lastDataDay: string | null;
  staleDays: number | null;
}

/** Pure summary maths (unit-tested) over day rows plus today's date. */
export function summarize(rows: DayRow[], today = new Date().toISOString().slice(0, 10)): Summary {
  const day = (offset: number) => new Date(new Date(`${today}T00:00:00Z`).getTime() - offset * 86400000).toISOString().slice(0, 10);
  const inRange = (r: DayRow, from: string, to: string) => r.day >= from && r.day <= to;
  const sum = (list: DayRow[]) => list.reduce((a, r) => a + r.earnings_micros, 0);
  const monthStart = `${today.slice(0, 7)}-01`;
  const prevMonthEnd = (() => {
    const d = new Date(`${monthStart}T00:00:00Z`);
    d.setUTCDate(0);
    return d.toISOString().slice(0, 10);
  })();
  const prevMonthStart = `${prevMonthEnd.slice(0, 7)}-01`;

  const last30 = rows.filter((r) => inRange(r, day(29), today));
  const thisMonthRows = rows.filter((r) => r.day >= monthStart);
  const prevMonthRows = rows.filter((r) => inRange(r, prevMonthStart, prevMonthEnd));
  const last30Sum = sum(last30);
  const prevMonthSum = sum(prevMonthRows);
  const monthToDate = sum(thisMonthRows);

  const impressions30 = last30.reduce((a, r) => a + r.impressions, 0);
  const pageViews30 = last30.reduce((a, r) => a + r.page_views, 0);
  const clicks30 = last30.reduce((a, r) => a + r.clicks, 0);
  // RPM = earnings per 1000 page views, computed from the real totals (not averaged daily RPMs).
  const rpm30 = pageViews30 > 0 ? Math.round((last30Sum / pageViews30) * 1000) : 0;

  const best = rows.length ? rows.reduce((a, r) => (r.earnings_micros > a.earnings_micros ? r : a), rows[0]) : null;
  const currency = rows.find((r) => r.currency)?.currency || 'INR';
  const lastDataDay = rows.length ? rows.map((r) => r.day).sort().slice(-1)[0] : null;
  const staleDays = lastDataDay
    ? Math.max(0, Math.round((new Date(`${today}T00:00:00Z`).getTime() - new Date(`${lastDataDay}T00:00:00Z`).getTime()) / 86400000))
    : null;

  return {
    currency,
    today: sum(rows.filter((r) => r.day === today)),
    yesterday: sum(rows.filter((r) => r.day === day(1))),
    last7: sum(rows.filter((r) => inRange(r, day(6), today))),
    last30: last30Sum,
    thisMonth: monthToDate,
    prevMonth: prevMonthSum,
    lifetime: sum(rows),
    impressions30, clicks30, pageViews30, rpm30,
    // Month-over-month, only when the previous month actually has data (never invent a delta).
    changePct: prevMonthSum > 0 ? Math.round(((monthToDate - prevMonthSum) / prevMonthSum) * 1000) / 10 : null,
    bestDay: best ? { day: best.day, amount: best.earnings_micros } : null,
    daysWithData: rows.length,
    lastDataDay,
    staleDays,
  };
}

// ---------------- live API (AdSense Management API v2) ----------------

interface Circuit { until: number; reason: string; credentialHash: string }
let circuit: Circuit | null = null;

export function adsenseApiConfig() {
  const accountId = String(process.env.ADSENSE_ACCOUNT_ID || '').trim();
  const clientId = String(process.env.ADSENSE_OAUTH_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.ADSENSE_OAUTH_CLIENT_SECRET || '').trim();
  const refreshToken = String(process.env.ADSENSE_REFRESH_TOKEN || '').trim();
  const currency = String(process.env.ADSENSE_CURRENCY || 'INR').trim().toUpperCase();
  const configured = Boolean(accountId && clientId && clientSecret && refreshToken);
  const credentialHash = crypto.createHash('sha256').update(`${accountId}|${clientId}|${refreshToken}`).digest('hex').slice(0, 16);
  return { accountId, clientId, clientSecret, refreshToken, currency, configured, credentialHash };
}

/** Circuit status for the admin panel: is the API parked, why, until when. */
export function adsenseApiCircuit(): { parked: boolean; reason: string; until: string | null } {
  const cfg = adsenseApiConfig();
  if (!circuit) return { parked: false, reason: '', until: null };
  // New credentials (owner pasted a fresh token) always get an immediate retry.
  if (circuit.credentialHash !== cfg.credentialHash) { circuit = null; return { parked: false, reason: '', until: null }; }
  if (Date.now() >= circuit.until) { circuit = null; return { parked: false, reason: '', until: null }; }
  return { parked: true, reason: circuit.reason, until: new Date(circuit.until).toISOString() };
}

export function _resetAdsenseCircuit(): void { circuit = null; }

/**
 * Pull the last N days from the AdSense Management API and cache them. Returns a plain
 * result object; never throws so the admin route can always answer honestly.
 */
export async function syncFromAdsenseApi(days = 30): Promise<{ ok: boolean; rows: number; error?: string; parked?: boolean }> {
  const cfg = adsenseApiConfig();
  if (!cfg.configured) {
    return { ok: false, rows: 0, error: 'AdSense API not configured yet — add ADSENSE_ACCOUNT_ID, ADSENSE_OAUTH_CLIENT_ID, ADSENSE_OAUTH_CLIENT_SECRET and ADSENSE_REFRESH_TOKEN in hPanel, or import the CSV export instead.' };
  }
  const parked = adsenseApiCircuit();
  if (parked.parked) return { ok: false, parked: true, rows: 0, error: `AdSense API paused: ${parked.reason} (retry after ${parked.until})` };

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: cfg.clientId, client_secret: cfg.clientSecret,
        refresh_token: cfg.refreshToken, grant_type: 'refresh_token',
      }).toString(),
    });
    const tokenJson: any = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenJson?.access_token) {
      const reason = String(tokenJson?.error_description || tokenJson?.error || `HTTP ${tokenRes.status}`);
      // A dead grant will never fix itself on the next run — park it until credentials change.
      circuit = { until: Date.now() + 6 * 3600_000, reason: `token: ${reason}`, credentialHash: cfg.credentialHash };
      await logSync('api', false, 0, `token: ${reason}`);
      return { ok: false, rows: 0, error: `AdSense rejected the OAuth token (${reason}). Re-generate ADSENSE_REFRESH_TOKEN.` };
    }
    const end = new Date(Date.now() - 86400000).toISOString().slice(0, 10); // yesterday: today is still accruing
    const start = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const account = cfg.accountId.startsWith('accounts/') ? cfg.accountId : `accounts/${cfg.accountId}`;
    const url = new URL(`https://adsense.googleapis.com/v2/${account}/reports:generate`);
    url.searchParams.set('dateRange', 'CUSTOM');
    url.searchParams.set('startDate.year', start.slice(0, 4));
    url.searchParams.set('startDate.month', String(Number(start.slice(5, 7))));
    url.searchParams.set('startDate.day', String(Number(start.slice(8, 10))));
    url.searchParams.set('endDate.year', end.slice(0, 4));
    url.searchParams.set('endDate.month', String(Number(end.slice(5, 7))));
    url.searchParams.set('endDate.day', String(Number(end.slice(8, 10))));
    for (const m of ['ESTIMATED_EARNINGS', 'IMPRESSIONS', 'CLICKS', 'PAGE_VIEWS', 'PAGE_VIEWS_RPM']) url.searchParams.append('metrics', m);
    url.searchParams.set('dimensions', 'DATE');
    url.searchParams.set('currencyCode', cfg.currency);

    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${tokenJson.access_token}` } });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = String(json?.error?.message || `HTTP ${res.status}`);
      if (res.status === 401 || res.status === 403) {
        circuit = { until: Date.now() + 6 * 3600_000, reason: msg, credentialHash: cfg.credentialHash };
      } else if (res.status === 429 || /quota|rate limit/i.test(msg)) {
        circuit = { until: Date.now() + 60 * 60_000, reason: `quota: ${msg}`, credentialHash: cfg.credentialHash };
      }
      await logSync('api', false, 0, msg);
      return { ok: false, rows: 0, error: `AdSense API: ${msg}` };
    }

    const headers: string[] = (json?.headers || []).map((h: any) => String(h?.name || '').toUpperCase());
    const iDay = headers.indexOf('DATE');
    const iEarn = headers.indexOf('ESTIMATED_EARNINGS');
    const iImp = headers.indexOf('IMPRESSIONS');
    const iClicks = headers.indexOf('CLICKS');
    const iViews = headers.indexOf('PAGE_VIEWS');
    const iRpm = headers.indexOf('PAGE_VIEWS_RPM');
    const rows: DayRow[] = [];
    for (const r of json?.rows || []) {
      const cells = r?.cells || [];
      const day = parseAdsenseDate(iDay >= 0 ? cells[iDay] : '');
      if (!day) continue;
      rows.push({
        day, source: 'adsense_api', currency: cfg.currency,
        earnings_micros: moneyToMicros(iEarn >= 0 ? cells[iEarn] : 0),
        impressions: countOf(iImp >= 0 ? cells[iImp] : 0),
        clicks: countOf(iClicks >= 0 ? cells[iClicks] : 0),
        page_views: countOf(iViews >= 0 ? cells[iViews] : 0),
        rpm_micros: moneyToMicros(iRpm >= 0 ? cells[iRpm] : 0),
      });
    }
    await upsertDays(rows);
    circuit = null; // success always clears the circuit (self-healing)
    await logSync('api', true, rows.length, `${rows.length} days`);
    return { ok: true, rows: rows.length };
  } catch (e: any) {
    const msg = String(e?.message || 'network error');
    await logSync('api', false, 0, msg);
    return { ok: false, rows: 0, error: `AdSense API unreachable: ${msg}` };
  }
}

/** CSV / paste import used by the admin panel. */
export async function importAdsenseCsv(text: string, currency = 'INR'): Promise<{ ok: boolean; rows: number; skipped: number; error?: string }> {
  const parsed = parseAdsenseCsv(text, currency);
  if (parsed.error) { await logSync('csv', false, 0, parsed.error); return { ok: false, rows: 0, skipped: 0, error: parsed.error }; }
  if (!parsed.rows.length) {
    const error = 'No day rows found in that file.';
    await logSync('csv', false, 0, error);
    return { ok: false, rows: 0, skipped: parsed.skipped, error };
  }
  await upsertDays(parsed.rows);
  await logSync('csv', true, parsed.rows.length, `${parsed.rows.length} days, ${parsed.skipped} skipped`);
  return { ok: true, rows: parsed.rows.length, skipped: parsed.skipped };
}

export async function lastSyncs(limit = 5): Promise<any[]> {
  await ensureTables();
  return getStore().query<any>('SELECT kind, ok, rows_seen, message, created_at FROM adsense_sync_log ORDER BY id DESC LIMIT ?', [limit]).catch(() => []);
}
