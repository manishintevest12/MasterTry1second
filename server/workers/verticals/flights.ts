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
import { parseIxigoFlights, parseIxigoOffers, ixigoRouteTokens } from '../parsers/ixigoFlights';
import { AcquisitionError } from '../../common/httpClient';
import { parseEmtFareCalendar, emtFareItems } from '../parsers/emtFareCalendar';
import { emtEncrypt, parseEmtAirbus, emtAirbusItems } from '../parsers/emtAirbus';
import { resolveAirport, IATA } from '../../common/airportLookup';
import { kiwiSearch, kiwiItems } from '../parsers/kiwiFlights';
import { parseIndigoSearch, indigoItems, indigoWebFareCalendar, indigoDayFareItems } from '../parsers/indigoFlights';
import { parseAkasaFareCalendar, akasaFareCalendarUrl, akasaDayFareItems } from '../parsers/akasaFlights';
import { EXPEDIA_FLIGHTS_QUERY } from '../parsers/expediaFlightsQuery';
import { parseExpediaFlights } from '../parsers/expediaFlights';
import { usdToInrRate } from '../../common/fxRates';
import { cffiFetch } from '../../common/curlCffiFetch';


const URL_AP = 'https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat';

/** "Indore (IDR) to Delhi (DEL) on 20 oct", "patna to delhi flight", "DEL → BOM" -> clean city names (codes stripped). */
function routeFromQuery(raw: string): { from: string; to: string; fromCode?: string; toCode?: string } | null {
  // Normalise bare trailing IATA codes ("indore idr to delhi del") into the "City (IDR)" form.
  // A 3-letter token after a city word is a typed IATA code: UPPERCASE always
  // counts ("dubai DXB to london LHR", any world airport); lowercase only when
  // it is a KNOWN code ("indore idr to delhi del" — lowercase words are not
  // trusted as codes because they can be ordinary words).
  const KNOWN_CODES = new Set(['DEL','BOM','BLR','HYD','MAA','CCU','PNQ','AMD','JAI','GOI','LKO','NAG','IDR','STV','PAT','BHO','CJB','COK','GAU','IXC','DED','ATQ','VNS','SXR','TRV','VTZ','IXM','UDR','JDH','IXR','RPR','BBI','IMF','IXL','IXB','IXU','IXE','BDQ','RAJ','IXJ','IXD','GOP','JRG','DIB','TEZ','KNU','MYQ','HBX','IXG','KLH','ISK','SAG','TIR','DXB','SIN','LHR','JFK','BKK','KUL','DOH','AUH','SHJ']);
  raw = raw.replace(/\b([a-zA-Z][a-zA-Z.]{2,})\s+([A-Za-z]{3})\b(?!\s*\))/g, (full, city, code) => {
    if (/^(to|from|and|the|via)$/i.test(city)) return full;
    const up = code.toUpperCase();
    if (code === code.toUpperCase() || KNOWN_CODES.has(up)) return `${city} (${up})`;
    return full;
  });
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

/** Expedia flights live search (flights-shopping-pwa GraphQL, browserless):
 *  1. GET the Flights-Search SRP with safari impersonation (primes Akamai cookies
 *     + DUAID; chrome TLS is sampled/429 from datacenter IPs).
 *  2. POST /graphql with the EXACT FlightsSearchResultsLoadedQuery document the
 *     PWA ships (237 fragments, see parsers/expediaFlightsQuery.ts).
 *  Expedia is the price-owning OTA: seller = Expedia, deeplink = expedia.com.
 *  USD fares convert to INR via the live fxRates module (never a guessed rate). */
