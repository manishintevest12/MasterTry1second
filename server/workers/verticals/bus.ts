/**
 * Bus worker (India). A bus search runs ONLY this worker.
 * Intercity bus operators' live fares are behind WAF/JS walls today, so this worker
 * provides a REAL road distance/duration (OSRM) with a transparent, labelled
 * indicative fare estimate — never presented as an operator quote.
 */
import { registerVerticalWorker, type VerticalWorker } from '../verticalWorker';
import { buildCabEstimate } from '../parsers/osrmCab';
import { AcquisitionError } from '../../common/httpClient';
import { parseAbhiBusServices, resolveAbhiBusCity, type AbhiBusRoute } from '../parsers/abhibus';

function routeFromQuery(raw: string): { from: string; to: string } | null {
  const cleaned = raw.replace(/\b(bus|buses|volvo|sleeper|ticket|tickets|book|redbus|fare|price|for|travel)\b/gi, ' ')
    .replace(/\s+/g, ' ').trim();
  const m = cleaned.match(/(.{2,40}?)\s+(?:to|from)\s+(.{2,40})/);
  if (!m) return null;
  return { from: m[1].trim(), to: m[2].trim() };
}

export const busWorker: VerticalWorker = {
  vertical: 'bus',
  tasks: [
    {
      // REAL operator fares. AbhiBus's internal JSON API answers plain HTTP:
      // /wap/SearchStations resolves city -> station id, /buslist/v3/services
      // returns live per-service fares, timings, bus type and seat counts.
      sourceId: 'w_bus_abhibus',
      name: 'Bus worker: AbhiBus live services (real fares, timings, seats)',
      priority: 1,
      maxPerMinute: 8,
      run: async (ctx) => {
        const raw = String(ctx.query.rawQuery || '');
        const rt = routeFromQuery(raw);
        if (!rt) return [];
        const getJson = async (url: string): Promise<any> => {
          const r = await ctx.fetch(url, { expectJson: true, headers: { Accept: 'application/json' } });
          if (r.status !== 200) throw new AcquisitionError('FORBIDDEN', `AbhiBus HTTP ${r.status} on ${url.split('?')[0]}`, r.status);
          try { return JSON.parse(r.body); } catch { throw new AcquisitionError('MALFORMED_RESPONSE', 'AbhiBus non-JSON response'); }
        };
        const [from, to] = await Promise.all([
          resolveAbhiBusCity(getJson, rt.from),
          resolveAbhiBusCity(getJson, rt.to),
        ]);
        if (!from || !to) throw new AcquisitionError('NOT_FOUND', `AbhiBus: could not resolve '${rt.from}'/'${rt.to}' as stations`);
        const depart = String(ctx.query.travelDates?.depart || '');
        const jdate = /^\d{4}-\d{2}-\d{2}$/.test(depart) ? depart : new Date(Date.now() + 86400000).toISOString().slice(0, 10);
        const route: AbhiBusRoute = { fromName: from.label, fromId: from.id, toName: to.label, toId: to.id, jdate };
        const r = await ctx.fetch('https://www.abhibus.com/buslist/v3/services', {
          method: 'POST',
          expectJson: true,
          maxBytes: 6_000_000,
          timeoutMs: 20_000,
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: from.label, sourceid: Number(from.id),
            destination: to.label, destinationid: Number(to.id),
            jdate, prd: 'mobile', filters: '1', isReturnJourney: '0',
          }),
        });
        if (r.status !== 200) throw new AcquisitionError('FORBIDDEN', `AbhiBus services HTTP ${r.status}`, r.status);
        return parseAbhiBusServices(r.body, ctx.source, route);
      },
    },
    {
      sourceId: 'w_bus_osrm_estimate',
      name: 'Bus worker: OSRM real-distance intercity estimate',
      priority: 10,
      maxPerMinute: 10,
      run: async (ctx) => {
        const raw = String(ctx.query.rawQuery || '');
        const rt = routeFromQuery(raw);
        if (!rt) return [];
        const ratePerKm = Number((ctx.source.config as any)?.ratePerKm) || 2.2;
        const fetchRoute = async (lon1: number, lat1: number, lon2: number, lat2: number) => {
          const r = await ctx.fetch(`https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`, { expectJson: true });
          if (r.status !== 200) throw new AcquisitionError('SERVER_ERROR', `OSRM HTTP ${r.status}`, r.status);
          let j: any; try { j = JSON.parse(r.body); } catch { throw new AcquisitionError('MALFORMED_RESPONSE', 'OSRM non-JSON'); }
          const route = j?.routes?.[0];
          if (!route) throw new AcquisitionError('NOT_FOUND', 'OSRM found no route between the points');
          return { distanceM: Number(route.distance), durationS: Number(route.duration) };
        };
        const items = await buildCabEstimate(ctx.source, rt.from, rt.to, ctx.query.travelDates?.depart, fetchRoute, ratePerKm, 'https://router.project-osrm.org/');
        // Label as intercity bus estimate, not cab
        return items.map((i) => ({
          ...i,
          title: `Bus route ${rt.from} → ${rt.to}`,
          attributes: { ...i.attributes, vehicle_type: 'intercity bus (indicative)', fare_type: 'indicative_estimate',
            estimate_note: `Indicative bus fare = ${(i.attributes || {})[('distance_km' as never)] as unknown as string} km x ₹${ratePerKm}/km assumed rate. Live operator fares (RedBus etc.) block public HTTP today.` },
          travel: { ...i.travel, seatType: 'unknown' },
        }));
      },
    },
  ],
};
registerVerticalWorker(busWorker);
