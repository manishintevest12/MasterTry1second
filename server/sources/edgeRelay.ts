/**
 * Edge Relay — egress diversity for gated sources (owner 26 Oct).
 *
 * WHY: some sources (Uber, Rapido, Booking.com, Hotels.com, Expedia, MakeMyTrip,
 * Goibibo) gate datacenter IPs / TLS fingerprints of our production host. The
 * direct curl_cffi path is always tried FIRST (cheapest, fastest). When it is
 * gated, we re-issue the exact same request through an external relay pool that
 * egresses from different IPs with Chrome impersonation:
 *
 *   1. AWS Lambda (container image, curl_cffi) — PREFERRED
 *   2. Cloudflare Worker — secondary
 *
 * The relay is a dumb pipe: it takes {url, method, headers, body, impersonate}
 * and returns {status, headers, body}. All parsing/ranking stays in this server,
 * so the app and website need NO client changes — this is 100% server-driven.
 *
 * Config (hPanel env vars; all optional — relay simply stays off until set):
 *   EDGE_RELAY_AWS_URL    = https://xxxx.lambda-url.ap-south-1.on.aws/   (preferred)
 *   EDGE_RELAY_AWS_TOKEN  = shared secret, must match the Lambda's RELAY_TOKEN
 *   EDGE_RELAY_CF_URL     = https://t1s-edge.<acct>.workers.dev/         (fallback)
 *   EDGE_RELAY_CF_TOKEN   = shared secret for the Worker
 *   EDGE_RELAY_HOSTS      = optional CSV override of the gated-host policy
 *   EDGE_RELAY_DISABLE    = '1' to force direct-only (kill switch)
 */
import { log } from '../common/logger';

export type RelayVia = 'direct' | 'aws' | 'cf';

export interface RelayOpts {
  headers?: Record<string, string>;
  method?: 'GET' | 'POST';
  body?: string;
  timeoutMs?: number;
  impersonate?: string;
  /** Force HTTP/1.1 on the relay leg too (some Akamai edges reset h2). */
  httpVersion?: '1.1';
}

export interface RelayResponse {
  status: number;
  body: string;
  headers?: Record<string, string>;
  via: RelayVia;
}

/**
 * Default gated-host policy: the sources the owner named as "results nahi de
 * rahe". Suffix-matched, so every subdomain is covered.
 */
const DEFAULT_GATED_HOSTS = [
  'uber.com',            // m.uber.com / www.uber.com guest fare paths
  'rapido.bike',         // m.rapido.bike fare-estimate PWA
  'booking.com',         // bot-challenge probe
  'hotels.com',          // Expedia group edge
  'expedia.com',         // Expedia group edge
  'makemytrip.com',      // Akamai-sampled listings (hotels/flights SRP)
  'goibibo.com',         // Akamai-sampled listings
];

