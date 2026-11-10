/**
 * Cab worker (India). A cab search runs ONLY this worker.
 * Real road distance/duration from OSRM between two places; the fare is a
 * transparent, labelled estimate (never a live operator quote).
 */
import { cabLinks, cabAppOpenUrl } from '../../affiliate/cabLinks';
import { registerVerticalWorker, type VerticalWorker } from '../verticalWorker';
import { parseSavaariCabs, savaariRouteSlug } from '../parsers/savaariCabs'
import { bharatTaxiSlug, parseBharatTaxiCabs } from '../parsers/bharatTaxi';;
import { parseQuickRideCabs } from '../parsers/quickRideCabs';
import { indriveCityLookup, indrivePrices, buildIndriveOffers } from '../parsers/indriveIntercity';
import { cffiFetch } from '../../common/curlCffiFetch';
import { newRawItem } from '../../sources/contract';
import type { RawSourceItem, SourceConfig } from '../../types';
import { photonGeocode, cityFromRouteText, geocodePlace, cityForPlace, type GeoPoint } from '../parsers/osmTravel';
import { geoSearch, geoReverse } from '../../common/geoProxy';
import { rapidoServedCities, rapidoCityLookup, rapidoCitySlug, canonCity } from '../parsers/rapidoCabs';
import { rapidoGuestFares, rapidoServiceCatalog, buildRapidoFareRows } from '../parsers/rapidoFares';
import { uberIndiaCityFor } from '../parsers/uberIndiaCities';
import { buildUberProductsRequestBody, parseUberProductsResponse, buildUberGoBookUrl, buildUberProductSelectionBody, parseUberProductSelectionResponse, type UberGoPlace, type UberGoProduct } from '../parsers/uberGoProducts';
import { AcquisitionError } from '../../common/httpClient';
import { BOOKING_PROBE, bookingGate, bookingGateMessage } from '../parsers/bookingProbe';

/**
 * Rapido live-fare flow, hard-failed safe: returns [] on any miss so the caller
 * falls back to the honest availability rows. Both endpoints must geocode
 * (city-center coords would price the WRONG trip — no number beats a wrong one).
 */
async function rapidoLiveFaresSafe(
  ctx: { source: SourceConfig },
  rt: { from: string; to: string },
  city: string,
): Promise<RawSourceItem[]> {
  try {
    const [pa, pb] = await Promise.all([geocodePudo(rt.from, city), geocodePudo(rt.to, city)]);
    if (!pa?.lat || !pb?.lat || pa?.lon == null || pb?.lon == null) return [];
    const outcome = await rapidoGuestFares(
      { lat: pa.lat, lng: pa.lon, label: rt.from },
      { lat: pb.lat, lng: pb.lon, label: rt.to },
    );
    if (outcome.status !== 'ok' || !outcome.quotes.length) {
      // OWNER 3 Nov: this used to `return []` - the row vanished and NOTHING in the answer said why,
      // so "Rapido ka price ni aa raha" was undiagnosable from outside. A Rapido card still only
      // appears WITH a real fare (owner rule 31 Oct), but the reason now reaches sourcesFailed.
      throw new AcquisitionError('EMPTY_RESPONSE', `Rapido city fare unavailable (${outcome.status}): ${String((outcome as any).detail || 'no quotes')}`);
    }
    const catalog = await rapidoServiceCatalog(pa.lat, pa.lon);
    return buildRapidoFareRows({
      source: ctx.source,
      from: rt.from,
      to: rt.to,
      city,
      quotes: outcome.quotes,
      catalog,
    });
  } catch (e) {
    if (e instanceof AcquisitionError) throw e; // already a precise, honest reason
    return []; // geocode/fetch/decode failure — no Rapido row rather than a guessed fare
  }
}

function routeFromQuery(raw: string): { from: string; to: string } | null {
  const cleaned = raw.replace(/\b(cab|taxi|ride|auto|uber|ola|rapido|book|a|an|the|price|fare|for|drop|pickup|from|need|want|go|going)\b/gi, ' ')
    .replace(/\s+/g, ' ').trim();
  const m = cleaned.match(/(.{2,40}?)\s+(?:to|→)\s+(.{2,40})/);
  if (!m) return null;
  return { from: m[1].trim(), to: m[2].trim() };
}

/**
 * Owner 25 Oct ("uber aur rapido app pr v real price ni de raha"): a bare
 * PUDO label like "Rajwada" geocodes to Nashik's Rajwada (467 km away) — every
 * cab price then goes absurd (Ola rate-card estimated a Rs 9,839 intercity
 * trip for an 8 km Indore city ride) or vanishes (Rapido fareEstimate 500s on
 * intercity, Uber rows go presence-only). Bias every PUDO geocode with the
 * search's own city context: city-scoped lookup first when the label does not
 * already name the city, bare lookup as the honest fallback.
 */
function ctxCity(ctx: any): string | undefined {
  const c = String(ctx?.query?.location?.city || '').trim();
  return c || undefined;
}
async function geocodePudo(name: string, city?: string): Promise<GeoPoint | null> {
  const clean = String(name || '').trim();
  if (!clean) return null;
  if (city && !clean.toLowerCase().includes(city.toLowerCase())) {
    const biased = await photonGeocode(`${clean}, ${city}`);
    if (biased) return biased;
  }
  return geocodePlace(clean);
}
/** Prefer explicit picker PUDO labels (app sends from/to with full Photon
 * labels) over regex route extraction from the raw query. */
function cabRoute(ctx: any): { from: string; to: string } | null {
  const p = ctx?.query?.pudo;
  const f = String(p?.from || '').trim().slice(0, 120);
  const t2 = String(p?.to || '').trim().slice(0, 120);
  if (f && t2) return { from: f, to: t2 };
  return routeFromQuery(String(ctx?.query?.rawQuery || ''));
}


