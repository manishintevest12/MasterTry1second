/**
 * Cab worker (India). A cab search runs ONLY this worker.
 * Real road distance/duration from OSRM between two places; the fare is a
 * transparent, labelled estimate (never a live operator quote).
 */
import { registerVerticalWorker, type VerticalWorker } from '../verticalWorker';
import { buildCabEstimate } from '../parsers/osrmCab';
import { AcquisitionError } from '../../common/httpClient';

function routeFromQuery(raw: string): { from: string; to: string } | null {
  const cleaned = raw.replace(/\b(cab|taxi|ride|auto|uber|ola|rapido|book|a|an|the|price|fare|for|drop|pickup)\b/gi, ' ')
    .replace(/\s+/g, ' ').trim();
  const m = cleaned.match(/(.{2,40}?)\s+(?:to|→)\s+(.{2,40})/);
  if (!m) return null;
  return { from: m[1].trim(), to: m[2].trim() };
}

export const cabWorker: VerticalWorker = {
  vertical: 'cab',
  tasks: [
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
