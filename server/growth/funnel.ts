/**
 * Funnel telemetry — the missing middle of the growth chain.
 *
 * OWNER 19 Nov: "Instrument clear funnel events across search, results, card clicks, outbound
 * redirects, shares, and repeat sessions so optimization focuses on real drop-off points and
 * retention rather than vanity metrics."
 *
 * Before this, only `searches` and `affiliate_clicks` existed. That pair can say "63,490 searches,
 * 1,472 exits" and nothing about WHY: how many searches ended with zero results, how many result
 * screens were actually looked at, whether a card click ever reached the merchant, or whether a share
 * came from someone who had clicked. This module records those steps and reports the rates between
 * them, so the next change is aimed at a measured drop-off.
 *
 * Design rules (deliberate, and enforced in code below):
 *  1. ALLOWLIST ONLY. An event name that is not in FUNNEL_EVENTS is rejected, so a client cannot write
 *     arbitrary rows into the table.
 *  2. NO PERSONAL DATA. No IP, user agent, email or phone is stored. `query` is product text and is
 *     scrubbed of anything email-like or a long digit run; `session_id` is a client-generated random
 *     id; `user_id` is our own numeric id when signed in.
 *  3. NEVER IN THE WAY. Recording is fire-and-forget and best-effort: a failure (missing table, DB
 *     hiccup) is swallowed so a page view can never break because analytics did.
 *  4. REPORT FROM ROWS, NOT ASSUMPTIONS. The report aggregates the rows it can read and computes the
 *     rates from those counts, in JS, so it behaves the same on MySQL and on the file store used in dev.
 */
import { createHash } from 'node:crypto';
import { getStore } from '../common/db';

/** The funnel, in order. Everything else is refused. */
export const FUNNEL_EVENTS = [
  'search',        // a search was submitted (vertical + query + city)
  'results_view',  // a results screen rendered with rows
  'zero_result',   // a search finished with nothing to show (the drop-off to fix)
  'card_click',    // a result card was opened
  'outbound_click',// the user left for the merchant (server-side, from /api/out)
  'share',         // a result/card was shared
  'app_open',      // app or web session started
  'alert_create',  // a price alert / watchlist was created
  'push_open',     // a push notification was opened
] as const;

export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

/** Verticals the report may see. Unknown ids are kept as 'other' rather than dropped. */
const VERTICALS = new Set([
  'grocery', 'ecommerce', 'flights', 'hotels', 'bus', 'food', 'cab', 'movies', 'movie',
  'loans', 'insurance', 'creditcards', 'account', 'banking', 'coupons', 'giftcards', 'nearby', 'ev',
]);

export interface FunnelInput {
  event: string;
  sessionId?: string;
  userId?: number | null;
  vertical?: string;
  query?: string;
  itemId?: string;
  seller?: string;
  city?: string;
  platform?: string;
  value?: number | null;
  meta?: Record<string, unknown> | string;
}

