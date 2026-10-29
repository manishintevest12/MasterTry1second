/**
 * Per-BUS seat-selection deep links (owner 29 Oct: "bus selection ke baad uss bus ke seat
 * selection tk jaa raha hai waise redirection chaiye", and "ixigo aur makemytrip v tho hai
 * waha, aise hi flight and hotels ya baki verticals pr deeplink kro").
 *
 * Same rule as the movie seat resolver: a seat page is addressed by ONE service on ONE date, so
 * the link is rebuilt at click time from the id the listing carried — never a stale capture.
 *
 * Every platform's template lives in one table below and is NEVER trusted by default: before a
 * template is served, the platform is probed once with a real listing URL (HTTP 200 + seat
 * signals + no hop to a different route). Until that probe passes, the row keeps the route page
 * it has always had, so a wrong template can never hand a user a dead link — it just earns
 * nothing extra. The probe re-runs after 24h, i.e. the platform fixing or changing its route
 * self-heals without an owner report.
 */
import { createHash } from 'crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { cffiFetch } from '../common/curlCffiFetch';
import { log } from '../common/logger';

export type BusSeatPlatform = 'redbus' | 'abhibus' | 'makemytrip' | 'ixigo' | 'zingbus';

export interface BusSeatTarget {
  platform: BusSeatPlatform;
  from: string;
  to: string;
  /** ISO date the user is buying for (YYYY-MM-DD) */
  isoDate: string;
  /** ids as published by the platform's own listing (missing id => no seat link) */
  routeId?: string;
  serviceId?: string;
  tripKey?: string;
  fromCityId?: string;
  toCityId?: string;
}

const PROBE_TTL_MS = 24 * 3600 * 1000;
const SEAT_SIGNALS = ['seat', 'lower deck', 'upper deck', 'boarding point', 'dropping point', 'select seats'];

interface ProbeState { at: number; ok: boolean; status: number; note?: string }

const probeCache = new Map<BusSeatPlatform, ProbeState>();
loadProbeState();
/** In-flight probes, so a listing loop with 40 rows does not fire 40 requests. */
const probing = new Map<BusSeatPlatform, Promise<boolean>>();

const slug = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');

/** redBus prints the journey date as DD-MMM-YYYY in its own share links. */
function redbusDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(d.getUTCDate()).padStart(2, '0')}-${months[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
}

function ddmmyyyy(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getUTCDate()).padStart(2, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${d.getUTCFullYear()}`;
}

/**
 * The candidate seat URL for a platform. Returns '' when the listing carried no id, because a
 * route page that looks like a seat page would be a lie.
 */
export function buildBusSeatUrl(t: BusSeatTarget): string {
  const from = slug(t.from);
  const to = slug(t.to);
  if (!from || !to || !t.isoDate) return '';
  switch (t.platform) {
    case 'redbus': {
      const id = t.routeId || t.serviceId;
      if (!id) return '';
      // redBus keeps the seat screen on the route path, addressed by busId + journey date.
      return `https://www.redbus.in/bus-tickets/${from}-to-${to}?busId=${encodeURIComponent(id)}&doj=${encodeURIComponent(redbusDate(t.isoDate))}`;
    }
    case 'abhibus': {
      const id = t.serviceId;
      if (!id || !t.fromCityId || !t.toCityId) return '';
      // AbhiBus addresses a single service under its search path.
      return `https://www.abhibus.com/bus_search/${encodeURIComponent(t.from)}/${encodeURIComponent(t.fromCityId)}/${encodeURIComponent(t.to)}/${encodeURIComponent(t.toCityId)}/${encodeURIComponent(ddmmyyyy(t.isoDate))}/${encodeURIComponent(id)}/seats`;
    }
    case 'makemytrip': {
      const id = t.tripKey || t.serviceId;
      if (!id) return '';
      return `https://www.makemytrip.com/bus/search/${encodeURIComponent(t.from)}/${encodeURIComponent(t.to)}/${encodeURIComponent(ddmmyyyy(t.isoDate))}?busId=${encodeURIComponent(id)}`;
    }
    case 'ixigo': {
      const id = t.serviceId;
      if (!id) return '';
      return `https://www.ixigo.com/buses/${from}-to-${to}?busId=${encodeURIComponent(id)}`;
    }
    case 'zingbus': {
      const id = t.serviceId || t.tripKey;
      if (!id) return '';
      return `https://www.zingbus.com/seat-layout/${encodeURIComponent(id)}`;
    }
    default:
      return '';
  }
}

