/**
 * OpenFlights parser (flights vertical, worldwide). OpenFlights publishes open
 * airports.dat / airlines.dat / routes.dat dumps (updated monthly, no key, no auth).
 * They prove WHICH airlines operate a route and where the airports are — real
 * airline-route data. Fares do not exist in these datasets and are never invented.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

const BASE = 'https://raw.githubusercontent.com/jpatokal/openflights/master/data';

export interface Airport { id: string; name: string; city: string; country: string; iata: string; lat: number; lon: number }
export interface Airline { name: string; iata: string; active: boolean }
export interface Route { airlineIata: string; srcIata: string; dstIata: string; stops: number }

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = '', inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

let cache: { at: number; airports: Airport[]; airlines: Airline[]; routes: Route[] } | null = null;

export async function loadOpenFlights(fetchFn: (u: string) => Promise<string>): Promise<{ airports: Airport[]; airlines: Airline[]; routes: Route[] }> {
  if (cache && Date.now() - cache.at < 24 * 3600_000) return cache;
  const [apRaw, alRaw, rtRaw] = await Promise.all([
    fetchFn(`${BASE}/airports.dat`),
    fetchFn(`${BASE}/airlines.dat`),
    fetchFn(`${BASE}/routes.dat`),
  ]);
  const airports: Airport[] = apRaw.split('\n').filter(Boolean).map((l) => {
    const f = splitCsv(l);
    return { id: f[0], name: f[1], city: f[2], country: f[3], iata: f[4], lat: Number(f[6]), lon: Number(f[7]) };
  }).filter((a) => a.iata && a.iata !== '\\N');
  const airlines: Airline[] = alRaw.split('\n').filter(Boolean).map((l) => {
    const f = splitCsv(l);
    return { name: f[1], iata: f[3], active: f[7] === 'Y' };
  }).filter((a) => a.iata && a.iata !== '\\N');
  const routes: Route[] = rtRaw.split('\n').filter(Boolean).map((l) => {
    const f = l.split(',');
    return { airlineIata: f[0], srcIata: f[2], dstIata: f[4], stops: Number(f[7]) };
  }).filter((r) => r.srcIata && r.dstIata && r.srcIata !== '\\N' && r.dstIata !== '\\N');
  cache = { at: Date.now(), airports, airlines, routes };
  return { airports, airlines, routes };
}

export function parseRoute(airports: Airport[], airlines: Airline[], routes: Route[], source: SourceConfig, fromCity: string, toCity: string, date: string | undefined, sourceUrl: string): RawSourceItem[] {
  const fc = fromCity.toLowerCase().trim();
  const tc = toCity.toLowerCase().trim();
  const fromAirports = airports.filter((a) => a.city.toLowerCase() === fc);
  const toAirports = airports.filter((a) => a.city.toLowerCase() === tc);
  if (!fromAirports.length || !toAirports.length) return [];
  const srcIatas = new Set(fromAirports.map((a) => a.iata));
  const dstIatas = new Set(toAirports.map((a) => a.iata));
  const airlineByIata = new Map(airlines.filter((a) => a.active).map((a) => [a.iata, a]));
  const matched = new Map<string, Route[]>();
  for (const r of routes) {
    if (srcIatas.has(r.srcIata) && dstIatas.has(r.dstIata)) {
      const al = airlineByIata.get(r.airlineIata);
      if (!al) continue;
      if (!matched.has(al.name)) matched.set(al.name, []);
      matched.get(al.name)!.push(r);
    }
  }
  const out: RawSourceItem[] = [];
  for (const [airlineName, rs] of matched) {
    const direct = rs.filter((r) => r.stops === 0).length;
    const r0 = rs[0];
    const srcAp = fromAirports.find((a) => a.iata === r0.srcIata)!;
    const dstAp = toAirports.find((a) => a.iata === r0.dstIata)!;
    out.push(newRawItem(source, {
      title: `${airlineName}: ${srcAp.city} (${srcAp.iata}) → ${dstAp.city} (${dstAp.iata})`.slice(0, 200),
      seller: airlineName.slice(0, 120),
      sellerUrl: sourceUrl,
      currency: 'INR',
      travel: { route: `${srcAp.city} ${srcAp.iata} to ${dstAp.city} ${dstAp.iata}`.toLowerCase(), ...(date ? { date } : {}), seatType: 'unknown' },
      attributes: {
        airline: airlineName.slice(0, 100),
        from_iata: srcAp.iata,
        to_iata: dstAp.iata,
        scheduled_services: String(rs.length),
        ...(direct > 0 ? { direct_services: String(direct) } : {}),
        data_note: 'Airline-route schedules from OpenFlights open data; live fares require the airline (we never invent them)',
      },
      evidence: {
        sourceUrl,
        sourceReference: `${r0.srcIata}-${r0.dstIata}:${airlineName}`,
        extractedFields: ['route', 'airline', 'airports'],
      },
    }));
  }
  return out.slice(0, 20);
}
