/**
 * Cab worker (India). A cab search runs ONLY this worker.
 * Real road distance/duration from OSRM between two places; the fare is a
 * transparent, labelled estimate (never a live operator quote).
 */
import { registerVerticalWorker, type VerticalWorker } from '../verticalWorker';
import { buildCabEstimate } from '../parsers/osrmCab';
import { parseSavaariCabs, savaariRouteSlug } from '../parsers/savaariCabs'
import { bharatTaxiSlug, parseBharatTaxiCabs } from '../parsers/bharatTaxi';;
import { parseQuickRideCabs } from '../parsers/quickRideCabs';
import { cffiFetch } from '../../common/curlCffiFetch';
import { newRawItem } from '../../sources/contract';
import { photonGeocode } from '../parsers/osmTravel';
import { AcquisitionError } from '../../common/httpClient';

function routeFromQuery(raw: string): { from: string; to: string } | null {
  const cleaned = raw.replace(/\b(cab|taxi|ride|auto|uber|ola|rapido|book|a|an|the|price|fare|for|drop|pickup|from|need|want|go|going)\b/gi, ' ')
    .replace(/\s+/g, ' ').trim();
  const m = cleaned.match(/(.{2,40}?)\s+(?:to|→)\s+(.{2,40})/);
  if (!m) return null;
  return { from: m[1].trim(), to: m[2].trim() };
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
];

function uberCitySlugFor(place: string): { slug: string; city: string } | null {
  const p = place.toLowerCase();
  for (const c of UBER_CITY_SLUGS) if (c.keys.some((k) => p.includes(k))) return { slug: c.slug, city: c.city };
  return null;
}

function normPlace(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((t) => t.length > 2 && !['and', 'the', 'st', 'station'].includes(t));
}