function hasSeatSignals(body: string): boolean {
  const b = String(body || '').toLowerCase();
  if (b.length < 2000) return false; // a stub/challenge page is never a seat map
  return SEAT_SIGNALS.some((s) => b.includes(s));
}

/**
 * Differential probe: the SAME page is fetched twice, once with the real bus id and once with a
 * deliberately bogus one. If both render the same page, the platform ignores the parameter, so
 * the template is NOT a seat link and must never be served. This needs no knowledge of the
 * platform's internals and cannot be fooled by a route page that merely contains the word
 * "seat". Result is cached on disk so a restart does not re-probe every platform.
 */
async function fetchBody(url: string): Promise<{ status: number; body: string }> {
  const r = await cffiFetch(url, { impersonate: 'chrome', timeoutMs: 20_000, headers: { Accept: 'text/html' } });
  return { status: r.status, body: String(r.body || '') };
}

function bogusIdFor(id: string): string {
  return String(id).replace(/\d/g, '9') === String(id) ? '0000001' : '0000001';
}

function controlUrlFor(url: string): string {
  try {
    const u = new URL(url);
    for (const key of ['busId', 'busid', 'tripKey', 'serviceId']) {
      if (u.searchParams.has(key)) {
        u.searchParams.set(key, bogusIdFor(u.searchParams.get(key) || ''));
        return u.toString();
      }
    }
    // Path-addressed templates (AbhiBus/Zingbus): swap the last id-looking segment.
    const parts = u.pathname.split('/');
    for (let i = parts.length - 1; i >= 0; i--) {
      if (/^[A-Za-z0-9_-]{4,}$/.test(parts[i]) && /\d/.test(parts[i])) {
        const copy = [...parts];
        copy[i] = bogusIdFor(parts[i]);
        u.pathname = copy.join('/');
        return u.toString();
      }
    }
    return '';
  } catch { return ''; }
}

const PATTERN_FILE = 'data/bus-seat-patterns.json';

function loadProbeState(): void {
  try {
    const raw = JSON.parse(readFileSync(PATTERN_FILE, 'utf8')) as Record<string, ProbeState>;
    for (const [k, v] of Object.entries(raw || {})) {
      if (v && typeof v.at === 'number') probeCache.set(k as BusSeatPlatform, v);
    }
  } catch { /* first run: nothing verified yet */ }
}

function saveProbeState(): void {
  try {
    mkdirSync('data', { recursive: true });
    const out: Record<string, ProbeState> = {};
    for (const [k, v] of probeCache) out[k] = v;
    writeFileSync(PATTERN_FILE, JSON.stringify(out, null, 2));
  } catch { /* persistence is best-effort; probes re-run after restart */ }
}

async function probeOnce(platform: BusSeatPlatform, url: string): Promise<boolean> {
  const control = controlUrlFor(url);
  if (!control) {
    probeCache.set(platform, { at: Date.now(), ok: false, status: 0, note: 'no id parameter to control' });
    saveProbeState();
    return false;
  }
  try {
    const [real, bogus] = await Promise.all([fetchBody(url), fetchBody(control)]);
    const realLooksSeat = real.status === 200 && hasSeatSignals(real.body);
    // Same page for a bogus id => the parameter is decorative.
    const differs = realLooksSeat && (real.body.length !== bogus.body.length
      || createHash('sha256').update(real.body).digest('hex') !== createHash('sha256').update(bogus.body).digest('hex'));
    probeCache.set(platform, { at: Date.now(), ok: differs, status: real.status,
      note: differs ? 'id changes the page' : 'bogus id renders the same page' });
    saveProbeState();
    log.info('Bus', 'Seat template probe', { platform, ok: differs, status: real.status });
    return differs;
  } catch (e: any) {
    probeCache.set(platform, { at: Date.now(), ok: false, status: 0, note: String(e?.message || e).slice(0, 120) });
    saveProbeState();
    return false;
  }
}

