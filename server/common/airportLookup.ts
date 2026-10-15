/**
 * Global city → IATA resolver.
 *
 * The static map covers Indian cities (instant, no network). Every other world
 * city is resolved against OpenFlights' public airports.dat (~7,700 rows,
 * exactly the dataset the OpenFlights parser already trusts for schedules).
 * Multi-airport cities (London, New York, Dubai…) resolve to the city's MAJOR
 * hub via the PREFERRED set; otherwise the first airport of that city that
 * actually has an IATA code. Never guesses: no match → { code: null } and the
 * caller honestly skips the route.
 *
 * Dataset cached in-process for 24h; negative lookups cached 10 min so an
 * unknown city can't hammer the CDN on every keystroke-search.
 */
import { log } from './logger';

const URL_DAT = 'https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat';

/** Major hubs preferred when a city has several airports (busiest-first, not exhaustive). */
// Ordered: for multi-airport cities the EARLIEST entry wins (LHR before LGW, JFK before EWR…).
const PREFERRED = [
  'LHR', 'JFK', 'EWR', 'LGA', 'LGW', 'DXB', 'SIN', 'CDG', 'AMS', 'FRA', 'IST',
  'HND', 'ICN', 'PEK', 'PVG', 'SYD', 'DOH', 'AUH', 'BKK', 'MAD', 'FCO', 'MUC',
  'YYZ', 'GRU', 'MEX', 'JNB', 'CAI', 'KUL', 'CGK', 'SVO', 'MOW', 'LAX', 'SFO',
  'ORD', 'ATL', 'DFW', 'MIA', 'HKG', 'TPE', 'NRT', 'AKL', 'MEL', 'ZRH', 'VIE',
  'ARN', 'OSL', 'HEL', 'DUB', 'LIS', 'ATH', 'WAW', 'PRG', 'OTP', 'SOF', 'BEY',
  'AMM', 'TLV', 'KHI', 'LHE', 'ISB', 'DAC', 'KTM', 'CMB', 'ALA', 'TAS', 'TBS',
  'RUH', 'JED', 'MLE', 'BOM', 'DEL', 'BLR', 'MAA', 'SHJ', 'DWC', 'LGW', 'STN',
];
const PREF_RANK = new Map(PREFERRED.map((c, i) => [c, i]));

/** Cities with the same name in several countries: prefer the one whose airport is a major hub. */

/** Static India map: instant resolution, no network, country known to be India. */
export const IATA: Record<string, string> = {
          delhi: 'DEL', 'new delhi': 'DEL', mumbai: 'BOM', bombay: 'BOM', bangalore: 'BLR', bengaluru: 'BLR',
          hyderabad: 'HYD', chennai: 'MAA', kolkata: 'CCU', pune: 'PNQ', ahmedabad: 'AMD', jaipur: 'JAI',
          goa: 'GOI', panaji: 'GOI', lucknow: 'LKO', nagpur: 'NAG', indore: 'IDR', surat: 'STV',
          patna: 'PAT', bhopal: 'BHO', coimbatore: 'CJB', kochi: 'COK', ernakulam: 'COK', guwahati: 'GAU',
          chandigarh: 'IXC', dehradun: 'DED', amritsar: 'ATQ', varanasi: 'VNS', srinagar: 'SXR',
          trivandrum: 'TRV', thiruvananthapuram: 'TRV', vizag: 'VTZ', visakhapatnam: 'VTZ', madurai: 'IXM',
          udaipur: 'UDR', jodhpur: 'JDH', ranchi: 'IXR', raipur: 'RPR', bhubaneswar: 'BBI', imphal: 'IMF',
          leh: 'IXL', bagdogra: 'IXB', aurangabad: 'IXU', mangalore: 'IXE',
          vadodara: 'BDQ', rajkot: 'RAJ', jammu: 'IXJ', allahabad: 'IXD', prayagraj: 'IXD',
          gorakhpur: 'GOP', jharsuguda: 'JRG', dibrugarh: 'DIB', tezpur: 'TEZ', kanpur: 'KNU',
          mysore: 'MYQ', hubli: 'HBX', belgaum: 'IXG', kolhapur: 'KLH', nashik: 'ISK', shirdi: 'SAG',
          tirupati: 'TIR',
        };
