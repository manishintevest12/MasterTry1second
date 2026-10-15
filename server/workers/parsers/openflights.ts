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

/** Common naming differences between what users type and OpenFlights' city field. */
const CITY_ALIASES: Record<string, string> = {
  'new delhi': 'delhi', 'bengaluru': 'bangalore', 'bombay': 'mumbai', 'calcutta': 'kolkata',
  'madras': 'chennai', 'gurugram': 'delhi', 'gurgaon': 'delhi', 'noida': 'delhi',
  'trivandrum': 'thiruvananthapuram', 'cochin': 'kochi', 'poona': 'pune', 'baroda': 'vadodara',
  'banaras': 'varanasi', 'benares': 'varanasi', 'new york city': 'new york', 'nyc': 'new york',
  'dubai international': 'dubai', 'abu dhabi': 'abu dhabi',
};

/** Resolve free text ("New Delhi", "Delhi (DEL)", "DXB") to airports: IATA code first, then city (with aliases), then name. */
export function matchAirports(airports: Airport[], input: string): Airport[] {
  const raw = String(input || '').trim();
  const code = raw.match(/\(([A-Za-z]{3})\)/)?.[1] || (/^[A-Za-z]{3}$/.test(raw) ? raw : '');
  if (code) {
    const byCode = airports.filter((a) => a.iata.toUpperCase() === code.toUpperCase());
    if (byCode.length) return byCode;
  }
  const cleaned = raw.replace(/\([^)]*\)/g, '').replace(/\b(airport|international|intl)\b/gi, '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!cleaned) return [];
  const target = CITY_ALIASES[cleaned] || cleaned;
  let hit = airports.filter((a) => a.city.toLowerCase() === target);
  if (!hit.length) hit = airports.filter((a) => a.city.toLowerCase() === cleaned);
  if (!hit.length) hit = airports.filter((a) => a.name.toLowerCase().includes(target));
  return hit;
}

const AIRLINE_SITES: Array<[RegExp, string]> = [
  [/indigo/i, 'https://www.goindigo.in/'], [/air india express/i, 'https://www.airindiaexpress.com/'], [/air india/i, 'https://www.airindia.com/'],
  [/spicejet/i, 'https://www.spicejet.com/'], [/akasa/i, 'https://www.akasaair.com/'], [/vistara/i, 'https://www.airindia.com/'],
  [/alliance air/i, 'https://www.allianceair.in/'], [/star air/i, 'https://www.starair.in/'], [/fly ?91/i, 'https://flybig.in/'],
];
function airlineSiteFor(name: string): string | undefined {
  for (const [re, u] of AIRLINE_SITES) if (re.test(name)) return u;
  return undefined;
}

/** Canonical seller names for the Platforms & Sellers sidebar filter (15 Oct):
 *  OpenFlights' airlines.dat uses legal-entity names ("IndiGo Airlines",
 *  "Air India Limited") which showed up as confusing near-duplicates next to
 *  the direct-source rows ("IndiGo", "Air India"). Normalize to the carrier's
 *  common brand so the sidebar groups them with the priced offers. */
const CANONICAL_AIRLINES: Array<[RegExp, string]> = [
  [/indigo/i, 'IndiGo'], [/air india express/i, 'Air India Express'], [/^air india(?!.*express)/i, 'Air India'],
  [/spicejet/i, 'SpiceJet'], [/akasa/i, 'Akasa Air'], [/emirates/i, 'Emirates'], [/vistara/i, 'Vistara'],
  [/alliance air/i, 'Alliance Air'], [/star air/i, 'Star Air'], [/fly ?91/i, 'Fly91'],
];
export function canonicalAirlineName(name: string): string {
  for (const [re, canon] of CANONICAL_AIRLINES) if (re.test(name)) return canon;
  return name.replace(/\s*(airlines|air lines|limited|ltd|pvt\.? ?ltd|co\.|inc)\.?$/i, '').trim() || name;
}

export function parseRoute(airports: Airport[], airlines: Airline[], routes: Route[], source: SourceConfig, fromCity: string, toCity: string, date: string | undefined, sourceUrl: string): RawSourceItem[] {
  const fromAirports = matchAirports(airports, fromCity);
  const toAirports = matchAirports(airports, toCity);
  if (!fromAirports.length || !toAirports.length) return [];
  const srcIatas = new Set(fromAirports.map((a) => a.iata));
  const dstIatas = new Set(toAirports.map((a) => a.iata));
  // OpenFlights' `active` flag lags reality: drop known-defunct carriers and cargo-only operators
  // so a passenger search never lists an airline that no longer sells tickets.
  const DEFUNCT = /\b(jet airways|kingfisher|spicejet cargo|silkair|tiger airways|air deccan|jetlite|go ?first|go ?air|air sahara|sahara|king ?fisher|virgin america|germanwings|monarch|thomas cook|air berlin|alitalia|malev|cargo|freight|express cargo|logistics|courier|dhl|fedex|ups)\b/i;
  const airlineByIata = new Map(airlines.filter((a) => a.active && !DEFUNCT.test(a.name)).map((a) => [a.iata, a]));
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
      seller: canonicalAirlineName(airlineName).slice(0, 100),
      sellerUrl: airlineSiteFor(airlineName) || sourceUrl,
      currency: 'INR',
      travel: { route: `${srcAp.city} ${srcAp.iata} to ${dstAp.city} ${dstAp.iata}`.toLowerCase(), ...(date ? { date } : {}), seatType: 'unknown' },
      attributes: {
        airline: airlineName.slice(0, 100),
        ...(r0.airlineIata ? { airline_code: r0.airlineIata } : {}),
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
