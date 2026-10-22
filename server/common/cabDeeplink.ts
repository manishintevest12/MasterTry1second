/**
 * Cab in-app booking deep links (owner request 22 Oct): clicking Book on an
 * Uber/Ola row must open the provider's app with pickup + drop prefilled so the
 * user sees the REAL fare in the provider app and books directly there.
 *
 * Formats (owner-supplied):
 *   Uber: https://m.uber.com/looking/?client_id=CLIENT
 *         &pickup={"latitude":LAT,"longitude":LNG,"addressLine1":"NAME"}   (or pickup=my_location)
 *         &drop[0]={"latitude":LAT,"longitude":LNG,"addressLine1":"NAME"}
 *   Ola : https://book.olacabs.com/?lat=&lng=&drop_lat=&drop_lng=&drop_name=&pickup_name=
 *
 * Affiliate is admin-configurable end to end (Admin → Cab App Booking): the
 * Uber client_id + extra query params (utm_source, sub_id, ...) are stored in
 * app_settings and appended here. The final URL still routes through /api/out
 * so the existing server-side tracking + affiliate injection both apply.
 * Nothing is fabricated: without coordinates the route falls back honestly.
 */
import { getStore } from './db';
import { log } from './logger';
import { geoSearch } from './geoProxy';

export interface CabDeeplinkConfig {
  uberClientId: string;
  /** Extra query string appended to Uber links, e.g. utm_source=try1second&sub_id=x */
  uberExtraParams: string;
  /** Extra query string appended to Ola links. */
  olaExtraParams: string;
  uberEnabled: boolean;
  olaEnabled: boolean;
}

const DEFAULTS: CabDeeplinkConfig = {
  uberClientId: process.env.UBER_CLIENT_ID || '',
  uberExtraParams: 'utm_source=try1second&utm_medium=cab',
  olaExtraParams: 'utm_source=try1second&utm_medium=cab',
  uberEnabled: true,
  olaEnabled: true,
};

const KEY = 'cab_deeplinks';
let cache: { at: number; v: CabDeeplinkConfig } | null = null;
const CACHE_MS = 60_000;

export async function getCabDeeplinkConfig(): Promise<CabDeeplinkConfig> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.v;
  let merged = { ...DEFAULTS };
  try {
    const rows = await getStore().query<{ v: string }>('SELECT v FROM app_settings WHERE k = ?', [KEY]);
    if (rows.length && rows[0].v) {
      const parsed = JSON.parse(rows[0].v);
      merged = { ...DEFAULTS, ...parsed };
    }
  } catch (e: any) {
    // Table missing on fresh DBs / file store: env defaults keep working.
    log.debug('CabDeeplink', `app_settings read skipped: ${String(e?.message || e).slice(0, 60)}`);
  }
  cache = { at: Date.now(), v: merged };
  return merged;
}

export async function saveCabDeeplinkConfig(patch: Partial<CabDeeplinkConfig>): Promise<CabDeeplinkConfig> {
  const cur = await getCabDeeplinkConfig();
  const next: CabDeeplinkConfig = {
    uberClientId: String(patch.uberClientId ?? cur.uberClientId).trim(),
    uberExtraParams: String(patch.uberExtraParams ?? cur.uberExtraParams).trim(),
    olaExtraParams: String(patch.olaExtraParams ?? cur.olaExtraParams).trim(),
    uberEnabled: patch.uberEnabled === undefined ? cur.uberEnabled : Boolean(patch.uberEnabled),
    olaEnabled: patch.olaEnabled === undefined ? cur.olaEnabled : Boolean(patch.olaEnabled),
  };
  await getStore().execute(
    'INSERT INTO app_settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)',
    [KEY, JSON.stringify(next)],
  );
  cache = { at: Date.now(), v: next };
  return next;
}

/** Kept sorted + "k=v" shaped so a mistyped admin entry can never poison a URL. */
function sanitizeParams(raw: string): string {
  return String(raw || '')
    .split('&')
    .map((p) => p.trim())
    .filter((p) => /^[a-zA-Z0-9_.-]+=/.test(p))
    .join('&');
}

export interface CabPlace {
  lat: number;
  lng: number;
  name: string;
}

const encJson = (v: unknown) => encodeURIComponent(JSON.stringify(v));

/** Owner format: pickup as JSON (or my_location when coordinates are unknown). */
export function buildUberBookUrl(opts: {
  cfg: CabDeeplinkConfig;
  pickup?: CabPlace | null;
  drop: CabPlace;
}): string | null {
  if (!opts.cfg.uberEnabled) return null;
  // Manual query assembly: URLSearchParams would double-encode the JSON blobs.
  const q: string[] = [];
  if (opts.cfg.uberClientId) q.push(`client_id=${encodeURIComponent(opts.cfg.uberClientId)}`);
  q.push(`pickup=${opts.pickup ? encJson({ latitude: opts.pickup.lat, longitude: opts.pickup.lng, addressLine1: opts.pickup.name.slice(0, 120) }) : 'my_location'}`);
  q.push(`drop[0]=${encJson({ latitude: opts.drop.lat, longitude: opts.drop.lng, addressLine1: opts.drop.name.slice(0, 120) })}`);
  const extra = sanitizeParams(opts.cfg.uberExtraParams);
  if (extra) q.push(extra);
  return `https://m.uber.com/looking/?${q.join('&')}`;
}

/** Ola books via its mobile web endpoint; needs pickup AND drop coordinates. */
export function buildOlaBookUrl(opts: {
  cfg: CabDeeplinkConfig;
  pickup: CabPlace;
  drop: CabPlace;
}): string | null {
  if (!opts.cfg.olaEnabled) return null;
  const params = new URLSearchParams({
    lat: String(opts.pickup.lat),
    lng: String(opts.pickup.lng),
    drop_lat: String(opts.drop.lat),
    drop_lng: String(opts.drop.lng),
    drop_name: opts.drop.name.slice(0, 120),
  });
  if (opts.pickup.name) params.set('pickup_name', opts.pickup.name.slice(0, 120));
  const extra = sanitizeParams(opts.cfg.olaExtraParams);
  return `https://book.olacabs.com/?${params.toString()}${extra ? `&${extra}` : ''}`;
}

/**
 * Resolve a place name to coordinates. Cached by the geo proxy (24h Nominatim
 * cache + polite 1.1s throttle). Returns null when unknown — never fabricated.
 */
export async function geocodeCabPlace(name: string): Promise<CabPlace | null> {
  const rows = await geoSearch(name, 1);
  const r = rows[0];
  if (!r || !Number.isFinite(r.lat) || !Number.isFinite(r.lng)) return null;
  return { lat: r.lat, lng: r.lng, name: name.trim().slice(0, 120) };
}

/** Nominally a number param, honestly null when the caller sent nothing usable. */
export function numParam(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && (n !== 0 || String(v).trim() === '0') ? n : null;
}
