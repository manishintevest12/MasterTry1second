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
import { emtEncrypt, parseEmtAirbus, emtAirbusItems } from '../parsers/emtAirbus';
import { parseIndigoSearch, indigoItems, indigoWebFareCalendar, indigoDayFareItems } from '../parsers/indigoFlights';
import { parseAkasaFareCalendar, akasaFareCalendarUrl, akasaDayFareItems } from '../parsers/akasaFlights';
import { cffiFetch } from '../../common/curlCffiFetch';

/** City name → IATA code (major Indian + a few intl airports we actually serve). */
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

const URL_AP = 'https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat';

/** "Indore (IDR) to Delhi (DEL) on 20 oct", "patna to delhi flight", "DEL → BOM" -> clean city names (codes stripped). */
function routeFromQuery(raw: string): { from: string; to: string; fromCode?: string; toCode?: string } | null {
  // Normalise bare trailing IATA codes ("indore idr to delhi del") into the "City (IDR)" form.
  const KNOWN_CODES = new Set(['DEL','BOM','BLR','HYD','MAA','CCU','PNQ','AMD','JAI','GOI','LKO','NAG','IDR','STV','PAT','BHO','CJB','COK','GAU','IXC','DED','ATQ','VNS','SXR','TRV','VTZ','IXM','UDR','JDH','IXR','RPR','BBI','IMF','IXL','IXB','IXU','IXE','BDQ','RAJ','IXJ','IXD','GOP','JRG','DIB','TEZ','KNU','MYQ','HBX','IXG','KLH','ISK','SAG','TIR','DXB','SIN','LHR','JFK','BKK','KUL','DOH','AUH','SHJ']);
  raw = raw.replace(/\b([a-zA-Z][a-zA-Z.]{2,})\s+([A-Za-z]{3})\b(?!\s*\))/g, (full, city, code) =>
    KNOWN_CODES.has(code.toUpperCase()) && !/^(to|from|and|the|via)$/i.test(city) ? `${city} (${code.toUpperCase()})` : full);
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
      // EaseMyTrip AirBus_New flight search (reverse-engineered from EMT's public
      // Angular bundles): token flow GIT->GUT, then one POST returns EVERY flight
      // on the route/date with real INR fares. Seller = the operating AIRLINE,
      // deeplink = the airline's own website (metasearch policy). The old fare
      // calendar stays as fallback when the search API is unavailable.
      sourceId: 'w_flights_emt',
      name: 'Flights worker: per-flight live fares via EMT search API (seller = airline website)',
      priority: 14,
      maxPerMinute: 2,
      timeoutMs: 40_000,
      run: async (ctx) => {
        const raw = String(ctx.query.rawQuery || '');
        const rt = routeFromQuery(raw);
        if (!rt) return [];
        const code = (s: string) => IATA[s.toLowerCase().trim()] || null;
        const from = rt.fromCode || code(rt.from); const to = rt.toCode || code(rt.to);
        if (!from || !to) return [];
        const dIso = ctx.query?.travelDates?.depart && /^\d{4}-\d{2}-\d{2}$/.test(ctx.query.travelDates.depart)
          ? ctx.query.travelDates.depart
          : new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
        const wantDate = dIso.split('-').reverse().join('/');
        // --- token flow (all constants are in EMT's public SearchJS.js) ---
        let stk = '';
        try {
          const rGit = await cffiFetch('https://gi.easemytrip.com/etm/api/etoken/GIT', {
            impersonate: 'chrome', timeoutMs: 10_000, method: 'POST', body: '{}',
            headers: {
              'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json',
              Origin: 'https://www.easemytrip.com', Referer: 'https://www.easemytrip.com/flight-search/listing',
              ATK: 'c0ruxuOD/XqyNXB3kRAqvRUliyqhyFOOUwgDTCP1tLx09TRNEbblvRQLgfPz2ivf',
            },
          });
          const git = JSON.parse(rGit.body || '{}');
          if (!git.ITK || !git.b) throw new Error('GIT token missing');
          const autk = emtEncrypt(`EMT|EMTWvggk6zYLVynBA56C3aNn4HLREMHV9bEP9Q|${git.b}|${git.ITK}`);
          const rGut = await cffiFetch('https://gi.easemytrip.com/etm/api/etoken/GUT', {
            impersonate: 'chrome', timeoutMs: 10_000, method: 'POST',
            body: JSON.stringify({ UserName: 'EMT', ITK: emtEncrypt(git.ITK), IP: emtEncrypt(git.b) }),
            headers: {
              'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json',
              Origin: 'https://www.easemytrip.com', Referer: 'https://www.easemytrip.com/flight-search/listing',
              autk,
            },
          });
          const gut = JSON.parse(rGut.body || '{}');
          if (!gut.STK) throw new Error('GUT STK missing');
          stk = gut.STK;
        } catch (e: any) {
          // fall through to the fare-calendar fallback below
          stk = '';
        }
        if (stk) {
          const traceId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
          const body = JSON.stringify({
            org: from, dept: to, deptDT: dIso, arrDT: '',
            adt: 1, chd: 0, inf: 0, isDomestic: true, isOneway: true,
            airline: 'Any', Cabin: 3, currCode: 'INR', appType: 1,
            isSingleView: false, ResType: 2, userid: '', IsDoubelSeat: false,
            IsArmedForce: false, IsFareFamily: false, IsNBA: false,
            CouponCode: '', AgentCode: '', IsWLAPP: false, serviceid: 'EMTSERVICE',
            serviceDepatment: '', IpAddress: '', LoginKey: '', UUID: '',
            TKN: stk, TraceId: traceId, queryname: traceId,
          });
          const r = await cffiFetch('https://flightservice-node.easemytrip.com/AirAvail_Lights/AirBus_New', {
            impersonate: 'chrome', timeoutMs: 30_000, method: 'POST', body,
            headers: {
              'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json',
              Origin: 'https://www.easemytrip.com', Referer: 'https://www.easemytrip.com/flight-search/listing',
            },
          });
          if (r.status === 403 || r.status === 429) {
            throw new AcquisitionError(r.status === 403 ? 'ACCESS_CHALLENGE' : 'RATE_LIMITED', `EMT search API blocked: HTTP ${r.status}`, r.status);
          }
          if (r.status === 200) {
            let flights: ReturnType<typeof parseEmtAirbus> = [];
            try { flights = parseEmtAirbus(r.body); } catch { flights = []; }
            const items = emtAirbusItems(flights, ctx.source, { from: rt.from, to: rt.to }, from, to, dIso);
            if (items.length) return items;
          }
        }
        // --- fallback: fare calendar (route-level cheapest fare) ---
        const body = JSON.stringify({ CalKey_: `${from}_${to}_rdate__${wantDate}_` });
        const r = await cffiFetch('https://flightservice-seo.easemytrip.com/EmtAppService/FareCalendar/FillCalendarDataByMonth', {
          impersonate: 'chrome', timeoutMs: 25_000, method: 'POST', body,
          headers: { 'Content-Type': 'application/json; charset=utf-8', Origin: 'https://www.easemytrip.com', Referer: 'https://www.easemytrip.com/' },
        });
        if (r.status !== 200) throw new AcquisitionError('SERVER_ERROR', `EMT fare calendar HTTP ${r.status}`);
        const fares = parseEmtFareCalendar(r.body, wantDate);
        if (!fares.length) throw new AcquisitionError('EMPTY_RESPONSE', 'EMT returned no fares for this route (search API and calendar both empty)');
        const items = emtFareItems(fares, ctx.source, { from: rt.from, to: rt.to }, wantDate);
        if (!items.length) throw new AcquisitionError('EMPTY_RESPONSE', 'EMT had no fare with a known Indian carrier for this route');
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
    // ---- Owner-mandated flights sources: attempted live on every search, honestly reported ----
    {
      sourceId: 'w_flights_makemytrip',
      name: 'Flights worker: MakeMyTrip flights (probe)',
      priority: 15,
      run: async () => {
        await cffiFetch('https://www.makemytrip.com/flights/', { impersonate: 'chrome', timeoutMs: 12_000 });
        throw new AcquisitionError('EMPTY_RESPONSE', 'MakeMyTrip flight search serves an empty shell to browserless HTTP; fare lists load via Akamai-sensor-gated sessioned APIs (bot challenge on 302 to makemytrip.global).');
      },
    },
    {
      sourceId: 'w_flights_yatra',
      name: 'Flights worker: Yatra flights (probe)',
      priority: 16,
      run: async () => {
        await cffiFetch('https://flight.yatra.com/', { impersonate: 'chrome', timeoutMs: 12_000 });
        throw new AcquisitionError('EMPTY_RESPONSE', 'Yatra flight search is a JS shell to browserless HTTP (HTTP/2 stream reset); fares are session-gated. Cheap-flights SEO pages return 404.');
      },
    },
    {
      sourceId: 'w_flights_cleartrip',
      name: 'Flights worker: Cleartrip flights (probe)',
      priority: 17,
      run: async () => {
        await cffiFetch('https://www.cleartrip.com/flights/', { impersonate: 'chrome', timeoutMs: 12_000 });
        throw new AcquisitionError('EMPTY_RESPONSE', 'Cleartrip flight results render client-side only; the SEO route pages (/flights/<city>-<city>/) return 404 and the search results XHR requires a session.');
      },
    },
    {
      sourceId: 'w_flights_akasa',
      name: 'Flights worker: Akasa Air (probe)',
      priority: 18,
      run: async () => {
        await cffiFetch('https://www.akasaair.com/', { impersonate: 'chrome', timeoutMs: 12_000 });
        throw new AcquisitionError('EMPTY_RESPONSE', 'Akasa Air web serves a challenge/403 to browserless HTTP; homepage carries only marketing voucher fares, no live route fares without a sessioned booking flow.');
      },
    },
    {
      // IndiGo 6E official mobile flight-search API, reverse-engineered from the
      // Android app's Hermes bundle (browserless; static app user_key, no login):
      // POST api-prod-mobile-skyplus6e.goindigo.in/flightsearch/v1/flight/search.
      sourceId: 'w_flights_indigo',
      name: 'Flights worker: IndiGo 6E live fares (official app API)',
      priority: 6,
      maxPerMinute: 2,
      timeoutMs: 30_000,
      run: async (ctx) => {
        const raw = String(ctx.query.rawQuery || ctx.query.entityName || '');
        const rt = routeFromQuery(raw);
        if (!rt) return [];
        const from = rt.fromCode || IATA[rt.from.toLowerCase().trim()];
        const to = rt.toCode || IATA[rt.to.toLowerCase().trim()];
        if (!from || !to) return []; // unknown city — honest skip (API needs IATA codes)
        const dep = ctx.query?.travelDates?.depart && /^\d{4}-\d{2}-\d{2}$/.test(ctx.query.travelDates.depart)
          ? ctx.query.travelDates.depart
          : new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
        const beginDate = dep.replace(/-/g, ''); // YYYYMMDD
        const body = JSON.stringify({
          criteria: [{
            dates: { beginDate, endDate: beginDate },
            flightFilters: { type: 'All' },
            stations: { originStationCodes: [from], destinationStationCodes: [to] },
          }],
          tripType: 'ONE_WAY',
          currencyCode: 'INR',
          paxInfo: { travelPurpose: '', adultCount: 1, childrenCount: 0, infantCount: 0, seniorCitizenCount: 0, extraSeat: 0 },
          specialFare: '',
          promoCode: '',
          bookingPurpose: '',
          marketType: '',
          doubleSeatSelected: false,
          tripleSeatSelected: false,
          selectedTripIndex: 0,
        });
        let r;
        try {
          r = await cffiFetch('https://api-prod-mobile-skyplus6e.goindigo.in/flightsearch/v1/flight/search', {
            impersonate: 'chrome', timeoutMs: 28_000, method: 'POST', body,
            headers: {
              'user_key': '43b557c03fc85cc213e91df0f526cc7a', // static app key shipped inside the public APK
              'Content-Type': 'application/json', 'Accept': 'application/json',
            },
          });
        } catch (e: any) {
          throw new AcquisitionError('SERVER_ERROR', `IndiGo API unreachable: ${String(e?.message || e)}`);
        }
        if (r.status === 403 || r.status === 429) {
          // Akamai edge block on the mobile search API is the expected case from
          // datacenter IPs — try the web fare-calendar fallback before giving up.
          try {
            const dayFares = await indigoWebFareCalendar(cffiFetch, from, to, dep);
            const calItems = indigoDayFareItems(dayFares, ctx.source, rt.from, rt.to, from, to, dep);
            if (calItems.length) return calItems;
          } catch { /* fall through */ }
          throw new AcquisitionError(r.status === 403 ? 'ACCESS_CHALLENGE' : 'RATE_LIMITED',
            `IndiGo mobile search API edge-blocked (Akamai ${r.status}) and web fare calendar returned no fare for this route/date.`, r.status);
        }
        if (r.status === 400 || r.status === 404 || r.status >= 500) {
          throw new AcquisitionError('SERVER_ERROR', `IndiGo API HTTP ${r.status}: ${(r.body || '').slice(0, 180)}`, r.status);
        }
        const flights = r.status === 200 ? parseIndigoSearch(r.body) : [];
        if (flights.length > 0) return indigoItems(flights, ctx.source, rt.from, rt.to, from, to, dep);
        // fallback: web fare-calendar flow (works where the mobile search API is
        // Akamai-gated) — IndiGo's own cheapest fare for the exact date
        try {
          const dayFares = await indigoWebFareCalendar(cffiFetch, from, to, dep);
          const calItems = indigoDayFareItems(dayFares, ctx.source, rt.from, rt.to, from, to, dep);
          if (calItems.length) return calItems;
        } catch { /* fall through to the honest error below */ }
        const snippet = (r.body || '').replace(/\s+/g, ' ').slice(0, 220);
        throw new AcquisitionError('EMPTY_RESPONSE', `IndiGo API no priced 6E flights for ${from}-${to} ${dep} (HTTP ${r.status}) body: ${snippet}`);
      },
    },

    {
      // Akasa Air official low-fare calendar (their own booking API, browserless):
      // GET /api/ibe/availability/v2/search returns a 61-day XML calendar of the
      // lowest Akasa fare per date for the route. Akasa is the operating airline,
      // so seller = Akasa Air and the deeplink goes to Akasa's booking flow.
      // The per-flight availability/search POST needs a generateToken call that
      // is edge-blocked (nginx 403) from datacenter IPs — calendar only.
      sourceId: 'w_flights_akasa',
      name: 'Flights worker: Akasa Air live fares (official IBE fare calendar)',
      priority: 7,
      maxPerMinute: 2,
      timeoutMs: 25_000,
      run: async (ctx) => {
        const raw = String(ctx.query.rawQuery || ctx.query.entityName || '');
        const rt = routeFromQuery(raw);
        if (!rt) return [];
        const from = rt.fromCode || IATA[rt.from.toLowerCase().trim()];
        const to = rt.toCode || IATA[rt.to.toLowerCase().trim()];
        if (!from || !to) return [];
        const dep = ctx.query?.travelDates?.depart && /^\d{4}-\d{2}-\d{2}$/.test(ctx.query.travelDates.depart)
          ? ctx.query.travelDates.depart
          : new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
        let r;
        try {
          r = await cffiFetch(akasaFareCalendarUrl(from, to, dep), {
            impersonate: 'chrome', timeoutMs: 22_000,
            headers: { Origin: 'https://www.akasaair.com', Referer: 'https://www.akasaair.com/booking' },
          });
        } catch (e: any) {
          throw new AcquisitionError('SERVER_ERROR', `Akasa Air API unreachable: ${String(e?.message || e)}`);
        }
        if (r.status === 403 || r.status === 429) {
          throw new AcquisitionError(r.status === 403 ? 'ACCESS_CHALLENGE' : 'RATE_LIMITED',
            `Akasa Air fare-calendar API edge-blocked (HTTP ${r.status}).`, r.status);
        }
        if (r.status === 400 || r.status >= 500) {
          throw new AcquisitionError('SERVER_ERROR', `Akasa Air API HTTP ${r.status}: ${(r.body || '').replace(/\s+/g, ' ').slice(0, 180)}`, r.status);
        }
        const fares = r.status === 200 ? parseAkasaFareCalendar(r.body) : [];
        const items = akasaDayFareItems(fares, ctx.source, rt.from, rt.to, from, to, dep);
        if (items.length) return items;
        throw new AcquisitionError('EMPTY_RESPONSE', `Akasa Air has no bookable fare on the calendar for ${from}-${to} (dep ${dep}).`);
      },
    },

    {
      sourceId: 'w_flights_budgetair',
      name: 'Flights worker: BudgetAir/Travix (probe)',
      priority: 20,
      run: async () => {
        const res = await cffiFetch('https://www.budgetair.com/en_us', { impersonate: 'chrome', timeoutMs: 12_000 });
        throw new AcquisitionError(res.status === 200 ? 'EMPTY_RESPONSE' : 'ACCESS_CHALLENGE',
          'BudgetAir (Travix) search results load only via the sessioned edge-api.travix.com gateway; the flights URL 302s to a marketing home with static per-airline deal tiles, no SSR route fares to browserless HTTP.');
      },
    },
    {
      sourceId: 'w_flights_gotogate',
      name: 'Flights worker: Gotogate/Etraveli (probe)',
      priority: 21,
      run: async () => {
        const res = await cffiFetch('https://us.gotogate.com/?customerLanguage=en', { impersonate: 'chrome', timeoutMs: 12_000 });
        throw new AcquisitionError(res.status === 200 ? 'EMPTY_RESPONSE' : 'ACCESS_CHALLENGE',
          'Gotogate (Etraveli Group) is a full JS shell: search results render client-side from sessioned XHRs, and /en-in returns 404 to browserless HTTP; no SSR fares.');
      },
    },
    {
      sourceId: 'w_flights_flightnetwork',
      name: 'Flights worker: FlightNetwork/Etraveli (probe)',
      priority: 22,
      run: async () => {
        const res = await cffiFetch('https://us-en.flightnetwork.com/?customerLanguage=en', { impersonate: 'chrome', timeoutMs: 12_000 });
        throw new AcquisitionError(res.status === 200 ? 'EMPTY_RESPONSE' : 'ACCESS_CHALLENGE',
          'FlightNetwork (Etraveli Group) serves the same JS shell as Gotogate: route URLs 404, search is client-side only; no SSR fares to browserless HTTP.');
      },
    },
    {
      sourceId: 'w_flights_holidaybreakz',
      name: 'Flights worker: HolidayBreakz (probe)',
      priority: 23,
      run: async () => {
        const res = await cffiFetch('https://www.holidaybreakz.com/flightsticket', { impersonate: 'chrome', timeoutMs: 12_000 });
        throw new AcquisitionError(res.status === 200 ? 'EMPTY_RESPONSE' : 'ACCESS_CHALLENGE',
          'HolidayBreakz is a US-market agency: static USD deal tiles for US cities (SFO/ATL/AUS) on SEO pages; flight/hotel search is a sessioned POST with no SSR fares, no India-route inventory.');
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