function csv(v: string | undefined): string[] {
  return String(v || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function gatedHostPolicy(): string[] {
  const override = csv(process.env.EDGE_RELAY_HOSTS);
  return override.length ? override : DEFAULT_GATED_HOSTS;
}

export function relayDisabled(): boolean {
  return String(process.env.EDGE_RELAY_DISABLE || '') === '1';
}

export function hostInPolicy(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return gatedHostPolicy().some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/**
 * Is this response a GATE rather than real content? Covers the shapes we have
 * actually seen: hard 403/429/503, Akamai behavioral challenge shells,
 * Cloudflare "Just a moment" interstitials, and suspiciously tiny HTML stubs
 * where a real listing page is expected to be large.
 */
export function isGatedResponse(status: number, body: string, opts?: { minHtmlBytes?: number }): boolean {
  if (status === 401 || status === 403 || status === 407 || status === 429 || status === 503) return true;
  const b = (body || '').toLowerCase();
  const markers = [
    'akamai bot manager', 'akamai_ bot', '_abck', 'behavioral challenge',
    'just a moment', 'cf-chl', 'checking your browser', 'enable javascript and cookies',
    'attention required! | cloudflare', 'request unsuccessful. incapsula',
    'access denied', 'pardon our interruption', 'unusual traffic',
  ];
  if (markers.some((m) => b.includes(m))) return true;
  // Tiny HTML where a listing should be: a stub, not a page.
  const min = opts?.minHtmlBytes ?? 1200;
  if (body && body.length < min && /^\s*<(!doctype|html)/i.test(body)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Relay endpoints + circuit breakers
// ---------------------------------------------------------------------------

interface RelayLeg {
  name: 'aws' | 'cf';
  url: string;
  token: string;
}

function relayLegs(): RelayLeg[] {
  const legs: RelayLeg[] = [];
  const awsUrl = String(process.env.EDGE_RELAY_AWS_URL || '').trim();
  const cfUrl = String(process.env.EDGE_RELAY_CF_URL || '').trim();
  if (awsUrl) legs.push({ name: 'aws', url: awsUrl, token: String(process.env.EDGE_RELAY_AWS_TOKEN || '') });
  if (cfUrl) legs.push({ name: 'cf', url: cfUrl, token: String(process.env.EDGE_RELAY_CF_TOKEN || '') });
  return legs; // AWS first = owner preference
}

interface Breaker { failures: number; openedAt: number; }
const breakers = new Map<string, Breaker>();
const BREAKER_THRESHOLD = 3;
const BREAKER_COOLDOWN_MS = 60_000;
const stats = { attempts: 0, ok: 0, failed: 0, gated: 0, servedByRelay: 0, lastVia: '' as RelayVia | '', lastError: '' };

function breakerOpen(name: string): boolean {
  const b = breakers.get(name);
  if (!b) return false;
  if (b.failures < BREAKER_THRESHOLD) return false;
  if (Date.now() - b.openedAt > BREAKER_COOLDOWN_MS) {
    breakers.set(name, { failures: BREAKER_THRESHOLD - 1, openedAt: 0 }); // half-open probe
    return false;
  }
  return true;
}
function breakerOk(name: string) { breakers.set(name, { failures: 0, openedAt: 0 }); }
function breakerFail(name: string) {
  const b = breakers.get(name) || { failures: 0, openedAt: 0 };
  const failures = b.failures + 1;
  breakers.set(name, { failures, openedAt: failures >= BREAKER_THRESHOLD ? Date.now() : 0 });
}

export function relayStats() {
  return { ...stats, legs: relayLegs().map((l) => ({ name: l.name, open: breakerOpen(l.name) })) };
}

export function relayConfigured(): boolean {
  return relayLegs().length > 0 && !relayDisabled();
}

/**
 * Send the request through the relay pool. AWS first, Cloudflare second.
 * Returns null when no relay is configured or every leg is down/gated.
 */
export async function edgeRelayFetch(url: string, opts: RelayOpts = {}): Promise<RelayResponse | null> {
  if (relayDisabled()) return null;
  const legs = relayLegs();
  if (!legs.length) return null;

  for (const leg of legs) {
    if (breakerOpen(leg.name)) continue;
    stats.attempts++;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), (opts.timeoutMs || 25_000) + 8_000);
      const res = await fetch(leg.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(leg.token ? { 'x-relay-token': leg.token } : {}) },
        body: JSON.stringify({
          url,
          method: opts.method || 'GET',
          headers: opts.headers || {},
          ...(opts.body ? { body: opts.body } : {}),
          impersonate: opts.impersonate || 'chrome',
          ...(opts.httpVersion ? { httpVersion: opts.httpVersion } : {}),
          timeoutSec: Math.max(3, Math.ceil((opts.timeoutMs || 25_000) / 1000)),
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`relay ${leg.name} http ${res.status}`);
      const data = await res.json() as { status?: number; body?: string; headers?: Record<string, string>; error?: string };
      if (data.error) throw new Error(`relay ${leg.name}: ${data.error}`);
      const status = Number(data.status || 0);
      const body = String(data.body ?? '');
      // A relay that itself returns a gate is no better than direct — try next leg.
      if (isGatedResponse(status, body)) {
        stats.gated++;
        breakerFail(leg.name);
        continue;
      }
      breakerOk(leg.name);
      stats.ok++;
      stats.servedByRelay++;
      stats.lastVia = leg.name;
      return { status, body, headers: data.headers, via: leg.name };
    } catch (e: any) {
      breakerFail(leg.name);
      stats.failed++;
      stats.lastError = String(e?.message || e).slice(0, 160);
      log.warn('EdgeRelay', `relay leg ${leg.name} failed`, { url: url.slice(0, 120), error: stats.lastError });
    }
  }
  return null;
}

/** Mark a direct-leg gate (for admin visibility). */
export function noteDirectGate() { stats.gated++; }