/** One sanitised row, ready to insert. Exported so the tests can pin the rules exactly. */
export interface FunnelRow {
  event: FunnelEvent;
  session_id: string;
  user_id: number | null;
  vertical: string;
  query: string;
  item_id: string;
  seller: string;
  city: string;
  platform: string;
  value: number | null;
  meta: string;
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const LONG_DIGITS_RE = /\b\d{9,}\b/g;

/**
 * A storable session id. The client mints an opaque token and we keep it as-is; the server-side steps
 * (search, merchant exit) sometimes only have the request guard's key, which embeds an IP and a user
 * agent. That raw key is NEVER stored: it is hashed to a stable pseudonymous token instead, so sessions
 * still group across the funnel without the table holding an address or a device string.
 */
export function sessionToken(raw: unknown): string {
  const text = String(raw ?? '').trim();
  if (/^[A-Za-z0-9_-]{6,64}$/.test(text)) return text;
  if (!text) return '';
  return 'h_' + createHash('sha256').update(`t1s-funnel|${text}`).digest('hex').slice(0, 24);
}

/** Strip personal data that a user may have typed into a search box, then bound the length. */
export function scrub(text: unknown, max = 200): string {
  return String(text ?? '')
    .replace(EMAIL_RE, '[email]')
    .replace(LONG_DIGITS_RE, '[number]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function str(v: unknown, max: number): string {
  return scrub(v, max);
}

/** Validate one incoming event. Returns null when it must not be stored. */
export function normaliseEvent(raw: any, opts: { userId?: number | null } = {}): FunnelRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const event = String(raw.event || '').trim() as FunnelEvent;
  if (!FUNNEL_EVENTS.includes(event)) return null;

  const sessionId = sessionToken(raw.sessionId ?? raw.session_id);
  if (!sessionId) return null;

  const verticalRaw = String(raw.vertical || '').trim().toLowerCase();
  const vertical = VERTICALS.has(verticalRaw) ? verticalRaw : verticalRaw ? 'other' : '';

  const userId = Number(raw.userId ?? raw.user_id ?? opts.userId ?? 0);
  const value = Number(raw.value);
  let meta = '';
  if (raw.meta != null) {
    const asText = typeof raw.meta === 'string' ? raw.meta : JSON.stringify(raw.meta);
    meta = scrub(asText, 512);
  }

  return {
    event,
    session_id: sessionId,
    user_id: Number.isFinite(userId) && userId > 0 ? Math.floor(userId) : null,
    vertical,
    query: str(raw.query, 200),
    item_id: str(raw.itemId ?? raw.item_id, 120),
    seller: str(raw.seller, 80),
    city: str(raw.city, 60),
    platform: ['web', 'android', 'ios', 'server'].includes(String(raw.platform || '').toLowerCase())
      ? String(raw.platform).toLowerCase()
      : '',
    value: Number.isFinite(value) ? value : null,
    meta,
  };
}

/** Per-process write budget: a stuck client must not be able to flood the table. */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 120;
const budget = new Map<string, { count: number; resetAt: number }>();

export function withinBudget(key: string, now = Date.now()): boolean {
  const cur = budget.get(key);
  if (!cur || now > cur.resetAt) {
    budget.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (cur.count >= MAX_PER_WINDOW) return false;
  cur.count += 1;
  return true;
}

/** Test hook. */
export function resetFunnelBudget(): void {
  budget.clear();
}

/**
 * Store a batch of events. Never throws: telemetry must not be able to break a request.
 * Returns how many rows were accepted (validated and attempted), for the client's own honesty.
 */
export async function recordEvents(inputs: FunnelInput[], opts: { userId?: number | null } = {}): Promise<number> {
  const rows = inputs
    .slice(0, 20)
    .map((e) => normaliseEvent(e, opts))
    .filter((r): r is FunnelRow => Boolean(r));
  if (!rows.length) return 0;
  try {
    const store = getStore();
    for (const r of rows) {
      await store.execute(
        `INSERT INTO funnel_events (event, session_id, user_id, vertical, query, item_id, seller, city, platform, value, meta)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.event, r.session_id, r.user_id, r.vertical, r.query, r.item_id, r.seller, r.city, r.platform, r.value, r.meta],
      );
    }
    return rows.length;
  } catch {
    return 0; // best effort: analytics must never surface as an error to a user
  }
}

/** One event, for server-side steps (search finished, merchant exit). */
export async function recordEvent(input: FunnelInput, opts: { userId?: number | null } = {}): Promise<boolean> {
  return (await recordEvents([input], opts)) > 0;
}

export interface FunnelReport {
  ok: boolean;
  days: number;
  totals: { events: number; sessions: number; searches: number; resultsViews: number; cardClicks: number; outbound: number; shares: number };
  conversion: { searchToResults: number; searchToCard: number; cardToOutbound: number; searchToShare: number };
  zeroResult: { searches: number; empty: number; rate: number };
  byEvent: { event: string; count: number; sessions: number }[];
  byVertical: { vertical: string; searches: number; clicks: number; outbound: number; ctr: number }[];
  daily: { day: string; search: number; results_view: number; card_click: number; outbound_click: number; share: number }[];
  repeatSessions: { sessions: number; returning: number; rate: number };
  note?: string;
}

const EMPTY = (days: number, note?: string): FunnelReport => ({
  ok: true,
  days,
  totals: { events: 0, sessions: 0, searches: 0, resultsViews: 0, cardClicks: 0, outbound: 0, shares: 0 },
  conversion: { searchToResults: 0, searchToCard: 0, cardToOutbound: 0, searchToShare: 0 },
  zeroResult: { searches: 0, empty: 0, rate: 0 },
  byEvent: [],
  byVertical: [],
  daily: [],
  repeatSessions: { sessions: 0, returning: 0, rate: 0 },
  ...(note ? { note } : {}),
});

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

/**
 * Read the funnel for the last `days`. Aggregated in JS from at most MAX_ROWS newest rows so the same
 * code path works on MySQL and on the dev file store (which cannot do GROUP BY).
 */
export async function funnelReport(
  daysInput?: unknown,
  maxRows = 50_000,
  storeOverride?: { query: <T = any>(sql: string, params?: any[]) => Promise<T[]> },
): Promise<FunnelReport> {
  const days = Math.max(1, Math.min(180, Number(daysInput) || 30));
  const since = new Date(Date.now() - days * 24 * 60 * 60_000);
  let rows: any[];
  try {
    const store = storeOverride || getStore();
    rows = await store.query<any>(
      `SELECT event, session_id, user_id, vertical, created_at FROM funnel_events ORDER BY id DESC LIMIT ${maxRows}`,
    );
  } catch {
    return EMPTY(days, 'funnel_events table is not available yet (migration 029 not applied)');
  }

  const inWindow = rows.filter((r) => {
    const at = Date.parse(String(r.created_at || '').replace(' ', 'T'));
    return !Number.isFinite(at) || at >= since.getTime();
  });

  const perEvent = new Map<string, { count: number; sessions: Set<string> }>();
  const perVertical = new Map<string, { searches: number; clicks: number; outbound: number }>();
  const perDay = new Map<string, Record<string, number>>();
  const sessions = new Set<string>();
  const sessionDays = new Map<string, Set<string>>();
  let emptySearches = 0;

  for (const r of inWindow) {
    const event = String(r.event || '');
    const session = String(r.session_id || '');
    const vertical = String(r.vertical || '');
    const day = String(r.created_at || '').slice(0, 10);

    const ev = perEvent.get(event) || { count: 0, sessions: new Set<string>() };
    ev.count += 1;
    if (session) ev.sessions.add(session);
    perEvent.set(event, ev);

    if (session) {
      sessions.add(session);
      const d = sessionDays.get(session) || new Set<string>();
      d.add(day);
      sessionDays.set(session, d);
    }

    if (event === 'zero_result') emptySearches += 1;
    if (vertical) {
      const v = perVertical.get(vertical) || { searches: 0, clicks: 0, outbound: 0 };
      if (event === 'search') v.searches += 1;
      if (event === 'card_click') v.clicks += 1;
      if (event === 'outbound_click') v.outbound += 1;
      perVertical.set(vertical, v);
    }
    if (day) {
      const d = perDay.get(day) || {};
      d[event] = (d[event] || 0) + 1;
      perDay.set(day, d);
    }
  }

  const count = (e: string) => perEvent.get(e)?.count || 0;
  const searches = count('search');
  const resultsViews = count('results_view');
  const cardClicks = count('card_click');
  const outbound = count('outbound_click');
  const shares = count('share');
  const returning = [...sessionDays.values()].filter((d) => d.size > 1).length;

  return {
    ok: true,
    days,
    totals: { events: inWindow.length, sessions: sessions.size, searches, resultsViews, cardClicks, outbound, shares },
    conversion: {
      searchToResults: pct(resultsViews, searches),
      searchToCard: pct(cardClicks, searches),
      cardToOutbound: pct(outbound, cardClicks),
      searchToShare: pct(shares, searches),
    },
    zeroResult: { searches, empty: emptySearches, rate: pct(emptySearches, searches) },
    byEvent: [...perEvent.entries()]
      .map(([event, v]) => ({ event, count: v.count, sessions: v.sessions.size }))
      .sort((a, b) => b.count - a.count),
    byVertical: [...perVertical.entries()]
      .map(([vertical, v]) => ({ vertical, ...v, ctr: pct(v.clicks, v.searches) }))
      .sort((a, b) => b.searches - a.searches),
    daily: [...perDay.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([day, d]) => ({
        day,
        search: d.search || 0,
        results_view: d.results_view || 0,
        card_click: d.card_click || 0,
        outbound_click: d.outbound_click || 0,
        share: d.share || 0,
      })),
    repeatSessions: { sessions: sessions.size, returning, rate: pct(returning, sessions.size) },
  };
}