/**
 * Unified resolver used by every flight worker: typed IATA code > static Indian
 * map > global OpenFlights lookup. Returns code:null when nothing matches —
 * callers honestly skip the route (never guess).
 */
export async function resolveAirport(city: string, codeHint?: string | null): Promise<ResolvedAirport> {
  if (codeHint && /^[A-Za-z]{3}$/.test(codeHint)) return { code: codeHint.toUpperCase(), city, country: '' };
  const s = IATA[city.toLowerCase().trim()];
  if (s) return { code: s, city, country: 'India' };
  return cityToAirport(city);
}

export interface Airport { iata: string; city: string; country: string; name: string }

export interface ResolvedAirport { code: string | null; city: string; country: string }

const TTL_OK = 24 * 3600_000;    // airports.dat: re-fetch daily
const TTL_MISS = 10 * 60_000;    // unknown city: retry lookup after 10 min

let cache: { at: number; byCity: Map<string, Airport[]> } | null = null;
const missCache = new Map<string, number>();

const norm = (s: string) => s.toLowerCase().replace(/[’'’.]/g, '').replace(/\s+/g, ' ').trim();

async function loadAirports(): Promise<Map<string, Airport[]>> {
  if (cache && Date.now() - cache.at < TTL_OK) return cache.byCity;
  const res = await fetch(URL_DAT, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`airports.dat HTTP ${res.status}`);
  const text = await res.text();
  const byCity = new Map<string, Airport[]>();
  // CSV: id,name,city,country,iata,icao,lat,lon,alt,tz,dst,tzdb,type,source — quote-aware split.
  const splitCsv = (line: string): string[] => {
    const out: string[] = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (ch === ',' && !q) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  };
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const f = splitCsv(line);
    const iata = (f[4] || '').trim();
    if (!iata || iata === '\\N' || !/^[A-Z]{3}$/.test(iata)) continue;
    const city = (f[2] || '').trim();
    const country = (f[3] || '').trim();
    if (!city || !country) continue;
    const ap: Airport = { iata, city, country, name: (f[1] || '').trim() };
    const key = norm(city);
    const bucket = byCity.get(key);
    if (bucket) bucket.push(ap); else byCity.set(key, [ap]);
  }
  cache = { at: Date.now(), byCity };
  return byCity;
}

/**
 * Resolve any world city to its major airport IATA code + country.
 * Static Indian cities resolve instantly via the map passed by the caller
 * (flights.ts owns that map) — this function handles everything else.
 */
export async function cityToAirport(city: string): Promise<ResolvedAirport> {
  const key = norm(city);
  if (!key) return { code: null, city, country: '' };
  const missAt = missCache.get(key);
  if (missAt && Date.now() - missAt < TTL_MISS) return { code: null, city, country: '' };
  try {
    const byCity = await loadAirports();
    let bucket = byCity.get(key);
    if (!bucket) {
      // Last resort: airport NAME containing the city ("Velana Intl (Male)") before giving up.
      for (const [ck, aps] of byCity) {
        if (aps.some((a) => norm(a.name).includes(key))) { bucket = aps; break; }
      }
    }
    if (!bucket || bucket.length === 0) {
      missCache.set(key, Date.now());
      return { code: null, city, country: '' };
    }
    const ranked = bucket
      .map((a) => ({ a, rank: PREF_RANK.has(a.iata) ? PREF_RANK.get(a.iata)! : 999 }))
      .sort((x, y) => x.rank - y.rank);
    const preferred = ranked[0]?.a || bucket[0];
    return { code: preferred.iata, city: preferred.city, country: preferred.country };
  } catch (e: any) {
    log.warn('AirportLookup', `airports.dat unavailable: ${String(e?.message || e)}`);
    return { code: null, city, country: '' };
  }
}
