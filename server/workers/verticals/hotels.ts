/**
 * Hotels worker (WORLDWIDE). A hotels search runs ONLY this worker.
 * Real property discovery from OpenStreetMap: Photon geocode → Overpass hotels.
 * Room rates are not present in OSM and are never invented; the property listing
 * is served with price honestly unknown.
 */
import { registerVerticalWorker, looksLikeChallenge, type VerticalWorker } from '../verticalWorker';
import { photonGeocode, parseOverpassHotels, overpassHotelQuery } from '../parsers/osmTravel';
import { parseBookingHotels } from '../parsers/booking';
import { parseExpediaGroup, EXPEDIA_GRAPHQL_QUERY } from '../parsers/expediaGroup';
import { usdToInrRate } from '../../common/fxRates';
import { wikidataHotelQuery, parseWikidataHotels, WIKIDATA_ENDPOINT } from '../parsers/wikidataHotels';
import { parseCleartripHotels, parseCleartripOffers } from '../parsers/cleartripHotels';
import { extractAirbnbSearchResults, parseAirbnbStays, parseAirbnbOffers } from '../parsers/airbnbHotels';
import { parseIxigoHotels, ixigoHotelsSlug } from '../parsers/ixigoHotels';
import { cffiFetch } from '../../common/curlCffiFetch';
import { AcquisitionError } from '../../common/httpClient';
import { cityVariants, slugOf } from '../../common/cityAlias';

import {
  oyoCityPaths, parseOyoPreloadedState, parseOyoHotels, parseOyoOffers,
} from '../parsers/oyoHotels';
import { parseYatraHotels, parseYatraOffers, yatraPageSearchUrl, yatraSrpUrl, YATRA_HOTELS_API_KEY } from '../parsers/yatraHotels';
import { emtCityPaths, parseEmtLdJson, parseEmtHotelLinks, parseEmtHotels, parseEmtOffers, ddmmyyyyDash } from '../parsers/emtHotels';
import {
  agodaCitySlugs, extractAgodaCityId, extractAgodaPageConfig, agodaGateHeaders,
  AGODA_CITY_SEARCH_QUERY, buildAgodaCitySearchVars, extractAgodaProperties,
  parseAgodaHotels, parseAgodaOffers,
} from '../parsers/agodaHotels';

const OYO_WEB_URL = 'https://www.oyorooms.com';
const ddmmyyyy = (iso: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };

/** city (lowercase) → Agoda CityId, learned from SEO city pages (stable ids). */
const agodaCityIdCache = new Map<string, number>();

function cityFromQuery(ctx: { query: any }): string | null {
  const q = ctx.query;
  const raw = String(q.rawQuery || '').trim();
  // The destination the USER TYPED always wins over their device/profile city
  // (searching "Goa" from Delhi must never return Delhi hotels).
  const strip = (x: string) => x.replace(/\b(hotels?|rooms?|stay|stays|resorts?|in|near|at|for|book|booking|cheap|best|budget|luxury|check-?in:?|tonight|night|nights|today|tomorrow|weekend|this|next|under|price)\b/gi, ' ')
    .replace(/,.*$/, '').replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  const cleaned = strip(raw);
  if (cleaned.length >= 3 && cleaned.length <= 40) return cleaned;
  if (q.location?.city) return String(q.location.city);
  return null;
}

function stayDates(q: any): { checkin: string; checkout: string } {
  const dep = q?.travelDates?.depart;
  const ret = q?.travelDates?.return;
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const base = dep && /\d{4}-\d{2}-\d{2}/.test(dep) ? new Date(dep) : new Date(Date.now() + 7 * 86400_000);
  const end = ret && /\d{4}-\d{2}-\d{2}/.test(ret) ? new Date(ret) : new Date(base.getTime() + 86400_000);
  return { checkin: fmt(base), checkout: fmt(end) };
}

