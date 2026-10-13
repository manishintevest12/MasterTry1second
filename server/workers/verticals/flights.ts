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
import { parseEmtFareCalendar, emtFareItems } from '../parsers/emtFareCalendar';
import { cffiFetch } from '../../common/curlCffiFetch';

const URL_AP = 'https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat';

/** "Indore (IDR) to Delhi (DEL) on 20 oct", "patna to delhi flight", "DEL → BOM" -> clean city names (codes stripped). */
function routeFromQuery(raw: string): { from: string; to: string; fromCode?: string; toCode?: string } | null {
  const m = raw.match(/([a-zA-Z][a-zA-Z\s.]{1,28}?(?:\s*\([A-Za-z]{3}\))?)\s+(?:to|→|->|-)\s+([a-zA-Z][a-zA-Z\s.]{1,28}(?:\s*\([A-Za-z]{3}\))?)/);
  if (!m) return null;
  const codeOf = (s: string) => s.match(/\(([A-Za-z]{3})\)/)?.[1]?.toUpperCase();
  const clean = (s: string) => s
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(flight|flights|ticket|tickets|air|fly|from|cheapest|cheap|direct|return|one-way|oneway|round trip|airport)\b/gi, ' ')
    .replace(/\b(on|for|tomorrow|today|tonight|night|morning|evening|at)\b.*$/i, ' ')
    .replace(/\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b.*$/i, ' ')
    .replace(/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b.*$/, ' ')
    .replace(/,.*$/, '').replace(/\s+/g, ' ').trim();
  const from = clean(m[1]); const to = clean(m[2]);
  if (!from || !to) return null;
  return { from, to, fromCode: codeOf(m[1]), toCode: codeOf(m[2]) };
}

export const flightsWorker: VerticalWorker = {
  vertical: 'flights',
  tasks: [
    {
      // EaseMyTrip fare calendar (metasearch acquisition): real cheapest per-day
      // fare + operating airline. Seller = the AIRLINE; deeplink = airline's own site.
      sourceId: 'w_flights_emt',
      priority: 14,
      run: async (ctx) => {
        const raw = String(ctx.query.rawQuery || '');
        const rt = routeFromQuery(raw);
        if (!rt) return [];
        const IATA: Record<string, string> = {
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
        const code = (s: string) => IATA[s.toLowerCase().trim()] || null;
        const from = rt.fromCode || code(rt.from); const to = rt.toCode || code(rt.to);
        if (!from || !to) return []; // unknown city — honest skip (calendar needs IATA codes)
        const dIso = ctx.query?.travelDates?.depart;
        const base = dIso && /^\d{4}-\d{2}-\d{2}$/.test(dIso) ? new Date(`${dIso}T00:00:00`) : new Date(Date.now() + 7 * 86400_000);
        const dd = String(base.getDate()).padStart(2, '0'); const mm = String(base.getMonth() + 1).padStart(2, '0'); const yy = base.getFullYear();
        const wantDate = `${dd}/${mm}/${yy}`;
        const body = JSON.stringify({ CalKey_: `${from}_${to}_rdate__${wantDate}_` });
        const r = await cffiFetch('https://flightservice-seo.easemytrip.com/EmtAppService/FareCalendar/FillCalendarDataByMonth', {
          impersonate: 'chrome', timeoutMs: 25_000, method: 'POST', body,
          headers: { 'Content-Type': 'application/json; charset=utf-8', Origin: 'https://www.easemytrip.com', Referer: 'https://www.easemytrip.com/' },
        });
        if (r.status !== 200) throw new AcquisitionError('SERVER_ERROR', `EMT fare calendar HTTP ${r.status}`);
        const fares = parseEmtFareCalendar(r.body, wantDate);
        if (!fares.length) throw new AcquisitionError('EMPTY_RESPONSE', 'EMT fare calendar returned no per-day fares for this route');
        const items = emtFareItems(fares, ctx.source, { from: rt.from, to: rt.to }, wantDate);
        if (!items.length) throw new AcquisitionError('EMPTY_RESPONSE', 'EMT fare calendar had no fare with a known Indian carrier for this route');
        return items;
      },
    },
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