// Uber OAuth2 client-credentials bearer token with in-process cache.
let _uberTokenCache: { token: string; expiresAt: number } | null = null;
async function uberBearerToken(appId: string, appSecret: string): Promise<string | null> {
  if (_uberTokenCache && Date.now() < _uberTokenCache.expiresAt) return _uberTokenCache.token;
  const basic = Buffer.from(`${appId}:${appSecret}`).toString('base64');
  const r = await cffiFetch('https://login.uber.com/oauth/v2/token', {
    method: 'POST', timeoutMs: 15_000,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${basic}` },
    body: 'grant_type=client_credentials',
  });
  if (r.status !== 200) return null;
  try {
    const j = JSON.parse(r.body || '{}');
    const token = String(j?.access_token || '');
    const ttl = Number(j?.expires_in || 0);
    if (!token || !ttl) return null;
    _uberTokenCache = { token, expiresAt: Date.now() + Math.max(ttl - 60, 60) * 1000 };
    return token;
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Uber SSR city-guide fallback (no API credentials needed).
// Uber publishes per-city guides with "Average price with UberX*" tables for
// popular destinations (real Uber-published averages, rendered server-side on
// www.uber.com). When official API credentials are absent/blocked we use these
// honestly: the offer states it is a published city average, not a live quote.
const UBER_CITY_SLUGS: { keys: string[]; slug: string; city: string }[] = [
  { keys: ['delhi', 'new delhi', 'ndls'], slug: 'new-delhi-new-delhi-in', city: 'New Delhi' },
  { keys: ['mumbai', 'bombay'], slug: 'mumbai-maharashtra-in', city: 'Mumbai' },
  { keys: ['bangalore', 'bengaluru'], slug: 'bangalore-karnataka-in', city: 'Bangalore' },
  { keys: ['chennai', 'madras'], slug: 'chennai-tamil-nadu-in', city: 'Chennai' },
  { keys: ['hyderabad'], slug: 'hyderabad-telangana-in', city: 'Hyderabad' },
  { keys: ['kolkata', 'calcutta'], slug: 'kolkata-west-bengal-in', city: 'Kolkata' },
  { keys: ['ahmedabad', 'ahmadabad'], slug: 'ahmedabad-gujarat-in', city: 'Ahmedabad' },
  { keys: ['jaipur'], slug: 'jaipur-rajasthan-in', city: 'Jaipur' },
  { keys: ['lucknow'], slug: 'lucknow-uttar-pradesh-in', city: 'Lucknow' },
  { keys: ['gurgaon', 'gurugram'], slug: 'gurgaon-haryana-in', city: 'Gurgaon' },
  { keys: ['chandigarh'], slug: 'chandigarh-chandigarh-in', city: 'Chandigarh' },
  { keys: ['kochi', 'ernakulam'], slug: 'kochi-kerala-in', city: 'Kochi' },
  { keys: ['guwahati'], slug: 'guwahati-assam-in', city: 'Guwahati' },
  { keys: ['indore'], slug: 'indore-madhya-pradesh-in', city: 'Indore' },
  { keys: ['thiruvananthapuram', 'trivandrum'], slug: 'thiruvananthapuram-kerala-in', city: 'Thiruvananthapuram' },
  { keys: ['mysore', 'mysuru'], slug: 'mysore-karnataka-in', city: 'Mysore' },
  { keys: ['vadodara', 'baroda'], slug: 'vadodara-gujarat-in', city: 'Vadodara' },
  { keys: ['bhubaneswar'], slug: 'bhubaneswar-odisha-in', city: 'Bhubaneswar' },
  { keys: ['jodhpur'], slug: 'jodhpur-rajasthan-in', city: 'Jodhpur' },
];

function uberCitySlugFor(place: string): { slug: string; city: string } | null {
  const p = place.toLowerCase();
  for (const c of UBER_CITY_SLUGS) if (c.keys.some((k) => p.includes(k))) return { slug: c.slug, city: c.city };
  return null;
}

function normPlace(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
    .filter((t) => t.length > 2 && !['and', 'the', 'st', 'station'].includes(t))
    .map((t) => canonCity(t)); // canonical spellings: "gurgaon" matches a published "gurugram"
}

/** Match a route endpoint against an SSR destination name. Score = fraction of
 * the QUERIED endpoint's tokens found in the published destination name.
 * Owner bug 17 Oct: the old hits/min(len) denominator let a 1-token destination
 * ("Indore Jn.") score 1.0 against a locality drop ("Martand Chowk, Indore") on
 * the shared city word alone — the fallback then priced a WRONG route
 * ("Indore to Indore Jn."), which the route filter correctly dropped, and Uber
 * silently vanished from intra-city results. Coverage against the queried side
 * (hits/a.length) keeps genuine single-token drops ("Ujjain") at 1.0 while a
 * city-word-only hit ("indore" in "Martand Chowk, Indore") scores 0.33 < 0.5
 * and correctly falls through to the honest presence row. */
function uberDestMatchScore(routeEnd: string, destName: string): number {
  const a = normPlace(routeEnd); const b = normPlace(destName);
  if (!a.length || !b.length) return 0;
  let hits = 0;
  for (const t of a) if (b.includes(t) || b.some((x) => (x.length > 3 && t.length > 3 && (x.includes(t) || t.includes(x))))) hits++;
  return hits / a.length;
}

interface UberCityFare { dest: string; price: number; city: string; slug: string; fetchedUrl: string }

async function uberCityFares(slug: string, city: string): Promise<UberCityFare[]> {
  const url = `https://www.uber.com/global/en/r/cities/${slug}/`;
  const r = await cffiFetch(url, { impersonate: 'chrome', timeoutMs: 20_000, headers: { Accept: 'text/html', 'Accept-Language': 'en-IN,en;q=0.9' } });
  if (r.status !== 200 || !(r.body || '').includes('Average price with UberX')) throw new AcquisitionError('EMPTY_RESPONSE', `Uber city guide page unavailable (HTTP ${r.status}) for ${city}`);
  const out: UberCityFare[] = [];
  const re = /cmln__paragraph">([^<]{2,80})</g;
  const txts: string[] = []; let m: RegExpExecArray | null;
  while ((m = re.exec(r.body || ''))) txts.push(m[1].trim());
  for (let i = 0; i + 1 < txts.length; i++) {
    const priceM = txts[i + 1].match(/^\s*(?:₹|Rs\.?\s*)([\d,]+)\s*$/);
    if (priceM && !/^\s*[₹]/.test(txts[i])) {
      const price = Number(priceM[1].replace(/,/g, ''));
      if (price > 0) out.push({ dest: txts[i], price, city, slug, fetchedUrl: url });
    }
  }
  return out;
}


/** SSR city-guide fallback: emit the honest published average when the queried
 *  destination appears in Uber's own city fare table. Never fabricates. */

// ---------------------------------------------------------------------------
// Uber m.uber.com/go guest Products flow (discovered 24 Oct 2026; production =
// curl_cffi replay, never a browser). Uber retired the legacy guest fare RPC
// (loadFEEstimates); the price-estimate page now hands off to m.uber.com/go,
// whose Apollo endpoint (POST /go/graphql, literal x-csrf-token: "x" -- their own
// bundle sends exactly this) returns the real route-scoped product catalog for
// pickup/drop coordinates once a guest session is primed (GET /go/looking for
// the jwt-session cookie). ANONYMOUS fares/ETAs come back empty: Uber quotes
// prices only post-login -- we never invent them. Every run re-requests fares,
// so if Uber ever re-exposes guest prices the rows automatically carry them
// (self-healing probe). On any failure the SSR city-guide fallback still runs.
async function uberPudoPlace(bias: { lat: number; lon: number }, query: string, type: 'PICKUP' | 'DROPOFF'): Promise<UberGoPlace | null> {
  try {
    const r = await cffiFetch('https://www.uber.com/api/pudoLocationSearch', {
      method: 'POST', impersonate: 'chrome', timeoutMs: 12_000,
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': 'x', Accept: 'application/json', Origin: 'https://www.uber.com', Referer: 'https://www.uber.com/global/en/price-estimate/' },
      body: JSON.stringify({ latitude: bias.lat, longitude: bias.lon, query: query.slice(0, 120), type }),
    });
    if (r.status !== 200) return null;
    const j = JSON.parse(r.body || '{}');
    const hit = j?.data?.[0];
    if (!hit?.addressLine1) return null;
    return { lat: bias.lat, lng: bias.lon, name: String(hit.addressLine1).slice(0, 120) }; // Uber's search API returns no coordinates; geocode coords carry the route.
  } catch { return null; }
}

/**
 * Uber RIDER SESSION (owner 30 Oct: "ek option open source add kro github se jo
 * uber ka price real time").
 *
 * The open-source finding, verified against two live repos — jgalea/uber-cli and
 * Emerson1337/CanIGetHome — is that NO anonymous Uber ride price exists any more
 * (every guest endpoint answers {"code":"unauthorized"}), and both working OSS
 * projects therefore send the rider's OWN session cookie to
 * POST https://m.uber.com/go/graphql (Products / FareEstimate). That is exactly
 * the endpoint this file already replays; the missing piece was the session.
 *
 * So with UBER_SESSION_COOKIE set (the owner's own logged-in m.uber.com cookie,
 * pasted in hPanel env, the same way OLA_API_KEY is set), the identical Products
 * request returns REAL route-scoped fares for UberX/Moto/Auto/Premier without any
 * developer token. Without it, nothing changes: guest flow + published averages.
 *
 * Accepted value shapes: "sid=...", "sid=...; jwt-session=...", a raw sid value,
 * or several newline/comma separated name=value pairs.
 */
export function parseUberSessionCookie(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  // OWNER 3 Nov: the value arrives as a copy-paste, so tolerate the shapes hPanel actually receives:
  // a leading "Cookie:" header name, wrapping quotes/backticks, and a header split over several lines.
  const text = String(raw ?? '')
    .replace(/^\s*cookie\s*:/i, '')
    .replace(/[\u201c\u201d\u2018\u2019"'`]/g, '')
    .replace(/\r/g, '')
    .trim();
  if (!text) return out;
  for (const chunk of text.split(/[\n,;]+/)) {
    const part = chunk.trim();
    if (!part) continue;
    const eq = part.indexOf('=');
    if (eq > 0) {
      const name = part.slice(0, eq).trim();
      const value = part.slice(eq + 1).trim();
      if (name && value) out[name] = value;
    } else if (eq === -1 && !out.sid) {
      // A bare value is taken as the sid (the one cookie Uber's API actually needs).
      // A fragment that merely LOOKS like "===" is not a value, so it is ignored.
      out.sid = part;
    }
  }
  return out;
}

const uberSessionCookies = (): Record<string, string> => parseUberSessionCookie(process.env.UBER_SESSION_COOKIE);

/**
 * OWNER 3 Nov: a rider session alone is NOT enough. MEASURED on m.uber.com/go/product-selection
 * with the owner's payload and no csrf header: HTTP 403 body "Missing csrf token." So the header
 * must carry the session's real token — read from the session jar when the owner pasted a full
 * cookie string, else UBER_CSRF_TOKEN from hPanel. 'x' stays as the last resort because Uber's own
 * ANONYMOUS bundle literally sends x-csrf-token: x (that is what the guest Products query accepts).
 */
export function uberCsrfToken(jar: Record<string, string>): string {
  // 'ds_csrf' comes from the owner's 3 Nov snippet; 'csrftoken'/'_csrf'/'uber-csrf' are the other
  // names Uber's web stack has used. First match wins, percent-decoded because jars store %3D.
  const wanted = ['xsrf-token', 'csrf-token', 'ds_csrf', 'csrftoken', '_csrf', 'uber-csrf'];
  for (const k of wanted) {
    const hit = Object.keys(jar).find((c) => c.toLowerCase() === k);
    if (hit && jar[hit]) { try { return decodeURIComponent(jar[hit]); } catch { return jar[hit]; } }
  }
  return String(process.env.UBER_CSRF_TOKEN || '').trim() || 'x';
}

/** Returns availability rows from Uber's own guest web catalog. Never throws. */
async function uberGoFlowSafe(ctx: any, rt: { from: string; to: string }): Promise<any[]> {
  try {
    const city = ctxCity(ctx);
    const [a, b] = await Promise.all([geocodePudo(rt.from, city), geocodePudo(rt.to, city)]);
    if (!a || !b) return [];
    // Canonical Uber-side place names (best-effort refinement of the deeplink text).
    const [pu, dr] = await Promise.all([uberPudoPlace(a, rt.from, 'PICKUP'), uberPudoPlace(b, rt.to, 'DROPOFF')]);
    const pickup: UberGoPlace = pu ?? { lat: a.lat, lng: a.lon, name: rt.from.slice(0, 120) };
    const drop: UberGoPlace = dr ?? { lat: b.lat, lng: b.lon, name: rt.to.slice(0, 120) };
    // Owner 30 Oct: the OSS session route. When UBER_SESSION_COOKIE is configured the
    // SAME Products query runs with the rider's session, so Uber answers with real
    // fares instead of {"code":"unauthorized"}; try it first (it needs no priming).
    const session = uberSessionCookies();
    const hasSession = Object.keys(session).length > 0;
    // Ladder: chrome fingerprint, then safari (some Akamai edges rotate).
    let graphql: { status: number; body: string } | null = null;
    if (hasSession) {
      const r = await cffiFetch('https://m.uber.com/go/graphql', {
        method: 'POST', impersonate: 'chrome', timeoutMs: 25_000,
        cookies: session,
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': 'x', Accept: 'application/json', Origin: 'https://m.uber.com', Referer: 'https://m.uber.com/go/product-selection' },
        body: buildUberProductsRequestBody(pickup, drop),
      });
      if (r.status === 200 && (r.body || '').includes('"products"')) graphql = r;
    }
    // A stale/wrong session must never leave Uber with no rows: if the session quote
    // produced nothing, the anonymous ladder still runs and the honest presence /
    // published-average fallbacks remain the caller's safety net.
    for (const fp of (graphql ? [] : ['chrome', 'safari17_0'])) {
      const prime = await cffiFetch('https://m.uber.com/go/looking', {
        impersonate: fp, timeoutMs: 20_000, returnCookies: true,
        headers: { Accept: 'text/html', 'Accept-Language': 'en-IN,en;q=0.9', Referer: 'https://www.uber.com/global/en/price-estimate/' },
      });
      if (prime.status !== 200) continue;
      const r = await cffiFetch('https://m.uber.com/go/graphql', {
        method: 'POST', impersonate: fp, timeoutMs: 25_000,
        cookies: prime.cookies || {},
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': 'x', Accept: 'application/json', Origin: 'https://m.uber.com', Referer: 'https://m.uber.com/go/product-selection' },
        body: buildUberProductsRequestBody(pickup, drop),
      });
      if (r.status === 200 && (r.body || '').includes('"products"')) { graphql = r; break; }
      if (r.status !== 403) break; // 403 -> rotate fingerprint; other failures are not fingerprint-shaped
    }
    let liveSession = hasSession;
    let products: UberGoProduct[] = graphql
      ? parseUberProductsResponse(graphql.body).filter((p) => p.isAvailable).slice(0, 10)
      : [];
    // OWNER 3 Nov: the rider-session Product Selection call (his captured payload). Tried when the
    // Apollo Products query did not return products - with the operator's own session first, then
    // with the primed guest jar so the csrf header comes from a real cookie, not a guess.
    const trySelection = async (jar: Record<string, string>, fp: string): Promise<{ products: UberGoProduct[]; reason: string }> => {
      if (!Object.keys(jar).length) return { products: [], reason: 'no cookie' };
      try {
        const r = await cffiFetch('https://m.uber.com/go/product-selection', {
          method: 'POST', impersonate: fp, timeoutMs: 8_000, cookies: jar,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/plain, */*',
            'Accept-Language': 'en-IN,en;q=0.9',
            'x-csrf-token': uberCsrfToken(jar),
            Origin: 'https://m.uber.com',
            Referer: 'https://m.uber.com/go/product-selection',
          },
          body: buildUberProductSelectionBody(pickup, drop),
        });
        const snippet = String(r.body || '').replace(/\s+/g, ' ').slice(0, 80);
        if (r.status !== 200) return { products: [], reason: `HTTP ${r.status}${snippet ? `: ${snippet}` : ''}${r.status === 404 ? ' (this path is Uber\'s web page route; its fare API is /go/graphql)' : ''}` };
        const parsed = parseUberProductSelectionResponse(r.body).filter((p) => p.isAvailable).slice(0, 10);
        return { products: parsed, reason: parsed.length ? '' : 'HTTP 200 with no products' };
      } catch (e: any) { return { products: [], reason: `network error: ${String(e?.message || e).slice(0, 60)}` }; }
    };
    // Why the session produced nothing, kept for the failure message: the owner pasted a cookie and
    // is entitled to see 401/403 body rather than "no price". MEASURED gap 3 Nov 15:49 on prod: the
    // Uber source was ATTEMPTED with the cookie set, returned no fare, and its rows were then hidden by
    // the price gate - with no reason anywhere in the answer.
    let sessionReason = graphql ? '' : 'Apollo Products returned no products';
    if (graphql) {
      const sessionProducts = parseUberProductsResponse(graphql.body).filter((p) => p.isAvailable);
      const sessionFares = sessionProducts.filter((p) => p.fare != null).length;
      // A valid rider session that still answers 0 fares means Uber did not accept the cookie as a
      // signed-in rider (expired sid / app-only login) - say so instead of "no price".
      if (!sessionFares) sessionReason = `Apollo Products with your session returned ${sessionProducts.length} products but 0 fares (session not accepted as a signed-in rider)`;
    }
    if (!products.length && hasSession) {
      const attempt = await trySelection(session, 'chrome');
      products = attempt.products;
      if (products.length) liveSession = true;
      else sessionReason = `Product Selection ${attempt.reason || 'no products'}`;
    }
    if (!products.length) {
      for (const fp of ['chrome', 'safari17_0']) {
        const prime = await cffiFetch('https://m.uber.com/go/looking', {
          impersonate: fp, timeoutMs: 20_000, returnCookies: true,
          headers: { Accept: 'text/html', 'Accept-Language': 'en-IN,en;q=0.9', Referer: 'https://www.uber.com/global/en/price-estimate/' },
        });
        if (prime.status !== 200) continue;
        const attempt = await trySelection(prime.cookies || {}, fp);
        products = attempt.products;
        if (products.length) { liveSession = false; break; }
        if (!sessionReason) sessionReason = `Product Selection ${attempt.reason || 'no products'}`;
      }
    }
    if (!products.length) {
      // AN HONEST REASON BEATS A SILENT MISS: a configured session that yields no fare is a failure
      // the owner must be able to read (401/403 body, csrf, expired sid), not an empty list.
      if (hasSession) throw new AcquisitionError('UNAUTHORIZED', `Uber rider session did not return a fare (${sessionReason || 'unknown reason'})`);
      return [];
    }
    const uberClientId = String(process.env.UBER_CLIENT_ID || 'vjgXa6VEp5eVJNMBtlPEsYZ5agg9cy_w').trim();
    const today = new Date().toISOString().slice(0, 10);
    const bookUrl = buildUberGoBookUrl(uberClientId, pickup, drop);
    // Owner 27 Oct: app-level deeplink — the CTA opens the installed Uber app with
    // pickup/drop prefilled, tracked through /api/app-open, web page as fallback.
    const uberApp = cabAppOpenUrl(cabLinks('Uber', {
      pickup: { lat: Number(pickup.lat), lng: Number(pickup.lng), name: pickup.name },
      drop: { lat: Number(drop.lat), lng: Number(drop.lng), name: drop.name },
    }, bookUrl));
    const route = `${rt.from} to ${rt.to}`.toLowerCase();
    return products.map((p) => newRawItem(ctx.source, {
      title: `${rt.from} to ${rt.to} Uber ${p.displayName} (app quote)`,
      brand: 'Uber',
      ...(p.fare != null ? { price: p.fare, currency: 'INR' } : { currency: 'INR' }),
      seller: 'Uber',
      sellerUrl: uberApp || bookUrl,
      travel: { route, seatType: 'unknown' },
      attributes: {
        pickup: rt.from, drop: rt.to, route: `${rt.from} to ${rt.to}`,
        vehicle_type: p.displayName, trip_type: 'one-way',
        ...(p.capacity ? { seat_capacity: String(p.capacity) } : {}),
        ...(p.etaMinutes ? { eta_minutes: String(p.etaMinutes) } : {}),
        ...(p.description ? { vehicle_description: p.description } : {}),
        ...(p.tier ? { fare_tier: p.tier } : {}),
        price_basis: p.fare != null
          ? (liveSession ? `Uber live session quote for this route on ${today}` : `Uber guest web quote for this route on ${today}`)
          : 'app_only_fares',
        data_note: p.fare != null
          ? (liveSession
            ? `Live fare from Uber's own ride web app (m.uber.com/go Products / Product Selection query, sent with the operator's own rider session + csrf token on ${today}); deeplink is the owner-specified m.uber.com/looking format with pickup/drop prefilled, routed via /api/out so an affiliate campaign attaches when available.`
            : `Live fare from Uber's own guest ride web app (m.uber.com/go Products query) on ${today}; deeplink is the owner-specified m.uber.com/looking format with pickup/drop prefilled, routed via /api/out so an affiliate campaign attaches when available.`)
          : `Uber's own guest ride web app (m.uber.com/go) lists ${p.displayName} as available for this exact route, but quotes the fare only after login / in the app -- never estimated. Deeplink opens Uber's booking flow with this route prefilled, routed via /api/out so an affiliate campaign attaches when available.`,
      },
      identifiers: { sku: `uber-go-${rt.from}-${rt.to}-${p.displayName}`.toLowerCase().replace(/\s+/g, '-') },
      evidence: { sourceUrl: 'https://m.uber.com/go/graphql', extractedFields: ['products tiers', 'displayName', 'fares', 'capacity'], sourceReference: 'Uber guest ride web app Products query (ANONYMOUS)' },
    }));
  } catch { return []; } // SSR fallback is the caller's honest safety net
}

/** SSR city-guide fallback: emit the honest published average when the queried
 *  destination appears in Uber's own city fare table. Never fabricates. */
async function uberSsrFallback(ctx: any, rt: { from: string; to: string }, reason: string, goRows: any[] = []): Promise<any[]> {
  // City resolution: curated metro guides first (alias keys), then Uber's OWN sitemap-published
  // India city-page registry (2241 localities, scanned 17 Oct). A published page = real presence.
  const [fromCity, toCity] = await Promise.all([cityForPlace(rt.from), cityForPlace(rt.to)]);
  const curated = uberCitySlugFor(rt.from) || uberCitySlugFor(cityFromRouteText(rt.from))
    || uberCitySlugFor(rt.to) || uberCitySlugFor(cityFromRouteText(rt.to));
  const registry = (fromCity && uberIndiaCityFor(fromCity)) || uberIndiaCityFor(rt.from)
    || (toCity && uberIndiaCityFor(toCity)) || uberIndiaCityFor(rt.to) || uberIndiaCityFor(cityFromRouteText(rt.to));
  const cityInfo = curated || registry;
  if (!cityInfo) {
    if (goRows.length) return goRows; // Uber's own guest app just served this route's catalog — real presence, no city page needed.
    throw new AcquisitionError('EMPTY_RESPONSE', `Uber live fare unavailable (${reason}); no Uber city page exists for this city in Uber's own sitemap, and no live guest fare API is available without credentials.`);
  }
  let fares: UberCityFare[] = [];
  let pricedRows: any[] | null = null;
  try {
    fares = await uberCityFares(cityInfo.slug, cityInfo.city);
  } catch {
    fares = []; // presence page without a published fare table -> app-only row below
  }
  // match either route endpoint against published destinations, best score wins
  // Only the DROP side may match a published destination — matching the pickup
  // produced absurd offers (e.g. "delhi to kanpur" -> "Delhi Cantt station").
  let best: { fare: UberCityFare; score: number; end: string } | null = null;
  // The bare-city alternate (cityFromRouteText) exists for DECORATED intercity drops
  // ("Ujjain, Madhya Pradesh" -> "Ujjain"), but for an INTRA-CITY query the drop's city
  // text IS the guide's own city — matching it against the guide's own-city landmark
  // rows ("Indore Jn.") priced a route the user never typed, and the route filter then
  // dropped the row, silently vanishing Uber from intra-city results (owner bug 17 Oct).
  // Suppress the alternate when it names the guide city itself; the raw drop must match.
  // INTRA-CITY guard (owner bug 17 Oct): when BOTH endpoints sit inside the guide's own
  // city, every published landmark in that city's fare table scores high on the shared
  // city token — the guide's own-city averages ("Indore Jn.") priced a route the user
  // never typed, and the route filter then dropped the row, silently vanishing Uber.
  const guideCityRe = new RegExp(`\\b${cityInfo.city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  const intraCity = guideCityRe.test(rt.from) && guideCityRe.test(rt.to);
  const altCity = cityFromRouteText(rt.to).toLowerCase();
  const altAllowed = !intraCity && altCity !== cityInfo.city.toLowerCase();
  for (const fare of fares) {
    const score = intraCity ? 0 : Math.max(uberDestMatchScore(rt.to, fare.dest), altAllowed ? uberDestMatchScore(altCity, fare.dest) : 0);
    if (score >= 0.5 && (!best || score > best.score)) best = { fare, score, end: rt.to };
  }
  if (!best) { pricedRows = null; } // city has fares but not for this destination -> app-only row below
  if (best) {
  const dropName = best.fare.dest;
  const drop = (await photonGeocode(`${dropName}, ${cityInfo.city}`)) || (await geocodePlace(rt.to));
  const today = new Date().toISOString().slice(0, 10);
  const uberClientId = String(process.env.UBER_CLIENT_ID || 'vjgXa6VEp5eVJNMBtlPEsYZ5agg9cy_w').trim();
  const ul = new URL('https://m.uber.com/ul/');
  ul.searchParams.set('client_id', uberClientId);
  ul.searchParams.set('action', 'setPickup');
  ul.searchParams.set('pickup[my_location]', 'true');
  if (drop) {
    ul.searchParams.set('dropoff[latitude]', String(drop.lat));
    ul.searchParams.set('dropoff[longitude]', String(drop.lon));
  }
  ul.searchParams.set('dropoff[nickname]', dropName.slice(0, 60));
  return [newRawItem(ctx.source, {
    title: `${cityInfo.city} to ${dropName} cab (UberX, published average)`,
    brand: 'Uber',
    price: best.fare.price, currency: 'INR',
    seller: 'Uber',
    travel: { route: `${cityInfo.city} to ${dropName}`.toLowerCase(), seatType: 'unknown' },
    attributes: {
      pickup: cityInfo.city, drop: dropName, route: `${cityInfo.city} to ${dropName}`,
      vehicle_type: 'UberX', trip_type: 'one-way',
      price_basis: `Uber-published ${cityInfo.city} average for ${dropName} (UberX) on ${today}`,
      data_note: `Fare is Uber's own published city-guide average (SSR table on uber.com), not a live route quote; live quotes need official API credentials (${reason}). Deeplink is the Uber universal link with our client_id, routed via /api/out so an affiliate campaign (direct or network) attaches when available.`,
    },
    sellerUrl: ul.toString(),
    identifiers: { sku: `uber-ssr-${best.fare.slug}-${dropName}`.toLowerCase().replace(/\s+/g, '-') },
    evidence: { sourceUrl: best.fare.fetchedUrl, extractedFields: ['SSR city-guide fare table row'] },
  }), ...goRows];
  }

  // Guest-app catalog rows (24 Oct) are richer than the generic presence row below.
  if (goRows.length) return goRows;

  // Presence-only path (owner request 17 Oct: "Uber 96+ cities without API"). Uber's own
  // sitemap publishes a city page for this city (2241 Indian localities), but no web fare
  // exists for this route — surface an honest "available only on app" row, price invented NEVER.
  const cityPage = `https://www.uber.com/global/en/r/cities/${cityInfo.slug}/`;
  return [newRawItem(ctx.source, {
    title: `${rt.from} to ${rt.to} Uber cab (app booking)`,
    brand: 'Uber',
    currency: 'INR',
    seller: 'Uber',
    sellerUrl: cityPage,
    travel: { route: `${rt.from} → ${rt.to}` },
    attributes: {
      pickup: rt.from, drop: rt.to, route: `${rt.from} → ${rt.to}`,
      vehicle_type: 'Uber cab', trip_type: 'one-way',
      price_basis: 'app_only_fares',
      fare_table_note: fares.length ? `Uber's published ${cityInfo.city} fare table covers ${fares.length} other destinations` : '',
      data_note: `Uber operates in ${cityInfo.city} (Uber's own sitemap-published city page); live fares are quoted only in the Uber app or after web login — available only on app, never estimated (${reason}).`,
    },
    identifiers: { sku: `uber-presence-${cityInfo.slug}`.toLowerCase().replace(/\s+/g, '-') },
    evidence: { sourceUrl: cityPage, extractedFields: ['title', 'seller', 'currency'], sourceReference: "Uber's sitemap-published city page (presence; app-only fares)" },
  })];
}


// ---------------------------------------------------------------------------
// Ola rate-card fallback (no API key needed).
// Ola's own merchandising web app (webapps.olacabs.com) exposes the official
// BPD rate-card database: guest cookie session (XSRF-TOKEN + _csrf) +
// X-Client-Key header unlocks POST /fleet/pricing/v1/ratecard/all, returning
// EVERY live p2p rate card for a city (base fare, per-km slabs, per-minute
// rate, min fare — actively maintained, some cards updated same-day).
// We combine Ola's own published rate card with the OSRM road distance for a
// transparent, labelled estimate. Never presented as a live surge quote.
const OLA_RC_BASE = 'https://webapps.olacabs.com';
const OLA_RC_KEY = 'a3abb50bpd6p4bcdb519df4f0a140f53jfkhqfad'; // public web client token from window.owConfig
let _olaCityCache: { at: number; cities: { id: number; name: string; display_name?: string; country_code?: string; timezone?: string }[] } | null = null;

async function olaCityList(): Promise<{ id: number; name: string; display_name?: string; country_code?: string; timezone?: string }[]> {
  if (_olaCityCache && Date.now() - _olaCityCache.at < 24 * 3600 * 1000) return _olaCityCache.cities;
  const r = await cffiFetch(`${OLA_RC_BASE}/fleet/bpdproxy/bpd/rest/v1/city?country_code=IN`, { impersonate: 'chrome', timeoutMs: 20_000, headers: { Accept: 'application/json', 'X-Client-Key': OLA_RC_KEY, 'X-TraceId': `t1s-${Date.now()}`, Referer: `${OLA_RC_BASE}/merchandising/rate-card?api_ver=v1`, Origin: OLA_RC_BASE } });
  if (r.status !== 200) throw new AcquisitionError('SERVER_ERROR', `Ola BPD city list HTTP ${r.status}`, r.status);
  const j = JSON.parse(r.body || '[]');
  if (!Array.isArray(j) || !j.length) throw new AcquisitionError('EMPTY_RESPONSE', 'Ola BPD city list empty');
  _olaCityCache = { at: Date.now(), cities: j };
  return j;
}

function olaCityFor(place: string): { id: number; name: string; timezone?: string } | null {
  // best-effort name match against Ola's own city registry (unseeded calls set cache)
  const p = place.toLowerCase();
  return null; // resolved after cityList is awaited in olaRateCardFallback
}

export interface OlaRateCard { category: string; description?: string; base_fare?: number; inclusive_km?: number; rate_per_km?: number; rate_per_unit_distance?: number; rate_per_trip_minute?: number; min_fare?: number; threshold_1?: number | null; threshold_2?: number | null; rate_after_threshold_1?: number | null; rate_after_threshold_2?: number | null; created_at?: string; time_of_day?: string | null }

/** Ola's own slab fare formula (distance-based thresholds + per-minute rate). */
export function olaCardFare(c: OlaRateCard, km: number, mins: number): number {
  const base = Number(c.base_fare) || 0;
  const inclusive = Number(c.inclusive_km) || 0;
  const r1 = Number(c.rate_per_km) || Number(c.rate_per_unit_distance) || 0;
  const t1 = c.threshold_1 != null ? Number(c.threshold_1) : null;
  const t2 = c.threshold_2 != null ? Number(c.threshold_2) : null;
  const rA = Number(c.rate_after_threshold_1) || r1;
  const rB = Number(c.rate_after_threshold_2) || rA;
  const perMin = Number(c.rate_per_trip_minute) || 0;
  let fare = base;
  let rem = Math.max(km - inclusive, 0);
  if (rem > 0 && r1 > 0) {
    if (t1 != null) {
      const s1 = Math.min(rem, Math.max(t1 - inclusive, 0));
      fare += s1 * r1; rem -= s1;
      if (rem > 0 && t2 != null) {
        const s2 = Math.min(rem, Math.max(t2 - t1, 0));
        fare += s2 * rA; rem -= s2;
        if (rem > 0) fare += rem * rB;
      } else if (rem > 0) fare += rem * rA;
    } else fare += rem * r1;
  }
  fare += perMin * mins;
  const minF = Number(c.min_fare) || 0;
  return Math.max(Math.round(fare), Math.round(minF));
}

const OLA_CATEGORY_LABELS: { cat: string; label: string }[] = [
  { cat: 'auto', label: 'Ola Auto' },
  { cat: 'bike', label: 'Ola Bike' },
  { cat: 'mini_non_ac', label: 'Ola Mini' },
  { cat: 'compact', label: 'Ola Compact' },
  { cat: 'prime_play', label: 'Ola Prime Play' },
  { cat: 'prime_plus', label: 'Ola Prime' },
  { cat: 'economy_suv', label: 'Ola SUV' },
  { cat: 'luxury_sedan', label: 'Ola Luxury Sedan' },
  { cat: 'erick', label: 'Ola e-Rick' },
];

/**
 * OWNER 3 Nov ("ola, rapido ka v price aata tha wo v check kro ab kyun ni aata"): MEASURED with the
 * real workers in this sandbox - Ola answers a priced row (Rs 138 Rajwada->Airport) and Rapido 4 priced
 * rows (Rs 54/101/127), so neither parser is broken. But on production NO live cab source succeeded in
 * the recorded search: Ola had NO outcome at all (still fetching at snapshot time) while Rapido failed
 * silently. Ola's chain costs two Ola round-trips (guest session + full rate-card DB) plus OSRM on EVERY
 * search, which is why the answer was cut before it landed. The rate-card DB is city-level reference
 * data (base/slabs), not a quote - caching it cannot change a price, it only removes latency.
 */
const _olaRcCache = new Map<number, { at: number; cards: OlaRateCard[] }>();
const OLA_RC_TTL_MS = 12 * 3600 * 1000;
const _osrmCache = new Map<string, { at: number; km: number; mins: number }>();
const OSRM_TTL_MS = 6 * 3600 * 1000;

/** Guest session (cookie jar) + full rate-card DB for one Ola city. */
async function olaRateCards(cityId: number, timezone: string | undefined): Promise<OlaRateCard[]> {
  const hit = _olaRcCache.get(cityId);
  if (hit && Date.now() - hit.at < OLA_RC_TTL_MS) return hit.cards;
  const p: any = await cffiFetch(`${OLA_RC_BASE}/merchandising/rate-card?api_ver=v1`, { impersonate: 'chrome', timeoutMs: 20_000, returnCookies: true, headers: { Accept: 'text/html', 'Accept-Language': 'en-IN,en;q=0.9' } });
  const jar = Object.entries(p.cookies || {}).map(([k, v]: any) => `${k}=${encodeURIComponent(v)}`).join('; ');
  const xsrf = (p.cookies || {})['XSRF-TOKEN'] || '';
  const H: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Client-Key': OLA_RC_KEY, 'X-TraceId': `t1s-${Date.now()}`, 'csrf-token': xsrf, Cookie: jar, Referer: `${OLA_RC_BASE}/merchandising/rate-card?api_ver=v1`, Origin: OLA_RC_BASE };
  const r = await cffiFetch(`${OLA_RC_BASE}/fleet/pricing/v1/ratecard/all`, { impersonate: 'chrome', timeoutMs: 30_000, method: 'POST', headers: { ...H, 'x-timezone': timezone || 'IST' }, body: JSON.stringify({ city_id: cityId, country: 'IN', service_type: { p2p: null }, user_request_time: null }) });
  if (r.status !== 200 || !(r.body || '').includes('p2p')) throw new AcquisitionError('SERVER_ERROR', `Ola rate-card DB HTTP ${r.status}`, r.status);
  const j = JSON.parse(r.body || '{}');
  const now = Date.now();
  const isDate = (s?: string) => (s ? new Date(s.replace(' ', 'T') + (s.includes('+') ? '' : '+05:30')).getTime() : NaN);
  const cards: OlaRateCard[] = (j.p2p || []).filter((c: any) =>
    !c.deleted_at && c.status === 'approved' && c.rate_card_type === 'base' &&
    (!c.valid_to || isDate(c.valid_to) > now) && (!c.valid_from || isDate(c.valid_from) <= now) &&
    (c.threshold_type == null || c.threshold_type === 'distance_based') &&
    (Number(c.base_fare) || 0) >= 0 && (Number(c.rate_per_km) || Number(c.rate_per_unit_distance) || 0) > 0);
  if (cards.length) _olaRcCache.set(cityId, { at: Date.now(), cards });
  return cards;
}

/** Pick ONE live consumer card per category: prefer all-day (AL) time-of-day, newest wins. */
export function olaPickCards(cards: OlaRateCard[]): Record<string, OlaRateCard> {
  const best: Record<string, OlaRateCard> = {};
  const rank = (x: OlaRateCard) => ((x.time_of_day === 'AL' || !x.time_of_day ? 1 : 0) * 1e12) + new Date(String(x.created_at || '').replace(' ', 'T') + '+05:30').getTime();
  for (const c of cards) {
    if (!OLA_CATEGORY_LABELS.some((l) => l.cat === c.category)) continue;
    const prev = best[c.category];
    if (!prev || rank(c) > rank(prev)) best[c.category] = c;
  }
  return best;
}

/** Rate-card fallback: Ola's own published per-city fare formula + OSRM road distance. */
async function olaRateCardFallback(ctx: any, rt: { from: string; to: string }, reason: string): Promise<any[]> {
  const cities = await olaCityList();
  const pFrom = rt.from.toLowerCase(); const pTo = rt.to.toLowerCase();
  // UI endpoints are locality-decorated ("Chappan Dukan / MG Road, Indore") — match the
  // raw string first, then the extracted clean city ("Indore").
  const cFrom = cityFromRouteText(rt.from).toLowerCase(); const cTo = cityFromRouteText(rt.to).toLowerCase();
  const nm = (c: any) => String(c.name || '').toLowerCase();
  let city = cities.find((c) => pFrom.includes(nm(c))) || cities.find((c) => cFrom.includes(nm(c)))
    || cities.find((c) => pTo.includes(nm(c))) || cities.find((c) => cTo.includes(nm(c)));
  if (!city) {
    // geographic fallback: geocode pickup, pick the city whose boundary center is nearest? boundaries are polygons; use name distance instead
    throw new AcquisitionError('EMPTY_RESPONSE', `Ola fare unavailable (${reason}); "${rt.from}" is not an Ola operating city in Ola's own BPD registry (${cities.length} IN cities).`);
  }
  const [cards, a, b] = await Promise.all([olaRateCards(city.id, city.timezone), geocodePudo(rt.from, city.name), geocodePudo(rt.to, city.name)]);
  if (!a || !b) return [];
  // Road distance is a property of the coordinates, not of the fare: the same pickup/drop always
  // gives the same km, so a repeat search (or the web + app asking the same ride) reuses it.
  const okey = `${a.lat.toFixed(4)},${a.lon.toFixed(4)}>${b.lat.toFixed(4)},${b.lon.toFixed(4)}`;
  const ohit = _osrmCache.get(okey);
  let km: number; let mins: number;
  if (ohit && Date.now() - ohit.at < OSRM_TTL_MS) {
    km = ohit.km; mins = ohit.mins;
  } else {
    const osrm = await cffiFetch(`https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`, { timeoutMs: 15_000, headers: { Accept: 'application/json' } });
    if (osrm.status !== 200) throw new AcquisitionError('SERVER_ERROR', `OSRM HTTP ${osrm.status}`, osrm.status);
    const route = (JSON.parse(osrm.body || '{}').routes || [])[0];
    if (!route) throw new AcquisitionError('NOT_FOUND', `OSRM found no road route between ${rt.from} and ${rt.to}`);
    km = Number(route.distance) / 1000;
    mins = Number(route.duration) / 60;
    _osrmCache.set(okey, { at: Date.now(), km, mins });
  }
  // pick ONE live card per consumer category (prefer all-day "AL", newest wins)
  const best = olaPickCards(cards);
  const today = new Date().toISOString().slice(0, 10);
  const items: any[] = [];
  for (const { cat, label } of OLA_CATEGORY_LABELS) {
    const card = best[cat];
    if (!card) continue;
    const price = olaCardFare(card, km, mins);
    if (!price || price < 10 || price > 100000) continue;
    const ul = new URL('https://book.olacabs.com/');
    ul.searchParams.set('lat', String(a.lat));
    ul.searchParams.set('lng', String(a.lon));
    ul.searchParams.set('drop_lat', String(b.lat));
    ul.searchParams.set('drop_lng', String(b.lon));
    items.push(newRawItem(ctx.source, {
      title: `${rt.from} to ${rt.to} cab (${label}, one-way)`,
      brand: 'Ola',
      price, currency: 'INR',
      seller: 'Ola',
      travel: { route: `${rt.from} to ${rt.to}`.toLowerCase(), seatType: 'unknown' },
      attributes: {
        pickup: rt.from, drop: rt.to, route: `${rt.from} to ${rt.to}`,
        vehicle_type: label, trip_type: 'one-way',
        price_basis: `Estimate computed from Ola's own published ${city.name} rate card (${label}) + OSRM road distance (${km.toFixed(1)} km), retrieved ${today}`,
        data_note: `Ola has no public guest fare API without OLA_API_KEY (${reason}). This estimate applies Ola's official BPD rate-card formula (base + distance slabs + per-minute) to the real OSRM road distance; it is not a live surge-adjusted quote. Deeplink opens Ola web booking with pickup set; complete the ride in the app.`,
      },
      sellerUrl: ul.toString(),
      identifiers: { sku: `ola-rc-${city.id}-${cat}-${rt.from}-${rt.to}`.toLowerCase().replace(/\s+/g, '-') },
      evidence: { sourceUrl: `${OLA_RC_BASE}/merchandising/rate-card?api_ver=v1`, extractedFields: ['Ola BPD rate card (p2p, approved, base)'] },
    }));
  }
  if (!items.length) throw new AcquisitionError('EMPTY_RESPONSE', `Ola rate-card DB has no live consumer card for ${city.name}`);
  return items.sort((x, y) => x.price - y.price);
}

export const cabWorker: VerticalWorker = {
  vertical: 'cab',
  tasks: [
    {
      // ---- Owner-mandated cab sources: attempted live on every cab search, honestly reported ----
      // Ola: official Ola Cabs API fare estimates (developers.olacabs.com). Credentials in
      // OLA_API_KEY (owner supplies the real app token; demo keys are rejected by Ola).
      sourceId: 'w_cab_ola',
      name: 'Cab worker: Ola India fare estimates (official API)',
      priority: 15,
      maxPerMinute: 10,
      // Owner 23 Oct: the rate-card fallback chain is serial (geocode both ends
      // -> OSRM distance -> rate-card page -> pricing POST) and can exceed 25s on
      // a slow network leg, killing the task right before rows land (live 'cab
      // results nahi aa rahe'). 40s matches AbhiBus; the progressive floor
      // still paints instantly, live rows just get a fair chance to arrive.
      timeoutMs: 40_000,
      run: async (ctx) => {
        const key = String(process.env.OLA_API_KEY || '').trim();
        const rt = cabRoute(ctx);
        if (!rt) return [];
        if (!key) return olaRateCardFallback(ctx, rt, 'OLA_API_KEY not configured in hPanel env');
        const city = ctxCity(ctx);
        const [a, b] = await Promise.all([geocodePudo(rt.from, city), geocodePudo(rt.to, city)]);
        if (!a || !b) return [];
        const url = `https://devapi.olacabs.com/v1/products?pickup_lat=${a.lat}&pickup_lng=${a.lon}&drop_lat=${b.lat}&drop_lng=${b.lon}&category=sedan&response_type=json`;
        const r = await cffiFetch(url, { timeoutMs: 18_000, headers: { 'X-APP-TOKEN': key, Accept: 'application/json' } });
        if (r.status === 401 || r.status === 403) return olaRateCardFallback(ctx, rt, `official Ola API rejected the key (HTTP ${r.status})`);
        if (r.status !== 200) return olaRateCardFallback(ctx, rt, `official Ola API HTTP ${r.status}`);
        let j: any; try { j = JSON.parse(r.body); } catch { throw new AcquisitionError('MALFORMED_RESPONSE', 'Ola API non-JSON'); }
        const cats: any[] = Array.isArray(j?.categories) ? j.categories : [];
        const items = [];
        const today = new Date().toISOString().slice(0, 10);
        for (const c of cats.slice(0, 4)) {
          const fares = c?.ride_estimate?.fare_breakup;
          const total = Array.isArray(fares) ? fares.find((f: any) => String(f?.type || '').includes('total')) : null;
          const price = Math.round(Number(total?.amount ?? c?.ride_estimate?.amount_max ?? 0));
          if (!price) continue;
          const vehicle = String(c.display_name || c.category || 'Ola cab').slice(0, 60);
          items.push(newRawItem(ctx.source, {
            title: `${rt.from} to ${rt.to} cab (${vehicle}, one-way)`,
            brand: 'Ola',
            price, currency: 'INR',
            seller: 'Ola',
            sellerUrl: cabAppOpenUrl(cabLinks('Ola', {
              pickup: { lat: Number(a.lat), lng: Number(a.lon) },
              drop: { lat: Number(b.lat), lng: Number(b.lon) },
            }, `https://book.olacabs.com/?lat=${a.lat}&lng=${a.lon}&drop_lat=${b.lat}&drop_lng=${b.lon}`))
              || `https://book.olacabs.com/?lat=${a.lat}&lng=${a.lon}&drop_lat=${b.lat}&drop_lng=${b.lon}`,
            travel: { route: `${rt.from} to ${rt.to}`.toLowerCase(), seatType: 'unknown' },
            attributes: {
              pickup: rt.from, drop: rt.to, route: `${rt.from} to ${rt.to}`,
              vehicle_type: vehicle, trip_type: 'one-way',
              price_basis: `Ola API fare estimate on ${today}`,
              data_note: 'Fare estimate from the official Ola Cabs API (developers.olacabs.com)',
            },
            identifiers: { sku: `ola-${rt.from}-${rt.to}-${vehicle}`.toLowerCase().replace(/\s+/g, '-') },
            evidence: { sourceUrl: url, extractedFields: ['Ola API fare_breakup total_fare'] },
          }));
        }
        if (!items.length) throw new AcquisitionError('EMPTY_RESPONSE', 'Ola API returned no fare estimate for this route');
        return items;
      },
    },

    {
      // Uber: official Uber API price estimates (developer.uber.com / v1.2). Auth: OAuth2
      // client_credentials (UBER_APPLICATION_ID + UBER_CLIENT_SECRET) with legacy UBER_SERVER_TOKEN
      // fallback. Token is fetched from login.uber.com/oauth/v2/token and cached in-process.
      sourceId: 'w_cab_uber',
      name: 'Cab worker: Uber India fare estimates (official API)',
      priority: 15,
      maxPerMinute: 10,
      timeoutMs: 40_000,
      run: async (ctx) => {
        const rt = cabRoute(ctx);
        if (!rt) return [];
        let authHeaders: Record<string, string> | null = null;
        const appId = String(process.env.UBER_APPLICATION_ID || '').trim();
        const appSecret = String(process.env.UBER_CLIENT_SECRET || '').trim();
        const serverToken = String(process.env.UBER_SERVER_TOKEN || '').trim();
        if (appId && appSecret) {
          const bearer = await uberBearerToken(appId, appSecret);
          if (bearer) authHeaders = { Authorization: `Bearer ${bearer}` };
        }
        if (!authHeaders && serverToken) authHeaders = { Authorization: `Token ${serverToken}` };
        // Guest web-app catalog rows (m.uber.com/go, discovered 24 Oct) enrich every
        // credential-less path: appended after an SSR published-average price row, or
        // replacing the generic presence row entirely.
        const noCredsPath = async (why: string) => uberSsrFallback(ctx, rt, why, await uberGoFlowSafe(ctx, rt));
        if (!authHeaders) return noCredsPath('no Uber credential configured (official UBER_APPLICATION_ID + UBER_CLIENT_SECRET / UBER_SERVER_TOKEN, or an UBER_SESSION_COOKIE rider session)');
        const [a, b] = await Promise.all([geocodePudo(rt.from, ctxCity(ctx)), geocodePudo(rt.to, ctxCity(ctx))]);
        if (!a || !b) return [];
        const apiHost = String(process.env.UBER_API_HOST || 'api.uber.com').trim() || 'api.uber.com'; // set UBER_API_HOST=sandbox-api.uber.com to test against Uber's sandbox
        const url = `https://${apiHost}/v1.2/estimates/price?start_latitude=${a.lat}&start_longitude=${a.lon}&end_latitude=${b.lat}&end_longitude=${b.lon}`;
        const r = await cffiFetch(url, { timeoutMs: 18_000, headers: { ...authHeaders, Accept: 'application/json' } });
        if (r.status === 401 || r.status === 403) return noCredsPath(`official Uber API rejected credentials (HTTP ${r.status})`);
        if (r.status !== 200) throw new AcquisitionError('SERVER_ERROR', `Uber API HTTP ${r.status}`, r.status);
        let j: any; try { j = JSON.parse(r.body); } catch { throw new AcquisitionError('MALFORMED_RESPONSE', 'Uber API non-JSON'); }
        const prices: any[] = Array.isArray(j?.prices) ? j.prices : [];
        const items = [];
        const today = new Date().toISOString().slice(0, 10);
        // Owner 24 Oct evening ("real price chaiye"): Uber India returns `estimate`
        // as a LOCALIZED STRING ("₹221", "₹110-130", "Metered") — Number("₹221") is
        // NaN, so valid-token quotes were being SILENTLY DROPPED. Parse the string
        // honestly: ranges take the midpoint, "Metered" (no estimate) falls back to
        // low_estimate/high_estimate midpoint, else the single number wins.
        const parseUberEstimate = (p: any): number => {
          const est = String(p?.estimate ?? '');
          const nums = (est.match(/[\d,.]+/g) || []).map((x: string) => Number(x.replace(/,/g, ''))).filter((n: number) => Number.isFinite(n) && n > 0);
          if (nums.length === 1) return Math.round(nums[0]);
          if (nums.length >= 2) return Math.round((nums[0] + nums[1]) / 2);
          const lo = Number(p?.low_estimate ?? 0), hi = Number(p?.high_estimate ?? 0);
          if (lo > 0 && hi > 0) return Math.round((lo + hi) / 2);
          if (lo > 0) return Math.round(lo);
          if (hi > 0) return Math.round(hi);
          return 0;
        };
        for (const p of prices.slice(0, 8)) {
          const price = parseUberEstimate(p);
          if (!price) continue;
          const vehicle = String(p.localized_display_name || 'Uber cab').slice(0, 60);
          const uberClientId = String(process.env.UBER_CLIENT_ID || 'vjgXa6VEp5eVJNMBtlPEsYZ5agg9cy_w').trim();
          const ul = new URL('https://m.uber.com/ul/');
          ul.searchParams.set('client_id', uberClientId);
          ul.searchParams.set('action', 'setPickup');
          ul.searchParams.set('pickup[my_location]', 'true');
          ul.searchParams.set('dropoff[latitude]', String(b.lat));
          ul.searchParams.set('dropoff[longitude]', String(b.lon));
          ul.searchParams.set('dropoff[nickname]', rt.to.slice(0, 60));
          items.push(newRawItem(ctx.source, {
            title: `${rt.from} to ${rt.to} cab (${vehicle}, one-way)`,
            brand: 'Uber',
            price, currency: String(p.currency_code || 'INR'),
            seller: 'Uber',
            travel: { route: `${rt.from} to ${rt.to}`.toLowerCase(), seatType: 'unknown' },
            attributes: {
              pickup: rt.from, drop: rt.to, route: `${rt.from} to ${rt.to}`,
              vehicle_type: vehicle, trip_type: 'one-way',
              distance_km: p.distance != null ? String(Math.round(p.distance * 10) / 10) : '',
              duration_minutes: p.duration != null ? String(Math.round(p.duration / 60)) : '',
              fare_range: p.low_estimate && p.high_estimate ? `Rs ${p.low_estimate} - Rs ${p.high_estimate}` : '',
              price_basis: `Uber API price estimate on ${today}`,
              data_note: `Fare estimate from the official Uber API (${apiHost} /v1.2/estimates/price); deeplink is the Uber universal link with our client_id, routed via /api/out so an affiliate campaign (direct or network) attaches when available`,
            },
            sellerUrl: ul.toString(),
            identifiers: { sku: `uber-${rt.from}-${rt.to}-${vehicle}`.toLowerCase().replace(/\s+/g, '-') },
            evidence: { sourceUrl: url, extractedFields: ['Uber API estimates/price'] },
          }));
        }
        if (!items.length) return noCredsPath('official Uber API returned no fare estimate for this route');
        return items;
      },
    },
    {
      // Rapido (owner request 17 Oct: add without API). rapido.bike publishes NO fares on the web
      // (route/city pages are SEO content; the web bundle references only internal .svc hosts),
      // but it DOES publish which cities it serves (cities sitemap, 96 cities) and per-route pages.
      // For INTRA-CITY queries inside a served city we emit honest availability rows
      // (Bike Taxi / Auto / Cab) with the fare left "available only on app" — zero numbers invented.
      // Intercity queries return [] honestly: Rapido's published network is city-local.
      sourceId: 'w_cab_rapido',
      name: 'Cab worker: Rapido live city fares (Bike/Auto/Cab, guest fare API) + availability fallback',
      priority: 15,
      run: async (ctx) => {
        const rt = cabRoute(ctx);
        if (!rt) return [];
        const fetchText = async (url: string): Promise<string> => {
          const r = await cffiFetch(url, { impersonate: 'chrome', timeoutMs: 15_000, headers: { Accept: 'application/xml,text/xml,*/*' } });
          if (r.status !== 200) throw new AcquisitionError('EMPTY_RESPONSE', `Rapido sitemap HTTP ${r.status}`);
          return r.body || '';
        };
        const [cities, fromCity, toCity] = await Promise.all([
          rapidoServedCities(fetchText),
          cityForPlace(rt.from),
          cityForPlace(rt.to),
        ]);
        let a = fromCity ? rapidoCityLookup(cities, fromCity) : null;
        let b = toCity ? rapidoCityLookup(cities, toCity) : null;
        // Locality text ("indore bypass") resolves to no pincode, so cityForPlace hands
        // back the raw string and the strict lookup misses. The place text itself NAMES
        // a served city (word-boundary) — that is real evidence, not invention.
        const cityInText = (place: string) => cities.find((c) =>
          new RegExp(`\\b${c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(place)) || null;
        if (!a) a = cityInText(`${rt.from} ${fromCity || ''}`);
        if (!b) b = cityInText(`${rt.to} ${toCity || ''}`);
        // Text-hint fallback: some area pincodes exist in neither India Post nor OSM
        // (e.g. "Indore Airport (452022)") — but the endpoint text itself names the
        // other endpoint's resolved city, which is real evidence, not invention.
        const namesCity = (place: string, city: string) =>
          cityFromRouteText(place).toLowerCase().includes(city.toLowerCase()) || place.toLowerCase().includes(city.toLowerCase());
        if (!a && b && b.name && namesCity(rt.from, b.name)) a = b;
        if (!b && a && a.name && namesCity(rt.to, a.name)) b = a;
        // Self-healing locality resolution (owner 22 Oct): bare localities ("Vijay Nagar",
        // "Connaught Place") name no city and carry no pincode, so the text paths above miss
        // and Rapido rows silently vanished even though the trip is inside a served city.
        // Resolve the locality through the cached OSM geocoder (forward -> reverse) and match
        // the REAL city OSM reports against Rapido's served-city registry. A failed lookup
        // stays honest (no rows), never guessed.
        const osmCity = async (place: string, hint?: string) => {
          try {
            const g = (await geoSearch(hint && !place.toLowerCase().includes(hint.toLowerCase()) ? `${place} ${hint}` : place, 1))[0];
            if (!g) return null;
            const rev = await geoReverse(g.lat, g.lng);
            const c = rev?.city || '';
            return c ? rapidoCityLookup(cities, c) : null;
          } catch { return null; }
        };
        if (!a) a = await osmCity(rt.from, b?.name);
        if (!b) b = await osmCity(rt.to, a?.name);
        if (!a || !b) return []; // Rapido does not serve one of the cities — honestly no rows
        if (rapidoCitySlug(a.name) !== rapidoCitySlug(b.name)) {
          // OWNER 31 Oct (supersedes the 23 Oct presence row): "intercity ride mai hide
          // kro, aur city rides mai dikhao results with price". Rapido publishes no
          // intercity service at all (their own fare API answers HTTP 500 for it), so an
          // intercity search now shows NO Rapido row instead of a priceless one.
          return [];
        }
        // Owner 24 Oct ("real price chaiye bhai"): Rapido's guest booking PWA publishes
        // LIVE intra-city fare windows (wasm-signed unup fare API — see rapidoFares.ts).
        // Real prices win; the app-only availability rows stay as the honest fallback
        // whenever signing is unsupported (old Node), the fare call fails, or quotes
        // come back empty. Nothing is invented in between.
        const fare = await rapidoLiveFaresSafe(ctx, rt, a.name);
        if (fare.length) return fare;
        // OWNER 31 Oct: city rides show Rapido ONLY with a real fare. When the live quote
        // cannot be obtained the availability rows ("Fare on app") are no longer shown —
        // a Rapido card without a price is exactly what the owner asked to stop showing.
        return [];
      },
    },
    {
      // OWNER 10 Nov ("cab ... mai booking.com ka source bnao"): Booking.com Taxis / airport transfers.
      // Measured 10 Nov: taxi.booking.com answers HTTP 405 "Human Verification" and
      // booking.com/taxi returns 202 with zero bytes, so no transfer quote is readable. Registered as a
      // monitored probe for the same reason as the flights source: honest ACCESS_CHALLENGE, proxy
      // rotation keeps trying, and the CJ exit already pays if a row ever appears.
      sourceId: 'w_cab_booking_taxi',
      name: 'Cab worker: Booking.com Taxis / airport transfers (monitored probe - bot wall)',
      priority: 20,
      maxPerMinute: 2,
      timeoutMs: 20_000,
      run: async () => {
        const r = await cffiFetch(BOOKING_PROBE.taxi, { impersonate: 'chrome', timeoutMs: 15_000 });
        const gate = bookingGate(r.status, r.body);
        if (gate !== 'ok') throw new AcquisitionError(gate === 'access_challenge' ? 'ACCESS_CHALLENGE' : 'EMPTY_RESPONSE', bookingGateMessage('taxi', r.status, gate), r.status);
        throw new AcquisitionError('EMPTY_RESPONSE', 'Booking.com Taxis answered 200 but exposed no machine-readable quote payload; transfer fares stay unwired until a partner feed exists.');
      },
    },
    {
      sourceId: 'w_cab_meru',
      name: 'Cab worker: Meru (probe)',
      priority: 15,
      run: async () => {
        const r = await cffiFetch('https://www.meru.in/fares', { impersonate: 'chrome', timeoutMs: 12_000 });
        throw new AcquisitionError('EMPTY_RESPONSE', 'Meru consumer cab booking has been folded into Mahindra Alyte (enterprise mobility); meru.in carries no consumer cab fares anymore — available only on app.');
      },
    },
    {
      sourceId: 'w_cab_fastdeals',
      name: 'Cab worker: Fastdeals/Snap-E (probe)',
      priority: 15,
      run: async () => {
        throw new AcquisitionError('EMPTY_RESPONSE', 'No authoritative web presence found for the Fastdeals/Snap-E cab service (fastdeals.in is an unrelated laptop store); no fare data exists on the open web for this source.');
      },
    },
    {
      // Bharat Taxi (direct operator): SSR route pages with flat one-way fare tables,
      // covers routes Savaari/QuickRide do not publish (Indore→Ujjain, Mumbai→Pune, Bengaluru→Mysuru).
      sourceId: 'w_cab_bharattaxi',
      name: 'Cab worker: Bharat Taxi route fares (SSR HTML tables, per-vehicle one-way)',
      priority: 5,
      maxPerMinute: 6,
      timeoutMs: 30_000,
      run: async (ctx) => {
        const rt = cabRoute(ctx);
        if (!rt) return [];
        const url = `https://www.bharattaxi.com/${bharatTaxiSlug(cityFromRouteText(rt.from))}/to/${bharatTaxiSlug(cityFromRouteText(rt.to))}`;
        const r = await cffiFetch(url, { impersonate: 'chrome', timeoutMs: 30_000 });
        if (r.status === 404) return []; // route not published — nothing fabricated
        if (r.status !== 200) throw new AcquisitionError(r.status === 403 || r.status === 429 ? 'ACCESS_CHALLENGE' : 'SERVER_ERROR', `BharatTaxi HTTP ${r.status}`, r.status);
        const items = parseBharatTaxiCabs(r.body, ctx.source, url, rt.from, rt.to);
        if (!items.length) throw new AcquisitionError('EMPTY_RESPONSE', 'BharatTaxi route page carried no flat one-way fares');
        return items;
      },
    },
    {
      // Savaari (direct operator): route page FAQ JSON-LD carries real one-way fares
      sourceId: 'w_cab_savaari',
      name: 'Cab worker: Savaari outstation route fares',
      priority: 5,
      run: async (ctx) => {
        const raw = String(ctx.query.rawQuery || '');
        const rt = routeFromQuery(raw);
        if (!rt) return [];
        const from = savaariRouteSlug(cityFromRouteText(rt.from));
        const to = savaariRouteSlug(cityFromRouteText(rt.to));
        const url = `https://www.savaari.com/${from}/${from}-to-${to}-cabs`;
        const r = await cffiFetch(url, { impersonate: 'chrome', timeoutMs: 30_000 });
        if (r.status === 404) return []; // route page not published — nothing fabricated
        if (r.status !== 200) throw new AcquisitionError(r.status === 403 || r.status === 429 ? 'ACCESS_CHALLENGE' : 'SERVER_ERROR', `Savaari HTTP ${r.status}`, r.status);
        const items = parseSavaariCabs(r.body, ctx.source, url, rt.from, rt.to);
        if (!items.length) throw new AcquisitionError('EMPTY_RESPONSE', 'Savaari route page carried no parseable fares');
        return items;
      },
    },
    {
      // QuickRide (direct operator): static outstation fare table
      sourceId: 'w_cab_quickride',
      name: 'Cab worker: QuickRide outstation fare table',
      priority: 6,
      run: async (ctx) => {
        const raw = String(ctx.query.rawQuery || '');
        const rt = routeFromQuery(raw);
        if (!rt) return [];
        const url = 'https://quickride.in/outstation-taxi.php';
        const r = await cffiFetch(url, { impersonate: 'chrome', timeoutMs: 30_000 });
        if (r.status !== 200) throw new AcquisitionError('SERVER_ERROR', `QuickRide HTTP ${r.status}`, r.status);
        const items = parseQuickRideCabs(r.body, ctx.source, url, rt.from, rt.to);
        if (!items.length) throw new AcquisitionError('EMPTY_RESPONSE', `QuickRide fare table has no row for ${rt.from} to ${rt.to}`);
        return items;
      },
    },
    {
      // InDrive (India): guest API of the intercity web app — published city-pair
      // price bands (ic3-gw-cf.euce1.indriverapp.com). Rides are name-your-price,
      // so offers carry InDrive's own indicative range, never a fixed fare.
      sourceId: 'w_cab_indrive',
      name: 'Cab worker: InDrive India intercity price bands',
      priority: 14,
      maxPerMinute: 10,
      timeoutMs: 30_000,
      run: async (ctx) => {
        const rt = cabRoute(ctx);
        if (!rt) return [];
        const lookup = async (x: string) => {
          const byCity = await indriveCityLookup(cityFromRouteText(x));
          if (byCity) return byCity;
          return cityFromRouteText(x) !== x ? indriveCityLookup(x) : null;
        };
        const [from, to] = await Promise.all([lookup(rt.from), lookup(rt.to)]);
        if (!from || !to) throw new AcquisitionError('EMPTY_RESPONSE', `InDrive intercity registry has no match for ${!from ? rt.from : rt.to} (India registry only)`);
        if (from.id === to.id) throw new AcquisitionError('EMPTY_RESPONSE', `InDrive intercity: "${rt.from}" and "${rt.to}" resolved to the same city (${from.name})`);
        const rows = await indrivePrices(from.id, to.id);
        const items = buildIndriveOffers(ctx.source, rt.from, rt.to, from, to, rows);
        if (!items.length) throw new AcquisitionError('EMPTY_RESPONSE', `InDrive intercity has no published price band for ${from.name} → ${to.name}`);
        return items;
      },
    },


  ],
};
registerVerticalWorker(cabWorker);