/** Expedia Group shared acquisition: SRP prime (Akamai cookies + DUAID) then LodgingCard GraphQL. */
async function expediaGroupSearch(ctx: any, site: 'expedia.com' | 'hotels.com', impersonate: string, city: string, checkin: string, checkout: string): Promise<any[]> {
  const origin = `https://www.${site}`;
  const srpUrl = `${origin}/Hotel-Search?destination=${encodeURIComponent(`${city}, India`)}&d1=${checkin}&d2=${checkout}&rooms=1`;
  let cookies: Record<string, string> | undefined;
  const primed = await cffiFetch(srpUrl, { impersonate, timeoutMs: 30_000, returnCookies: true, cookies, headers: { Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9' } });
  cookies = primed.cookies || cookies;
  if (primed.status === 429 || (primed.status === 200 && /Bot or Not\?/.test(primed.body.slice(0, 4000)))) {
    throw new AcquisitionError('ACCESS_CHALLENGE', `${site} SRP edge returned a bot challenge (HTTP ${primed.status})`, primed.status);
  }
  if (primed.status !== 200) throw new AcquisitionError('SERVER_ERROR', `${site} SRP HTTP ${primed.status}`, primed.status);
  const duaid = (primed.body.match(/"duaid":"([0-9a-f-]{36})"/) || [])[1] || cookies?.DUAID || '';
  const y1 = +checkin.slice(0, 4), m1 = +checkin.slice(5, 7), d1 = +checkin.slice(8, 10);
  const y2 = +checkout.slice(0, 4), m2 = +checkout.slice(5, 7), d2 = +checkout.slice(8, 10);
  const siteId = site === 'hotels.com' ? 19 : 1;
  const payload = JSON.stringify({
    operationName: 'LodgingPropertySearch',
    query: EXPEDIA_GRAPHQL_QUERY,
    variables: {
      context: { currency: 'USD', device: { type: 'DESKTOP' }, eapid: 0, identity: { authState: 'ANONYMOUS', duaid }, locale: 'en_US', privacyTrackingState: 'CAN_TRACK', siteId, tpid: siteId },
      criteria: { primary: {
        dateRange: { checkInDate: { year: y1, month: m1, day: d1 }, checkOutDate: { year: y2, month: m2, day: d2 } },
        destination: { regionName: `${city}, India` },
        rooms: [{ adults: 2 }],
      } },
    },
  });
  const r = await cffiFetch(`${origin}/graphql`, {
    method: 'POST', impersonate, timeoutMs: 45_000, cookies, body: payload,
    headers: {
      'Content-Type': 'application/json', Accept: '*/*', Origin: origin, Referer: srpUrl,
      'client-info': `shopping-pwa,eb187b18bd35573abd2de93e9fd6a422a6206cfe,${site === 'hotels.com' ? 'us-west-2' : 'us-east-1'}`,
      'x-page-id': 'page.Hotel-Search,H,20',
    },
  });
  if (r.status === 429) throw new AcquisitionError('ACCESS_CHALLENGE', `${site} GraphQL edge returned a bot challenge (HTTP 429)`, 429);
  if (r.status !== 200) throw new AcquisitionError('SERVER_ERROR', `${site} GraphQL HTTP ${r.status}: ${r.body.slice(0, 160)}`, r.status);
  const fx = await usdToInrRate(); // live USD->INR; null => keep USD as listed (never a guessed rate)
  const items = parseExpediaGroup(r.body, ctx.source, site, checkin, checkout, fx);
  if (!items.length) throw new AcquisitionError('EMPTY_RESPONSE', `${site} GraphQL returned no priced LodgingCards for "${city}"`);
  return items;
}

export const hotelsWorker: VerticalWorker = {
  vertical: 'hotels',
  tasks: [
    {
      // MakeMyTrip hotels — owner-mandated mandatory source. Akamai Bot Manager gates
      // the hotel listing behind a valid _abck sensor cookie at the edge today; the
      // attempt stays honest: on block we report ACCESS_CHALLENGE (visible as
      // unavailable) and never fabricate prices.
      sourceId: 'w_hotels_mmt',
      priority: 15,
      run: async (ctx) => {
        const city = cityFromQuery(ctx);
        if (!city || city.length < 3) return [];
        const slug = city.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-');
        const r = await cffiFetch(`https://www.makemytrip.com/hotels/hotels-in-${slug}/`, { impersonate: 'chrome', timeoutMs: 25_000 });
        if (r.status === 302 || r.status === 301) throw new AcquisitionError('ACCESS_CHALLENGE', 'MakeMyTrip redirected to Akamai geo-challenge (makemytrip.global) from this IP');
        if (r.status !== 200) throw new AcquisitionError('ACCESS_CHALLENGE', `MakeMyTrip HTTP ${r.status}`);
        if (r.body.length < 500) throw new AcquisitionError('ACCESS_CHALLENGE', 'MakeMyTrip returned an empty Akamai edge body (no sensor cookie)');
        throw new AcquisitionError('EMPTY_RESPONSE', 'MakeMyTrip hotel page reached but carried no parseable SSR data');
      },
    },
    {
      // Goibibo hotels — owner-mandated mandatory source. Same Akamai edge gate today.
      sourceId: 'w_hotels_goibibo',
      priority: 15,
      run: async (ctx) => {
        const city = cityFromQuery(ctx);
        if (!city || city.length < 3) return [];
        const slug = city.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-');
        const r = await cffiFetch(`https://www.goibibo.com/hotels/hotels-in-${slug}/`, { impersonate: 'chrome', timeoutMs: 25_000 });
        if (r.status !== 200) throw new AcquisitionError('ACCESS_CHALLENGE', `Goibibo HTTP ${r.status}`);
        if (r.body.length < 500) throw new AcquisitionError('ACCESS_CHALLENGE', 'Goibibo returned an empty Akamai edge body (no sensor cookie)');
        throw new AcquisitionError('EMPTY_RESPONSE', 'Goibibo hotel page reached but carried no parseable SSR data');
      },
    },
    {
      // Ixigo hotels (metasearch acquisition): SEO listing page carries __NEXT_DATA__
      // with hotel names + per-night base fares. Seller = the hotel property, never Ixigo.
      sourceId: 'w_hotels_ixigo',
      priority: 14,
      run: async (ctx) => {
        const city = cityFromQuery(ctx);
        if (!city || city.length < 3) return [];
        let items: any[] = [];
        let url = '';
        let lastStatus = 0;
        for (const variant of cityVariants(city)) {
          url = `https://www.ixigo.com/hotels/${ixigoHotelsSlug(variant)}`;
          const r = await cffiFetch(url, { impersonate: 'chrome', timeoutMs: 30_000 });
          lastStatus = r.status;
          if (r.status === 404) continue; // this spelling has no page: try the next alias
          if (r.status !== 200) throw new AcquisitionError(r.status === 403 || r.status === 429 ? 'ACCESS_CHALLENGE' : 'FORBIDDEN', `Ixigo hotels HTTP ${r.status}`, r.status);
          items = parseIxigoHotels(r.body, ctx.source, url, city);
          if (items.length) break;
        }
        if (!items.length && lastStatus === 404) throw new AcquisitionError('NOT_FOUND', `Ixigo has no hotels page for "${city}"`, 404);
        if (!items.length) throw new AcquisitionError('EMPTY_RESPONSE', `No Ixigo hotels parsed for "${city}" (slug may not exist for this city)`);
        return items;
      },
    },
    {
      // Real nightly rates from Cleartrip's Next.js SEO SRP: __NEXT_DATA__
      // ships full hotel cards (price, slashed price, rating, locality,
      // Flipkart-CDN images, hotel-details deeplinks). No API keys, no browser.
      sourceId: 'w_hotels_cleartrip',
      name: 'Hotels worker: Cleartrip SEO SRP (live nightly rates via __NEXT_DATA__)',
      priority: 1,
      maxPerMinute: 6,
      timeoutMs: 30_000,
      run: async (ctx) => {
        const city = cityFromQuery(ctx);
        if (!city) return [];
        // curl_cffi (chrome impersonation) — Cleartrip serves plain node-fetch a bot page without __NEXT_DATA__.
        // Cleartrip only knows legacy spellings (bangalore, "new delhi"), so walk the alias variants and
        // retry once per variant: it intermittently returns a shell without __NEXT_DATA__.
        let next: any;
        let lastErr: AcquisitionError | undefined;
        for (const variant of cityVariants(city)) {
          for (let attempt = 0; attempt < 2 && !next; attempt++) {
            const res = await cffiFetch(`https://www.cleartrip.com/hotels/india/${slugOf(variant)}`, { impersonate: 'chrome', timeoutMs: 25_000 });
            if (res.status === 403 || res.status === 429) {
              throw new AcquisitionError(res.status === 403 ? 'ACCESS_CHALLENGE' : 'RATE_LIMITED', `Cleartrip blocked: ${res.status}`, res.status);
            }
            if (res.status === 404) { lastErr = new AcquisitionError('NOT_FOUND', `Cleartrip has no SEO page for '${variant}'`, res.status); break; }
            if (res.status !== 200) { lastErr = new AcquisitionError('SERVER_ERROR', `Cleartrip SRP HTTP ${res.status}`, res.status); break; }
            const m = res.body.match(/<script id="__NEXT_DATA__"[^>]*>(\{[\s\S]*?\})<\/script>/);
            if (!m) { lastErr = new AcquisitionError('MALFORMED_RESPONSE', 'Cleartrip SRP carried no __NEXT_DATA__'); continue; }
            try {
              const parsed = JSON.parse(m[1]);
              if (parseCleartripHotels(parsed).length > 0) next = parsed;
              else lastErr = new AcquisitionError('EMPTY_RESPONSE', 'Cleartrip SRP had no priced hotel cards');
            } catch { lastErr = new AcquisitionError('MALFORMED_RESPONSE', 'Cleartrip __NEXT_DATA__ not valid JSON'); }
            break;
          }
          if (next) break;
        }
        if (!next) throw lastErr || new AcquisitionError('EMPTY_RESPONSE', 'Cleartrip returned nothing for this destination');
        const hotels = parseCleartripHotels(next);
        if (hotels.length === 0) throw new AcquisitionError('EMPTY_RESPONSE', 'Cleartrip SRP had no priced hotel cards');
        return parseCleartripOffers(hotels, ctx.source);
      },
    },
    {
      // Airbnb SSRs the full search page: <script data-deferred-state-0>
      // carries StaysSearch results (property name, stay total + nights
      // qualifier -> per-night rate, rating, photos, listing deeplink).
      // Airbnb totals are divided by the parsed night count - never fabricated.
      sourceId: 'w_hotels_airbnb',
      name: 'Hotels worker: Airbnb SSR stays (live per-night rates)',
      priority: 2,
      maxPerMinute: 6,
      timeoutMs: 30_000,
      run: async (ctx) => {
        const city = cityFromQuery(ctx);
        if (!city) return [];
        const { checkin, checkout } = stayDates(ctx.query);
        const url = `https://www.airbnb.co.in/s/${encodeURIComponent(city)}/homes?checkin=${checkin}&checkout=${checkout}&adults=2`;
        const res = await cffiFetch(url, { impersonate: 'chrome', timeoutMs: 25_000 });
        if (res.status === 403 || res.status === 429) {
          throw new AcquisitionError(res.status === 403 ? 'ACCESS_CHALLENGE' : 'RATE_LIMITED', `Airbnb blocked: ${res.status}`, res.status);
        }
        if (res.status !== 200) throw new AcquisitionError('SERVER_ERROR', `Airbnb HTTP ${res.status}`, res.status);
        const m = res.body.match(/<script[^>]+data-deferred-state-0[^>]*>([\s\S]*?)<\/script>/);
        if (!m) throw new AcquisitionError('MALFORMED_RESPONSE', 'Airbnb SRP carried no deferred state');
        let deferred: any;
        try { deferred = JSON.parse(m[1]); } catch { throw new AcquisitionError('MALFORMED_RESPONSE', 'Airbnb deferred state not valid JSON'); }
        const results = extractAirbnbSearchResults(deferred);
        if (results.length === 0) throw new AcquisitionError('EMPTY_RESPONSE', 'Airbnb deferred state had no stays');
        const stays = parseAirbnbStays(results);
        if (stays.length === 0) throw new AcquisitionError('EMPTY_RESPONSE', 'Airbnb results had no parseable stays');
        return parseAirbnbOffers(stays, ctx.source, city);
      },
    },
    {
      sourceId: 'w_hotels_booking',
      name: 'Hotels worker: Booking.com live rates (worldwide)',
      priority: 10,
      run: async (ctx) => {
        const city = cityFromQuery(ctx);
        if (!city) return [];
        const { checkin, checkout } = stayDates(ctx.query);
        const url = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(city)}&checkin=${checkin}&checkout=${checkout}&group_adults=2&no_rooms=1`;
        const UA = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };
        // Booking.com's AWS-WAF edge answers repeated cookie-less hits with a 202
        // interstitial (rate sampling) but serves a normal session the first time. Run the
        // acquisition as ONE cffi cookie session with spaced retries (cookies carried over),
        // then an honest ACCESS_CHALLENGE if the edge still refuses.
        let cookies: any = undefined;
        for (let attempt = 1; attempt <= 3; attempt++) {
          const r: any = await cffiFetch(url, { timeoutMs: 20_000, cookies, returnCookies: true, headers: { 'Accept-Language': 'en-IN,en;q=0.9' } });
          cookies = r.cookies || cookies;
          if (r.status !== 200 && r.status !== 202) throw new AcquisitionError('FORBIDDEN', `Booking.com HTTP ${r.status}`, r.status);
          const items = parseBookingHotels(r.body, ctx.source, url, checkin, checkout);
          if (items.length) return items;
          if (looksLikeChallenge(r.body) && attempt < 3) { await new Promise((res) => setTimeout(res, 2500 * attempt)); continue; }
          throw new AcquisitionError('ACCESS_CHALLENGE', 'Booking.com presented a challenge page (no parseable property cards)');
        }
        throw new AcquisitionError('EMPTY_RESPONSE', 'Booking.com returned no property cards');
      },
    },
    {
      // Expedia Group "shopping-pwa" (Expedia.com + Hotels.com share one LodgingCard
      // GraphQL). Akamai accepts safari-TLS from datacenter IPs (chrome JA3 = 429
      // "Bot or Not?"). Recipe reverse-engineered 14 Oct 2026, sandbox-verified 50
      // priced cards per query; details in parsers/expediaGroup.ts.
      sourceId: 'w_hotels_expedia',
      name: 'Hotels worker: Expedia.com live rates (LodgingCard GraphQL)',
      priority: 11,
      maxPerMinute: 2,
      timeoutMs: 60_000,
      run: async (ctx) => {
        const city = cityFromQuery(ctx);
        if (!city) return [];
        const { checkin, checkout } = stayDates(ctx.query);
        return expediaGroupSearch(ctx, 'expedia.com', 'safari', city, checkin, checkout);
      },
    },
    {
      sourceId: 'w_hotels_hotelscom',
      name: 'Hotels worker: Hotels.com live rates (LodgingCard GraphQL)',
      priority: 11,
      maxPerMinute: 2,
      timeoutMs: 60_000,
      run: async (ctx) => {
        const city = cityFromQuery(ctx);
        if (!city) return [];
        const { checkin, checkout } = stayDates(ctx.query);
        let items: Awaited<ReturnType<typeof expediaGroupSearch>>;
        try {
          items = await expediaGroupSearch(ctx, 'hotels.com', 'safari17_0', city, checkin, checkout);
        } catch (e: any) {
          // Akamai rate-samples the SRP edge; the mobile-Android JA3 is a second key.
          if (String(e?.failureClass) !== 'ACCESS_CHALLENGE' && String(e?.failureClass) !== 'RATE_LIMITED') throw e;
          items = await expediaGroupSearch(ctx, 'hotels.com', 'chrome_android', city, checkin, checkout);
        }
        return items;
      },
    },
    {
      sourceId: 'w_hotels_osm',
      name: 'Hotels worker: OpenStreetMap hotel discovery (worldwide)',
      priority: 20,
      maxPerMinute: 6,
      timeoutMs: 45_000, // 3 mirrors x 12s must fit inside the task budget
      run: async (ctx) => {
        const city = cityFromQuery(ctx);
        if (!city) return [];
        const geo = await photonGeocode(city);
        if (!geo) return [];
        const d = 0.06; // ~6 km radius around the geocoded point
        const bbox = `${(geo.lat - d).toFixed(4)},${(geo.lon - d).toFixed(4)},${(geo.lat + d).toFixed(4)},${(geo.lon + d).toFixed(4)}`;
        const q = overpassHotelQuery(bbox);
        const mirrors = [
          'https://overpass.osm.ch/api/interpreter',
          'https://overpass-api.de/api/interpreter',
          'https://overpass.kumi.systems/api/interpreter',
        ];
        let json: any | null = null; let lastErr: any = null; let usedUrl = '';
        for (const mirror of mirrors) {
          try {
            const r = await ctx.fetch(mirror, {
              method: 'POST',
              body: `data=${encodeURIComponent(q)}`,
              headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
              expectJson: true,
              timeoutMs: 12_000,
            });
            if (r.status === 429 || r.status >= 500) { lastErr = new AcquisitionError('RATE_LIMITED', `Overpass mirror HTTP ${r.status}`); continue; }
            if (r.status !== 200) throw new AcquisitionError('SERVER_ERROR', `Overpass HTTP ${r.status}`, r.status);
            json = JSON.parse(r.body); usedUrl = mirror; break;
          } catch (e: any) { lastErr = e; }
        }
        if (!json) throw lastErr || new AcquisitionError('SERVER_ERROR', 'All Overpass mirrors failed');
        return parseOverpassHotels(json, ctx.source, city, bbox, usedUrl);
      },
    },
    {
      sourceId: 'w_hotels_wikidata',
      name: 'Hotels worker: Wikidata hotel discovery (worldwide)',
      priority: 30,
      maxPerMinute: 10,
      timeoutMs: 30_000,
      run: async (ctx) => {
        const city = cityFromQuery(ctx);
        if (!city) return [];
        const url = `${WIKIDATA_ENDPOINT}?format=json&query=${encodeURIComponent(wikidataHotelQuery(city))}`;
        const r = await ctx.fetch(url, {
          headers: { Accept: 'application/sparql-results+json', 'User-Agent': 'Try1Second/1.0 (contact@try1second.com)' },
          expectJson: true, timeoutMs: 25_000,
        });
        if (r.status === 429 || r.status >= 500) throw new AcquisitionError('RATE_LIMITED', `Wikidata HTTP ${r.status}`, r.status);
        if (r.status !== 200) throw new AcquisitionError('SERVER_ERROR', `Wikidata HTTP ${r.status}`, r.status);
        return parseWikidataHotels(JSON.parse(r.body), ctx.source, city, WIKIDATA_ENDPOINT);
      },
    },
    // ---- Owner-mandated hotel sources: attempted live on every search, honestly reported ----
    {
      // Agoda LIVE (13 Oct 2026): the SSR shell resolves cityId via SEO city pages,
      // then the token-gated GraphQL /graphql/search endpoint (gate: x-gate-meta
      // base64 epoch + AG-* headers from pageConfig) returns 30 hotels with real
      // INR per-night rates. Verified Goa + Bali. Details: parsers/agodaHotels.ts.
      sourceId: 'w_hotels_agoda',
      name: 'Hotels worker: Agoda GraphQL live rates',
      priority: 6,
      maxPerMinute: 4,
      timeoutMs: 90_000,
      run: async (ctx) => {
        const city = cityFromQuery(ctx);
        if (!city) return [];
        const { checkin, checkout } = stayDates(ctx.query);

        // 1. cityId from an SEO city page (module-level cache, ids are stable).
        let cityId = agodaCityIdCache.get(city.toLowerCase());
        if (!cityId) {
          for (const slug of agodaCitySlugs(city)) {
            const r = await cffiFetch(`https://www.agoda.com/city/${slug}.html`, {
              impersonate: 'chrome', timeoutMs: 20_000,
              headers: { Accept: 'text/html', 'Accept-Language': 'en-US,en;q=0.9' },
            });
            if (r.status !== 200) continue; // unknown slug → try next spelling
            const id = extractAgodaCityId(r.body);
            if (id) { cityId = id; agodaCityIdCache.set(city.toLowerCase(), id); break; }
          }
        }
        if (!cityId) throw new AcquisitionError('EMPTY_RESPONSE', `Agoda has no city page for "${city}"`);

        // 2. SRP shell → pageConfig correlation/analytics ids (also primes cookies).
        const los0 = Math.max(1, Math.round((Date.parse(`${checkout}T00:00:00Z`) - Date.parse(`${checkin}T00:00:00Z`)) / 86_400_000));
        const shell = await cffiFetch(`https://www.agoda.com/search?city=${cityId}&checkIn=${checkin}&los=${los0}`, {
          impersonate: 'chrome', timeoutMs: 25_000,
          headers: { Accept: 'text/html', 'Accept-Language': 'en-US,en;q=0.9' },
        });
        if (shell.status === 403 || shell.status === 429) {
          throw new AcquisitionError(shell.status === 403 ? 'ACCESS_CHALLENGE' : 'RATE_LIMITED', `Agoda blocked: ${shell.status}`, shell.status);
        }
        if (shell.status !== 200) throw new AcquisitionError('SERVER_ERROR', `Agoda HTTP ${shell.status}`, shell.status);
        const cfg = extractAgodaPageConfig(shell.body);
        if (!cfg) throw new AcquisitionError('MALFORMED_RESPONSE', 'Agoda SRP carried no pageConfig');

        // 3. gated GraphQL citySearch — up to 3 pages (~90 properties) so big cities overlap
        //    with the other hotel sites (same property on 2+ sites = one card, many prices).
        const gqlHeaders = () => ({
          ...agodaGateHeaders(cfg, Date.now()),
          Referer: `https://www.agoda.com/search?city=${cityId}&checkIn=${checkin}&los=${los0}`,
          'AG-REQUEST-ID': crypto.randomUUID(),
        });
        const hotels: ReturnType<typeof parseAgodaHotels> = [];
        const seenIds = new Set<string>();
        for (let page = 1; page <= 3; page++) {
          const gqlRes = await cffiFetch('https://www.agoda.com/graphql/search', {
            method: 'POST',
            impersonate: 'chrome',
            timeoutMs: 60_000,
            headers: gqlHeaders(),
            body: JSON.stringify({
              query: AGODA_CITY_SEARCH_QUERY,
              variables: buildAgodaCitySearchVars(cityId, checkin, checkout, page),
              operationName: 'citySearch',
            }),
          });
          if (gqlRes.status === 403 || gqlRes.status === 429) {
            if (page > 1) break; // keep what page 1 gave us
            throw new AcquisitionError(gqlRes.status === 403 ? 'ACCESS_CHALLENGE' : 'RATE_LIMITED', `Agoda gate rejected: ${gqlRes.status}`, gqlRes.status);
          }
          if (gqlRes.status !== 200) { if (page > 1) break; throw new AcquisitionError('SERVER_ERROR', `Agoda GraphQL HTTP ${gqlRes.status}`, gqlRes.status); }
          let gql: any;
          try { gql = JSON.parse(gqlRes.body); } catch { if (page > 1) break; throw new AcquisitionError('MALFORMED_RESPONSE', 'Agoda GraphQL response not valid JSON'); }
          if (gql?.errors?.length && !gql?.data?.citySearch?.properties?.length) {
            if (page > 1) break;
            throw new AcquisitionError('MALFORMED_RESPONSE', `Agoda GraphQL errors: ${String(gql.errors[0]?.message || '').slice(0, 160)}`);
          }
          const pageHotels = parseAgodaHotels(extractAgodaProperties(gql));
          let fresh = 0;
          for (const h of pageHotels) {
            const k = String((h as any).propertyId ?? (h as any).id ?? h.name);
            if (!seenIds.has(k)) { seenIds.add(k); hotels.push(h); fresh++; }
          }
          if (fresh === 0) break;
        }
        const priced = hotels.filter((h) => h.pricePerNight);
        if (priced.length === 0) throw new AcquisitionError('EMPTY_RESPONSE', 'Agoda GraphQL returned no priced hotels');
        return parseAgodaOffers(hotels, ctx.source, city, { cityId, checkin, los: los0 });
      },
    },
    {
      // OYO hotels — owner-mandated source (17 Oct). City SEO listing pages are full
      // SSR: window.__PRELOADED_STATE__ carries 20 real per-night prices + images.
      sourceId: 'w_hotels_oyo',
      name: 'Hotels worker: OYO live per-night rates',
      priority: 8,
      maxPerMinute: 6,
      timeoutMs: 45_000,
      run: async (ctx) => {
        const city = cityFromQuery(ctx);
        if (!city || city.length < 3) return [];
        const { checkin, checkout } = stayDates(ctx.query);
        let lastStatus = 0; let lastBody = '';
        for (const path of oyoCityPaths(city)) {
          const r = await cffiFetch(`${OYO_WEB_URL}/${path}/?checkin=${ddmmyyyy(checkin)}&checkout=${ddmmyyyy(checkout)}&guests=2&rooms=1`, {
            impersonate: 'chrome', timeoutMs: 30_000,
            headers: { Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9' },
          });
          lastStatus = r.status; lastBody = r.body.slice(0, 400);
          if (r.status !== 200) continue; // unknown spelling -> try next variant
          const state = parseOyoPreloadedState(r.body);
          const hotels = parseOyoHotels(state || {});
          if (hotels.length) return parseOyoOffers(hotels, ctx.source, city, { checkin, checkout, path });
        }
        if (lastStatus === 404) throw new AcquisitionError('EMPTY_RESPONSE', `OYO has no city page for "${city}"`);
        if (lastStatus !== 0) throw new AcquisitionError('SERVER_ERROR', `OYO city page HTTP ${lastStatus}: ${lastBody}`, lastStatus);
        throw new AcquisitionError('EMPTY_RESPONSE', `OYO listing for "${city}" carried no parseable PRELOADED_STATE`);
      },
    },
    {
      // EaseMyTrip hotels — owner-mandated source (17 Oct). City SEO pages are full
      // SSR with a JSON-LD ItemList of ~20 hotels incl. real per-night prices.
      sourceId: 'w_hotels_emt',
      name: 'Hotels worker: EaseMyTrip live per-night rates',
      priority: 9,
      maxPerMinute: 6,
      timeoutMs: 45_000,
      run: async (ctx) => {
        const city = cityFromQuery(ctx);
        if (!city || city.length < 3) return [];
        const { checkin, checkout } = stayDates(ctx.query);
        let lastStatus = 0;
        for (const path of emtCityPaths(city)) {
          const r = await cffiFetch(`https://www.easemytrip.com/${path}/?checkin=${ddmmyyyyDash(checkin)}&checkout=${ddmmyyyyDash(checkout)}&c=IN&num_rooms=1&adults=2`, {
            impersonate: 'chrome', timeoutMs: 30_000,
            headers: { Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9' },
          });
          lastStatus = r.status;
          if (r.status !== 200) continue; // unknown spelling -> try next variant
          const items = parseEmtLdJson(r.body);
          if (!items.length) continue;
          const links = parseEmtHotelLinks(r.body);
          const hotels = parseEmtHotels(items, links);
          if (hotels.length) return parseEmtOffers(hotels, ctx.source, city, { checkin, checkout, path });
        }
        if (lastStatus === 404) throw new AcquisitionError('EMPTY_RESPONSE', `EaseMyTrip has no city page for "${city}"`);
        if (lastStatus !== 0) throw new AcquisitionError('SERVER_ERROR', `EaseMyTrip city page HTTP ${lastStatus}`, lastStatus);
        throw new AcquisitionError('EMPTY_RESPONSE', `EaseMyTrip listing for "${city}" carried no hotels`);
      },
    },
    {
      // Yatra hotels — owner-mandated source, LIVE 17 Oct (TravelGuru tgapi pageSearch,
      // captured via stealth CDP interception, replayed browserless with curl_cffi).
      sourceId: 'w_hotels_yatra',
      name: 'Hotels worker: Yatra live per-night rates',
      priority: 7,
      maxPerMinute: 6,
      timeoutMs: 60_000,
      run: async (ctx) => {
        const city = cityFromQuery(ctx);
        if (!city || city.length < 3) return [];
        const { checkin, checkout } = stayDates(ctx.query);
        const headers = {
          'x-api-key': YATRA_HOTELS_API_KEY, // public — Yatra's own web app sends it
          'x-customer-ip': '106.51.30.10', // any client ip string the site expects
          Accept: 'application/json',
          'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
          Origin: 'https://hotel.yatra.com',
          Referer: 'https://hotel.yatra.com/',
        };
        const hotels: ReturnType<typeof parseYatraHotels> = [];
        let total: number | null = null;
        for (let page = 1; page <= 3; page++) { // up to 30 offers per search
          const r = await cffiFetch(yatraPageSearchUrl(city, checkin, checkout, page), {
            impersonate: 'chrome', timeoutMs: 45_000, headers,
          });
          if (r.status !== 200) {
            if (page === 1) throw new AcquisitionError('SERVER_ERROR', `Yatra pageSearch HTTP ${r.status}: ${r.body.slice(0, 160)}`, r.status);
            break;
          }
          let body: any = null;
          try { body = JSON.parse(r.body); } catch { /* fallthrough */ }
          if (page === 1) total = body?.data?.content?.totalResultCount ?? null;
          const batch = body ? parseYatraHotels(body) : [];
          const fresh = batch.filter((h: any) => !hotels.some((seen: any) => seen.id === h.id));
          hotels.push(...fresh);
          if (fresh.length === 0 || body?.meta?.lastPage === true) break;
        }
        if (!hotels.length || total == null) throw new AcquisitionError('EMPTY_RESPONSE', `Yatra pageSearch returned no hotels for "${city}"`);
        return parseYatraOffers(hotels, ctx.source, city, { checkin, checkout });
      },
    },
  ],
};

registerVerticalWorker(hotelsWorker);