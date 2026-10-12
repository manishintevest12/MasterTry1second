/**
 * Flights worker (WORLDWIDE). A flights search runs ONLY this worker.
 * Uses OpenFlights open data (airports, airlines, routes) to answer "which airlines
 * fly <from> to <to>?" — real scheduled-route information. Fares are never invented.
 */
import { registerVerticalWorker, type VerticalWorker } from '../verticalWorker';
import { loadOpenFlights, parseRoute } from '../parsers/openflights';
import { AcquisitionError } from '../../common/httpClient';

const URL_AP = 'https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat';

function routeFromQuery(raw: string): { from: string; to: string } | null {
  const m = raw.match(/([a-zA-Z][a-zA-Z\s]{1,24}?)\s+(?:to|→|-)\s+([a-zA-Z][a-zA-Z\s]{1,24})/);
  if (!m) return null;
  const strip = (s: string) => s.replace(/\b(flight|flights|ticket|tickets|air|fly|from|cheapest|direct)\b/gi, '').trim();
  const from = strip(m[1]);
  const to = strip(m[2]).replace(/\b(on|for|tomorrow|today|night|morning|evening|at)\b.*$/i, '').trim();
  if (!from || !to) return null;
  return { from, to };
}

export const flightsWorker: VerticalWorker = {
  vertical: 'flights',
  tasks: [
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