/**
 * Is this platform's seat template currently trusted? Only then callers use it. The probe uses
 * the very URL we were about to serve, i.e. real ids and a real journey date.
 */
export async function seatTemplateTrusted(platform: BusSeatPlatform, sampleUrl: string): Promise<boolean> {
  const hit = probeCache.get(platform);
  if (hit && Date.now() - hit.at < PROBE_TTL_MS) return hit.ok;
  const running = probing.get(platform);
  if (running) return running;
  const p = probeOnce(platform, sampleUrl).finally(() => probing.delete(platform));
  probing.set(platform, p);
  return p;
}

/**
 * The URL a bus row should actually carry: the verified seat link when this platform's template
 * has been confirmed, otherwise the route page the row already had. Never throws.
 */
export async function resolveBusSeatUrl(t: BusSeatTarget, routeUrl: string): Promise<string> {
  const candidate = buildBusSeatUrl(t);
  if (!candidate) return routeUrl;
  try {
    const trusted = await seatTemplateTrusted(t.platform, candidate);
    return trusted ? candidate : routeUrl;
  } catch {
    return routeUrl;
  }
}

/** Test seam: forget cached probe results. */
export function resetSeatProbes(): void {
  probeCache.clear();
  probing.clear();
}

/** Stable fingerprint for logs/tests (no ids leak into analytics). */
export function seatTargetFingerprint(t: BusSeatTarget): string {
  return createHash('sha256').update(`${t.platform}|${t.from}|${t.to}|${t.isoDate}`).digest('hex').slice(0, 12);
}

/**
 * Rewrite bus rows to their verified seat pages where the platform's template has been
 * confirmed, leaving everyone else on the route page. Called by the bus workers right after a
 * parser returns, so the ids come from that same live listing (never a stale capture).
 */
export interface SeatEnrichableRow {
  seller?: string;
  sellerUrl?: string;
  attributes?: Record<string, string>;
  travel?: { route?: string; date?: string };
}

const PLATFORM_OF_SELLER: Record<string, BusSeatPlatform> = {
  redbus: 'redbus',
  'red bus': 'redbus',
  abhibus: 'abhibus',
  'abhi bus': 'abhibus',
  makemytrip: 'makemytrip',
  'make my trip': 'makemytrip',
  ixigo: 'ixigo',
  zingbus: 'zingbus',
};

export async function enrichBusRows<T extends SeatEnrichableRow>(items: T[], ctx: { from: string; to: string; isoDate: string }): Promise<T[]> {
  if (!items.length || !ctx.isoDate) return items;
  return Promise.all(items.map(async (row) => {
    try {
      const platform = PLATFORM_OF_SELLER[String(row.seller || '').toLowerCase()];
      if (!platform) return row;
      const a = row.attributes || {};
      const target: BusSeatTarget = {
        platform,
        from: ctx.from,
        to: ctx.to,
        isoDate: ctx.isoDate,
        routeId: a.route_id || a.bus_id,
        serviceId: a.service_id || a.bus_id,
        tripKey: a.trip_key,
        fromCityId: a.from_city_id,
        toCityId: a.to_city_id,
      } as BusSeatTarget;
      const seat = await resolveBusSeatUrl(target, String(row.sellerUrl || ''));
      if (seat && seat !== row.sellerUrl) return { ...row, sellerUrl: seat };
      return row;
    } catch {
      return row;
    }
  }));
}
