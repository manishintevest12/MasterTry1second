/**
 * Cab worker (India). A cab search runs ONLY this worker.
 * Real road distance/duration from OSRM between two places; the fare is a
 * transparent, labelled estimate (never a live operator quote).
 */
import { registerVerticalWorker, type VerticalWorker } from '../verticalWorker';
import { buildCabEstimate } from '../parsers/osrmCab';
import { parseSavaariCabs, savaariRouteSlug } from '../parsers/savaariCabs';
import { parseQuickRideCabs } from '../parsers/quickRideCabs';
import { cffiFetch } from '../../common/curlCffiFetch';
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