/** Match a route endpoint against an SSR destination name; returns overlap score. */
function uberDestMatchScore(routeEnd: string, destName: string): number {
  const a = normPlace(routeEnd); const b = normPlace(destName);
  if (!a.length || !b.length) return 0;
  let hits = 0;
  for (const t of a) if (b.includes(t) || b.some((x) => (x.length > 3 && t.length > 3 && (x.includes(t) || t.includes(x))))) hits++;
  return hits / Math.min(a.length, b.length);
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
async function uberSsrFallback(ctx: any, rt: { from: string; to: string }, reason: string): Promise<any[]> {
  const cityInfo = uberCitySlugFor(rt.from) || uberCitySlugFor(rt.to);
  if (!cityInfo) throw new AcquisitionError('EMPTY_RESPONSE', `Uber live fare unavailable (${reason}); no Uber city guide page exists for this city, and no live guest fare API is available without credentials.`);
  const fares = await uberCityFares(cityInfo.slug, cityInfo.city);
  // match either route endpoint against published destinations, best score wins
  // Only the DROP side may match a published destination — matching the pickup
  // produced absurd offers (e.g. "delhi to kanpur" -> "Delhi Cantt station").
  let best: { fare: UberCityFare; score: number; end: string } | null = null;
  for (const fare of fares) {
    const score = uberDestMatchScore(rt.to, fare.dest);
    if (score >= 0.5 && (!best || score > best.score)) best = { fare, score, end: rt.to };
  }
  if (!best) throw new AcquisitionError('EMPTY_RESPONSE', `Uber live fare unavailable (${reason}); Uber's published ${cityInfo.city} fare table covers ${fares.length} destinations and none matches "${rt.to}".`);
  const dropName = best.fare.dest;
  const drop = (await photonGeocode(`${dropName}, ${cityInfo.city}`)) || (await photonGeocode(rt.to));
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
  })];
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
      timeoutMs: 25_000,
      run: async (ctx) => {
        const key = String(process.env.OLA_API_KEY || '').trim();
        if (!key) throw new AcquisitionError('EMPTY_RESPONSE', 'Ola API credentials not configured: set OLA_API_KEY in hPanel env (official Ola Cabs API; a demo key will be rejected by Ola with 401 — the owner will supply the original token).');
        const rt = routeFromQuery(String(ctx.query.rawQuery || ''));
        if (!rt) return [];
        const [a, b] = await Promise.all([photonGeocode(rt.from), photonGeocode(rt.to)]);
        if (!a || !b) return [];
        const url = `https://devapi.olacabs.com/v1/products?pickup_lat=${a.lat}&pickup_lng=${a.lon}&drop_lat=${b.lat}&drop_lng=${b.lon}&category=sedan&response_type=json`;
        const r = await cffiFetch(url, { timeoutMs: 18_000, headers: { 'X-APP-TOKEN': key, Accept: 'application/json' } });
        if (r.status === 401 || r.status === 403) throw new AcquisitionError('FORBIDDEN', `Ola API rejected credentials (HTTP ${r.status}) — set a valid OLA_API_KEY (devapi.olacabs.com host)`, r.status);
        if (r.status !== 200) throw new AcquisitionError('SERVER_ERROR', `Ola API HTTP ${r.status}`, r.status);
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
            seller: 'Ola', sellerUrl: 'https://book.olacabs.com/',
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
      timeoutMs: 25_000,
      run: async (ctx) => {
        const rt = routeFromQuery(String(ctx.query.rawQuery || ''));
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
        if (!authHeaders) return uberSsrFallback(ctx, rt, 'official Uber API credentials not configured (UBER_APPLICATION_ID/UBER_CLIENT_SECRET or UBER_SERVER_TOKEN)');
        const [a, b] = await Promise.all([photonGeocode(rt.from), photonGeocode(rt.to)]);
        if (!a || !b) return [];
        const apiHost = String(process.env.UBER_API_HOST || 'api.uber.com').trim() || 'api.uber.com'; // set UBER_API_HOST=sandbox-api.uber.com to test against Uber's sandbox
        const url = `https://${apiHost}/v1.2/estimates/price?start_latitude=${a.lat}&start_longitude=${a.lon}&end_latitude=${b.lat}&end_longitude=${b.lon}`;
        const r = await cffiFetch(url, { timeoutMs: 18_000, headers: { ...authHeaders, Accept: 'application/json' } });
        if (r.status === 401 || r.status === 403) return uberSsrFallback(ctx, rt, `official Uber API rejected credentials (HTTP ${r.status})`);
        if (r.status !== 200) throw new AcquisitionError('SERVER_ERROR', `Uber API HTTP ${r.status}`, r.status);
        let j: any; try { j = JSON.parse(r.body); } catch { throw new AcquisitionError('MALFORMED_RESPONSE', 'Uber API non-JSON'); }
        const prices: any[] = Array.isArray(j?.prices) ? j.prices : [];
        const items = [];
        const today = new Date().toISOString().slice(0, 10);
        for (const p of prices.slice(0, 5)) {
          const price = Math.round(Number(p.estimate ?? p.low_estimate ?? 0));
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
        if (!items.length) return uberSsrFallback(ctx, rt, 'official Uber API returned no fare estimate for this route');
        return items;
      },
    },
    {
      sourceId: 'w_cab_indrive',
      name: 'Cab worker: InDrive India (probe)',
      priority: 15,
      run: async () => {
        const r = await cffiFetch('https://indrive.com/en-in/', { impersonate: 'chrome', timeoutMs: 12_000 });
        throw new AcquisitionError('EMPTY_RESPONSE', 'InDrive publishes no fare list anywhere on the web — its model is rider-offered (negotiated) fares set per-ride in the app.');
      },
    },
    {
      // Rapido: verified live — rapido.bike serves SSR SEO route pages (/delhi/routes/<From>-<To>, city
      // sitemaps list thousands) but they carry NO fares; the only API hosts in the web bundle are
      // internal .svc.production.internal services (unreachable). Fare estimates are in-app only.
      sourceId: 'w_cab_rapido',
      name: 'Cab worker: Rapido (probe)',
      priority: 15,
      run: async () => {
        const r = await cffiFetch('https://www.rapido.bike/delhi/routes/Saket-Sainik_Farm', { impersonate: 'chrome', timeoutMs: 12_000 });
        throw new AcquisitionError('EMPTY_RESPONSE', 'Rapido publishes no fares on the web: rapido.bike route pages are SEO content only and the web bundle references only internal service hosts (verified live). Fare estimates are available only in the Rapido app.');
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
        const rt = routeFromQuery(String(ctx.query.rawQuery || ''));
        if (!rt) return [];
        const url = `https://www.bharattaxi.com/${bharatTaxiSlug(rt.from)}/to/${bharatTaxiSlug(rt.to)}`;
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
        const from = savaariRouteSlug(rt.from);
        const to = savaariRouteSlug(rt.to);
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
      sourceId: 'w_cab_osrm',
      name: 'Cab worker: OSRM real-distance fare estimate',
      priority: 10,
      maxPerMinute: 10,
      run: async (ctx) => {
        const raw = String(ctx.query.rawQuery || '');
        const rt = routeFromQuery(raw);
        if (!rt) return [];
        const ratePerKm = Number((ctx.source.config as any)?.ratePerKm) || 18;
        const fetchRoute = async (lon1: number, lat1: number, lon2: number, lat2: number) => {
          const r = await ctx.fetch(`https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`, { expectJson: true });
          if (r.status !== 200) throw new AcquisitionError('SERVER_ERROR', `OSRM HTTP ${r.status}`, r.status);
          let j: any; try { j = JSON.parse(r.body); } catch { throw new AcquisitionError('MALFORMED_RESPONSE', 'OSRM non-JSON'); }
          const route = j?.routes?.[0];
          if (!route) throw new AcquisitionError('NOT_FOUND', 'OSRM found no route between the points');
          return { distanceM: Number(route.distance), durationS: Number(route.duration) };
        };
        return buildCabEstimate(ctx.source, rt.from, rt.to, ctx.query.travelDates?.depart, fetchRoute, ratePerKm, 'https://router.project-osrm.org/');
      },
    },
  ],
};
registerVerticalWorker(cabWorker);
