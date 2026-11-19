/**
 * Funnel telemetry (web) — owner 19 Nov: "Instrument clear funnel events across search, results, card
 * clicks, outbound redirects, shares, and repeat sessions so optimization focuses on real drop-off points
 * and retention rather than vanity metrics."
 *
 * Contract with the server (server/growth/funnel.ts):
 *  - only allowlisted event names are accepted; anything else is dropped server-side,
 *  - no personal data is sent: no email, no phone, no page text. A random session id, the vertical, the
 *    query, the item id and the seller are all the server ever sees,
 *  - it NEVER blocks or throws: the payload goes out with sendBeacon when the page is closing, and every
 *    failure is swallowed. Analytics must not be able to break a search.
 *
 * Server-side steps already exist (search, zero_result, outbound_click) and are recorded where they
 * happen, so the client only posts what only the client can know: results_view, card_click, share,
 * app_open, alert_create, push_open.
 */

export type FunnelEvent =
  | 'search'
  | 'results_view'
  | 'zero_result'
  | 'card_click'
  | 'outbound_click'
  | 'share'
  | 'app_open'
  | 'alert_create'
  | 'push_open';

export interface FunnelPayload {
  event: FunnelEvent;
  vertical?: string;
  query?: string;
  itemId?: string;
  seller?: string;
  city?: string;
  platform?: 'web' | 'android' | 'ios';
  value?: number;
  meta?: Record<string, unknown>;
}

const SESSION_KEY = 't1s_funnel_session';
const ONCE_PREFIX = 't1s_funnel_once_';

/** A random, resettable session id. Clearing storage gives the user a new one, by design. */
export function funnelSessionId(): string {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing && /^[A-Za-z0-9_-]{6,64}$/.test(existing)) return existing;
    const fresh = `w_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`.slice(0, 40);
    localStorage.setItem(SESSION_KEY, fresh);
    return fresh;
  } catch {
    return `w_anon${Math.random().toString(36).slice(2)}`.slice(0, 40);
  }
}

/** Fire one funnel step. Safe to call on every render path; dedupe handles the repeats. */
export function trackFunnel(payload: FunnelPayload): void {
  try {
    const body = JSON.stringify({ ...payload, sessionId: funnelSessionId(), platform: payload.platform || 'web' });
    if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon('/api/track', blob)) return;
    }
    void fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
  } catch {
    /* telemetry is never allowed to surface */
  }
}

/**
 * Track a step at most once per key in this browser session. Used for steps that would otherwise fire on
 * every re-render ("results_view" for the same search) and inflate the funnel.
 */
export function trackFunnelOnce(key: string, payload: FunnelPayload): void {
  try {
    const storageKey = ONCE_PREFIX + key;
    if (sessionStorage.getItem(storageKey)) return;
    sessionStorage.setItem(storageKey, '1');
  } catch {
    /* private mode: fall through and send once per call rather than lose the step entirely */
  }
  trackFunnel(payload);
}