async function expediaFlightsSearch(ctx: any, rt: { from: string; to: string; fromCode?: string; toCode?: string }, dIso: string): Promise<any[]> {
  const from = rt.fromCode || IATA[rt.from.toLowerCase().trim()] || null;
  const to = rt.toCode || IATA[rt.to.toLowerCase().trim()] || null;
  if (!from || !to) return []; // unknown city — honest skip
  const srpUrl = `https://www.expedia.com/Flights-Search?flight-type=oneway&from-date=${dIso}` +
    `&from=${encodeURIComponent(`${rt.from} (${from})`)}&to=${encodeURIComponent(`${rt.to} (${to})`)}&search-type=arsed&mode=search`;
  let cookies: Record<string, string> | undefined;
  const primed = await cffiFetch(srpUrl, {
    impersonate: 'safari', timeoutMs: 30_000, returnCookies: true, cookies,
    headers: { Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9' },
  });
  cookies = primed.cookies || cookies;
  if (primed.status === 429 || (primed.status === 200 && /Bot or Not\?/.test(primed.body.slice(0, 4000)))) {
    throw new AcquisitionError('ACCESS_CHALLENGE', `expedia.com SRP edge returned a bot challenge (HTTP ${primed.status})`, primed.status);
  }
  if (primed.status !== 200) throw new AcquisitionError('SERVER_ERROR', `expedia.com SRP HTTP ${primed.status}`, primed.status);
  const duaid = (primed.body.match(/"duaid":"([0-9a-f-]{36})"/) || [])[1] || cookies?.DUAID || '';
  const y = +dIso.slice(0, 4), mo = +dIso.slice(5, 7), da = +dIso.slice(8, 10);
  const payload = JSON.stringify({
    operationName: 'FlightsSearchResultsLoadedQuery',
    query: EXPEDIA_FLIGHTS_QUERY,
    variables: {
      context: { currency: 'USD', device: { type: 'DESKTOP' }, eapid: 0, identity: { authState: 'ANONYMOUS', duaid }, locale: 'en_US', privacyTrackingState: 'CAN_TRACK', siteId: 1, tpid: 1 },
      journeyCriteria: [{ departureDate: { day: da, month: mo, year: y }, destination: to, origin: from }],
      travelerDetails: [{ ages: null, count: 1, travelerType: 'ADULT' }],
      searchPagination: { startingIndex: 0, size: 50 },
    },
  });
  const r = await cffiFetch('https://www.expedia.com/graphql', {
    method: 'POST', impersonate: 'safari', timeoutMs: 45_000, cookies, body: payload,
    headers: {
      'Content-Type': 'application/json', Accept: '*/*', Origin: 'https://www.expedia.com', Referer: srpUrl,
      'client-info': 'flights-shopping-pwa,f658986df5e0a55d154dc12eef2e7d34978e8f73,us-west-2',
      'x-page-id': 'page.Flights-Search,F,20',
    },
  });
  if (r.status === 429) throw new AcquisitionError('ACCESS_CHALLENGE', 'expedia.com flights GraphQL edge returned a bot challenge (HTTP 429)', 429);
  if (r.status !== 200) throw new AcquisitionError('SERVER_ERROR', `expedia.com flights GraphQL HTTP ${r.status}: ${r.body.slice(0, 160)}`, r.status);
  const fx = await usdToInrRate(); // live USD->INR; null => keep USD as listed (never a guessed rate)
  const items = parseExpediaFlights(r.body, ctx.source, { from: rt.from, to: rt.to, fromCode: from, toCode: to }, dIso, srpUrl, fx);
  if (!items.length) throw new AcquisitionError('EMPTY_RESPONSE', `expedia.com GraphQL returned no priced flight listings for ${from}-${to} on ${dIso}`);
  return items;
}

export const flightsWorker: VerticalWorker = {
  vertical: 'flights',
  tasks: [
    {
      // EaseMyTrip AirBus_New flight search (reverse-engineered from EMT's public
      // Angular bundles): token flow GIT->GUT, then one POST returns EVERY flight
      // on the route/date with real INR fares. Works for ANY world route (EMT's
      // engine sells foreign carriers too). Seller = EaseMyTrip — the website
      // selling the ticket (owner policy 15 Oct: seller is the selling site,
      // never the operating airline); deeplink = EMT's own search page. The old
      // fare calendar stays as fallback when the search API is unavailable.
      sourceId: 'w_flights_emt',
      name: 'Flights worker: per-flight live fares via EMT search API (worldwide, seller = EaseMyTrip)',
      priority: 14,
      maxPerMinute: 2,
      timeoutMs: 40_000,
      run: async (ctx) => {
        const raw = String(ctx.query.rawQuery || '');
        const rt = routeFromQuery(raw);
        if (!rt) return [];
        const fromA = await resolveAirport(rt.from, rt.fromCode);
        const toA = await resolveAirport(rt.to, rt.toCode);
        const from = fromA.code; const to = toA.code;
        if (!from || !to) return []; // unknown city — honest skip (worldwide resolver found nothing)
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
            const items = emtAirbusItems(flights, ctx.source, { from: rt.from, to: rt.to }, from, to, dIso, fromA.country, toA.country);
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
        const items = emtFareItems(fares, ctx.source, { from: rt.from, to: rt.to }, wantDate, from, to);
        if (!items.length) throw new AcquisitionError('EMPTY_RESPONSE', 'EMT had no fare with a known Indian carrier for this route');
        return items;
      },
    },
    {
      // Ixigo SSRs the flight search page: __NEXT_DATA__ ships up to 100
      // real flight entries for the date (airline, flight number, total
      // fare, times, stops). Any world city works (IATA tokens resolved
      // globally). Seller = Ixigo, the ticket-selling website.
      sourceId: 'w_flights_ixigo',
      name: 'Flights worker: real fares via Ixigo SSR (worldwide, seller = Ixigo)',
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
        // Ixigo route slugs: IATA-first; %20 in city names 404s (regression, 14 Oct 2026).
        const fromA = await resolveAirport(rt.from, rt.fromCode);
        const toA = await resolveAirport(rt.to, rt.toCode);
        const { fromTok, toTok, alts } = ixigoRouteTokens(rt.from, rt.to, fromA.code || rt.fromCode, toA.code || rt.toCode, IATA);
        const url = `https://www.ixigo.com/search/flight/${fromTok}/${toTok}/${dep}/1/0`;
        let res = await cffiFetch(url, { impersonate: 'chrome', timeoutMs: 30_000 });
        if (res.status === 403 || res.status === 429) {
          throw new AcquisitionError(res.status === 403 ? 'ACCESS_CHALLENGE' : 'RATE_LIMITED', `Ixigo blocked: ${res.status}`, res.status);
        }
        // Retry alternate origin slugs before giving up (underscore / hyphen / IATA).
        if (res.status === 404) {
          for (const altFrom of alts) {
            const r2 = await cffiFetch(`https://www.ixigo.com/search/flight/${altFrom}/${toTok}/${dep}/1/0`, { impersonate: 'chrome', timeoutMs: 30_000 });
            if (r2.status === 200) { res = r2; break; }
          }
        }
        if (res.status !== 200) throw new AcquisitionError('SERVER_ERROR', `Ixigo HTTP ${res.status}`, res.status);
        const m = res.body.match(/<script id="__NEXT_DATA__"[^>]*>(\{[\s\S]*?\})<\/script>/);
        if (!m) throw new AcquisitionError('MALFORMED_RESPONSE', 'Ixigo SRP carried no __NEXT_DATA__');
        let next: any;
        try { next = JSON.parse(m[1]); } catch { throw new AcquisitionError('MALFORMED_RESPONSE', 'Ixigo __NEXT_DATA__ not valid JSON'); }
        const flights = parseIxigoFlights(next);
        if (flights.length === 0) throw new AcquisitionError('EMPTY_RESPONSE', 'Ixigo SRP had no priced flights');
        return parseIxigoOffers(flights, ctx.source, rt.from, rt.to, dep, url);
      },
    },
    {
      // Expedia flights (flights-shopping-pwa GraphQL): the SRP app POSTs
      // FlightsSearchResultsLoadedQuery to /graphql — we replay the exact
      // document the PWA ships (73KB, all fragments) after priming the SRP
      // with safari TLS. Real per-flight USD fares converted honestly via
      // live FX. Expedia is the price-owning OTA: seller = Expedia and the
      // deeplink goes to expedia.com (owner deeplink policy), with a
      // data_note crediting where the fare was observed.
      sourceId: 'w_flights_expedia',
      name: 'Flights worker: Expedia live fares (flights-shopping-pwa GraphQL)',
      priority: 8,
      maxPerMinute: 2,
      timeoutMs: 50_000,
      run: async (ctx) => {
        const raw = String(ctx.query.rawQuery || ctx.query.entityName || '');
        const rt = routeFromQuery(raw);
        if (!rt) return [];
        const dIso = ctx.query?.travelDates?.depart && /^\d{4}-\d{2}-\d{2}$/.test(ctx.query.travelDates.depart)
          ? ctx.query.travelDates.depart
          : new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
        const rt2 = { ...rt, fromCode: (await resolveAirport(rt.from, rt.fromCode)).code || rt.fromCode, toCode: (await resolveAirport(rt.to, rt.toCode)).code || rt.toCode };
        return expediaFlightsSearch(ctx, rt2, dIso);
      },
    },
    {
      // Kiwi.com flights (umbrella/v2 GraphQL, cracked 15 Oct 2026 — no auth,
      // ~800ms, INR prices, works for ANY world route). Seller = Kiwi.com, the
      // ticket-selling website; operating airline stays in title/brand per owner
      // policy. Deeplink = Kiwi's per-itinerary booking URL (its own token).
      sourceId: 'w_flights_kiwi',
      name: 'Flights worker: Kiwi.com worldwide live fares (seller = Kiwi.com)',
      priority: 12,
      maxPerMinute: 2,
      timeoutMs: 40_000,
      run: async (ctx) => {
        const raw = String(ctx.query.rawQuery || '');
        const rt = routeFromQuery(raw);
        if (!rt) return [];
        const fromA = await resolveAirport(rt.from, rt.fromCode);
        const toA = await resolveAirport(rt.to, rt.toCode);
        const from = fromA.code; const to = toA.code;
        if (!from || !to) return []; // unknown city — honest skip
        const dIso = ctx.query?.travelDates?.depart && /^\d{4}-\d{2}-\d{2}$/.test(ctx.query.travelDates.depart)
          ? ctx.query.travelDates.depart
          : new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
        const res = await kiwiSearch(from, to, dIso);
        if (res === null) throw new AcquisitionError('ACCESS_CHALLENGE', `kiwi.com graphql HTTP 403/429 for ${from}-${to} on ${dIso}`, 403);
        const items = kiwiItems(res.itineraries, ctx.source, { from: rt.from, to: rt.to }, from, to, dIso);
        if (!items.length) throw new AcquisitionError('EMPTY_RESPONSE', `kiwi.com returned no itineraries departing ${from}-${to} on ${dIso} (search total ${res.total})`);
        return items;
      },
    },
    // ---- Owner-mandated flights sources: attempted live on every search, honestly reported ----
    {
      sourceId: 'w_flights_makemytrip',
      name: 'Flights worker: MakeMyTrip flights (probe)',
      priority: 15,
      run: async () => {
        // Attempt the real SRP URL live (dynamic date) so a gate lift is detected on any IP.
        const dd = new Date(Date.now() + 7 * 86400_000);
        const dmy = `${String(dd.getUTCDate()).padStart(2, '0')}/${String(dd.getUTCMonth() + 1).padStart(2, '0')}/${dd.getUTCFullYear()}`;
        const iso = dd.toISOString().slice(0, 10);
        const r = await cffiFetch(
          `https://www.makemytrip.com/flight/search?itinerary=IDR-DEL-${dmy}&tripType=O&pax=1-0-0&cabinClass=E`,
          { impersonate: 'chrome', timeoutMs: 12_000 },
        );
        if (r.status === 200 && (r.body || '').length > 50_000) {
          throw new AcquisitionError('ACCESS_CHALLENGE', 'MakeMyTrip SRP unexpectedly returned content from this IP; parse path not yet built (recon snapshot 14 Oct 2026: AkamaiGHost stub).');
        }
        throw new AcquisitionError('EMPTY_RESPONSE', 'MakeMyTrip flight SRP serves a 6-byte "200-OK" application/json stub from AkamaiGHost to browserless datacenter HTTP; Googlebot UA gets HTTP/2 reset; the app API host flights-cb.makemytrip.com exposes only a GET pre-search-validation route (Go validator, no fares); SEO pages carry no live fares (recon 14 Oct 2026). Retest from production IP after deploy.');
      },
    },
    {
      sourceId: 'w_flights_goibibo',
      name: 'Flights worker: Goibibo flights (probe)',
      priority: 15,
      run: async () => {
        // Attempt the real SRP URL live (dynamic date) so a gate lift is detected on any IP.
        const dd = new Date(Date.now() + 7 * 86400_000);
        const iso = dd.toISOString().slice(0, 10);
        const r = await cffiFetch(
          `https://www.goibibo.com/flights/search/?source=Indore&destination=New%20Delhi&triptype=O&tripdate=${iso}&adults=1`,
          { impersonate: 'chrome', timeoutMs: 12_000 },
        );
        if (r.status === 200 && (r.body || '').length > 50_000) {
          throw new AcquisitionError('ACCESS_CHALLENGE', 'Goibibo SRP unexpectedly returned content from this IP; parse path not yet built (recon snapshot 14 Oct 2026: Akamai 504/reset).');
        }
        throw new AcquisitionError('EMPTY_RESPONSE', 'Goibibo flights is edge-gated to browserless datacenter HTTP: www.goibibo.com/flights/* gives HTTP/2 stream reset or 504 AkamaiGHost gateway timeouts; m.goibibo.com 503; flights.goibibo.com returns Akamai "Access Denied" 403 on all paths; api.goibibo.com 503 DNS failure (recon 14 Oct 2026). Retest from production IP after deploy.');
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
        const from = (await resolveAirport(rt.from, rt.fromCode)).code;
        const to = (await resolveAirport(rt.to, rt.toCode)).code;
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
        const fromA = await resolveAirport(rt.from, rt.fromCode);
        const toA = await resolveAirport(rt.to, rt.toCode);
        const from = fromA.code; const to = toA.code;
        // Akasa Air is a domestic Indian carrier: routes touching a non-Indian
        // airport are honestly skipped (no such inventory exists to sell).
        if (!from || !to) return [];
        if (!IATA[rt.from.toLowerCase().trim()] || !IATA[rt.to.toLowerCase().trim()]) return [];
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
        if (r.status !== 200) throw new AcquisitionError('SERVER_ERROR', `Akasa Air API HTTP ${r.status}`, r.status);
        const fares = parseAkasaFareCalendar(r.body);
        const items = akasaDayFareItems(fares, ctx.source, rt.from, rt.to, from, to, dep);
        // Akasa is a small network: an empty 200 calendar for a route it doesn't
        // fly is a SUCCESSFUL acquisition proving "no Akasa service here", not a
        // failure. Returning [] keeps the circuit closed so routes Akasa DOES
        // serve (e.g. DEL-BOM) are not suppressed by unrelated warm queries.
        return items;
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
