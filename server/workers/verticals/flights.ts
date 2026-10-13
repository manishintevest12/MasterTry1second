/**
 * Flights worker (WORLDWIDE).
 * - w_flights_ixigo: REAL fares acquired from Ixigo's SSR search page (browserless
 *   curl_cffi + __NEXT_DATA__). Owner policy: Ixigo is a metasearch like us, used as
 *   an acquisition provider ONLY — the seller shown is the AIRLINE and the deeplink
 *   goes to the airline's own website, never to Ixigo.
 * - w_flights_openflights: which airlines fly <from> to <to> (real schedule data,
 *   open licence). Fares are never invented anywhere in this worker.
 */
import { registerVerticalWorker, type VerticalWorker } from '../verticalWorker';
import { loadOpenFlights, parseRoute } from '../parsers/openflights';
import { parseIxigoFlights, parseIxigoOffers } from '../parsers/ixigoFlights';
import { AcquisitionError } from '../../common/httpClient';
import { cffiFetch } from '../../common/curlCffiFetch';

const URL_AP = 'https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat';

function routeFromQuery(raw: string): { from: string; to: string } | null {
  const m = raw.match(/([a-zA-Z][a-zA-Z\s]{1,24}?(?:\s*\([A-Za-z]{3}\))?)\s+(?:to|→|-)\s+([a-zA-Z][a-zA-Z\s]{1,24}(?:\s*\([A-Za-z]{3}\))?)/);
  if (!m) return null;
  const strip = (s: string) => s.replace(/\b(flight|flights|ticket|tickets|air|fly|from|cheapest|direct|return|one-way|oneway|round trip)\b/gi, '').replace(/,.*$/, '').trim();
  const from = strip(m[1]);
  const to = strip(m[2]).replace(/\b(on|for|tomorrow|today|night|morning|evening|at)\b.*$/i, '').trim();
  if (!from || !to) return null;
  return { from, to };
}

export const flightsWorker: VerticalWorker = {
  vertical: 'flights',
  tasks: [
    {
      // Ixigo SSRs the flight search page: __NEXT_DATA__ ships up to 100
      // real flight entries for the date (airline, flight number, total
      // fare, times, stops). City names are accepted directly.
      sourceId: 'w_flights_ixigo',
      name: 'Flights worker: real fares via Ixigo SSR (seller = airline website)',
      priority: 1,
      maxPerMinute: 6,
      timeoutMs: 35_000,
      run: async (ctx) => {
        const raw = String(ctx.query.rawQuery || ctx.query.entityName || '');
        const rt = routeFromQuery(raw);
        if (!rt) return [];
        const dep = ctx.query?.travelDates?.depart && /\d{4}-\d{2}-\d{2}/.test(ctx.query.travelDates.depart)
          ? ctx.query.travelDates.depart
          : new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
        const url = `https://www.ixigo.com/search/flight/${encodeURIComponent(rt.from.toLowerCase())}/${encodeURIComponent(rt.to.toLowerCase())}/${dep}/1/0`;
        const res = await cffiFetch(url, { impersonate: 'chrome', timeoutMs: 30_000 });
        if (res.status === 403 || res.status === 429) {
          throw new AcquisitionError(res.status === 403 ? 'ACCESS_CHALLENGE' : 'RATE_LIMITED', `Ixigo blocked: ${res.status}`, res.status);
        }
        if (res.status !== 200) throw new AcquisitionError('SERVER_ERROR', `Ixigo HTTP ${res.status}`, res.status);
        const m = res.body.match(/<script id="__NEXT_DATA__"[^>]*>(\{[\s\S]*?\})<\/script>/);
        if (!m) throw new AcquisitionError('MALFORMED_RESPONSE', 'Ixigo SRP carried no __NEXT_DATA__');
        let next: any;
        try { next = JSON.parse(m[1]); } catch { throw new AcquisitionError('MALFORMED_RESPONSE', 'Ixigo __NEXT_DATA__ not valid JSON'); }
        const flights = parseIxigoFlights(next);
        if (flights.length === 0) throw new AcquisitionError('EMPTY_RESPONSE', 'Ixigo SRP had no priced flights');
        return parseIxigoOffers(flights, ctx.source, rt.from, rt.to, dep);
      },
    },
    {
      sourceId: 'w_flights_openflights',
      name: 'Flights worker: OpenFlights airline-route data (worldwide)',
      priority: 10,
      maxPerMinute: 10,
      run: async (ctx) => {
        const raw = String(ctx.query.rawQuery || ctx.query.entityName || '');
        const rt = routeFromQuery(raw);
        if (!rt) return [];
        const fetchFn = (u: string) => ctx.fetch(u, { expectJson: false }).then((r) => {
          if (r.status !== 200) throw new AcquisitionError('SERVER_ERROR', `OpenFlights HTTP ${r.status}`, r.status);
          return r.body;
        });
        const { airports, airlines, routes } = await loadOpenFlights(fetchFn);
        return parseRoute(airports, airlines, routes, ctx.source, rt.from, rt.to, ctx.query.travelDates?.depart, URL_AP);
      },
    },
  ],
};
registerVerticalWorker(flightsWorker);
