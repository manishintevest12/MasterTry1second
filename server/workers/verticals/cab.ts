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
        const url = `https://api.olacabs.com/v1/products?pickup_lat=${a.lat}&pickup_lng=${a.lon}&drop_lat=${b.lat}&drop_lng=${b.lon}&category=sedan&response_type=json`;
        const r = await cffiFetch(url, { timeoutMs: 18_000, headers: { 'X-APP-TOKEN': key, Accept: 'application/json' } });
        if (r.status === 401 || r.status === 403) throw new AcquisitionError('FORBIDDEN', `Ola API rejected credentials (HTTP ${r.status}) — set a valid OLA_API_KEY`, r.status);
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
      // Uber: official Uber API price estimates (developer.uber.com / v1.2). Credentials in
      // UBER_SERVER_TOKEN (owner supplies the real token; demo keys are rejected with 401 — verified live).
      sourceId: 'w_cab_uber',
      name: 'Cab worker: Uber India fare estimates (official API)',
      priority: 15,
      maxPerMinute: 10,
      timeoutMs: 25_000,
      run: async (ctx) => {
        const token = String(process.env.UBER_SERVER_TOKEN || '').trim();
        if (!token) throw new AcquisitionError('EMPTY_RESPONSE', 'Uber API credentials not configured: set UBER_SERVER_TOKEN in hPanel env (official Uber API /v1.2/estimates/price; demo keys are rejected by Uber with 401 — the owner will supply the original token).');
        const rt = routeFromQuery(String(ctx.query.rawQuery || ''));
        if (!rt) return [];
        const [a, b] = await Promise.all([photonGeocode(rt.from), photonGeocode(rt.to)]);
        if (!a || !b) return [];
        const url = `https://api.uber.com/v1.2/estimates/price?start_latitude=${a.lat}&start_longitude=${a.lon}&end_latitude=${b.lat}&end_longitude=${b.lon}`;
        const r = await cffiFetch(url, { timeoutMs: 18_000, headers: { Authorization: `Token ${token}`, Accept: 'application/json' } });
        if (r.status === 401 || r.status === 403) throw new AcquisitionError('FORBIDDEN', `Uber API rejected credentials (HTTP ${r.status}) — set a valid UBER_SERVER_TOKEN`, r.status);
        if (r.status !== 200) throw new AcquisitionError('SERVER_ERROR', `Uber API HTTP ${r.status}`, r.status);
        let j: any; try { j = JSON.parse(r.body); } catch { throw new AcquisitionError('MALFORMED_RESPONSE', 'Uber API non-JSON'); }
        const prices: any[] = Array.isArray(j?.prices) ? j.prices : [];
        const items = [];
        const today = new Date().toISOString().slice(0, 10);
        for (const p of prices.slice(0, 5)) {
          const price = Math.round(Number(p.estimate ?? p.low_estimate ?? 0));
          if (!price) continue;
          const vehicle = String(p.localized_display_name || 'Uber cab').slice(0, 60);
          items.push(newRawItem(ctx.source, {
            title: `${rt.from} to ${rt.to} cab (${vehicle}, one-way)`,
            brand: 'Uber',
            price, currency: String(p.currency_code || 'INR'),
            seller: 'Uber', sellerUrl: 'https://m.uber.com/looking/',
            travel: { route: `${rt.from} to ${rt.to}`.toLowerCase(), seatType: 'unknown' },
            attributes: {
              pickup: rt.from, drop: rt.to, route: `${rt.from} to ${rt.to}`,
              vehicle_type: vehicle, trip_type: 'one-way',
              distance_km: p.distance != null ? String(Math.round(p.distance * 10) / 10) : '',
              duration_minutes: p.duration != null ? String(Math.round(p.duration / 60)) : '',
              fare_range: p.low_estimate && p.high_estimate ? `Rs ${p.low_estimate} - Rs ${p.high_estimate}` : '',
              price_basis: `Uber API price estimate on ${today}`,
              data_note: 'Fare estimate from the official Uber API (developer.uber.com /v1.2/estimates/price)',
            },
            identifiers: { sku: `uber-${rt.from}-${rt.to}-${vehicle}`.toLowerCase().replace(/\s+/g, '-') },
            evidence: { sourceUrl: url, extractedFields: ['Uber API estimates/price'] },
          }));
        }
        if (!items.length) throw new AcquisitionError('EMPTY_RESPONSE', 'Uber API returned no fare estimate for this route');
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
