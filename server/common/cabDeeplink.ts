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
  /** Rapido deeplink base (owner 22 Oct: https://rapido.cc/ride). Admin-editable. */
  rapidoBaseUrl: string;
  /** Extra query string appended to the Rapido link (affiliate / utm). */
  rapidoExtraParams: string;
  uberEnabled: boolean;
  olaEnabled: boolean;
  rapidoEnabled: boolean;
}

const DEFAULTS: CabDeeplinkConfig = {
  uberClientId: process.env.UBER_CLIENT_ID || '',
  uberExtraParams: 'utm_source=try1second&utm_medium=cab',
  olaExtraParams: 'utm_source=try1second&utm_medium=cab',
  rapidoBaseUrl: 'https://rapido.cc/ride',
  rapidoExtraParams: '',
  uberEnabled: true,
  olaEnabled: true,
  rapidoEnabled: true,
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
    rapidoBaseUrl: /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/[^\s?#]*)?$/i.test(String(patch.rapidoBaseUrl ?? cur.rapidoBaseUrl).trim())
      ? String(patch.rapidoBaseUrl ?? cur.rapidoBaseUrl).trim() : cur.rapidoBaseUrl,
    rapidoExtraParams: String(patch.rapidoExtraParams ?? cur.rapidoExtraParams).trim(),
    rapidoEnabled: patch.rapidoEnabled === undefined ? cur.rapidoEnabled : Boolean(patch.rapidoEnabled),
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
 * Owner 23 Oct ("deeplink site pr le jaa raha hai, app pr jana tha"): the
 * https booking links (m.uber.com / book.olacabs.com) opened the provider's
 * MOBILE SITE because the whole chain ran inside a browser tab — the native
 * app was never asked. These builders emit the providers' documented APP
 * SCHEMES so a tap asks the OS for the installed app first; the https link
 * stays the honest fallback when the app is missing.
 *
 *   Uber: uber://?action=setPickup&client_id=X&pickup[latitude]=..
 *         &pickup[longitude]=..&pickup[nickname]=..&dropoff[latitude]=..
 *         &dropoff[longitude]=..&dropoff[nickname]=..   (or pickup=my_location)
 *   Ola : olacabs://book?lat=..&lng=..&drop_lat=..&drop_lng=..
 * Rapido has no documented scheme — its https link stays the only hop.
 */
export function buildUberAppSchemeUrl(opts: {
  cfg: CabDeeplinkConfig;
  pickup?: CabPlace | null;
  drop: CabPlace;
}): string | null {
  if (!opts.cfg.uberEnabled) return null;
  const q: string[] = ['action=setPickup'];
  if (opts.cfg.uberClientId) q.push(`client_id=${encodeURIComponent(opts.cfg.uberClientId)}`);
  q.push(opts.pickup
    ? `pickup[latitude]=${opts.pickup.lat}&pickup[longitude]=${opts.pickup.lng}` +
      `&pickup[nickname]=${encodeURIComponent(opts.pickup.name.slice(0, 120))}`
    : 'pickup=my_location');
  q.push(`dropoff[latitude]=${opts.drop.lat}&dropoff[longitude]=${opts.drop.lng}` +
    `&dropoff[nickname]=${encodeURIComponent(opts.drop.name.slice(0, 120))}`);
  return `uber://?${q.join('&')}`;
}

export function buildOlaAppSchemeUrl(opts: {
  cfg: CabDeeplinkConfig;
  pickup: CabPlace;
  drop: CabPlace;
}): string | null {
  if (!opts.cfg.olaEnabled) return null;
  const params = new URLSearchParams({
    lat: String(opts.pickup.lat), lng: String(opts.pickup.lng),
    drop_lat: String(opts.drop.lat), drop_lng: String(opts.drop.lng),
    drop_name: opts.drop.name.slice(0, 120), pickup_name: opts.pickup.name.slice(0, 120),
  });
  return `olacabs://book?${params.toString()}`;
}

/**
 * Web booking URL -> matching app scheme (for the browser interstitial's
 * "try the app first" attempt). Returns null when the URL is not a cab
 * provider booking link or the provider has no documented scheme (Rapido).
 * Coordinates are read back out of the built https URL, never re-geocoded.
 */
export function cabWebUrlToAppScheme(url: string, cfg: CabDeeplinkConfig): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.replace(/^www\./, '') === 'm.uber.com') {
      const pickupRaw = u.searchParams.get('pickup');
      const dropRaw = u.searchParams.get('drop[0]');
      const drop = dropRaw ? JSON.parse(dropRaw) : null;
      if (!drop || !Number.isFinite(drop.latitude) || !Number.isFinite(drop.longitude)) return null;
      let pickup: CabPlace | null = null;
      if (pickupRaw && pickupRaw !== 'my_location') {
        const p = JSON.parse(pickupRaw);
        if (Number.isFinite(p.latitude) && Number.isFinite(p.longitude)) pickup = { lat: p.latitude, lng: p.longitude, name: String(p.addressLine1 || 'Pickup') };
      }
      return buildUberAppSchemeUrl({ cfg, pickup, drop: { lat: drop.latitude, lng: drop.longitude, name: String(drop.addressLine1 || 'Drop') } });
    }
    if (u.hostname.replace(/^www\./, '') === 'book.olacabs.com') {
      const lat = Number(u.searchParams.get('lat')), lng = Number(u.searchParams.get('lng'));
      const dropLat = Number(u.searchParams.get('drop_lat')), dropLng = Number(u.searchParams.get('drop_lng'));
      if (![lat, lng, dropLat, dropLng].every(Number.isFinite)) return null;
      return buildOlaAppSchemeUrl({
        cfg,
        pickup: { lat, lng, name: u.searchParams.get('pickup_name') || 'Pickup' },
        drop: { lat: dropLat, lng: dropLng, name: u.searchParams.get('drop_name') || 'Drop' },
      });
    }
    return null; // rapido.cc has no documented app scheme — https link only
  } catch { return null; }
}

/**
 * Rapido: owner-supplied universal link (https://rapido.cc/ride). Rapido has no
 * documented pickup/drop prefill format, so NOTHING is invented: the link opens
 * Rapido's ride screen (app if installed, else its web/store page) and only the
 * admin-configured affiliate params are appended. Pickup/drop stay in our row.
 */
export function buildRapidoBookUrl(opts: { cfg: CabDeeplinkConfig }): string | null {
  if (!opts.cfg.rapidoEnabled) return null;
  const extra = sanitizeParams(opts.cfg.rapidoExtraParams);
  const base = opts.cfg.rapidoBaseUrl || 'https://rapido.cc/ride';
  return extra ? `${base}${base.includes('?') ? '&' : '?'}${extra}` : base;
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
