/**
 * Hotels worker (WORLDWIDE). A hotels search runs ONLY this worker.
 * Real property discovery from OpenStreetMap: Photon geocode → Overpass hotels.
 * Room rates are not present in OSM and are never invented; the property listing
 * is served with price honestly unknown.
 */
import { registerVerticalWorker, looksLikeChallenge, type VerticalWorker } from '../verticalWorker';
import { log } from '../../common/logger';
import { photonGeocode, parseOverpassHotels, overpassHotelQuery } from '../parsers/osmTravel';
import { parseBookingHotels } from '../parsers/booking';
import { parseExpediaGroup, EXPEDIA_GRAPHQL_QUERY } from '../parsers/expediaGroup';
import { usdToInrRate } from '../../common/fxRates';
import { wikidataHotelQuery, parseWikidataHotels, WIKIDATA_ENDPOINT } from '../parsers/wikidataHotels';
import { parseCleartripHotels, parseCleartripOffers } from '../parsers/cleartripHotels';

/** Cleartrip CDN-art dead verdict cache (owner 23 Oct): epoch-ms until which art is assumed dead. */
let cleartripArtDeadUntil = 0;
import { parseHermesHotels } from '../parsers/goibiboHermes';
import { extractAirbnbSearchResults, parseAirbnbStays, parseAirbnbOffers } from '../parsers/airbnbHotels';
import { parseIxigoHotels, ixigoHotelsSlug } from '../parsers/ixigoHotels';
import { parseGoibiboHotelsSsr } from '../parsers/goibiboHotels';
import { parseGoibiboHotelSsrState } from '../parsers/goibiboHotelSsr';
import { parseMmtHotelLanding } from '../parsers/mmtHotelLanding';
import { parseMmtHotelListing, mmtListingUrl, mmtPageMatchesStay } from '../parsers/mmtListing';
import { rescueFetch } from '../../sources/rescueFetch';
import { cffiFetch } from '../../common/curlCffiFetch';
import { newRawItem } from '../../sources/contract';
import type { RawSourceItem } from '../../types';
import { AcquisitionError } from '../../common/httpClient';
import { bookingDemandConfigured, bookingDemandSearch, bookingDemandItems } from '../parsers/bookingDemand';
import { apifyBookingRows, apifyMeetsConfigured, apifyMissingEnv, bookingActorInput, runActorSync } from '../parsers/apifySource';
import { cityVariants, slugOf, canonicalCity } from '../../common/cityAlias';

import {
  oyoCityPaths, parseOyoPreloadedState, parseOyoHotels, parseOyoOffers,
} from '../parsers/oyoHotels';
import { parseYatraHotels, parseYatraOffers, yatraPageSearchUrl, yatraSrpUrl, YATRA_HOTELS_API_KEY } from '../parsers/yatraHotels';
import { emtCityPaths, parseEmtLdJson, parseEmtHotelLinks, parseEmtHotels, parseEmtOffers, ddmmyyyyDash } from '../parsers/emtHotels';
import { saffronSearchBody, parseSaffronVillas, parseSaffronOffers, SAFFRON_API } from '../parsers/saffronStays';
import {
  agodaCitySlugs, extractAgodaCityId, extractAgodaPageConfig, agodaGateHeaders,
  AGODA_CITY_SEARCH_QUERY, buildAgodaCitySearchVars, extractAgodaProperties,
  parseAgodaHotels, parseAgodaOffers,
} from '../parsers/agodaHotels';

const OYO_WEB_URL = 'https://www.oyorooms.com';
const ddmmyyyy = (iso: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };

/** city (lowercase) → Agoda CityId, learned from SEO city pages (stable ids). */
const agodaCityIdCache = new Map<string, number>();

export function cityFromQuery(ctx: { query: any }): string | null {
  const q = ctx.query;
  const raw = String(q.rawQuery || '').trim();
  // The destination the USER TYPED always wins over their device/profile city
  // (searching "Goa" from Delhi must never return Delhi hotels).
  // Owner 29 Oct (ixigo returned NOT_FOUND for "Shimla 5 Nov 2026"): a DATE left inside the
  // city string becomes part of the slug, so every city-page source 404s and the vertical
  // loses a seller for a query shape users actually type. Strip dates, day numbers and years
  // BEFORE the keyword pass, then keep at most three words (Indian city names are short).
  const strip = (x: string) => x
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    .replace(/\b\d{1,2}[\/.-]\d{1,2}([\/.-]\d{2,4})?\b/g, ' ')
    .replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s*\d{0,4}\b/gi, ' ')
    .replace(/\b(under|below|above|upto|up to|max|min|budget)\s*\d+/gi, ' ')
    .replace(/\b\d{1,2}(st|nd|rd|th)?\b/g, ' ')
    // standalone 3+ digit numbers are prices/pincode-ish, never part of a city name
    .replace(/\b\d{3,6}\b/g, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\b(hotels?|rooms?|stay|stays|resorts?|in|near|at|for|book|booking|cheap|best|budget|luxury|check-?in:?|check-?out:?|tonight|night|nights|today|tomorrow|weekend|this|next|under|price|from|to|till|until|onwards|and|with|a|an|the|some|any|show|find|get|see|need|want|looking|search|compare)\b/gi, ' ')
    .replace(/,.*$/, '').replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim()
    .split(' ').slice(0, 3).join(' ');
  const cleaned = strip(raw);
  // OWNER 3 Nov: a reverse-geocoded locality ("Juni Indore Tahsil") is not a city, and every
  // city-slug source (OYO, Yatra, Goibibo, Cleartrip, EaseMyTrip, Agoda) 404s on it. Reduce the
  // destination to the city it contains; genuinely unknown towns keep their own name.
  if (cleaned.length >= 3 && cleaned.length <= 40) return canonicalCity(cleaned) || cleaned;
  if (q.location?.city) {
    const loc = String(q.location.city);
    return canonicalCity(loc) || loc;
  }
  return null;
}

/**
 * OWNER 10 Nov ("hotels vertical mai goibibo, makemytrip, airbnb ye sb tha abhi kuch websites hi dikh raha
 * hai"): measured with scripts/probeHotelSellers.ts, 17 hotel tasks ran for Indore 21-22 Nov - Ixigo (50 rows),
 * Airbnb (17) and Expedia (49) all returned PRICED rows but no travel date, so the strict date gate dropped every
 * one of them and only Agoda/OYO/EasyMyTrip survived. Those three sources search BY DATE (their request carries
 * checkin/checkout), so the date is known and not guessed: stamping it back is honest. Cleartrip's SEO SRP takes
 * no date at all (verified: the body is byte-identical with and without ?checkin=), so it is deliberately NOT
 * stamped - its rate is a city listing, not a fare for the requested stay.
 */
export function stampStayDates(items: any[], checkin: string, checkout: string): any[] {
  return items.map((it) => ({
    ...it,
    travel: { ...(it.travel || {}), date: checkin, checkIn: checkin, checkOut: checkout },
    attributes: { ...(it.attributes || {}), check_in: checkin, check_out: checkout },
  }));
}

/** Internal deadline so a slow source reports a failure instead of eating the whole hotel sweep. */
async function withBudget<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: any;
  const guard = new Promise<never>((_, rej) => {
    timer = setTimeout(() => rej(new AcquisitionError('SERVER_ERROR', `${label} exceeded ${ms}ms budget`)), ms);
  });
  try {
    return await Promise.race([p, guard]);
  } finally {
    clearTimeout(timer);
  }
}

// Hotels.com answers ONE clean LodgingCard search and then rate-samples every request for minutes (measured
// 10 Nov: 49 dated rows in 2.5s, then 429 on the next three calls), so a success is cached for 30 min and a 429
// parks the source for 5 min instead of letting every sweep pay for the same wall.
const HC_CACHE_TTL_MS = 30 * 60_000;
const HC_BLOCK_MS = 5 * 60_000;
const hotelsComCache = new Map<string, { at: number; items: RawSourceItem[] }>();
let hotelsComBlockedUntil = 0;

// Rendered MakeMyTrip listings are expensive (a browser rung), so one city+stay result is reused for 45 min.
const MMT_RENDER_TTL_MS = 45 * 60_000;
const mmtRenderCache = new Map<string, { at: number; items: RawSourceItem[] }>();

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
  // OWNER 30 Oct ("hotels ke gated sources pr kaam kro"): Expedia Group's edge answers a
  // bare 429 / "Bot or Not?" to first contact and then ADMITS the same request after the
  // session is warmed. So prime with a short ladder (impersonate chrome -> safari, brief
  // backoff between tries) instead of failing the whole source on the first challenge.
  // Every attempt is a real request; nothing is fabricated, and if all tries stay gated the
  // source still reports ACCESS_CHALLENGE honestly.
  const primeLadder = [impersonate, impersonate === 'chrome' ? 'safari17_0' : 'chrome'];
  let primed: any = null;
  for (let i = 0; i < primeLadder.length; i++) {
    // MEASURED 10 Nov: a clean profile primes in 1.4-1.6s and answers LodgingCard GraphQL in 1.1s, while a gated
    // profile returns 429 "Bot or Not?" after 9-16s. A 30s timeout therefore never bought anything, it only let a
    // gated profile eat the worker budget: Hotels.com was spending its whole 16s on safari17_0 and returning nothing.
    primed = await cffiFetch(srpUrl, { impersonate: primeLadder[i], timeoutMs: 7_000, returnCookies: true, cookies, headers: { Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9' } });
    cookies = primed.cookies || cookies;
    const gated = primed.status === 429 || (primed.status === 200 && /Bot or Not\?/.test(primed.body.slice(0, 4000)));
    if (!gated) break;
    if (i < primeLadder.length - 1) await new Promise((r) => setTimeout(r, 1200));
  }
  if (primed.status === 429 || (primed.status === 200 && /Bot or Not\?/.test(primed.body.slice(0, 4000)))) {
    throw new AcquisitionError('ACCESS_CHALLENGE', `${site} SRP edge returned a bot challenge (HTTP ${primed.status}) after ${primeLadder.length} attempts`, primed.status);
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
    method: 'POST', impersonate, timeoutMs: 10_000, cookies, body: payload,
    headers: {
      'Content-Type': 'application/json', Accept: '*/*', Origin: origin, Referer: srpUrl,
      'client-info': `shopping-pwa,eb187b18bd35573abd2de93e9fd6a422a6206cfe,${site === 'hotels.com' ? 'us-west-2' : 'us-east-1'}`,
      'x-page-id': 'page.Hotel-Search,H,20',
    },
  });
  if (r.status === 429) {
    // Same reasoning as the prime ladder: back off once, replay with the warmed cookies.
    await new Promise((res) => setTimeout(res, 1800));
    const again = await cffiFetch(`${origin}/graphql`, {
      method: 'POST', impersonate: primeLadder[primeLadder.length - 1], timeoutMs: 10_000, cookies, body: payload,
      headers: {
        'Content-Type': 'application/json', Accept: '*/*', Origin: origin, Referer: srpUrl,
        'client-info': `shopping-pwa,eb187b18bd35573abd2de93e9fd6a422a6206cfe,${site === 'hotels.com' ? 'us-west-2' : 'us-east-1'}`,
        'x-page-id': 'page.Hotel-Search,H,20',
      },
    });
    if (again.status === 429) throw new AcquisitionError('ACCESS_CHALLENGE', `${site} GraphQL edge returned a bot challenge (HTTP 429) after retry`, 429);
    if (again.status !== 200) throw new AcquisitionError('SERVER_ERROR', `${site} GraphQL HTTP ${again.status} (retry): ${again.body.slice(0, 160)}`, again.status);
    const fx2 = await usdToInrRate();
    const items2 = parseExpediaGroup(again.body, ctx.source, site, checkin, checkout, fx2);
    if (!items2.length) throw new AcquisitionError('EMPTY_RESPONSE', `${site} GraphQL retry returned no priced LodgingCards for "${city}"`);
    return items2;
  }
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
      // The browser rung needs headroom: a rendered MakeMyTrip listing takes 15-40s.
      timeoutMs: 75_000,
      run: async (ctx) => {
        const city = cityFromQuery(ctx);
        if (!city || city.length < 3) return [];
        // RECIPE 1 (10 Nov, CRACKED): the DATED listing page rendered through the rescue ladder's browser rung.
        // The earlier "MMT is gated" conclusion was wrong twice over: the probe asked for city=CTIXE while
        // searching Indore (IXE is MANGALORE, so MMT was right and I was wrong), and the React listing simply
        // needs a browser rung. With city = CT + IATA and render=true the page returns 685KB of real cards
        // carrying its own rupee prices, taxes and the requested stay.
        const { checkin, checkout } = stayDates(ctx.query);
        const renderUrl = mmtListingUrl(city, checkin, checkout);
        let renderErr: AcquisitionError | null = null;
        if (renderUrl && String(process.env.T1S_MMT_RENDER || '1').trim() !== '0') {
          const hit = mmtRenderCache.get(`${city.toLowerCase()}|${checkin}|${checkout}`);
          const cached = hit && Date.now() - hit.at < MMT_RENDER_TTL_MS ? hit.items : null;
          if (cached && cached.length) return cached;
          const started = Date.now();
          try {
            // The browser rung is intermittent against Akamai (measured 10 Nov: same URL answered a rendered
            // 685KB listing twice and a 6-byte "200-OK" stub on the next four tries), so it is attempted twice
            // with a short gap and every miss is reported as ACCESS_CHALLENGE for the self-healing layer.
            let res: any = null;
            let rows: any[] = [];
            for (let attempt = 0; attempt < 2 && !rows.length; attempt++) {
              if (attempt) await new Promise((r) => setTimeout(r, 3000));
              res = await rescueFetch(renderUrl, {
                render: true, maxRungs: 2, timeoutMs: 55_000, minHtmlBytes: 20_000,
                validate: (body) => parseMmtHotelListing(body).length > 0,
              });
              rows = parseMmtHotelListing(String(res?.body || ''));
            }
            if (rows.length && mmtPageMatchesStay(String(res?.body || ''), checkin, checkout)) {
              const offers: RawSourceItem[] = rows
                .sort((a, b) => a.total - b.total)
                .slice(0, 30)
                .map((h) => newRawItem(ctx.source, {
                  title: h.name,
                  seller: 'MakeMyTrip',
                  sellerUrl: renderUrl, // redirect only to the site that owns the price
                  currency: 'INR',
                  price: h.total, // printed room price + the taxes & fees MMT prints under it
                  attributes: {
                    city,
                    check_in: checkin,
                    check_out: checkout,
                    price_basis: `room for ${checkin} to ${checkout}: Rs ${h.price} + Rs ${h.taxes} taxes & fees`,
                    star_rating: h.star ? String(h.star) : '',
                    data_note: 'Live MakeMyTrip dated hotel listing (server-rendered cards)',
                  },
                  evidence: {
                    sourceUrl: renderUrl,
                    extractedFields: ['title', 'price', 'taxes', 'check_in', 'check_out'],
                  },
                }));
              mmtRenderCache.set(`${city.toLowerCase()}|${checkin}|${checkout}`, { at: Date.now(), items: offers });
              log.info('MMT render', `${rows.length} priced hotels for ${city} ${checkin}`, { ms: Date.now() - started, via: res?.via });
              return offers;
            }
            renderErr = new AcquisitionError('EMPTY_RESPONSE', `MakeMyTrip rendered listing carried no priced cards for "${city}" (${String(res?.body || '').length}B via ${res?.via || 'none'})`);
          } catch (e: any) {
            renderErr = new AcquisitionError('ACCESS_CHALLENGE', `MakeMyTrip rendered listing unavailable: ${String(e?.message || e).slice(0, 90)}`);
          }
        }
        const slug = city.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-');
        // SELF-DETECTING probe (21 Oct upgrade): the city landing
        // www.makemytrip.com/hotels-in-<city>/ is OPEN browserless but its
        // $hotelReducerResponse is EMPTY from gated IPs. With the full
        // real-Chrome header set (the same set that cracks Goibibo's sampled
        // hotel SSR pages) we retry both slug spellings and parse the reducer
        // the day MMT's gate lifts for this IP. Failures stay honest
        // ACCESS_CHALLENGE; hermes-style: this probe runs on every search.
        const mmtChromeHeaders = {
          'sec-ch-ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'Upgrade-Insecure-Requests': '1',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-User': '?1',
          'Sec-Fetch-Dest': 'document',
          'Accept-Language': 'en-US,en;q=0.9',
          Referer: 'https://www.google.com/',
        };
        let lastErr: AcquisitionError | null = null;
        for (const url of [
          `https://www.makemytrip.com/hotels-in-${slug}/`,
          `https://www.makemytrip.com/hotels/hotels-in-${slug}/`,
        ]) {
          let bigBody: string | null = null;
          let r;
          try {
            r = await cffiFetch(url, { impersonate: 'chrome', timeoutMs: 25_000, headers: mmtChromeHeaders });
          } catch (e: any) {
            lastErr = new AcquisitionError('SERVER_ERROR', `MakeMyTrip hotels page unreachable: ${String(e?.message || e).slice(0, 70)}`);
            continue;
          }
          if (r.status === 301 || r.status === 302) { lastErr = new AcquisitionError('ACCESS_CHALLENGE', 'MakeMyTrip redirected to Akamai geo-challenge (makemytrip.global) from this IP'); continue; }
          if (r.status !== 200) { lastErr = new AcquisitionError('ACCESS_CHALLENGE', `MakeMyTrip HTTP ${r.status}`); continue; }
          if (r.body.length < 500) { lastErr = new AcquisitionError('ACCESS_CHALLENGE', 'MakeMyTrip returned an empty Akamai edge body (no sensor cookie)'); continue; }
          bigBody = r.body;
          const st = parseMmtHotelLanding(bigBody);
          if (st.rows.length) {
            st.rows.sort((a, b) => a.price - b.price);
            const offers: RawSourceItem[] = [];
            for (const h of st.rows.slice(0, 40)) {
              offers.push(newRawItem(ctx.source, {
                title: h.name,
                seller: 'MakeMyTrip',
                sellerUrl: url, // redirect only to the site that owns the price
                currency: 'INR',
                price: h.price,
                attributes: {
                  image_url: h.image || '',
                  rating: h.rating !== undefined ? String(h.rating) : '',
                  locality: h.locality || '',
                  city,
                  price_basis: "per night for 1 room (page's own service dates picked by MakeMyTrip)",
                  data_note: 'Live nightly rates from MakeMyTrip hotel landing page ($hotelReducerResponse)',
                },
                evidence: {
                  sourceUrl: url,
                  extractedFields: ['title', 'price', 'rating', 'locality', 'image_url'],
                },
              }));
            }
            return offers;
          }
          lastErr = new AcquisitionError('EMPTY_RESPONSE', 'MakeMyTrip hotel page reached but $hotelReducerResponse carried no priced hotels (gate holds for this IP)');
        }
        throw lastErr || renderErr || new AcquisitionError('NOT_FOUND', `MakeMyTrip has no hotels page for "${city}"`, 404);
      },
    },
    {
      // Goibibo hotels — owner-mandated mandatory source. /hotels/* SEO pages are
      // Akamai-stubbed (8-byte "200 - OK") from sandbox + Browserbase IPs while the
      // /flights/* SEO pages on the SAME IP serve full __NEXT_DATA__ SSR — a
      // path-scoped bot gate, not an IP burn. This is a SELF-DETECTING full-flow
      // probe (MMT-flights pattern): every search actually fetches the hotel SEO
      // page, so a clean production Hostinger IP activates it automatically.
      // The parser is shape-tolerant (walks __NEXT_DATA__ for hotel-shaped rows).
      sourceId: 'w_hotels_goibibo',
      priority: 15,
      timeoutMs: 30_000,
      run: async (ctx) => {
        const city = cityFromQuery(ctx);
        if (!city || city.length < 3) return [];
        const base = city.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-');

        // RECIPE 1 (21 Oct): hermes.goibibo.com/hotels/v12/search/data/v3 — Goibibo's
        // own hotel search API. Akamai denies datacenter IPs (sandbox tarpit,
        // Browserbase 403) but the production Hostinger IP passes other goibibo
        // surfaces (flights SSR). Self-detecting: works wherever the IP is clean.
        const tomorrow = new Date(Date.now() + 86400000);
        const dayAfter = new Date(Date.now() + 2 * 86400000);
        const fmt = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
        const checkIn = fmt(tomorrow), checkOut = fmt(dayAfter);
        let lastHermesErr: AcquisitionError | null = null;
        const sq = encodeURIComponent(JSON.stringify({ Companion: { TA: '1DA' }, Pax: { A: '2' }, RoomCnt: '1', City: base, CheckIn: checkIn, CheckOut: checkOut }));
        const hermesUrl = `https://hermes.goibibo.com/hotels/v12/search/data/v3?searchQuery=${sq}`;
        try {
          const hr = await cffiFetch(hermesUrl, { impersonate: 'chrome', timeoutMs: 4_000, headers: { Accept: 'application/json', Referer: 'https://www.goibibo.com/hotels/' } });
          if (hr.status === 200 && hr.body.length > 100) {
            const offers = parseHermesHotels(hr.body, ctx.source, city, checkIn, checkOut, hermesUrl);
            if (offers.length) return offers;
            // shape mismatch or empty result — surface a snippet for the next iteration
            lastHermesErr = new AcquisitionError('EMPTY_RESPONSE', `Goibibo hermes 200 (${hr.body.length}B) carried no parseable hotel rows; snippet=${JSON.stringify(hr.body.slice(0, 160))}`);
          } else if (hr.status !== 200) {
            lastHermesErr = new AcquisitionError(hr.status === 403 || hr.status === 429 ? 'ACCESS_CHALLENGE' : 'SERVER_ERROR', `Goibibo hermes HTTP ${hr.status}`);
          }
        } catch (e: any) {
          lastHermesErr = new AcquisitionError('TIMEOUT', `Goibibo hermes unreachable: ${String(e?.message || e).slice(0, 60)}`);
        }

        // RECIPE 2 (21 Oct CRACKED): the SSR city page www.goibibo.com/hotels/
        // hotels-in-<city>[-ct]/ carries the FULL listing state in
        // window.__initial_state__ (srpUnif.srpData...hotels[]: priceDetail
        // per-night INR, media images, reviewSummaryUgc ratings, deeplinks).
        // Akamai SAMPLES datacenter IPs here (~alternating 8-byte "200 - OK"
        // stubs) — with the full real-Chrome header set (sec-ch-ua/sec-fetch)
        // the 1.3MB page lands; verified live: Goa 20 hotels ₹1,891-6,156.
        // Self-healing ladder: stub -> short backoff -> retry (up to 3),
        // -ct slug variant next; legacy __NEXT_DATA__ walker kept as fallback.
        const giChromeHeaders = {
          'sec-ch-ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'Upgrade-Insecure-Requests': '1',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-User': '?1',
          'Sec-Fetch-Dest': 'document',
          'Accept-Language': 'en-US,en;q=0.9',
          Referer: 'https://www.google.com/',
        };
        const attempts = [`hotels-in-${base}-ct`, `hotels-in-${base}`];
        // 22 Oct: Akamai's sample is per-IP+client-profile — rotating a mobile
        // profile (impersonate safari iOS UA) through the ladder gives the
        // Hostinger IP another independent sample each run.
        const mobileHeaders = {
          ...giChromeHeaders,
          'sec-ch-ua-mobile': '?1',
          'sec-ch-ua-platform': '"iOS"',
          'sec-ch-ua': '"Not A(Brand";v="8", "Safari";v="17", "Chromium";v="130"',
          Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
        };
        let lastErr: AcquisitionError | null = null;
        const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
        // MEASURED 10 Nov: two slugs x four attempts x 2s sleeps spent 28.7s of the hotel sweep on a source that
        // answered an 8-byte stub every single time, so real sellers (Agoda/Yatra/Ixigo/OYO/EMT/Airbnb) lost the
        // budget. The self-healing property only needs one honest sample per client profile per search, so the
        // loop is now 2 attempts per slug (chrome + iOS profile) inside a 9s deadline for the whole task.
        const giDeadline = Date.now() + 7_000;
        for (const slug of attempts) {
          if (Date.now() > giDeadline) break;
          const url = `https://www.goibibo.com/hotels/${slug}/`;
          let bigBody: string | null = null;
          for (let attempt = 1; attempt <= 2; attempt++) {
            if (Date.now() > giDeadline) break;
            let r;
            const headers = attempt === 2 ? mobileHeaders : giChromeHeaders;
            const imp = attempt === 2 ? 'safari17_0' : 'chrome';
            try {
              r = await cffiFetch(url, { impersonate: imp, timeoutMs: 8_000, headers });
            } catch (e: any) {
              lastErr = new AcquisitionError('SERVER_ERROR', `Goibibo hotels page unreachable (attempt ${attempt}/2): ${String(e?.message || e).slice(0, 80)}`);
              await sleep(900);
              continue;
            }
            if (r.status === 404) break; // spelling has no page: try the -ct variant
            if (r.status === 403 || r.status === 429) throw new AcquisitionError(r.status === 403 ? 'ACCESS_CHALLENGE' : 'RATE_LIMITED', `Goibibo hotels edge-blocked (HTTP ${r.status}).`, r.status);
            if (r.status !== 200) { lastErr = new AcquisitionError('ACCESS_CHALLENGE', `Goibibo hotels HTTP ${r.status}`); await sleep(900); continue; }
            if (r.body.length >= 100_000) { bigBody = r.body; break; } // the real 1.3MB SSR page
            lastErr = new AcquisitionError('ACCESS_CHALLENGE', `Goibibo hotels Akamai-sampled a ${r.body.length}B stub (attempt ${attempt}/2); ladder retries next search`);
            await sleep(900);
          }
          if (!bigBody) continue;
          const st = parseGoibiboHotelSsrState(bigBody);
          let rows = st.rows;
          if (!rows.length) rows = parseGoibiboHotelsSsr(bigBody); // legacy __NEXT_DATA__ shape
          if (!rows.length) { lastErr = new AcquisitionError('EMPTY_RESPONSE', `Goibibo hotel page reached (${bigBody.length} bytes) but carried no parseable hotel listings`); continue; }
          rows.sort((a, b) => a.price - b.price);
          const dateLabel = st.checkIn ? ` for ${st.checkIn} → ${st.checkOut || ''}` : '';
          const offers: RawSourceItem[] = [];
          for (const h of rows.slice(0, 40)) {
            offers.push(newRawItem(ctx.source, {
              title: h.name,
              seller: 'Goibibo',
              sellerUrl: h.url || url, // redirect only to the site that owns the price
              currency: 'INR',
              price: h.price,
              attributes: {
                image_url: h.image || '',
                rating: h.rating !== undefined ? String(h.rating) : '',
                locality: h.locality || '',
                city,
                price_basis: `per night for 1 room (page's own service date${dateLabel ? ': ' + dateLabel.trim() : ' picked by Goibibo'})`,
                data_note: `Live nightly rates from Goibibo hotel search results (SEO page${st.hotelCount ? `, ${st.hotelCount} hotels in city` : ''})`,
              },
              evidence: {
                sourceUrl: url,
                sourceReference: h.url,
                extractedFields: ['title', 'price', 'rating', 'locality', 'image_url'],
              },
            }));
          }
          return offers;
        }
        throw lastErr || lastHermesErr || new AcquisitionError('NOT_FOUND', `Goibibo has no hotels page for "${city}"`, 404);
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
        const stay = stayDates(ctx.query);
        let items: any[] = [];
        let url = '';
        let lastStatus = 0;
        for (const variant of cityVariants(city)) {
          // Ixigo honours checkInDate/checkOutDate on its SEO page (verified: the dated and undated bodies
          // differ and the dated one carries the requested stay), so its rows become dated-honest.
          url = `https://www.ixigo.com/hotels/${ixigoHotelsSlug(variant)}?checkInDate=${stay.checkin}&checkOutDate=${stay.checkout}`;
          const r = await cffiFetch(url, { impersonate: 'chrome', timeoutMs: 30_000 });
          lastStatus = r.status;
          if (r.status === 404) continue; // this spelling has no page: try the next alias
          if (r.status !== 200) throw new AcquisitionError(r.status === 403 || r.status === 429 ? 'ACCESS_CHALLENGE' : 'FORBIDDEN', `Ixigo hotels HTTP ${r.status}`, r.status);
          items = parseIxigoHotels(r.body, ctx.source, url, city);
          if (items.length) break;
        }
        if (!items.length && lastStatus === 404) throw new AcquisitionError('NOT_FOUND', `Ixigo has no hotels page for "${city}"`, 404);
        if (!items.length) throw new AcquisitionError('EMPTY_RESPONSE', `No Ixigo hotels parsed for "${city}" (slug may not exist for this city)`);
        return stampStayDates(items, stay.checkin, stay.checkout);
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
        const rows = parseCleartripOffers(hotels, ctx.source);
        // SELF-HEALING (owner 22 Oct, standing rule): Cleartrip's rukmini-ct
        // CMS image URLs intermittently 404 from the browser even though the
        // page parsed them — dead art renders as initials text in the photo
        // slot. Probe the batch's first image once; when the CDN is dead, strip
        // the images for the whole batch (they share the CDN session) instead
        // of persisting art that cannot load. Showcase/destination selection
        // then honestly prefers rows with live art.
        const firstImg = (rows as any[]).find((r) => (r.attributes?.image_url) || (r.attributes?.image_urls))
          ?.attributes?.image_url;
        if (firstImg) {
          // (owner 23 Oct, prod log audit: 36 identical warnings/hour) While the
          // CDN is known-dead we (a) skip the 4s probe entirely — every batch
          // re-probing just burns the search budget — and (b) strip silently,
          // re-probing at most once per hour so recovery is detected within the
          // hour without log spam. A live probe re-arms the cache instantly.
          const cachedDead = cleartripArtDeadUntil > Date.now();
          let live = false;
          if (!cachedDead) {
            try {
              const ctl = new AbortController();
              const t = setTimeout(() => ctl.abort(), 4000);
              const res = await fetch(firstImg, { signal: ctl.signal, redirect: 'follow' });
              clearTimeout(t);
              live = res.status === 200 && String(res.headers.get('content-type') || '').startsWith('image/');
            } catch { live = false; }
          }
          if (!live) {
            if (!cachedDead) cleartripArtDeadUntil = Date.now() + 60 * 60_000;
            for (const r of rows as any[]) {
              if (r.attributes?.image_url) delete r.attributes.image_url;
              if (r.attributes?.image_urls) delete r.attributes.image_urls;
            }
            if (!cachedDead) {
              log.warn('Hotels worker', 'Cleartrip CDN art dead — images stripped; hourly re-probe will re-arm art (self-healing)', { probe: String(firstImg).slice(0, 80) });
            }
          }
        }
        return rows;
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
        return stampStayDates(parseAirbnbOffers(stays, ctx.source, city), checkin, checkout);
      },
    },
    {
      // OWNER 10 Nov ("booking.com ka demand api ... kro"): Booking.com Demand API source.
      // Demand API access is a Managed Affiliate Partner approval, so there is nothing to scrape and
      // nothing to invent: with BOOKING_DEMAND_AFFILIATE_ID + BOOKING_DEMAND_TOKEN present this returns
      // real priced Booking.com hotels (and the CJ exit already pays on the click), and without them it
      // raises NOT_CONFIGURED so the admin dashboard shows exactly what is missing instead of an empty
      // result. Verify the response shape once on the first authenticated call before enabling live.
      sourceId: 'w_hotels_booking_demand',
      name: 'Hotels worker: Booking.com Demand API (managed affiliate partner feed)',
      priority: 3,
      maxPerMinute: 2,
      timeoutMs: 25_000,
      run: async (ctx) => {
        if (!bookingDemandConfigured()) {
          throw new AcquisitionError('CAPABILITY_UNAVAILABLE', 'Booking.com Demand API credentials missing: apply for Managed Affiliate Partner access, then set BOOKING_DEMAND_AFFILIATE_ID and BOOKING_DEMAND_TOKEN (X-Affiliate-Id + token per Booking.com docs).');
        }
        const q: any = ctx.query || {};
        const city = String(q.cityName || q.city || q.destination || q.rawQuery || '').trim();
        const checkin = q?.travelDates?.checkin || q?.travelDates?.from || new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
        const checkout = q?.travelDates?.checkout || q?.travelDates?.to || new Date(Date.now() + 9 * 86400_000).toISOString().slice(0, 10);
        const payload = await bookingDemandSearch({
          booker: { country: 'in', platform: 'desktop', travel_purpose: 'leisure' },
          checkin,
          checkout,
          city_name: city,
          guests: { number_of_adults: 2, number_of_rooms: 1 },
          extras: ['deals'],
          currency: 'INR',
        });
        return bookingDemandItems(payload, { checkin, checkout, city });
      },
    },
    {
      // OWNER 10 Nov ("stayapi, apify actors jaise kaam kr rahe hai same principal lga kr price lao"):
      // Booking.com cannot be read by cURL from here - measured 10 Nov, direct AND through a proxy service
      // both return the same 8.8KB client-rendered shell with zero property cards. The page only exists once
      // a browser paints it, so this source lets a browser run somewhere else (an Apify actor) and takes the
      // structured items back. Rows carry the merchant URL; the affiliate layer wraps it, and booking.com
      // already resolves to the owner's evergreen CJ deeplink, so the click is paid.
      sourceId: 'w_hotels_booking_apify',
      name: 'Hotels worker: Booking.com rates via Apify actor (browser-rendered, CJ exit)',
      priority: 4,
      maxPerMinute: 2,
      timeoutMs: 130_000,
      run: async (ctx) => {
        if (!apifyMeetsConfigured()) {
          throw new AcquisitionError('CAPABILITY_UNAVAILABLE',
            `Apify actor not configured: set ${apifyMissingEnv().join(' + ')} (APIFY_BOOKING_ACTOR is the actor id from the Apify store; APIFY_TOKEN comes from Apify settings -> Integrations).`);
        }
        const city = cityFromQuery(ctx);
        if (!city) return [];
        const { checkin, checkout } = stayDates(ctx.query);
        const items = await runActorSync(process.env.APIFY_BOOKING_ACTOR!.trim(), bookingActorInput({ destination: city, checkin, checkout }));
        const rows = apifyBookingRows(items);
        return rows.slice(0, 25).map((r) => newRawItem(ctx.source, {
          title: r.name,
          price: r.price,
          currency: 'INR',
          seller: 'Booking.com',
          sellerUrl: r.url,
          availability: 'in_stock',
          travel: { roomType: 'as listed on Booking.com' },
          attributes: {
            ...(r.imageUrl ? { image_url: r.imageUrl } : {}),
            ...(r.rating ? { review_score: String(r.rating) } : {}),
            ...(r.address ? { address: r.address.slice(0, 80) } : {}),
            price_scope: `nightly rate for ${checkin} to ${checkout} (as displayed by Booking.com)`,
            via: 'apify_actor',
          },
          evidence: {
            sourceUrl: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(city)}&checkin=${checkin}&checkout=${checkout}`,
            sourceReference: r.name,
            rawFingerprint: '',
            extractedFields: ['title', 'price', ...(r.imageUrl ? ['image_url'] : []), ...(r.rating ? ['review_score'] : [])],
          },
        }));
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
        // MEASURED 10 Nov: expedia.com answers 429 "Bot or Not?" to safari and chrome alike (hotels.com does not), so
        // this worker fails fast with ACCESS_CHALLENGE instead of spending 18s of the sweep on a gated edge.
        const items = await withBudget(expediaGroupSearch(ctx, 'expedia.com', 'chrome', city, checkin, checkout), 8_000, 'Expedia');
        return stampStayDates(items, checkin, checkout);
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
        const cacheKey = `${city.toLowerCase()}|${checkin}|${checkout}`;
        const hit = hotelsComCache.get(cacheKey);
        if (hit && Date.now() - hit.at < HC_CACHE_TTL_MS) return hit.items;
        if (Date.now() < hotelsComBlockedUntil) {
          throw new AcquisitionError('RATE_LIMITED', `Hotels.com edge is rate-sampling after a 429; cooling down ${Math.ceil((hotelsComBlockedUntil - Date.now()) / 1000)}s`);
        }
        // ORDER MATTERS, measured 10 Nov: the same SRP answered 429 "Bot or Not?" to safari17_0 after 16.2s and
        // HTTP 200 (1.29MB) to chrome in 1.35s, but safari ran first so the 16s budget died on the gated profile
        // and Hotels.com never appeared. chrome is now the primary key, the other two only as fallbacks.
        let items: Awaited<ReturnType<typeof expediaGroupSearch>>;
        let lastErr: any = null;
        // One overall deadline across the three profiles: a gated profile can take 7-9s to say 429, so without this
        // the fallbacks alone outlived the worker budget (measured 14,001ms TIMEOUT with three profiles).
        const hcDeadline = Date.now() + 7_000;
        for (const imp of ['chrome', 'chrome_android', 'safari17_0'] as const) {
          const left = hcDeadline - Date.now();
          if (left < 2_500) break;
          try {
            items = await withBudget(expediaGroupSearch(ctx, 'hotels.com', imp, city, checkin, checkout), left, 'Hotels.com');
            break;
          } catch (e: any) {
            lastErr = e;
            const cls = String(e?.failureClass);
            if (cls !== 'ACCESS_CHALLENGE' && cls !== 'RATE_LIMITED' && cls !== 'TIMEOUT') throw e;
          }
        }
        if (!items!) {
          hotelsComBlockedUntil = Date.now() + HC_BLOCK_MS;
          throw lastErr || new AcquisitionError('ACCESS_CHALLENGE', 'Hotels.com: no readable edge profile');
        }
        const stamped = stampStayDates(items, checkin, checkout);
        hotelsComBlockedUntil = 0;
        hotelsComCache.set(cacheKey, { at: Date.now(), items: stamped });
        return stamped;
      },
    },
    {
      sourceId: 'w_hotels_osm',
      name: 'Hotels worker: OpenStreetMap hotel discovery (worldwide)',
      priority: 20,
      maxPerMinute: 6,
      timeoutMs: 12_000, // OWNER 10 Nov: OSM rows carry no price, so they can never render under No Price No Card - it must not hold the sweep for 45s
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
      // MEASURED 3 Nov: 14.5s cold for Indore; the old 90s ceiling could outlive the 34s hotel sweep.
      timeoutMs: 24_000,
      run: async (ctx) => {
        const workerStart = Date.now();
        const city = cityFromQuery(ctx);
        if (!city) return [];
        const { checkin, checkout } = stayDates(ctx.query);

        // 1. cityId from an SEO city page (module-level cache, ids are stable).
        let cityId = agodaCityIdCache.get(city.toLowerCase());
        if (!cityId) {
          for (const slug of agodaCitySlugs(city)) {
            const r = await cffiFetch(`https://www.agoda.com/city/${slug}.html`, {
              impersonate: 'chrome', timeoutMs: 6_000,
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
          impersonate: 'chrome', timeoutMs: 9_000,
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
            timeoutMs: Math.max(3_000, Math.min(9_000, 24_000 - (Date.now() - workerStart))),
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
      // SaffronStays — owner-mandated source (17 Oct). Boutique villas; search API
      // captured via stealth CDP interception, replayed browserless with curl_cffi.
      sourceId: 'w_hotels_saffronstays',
      name: 'Hotels worker: SaffronStays live villa rates',
      priority: 10,
      maxPerMinute: 6,
      timeoutMs: 30_000,
      run: async (ctx) => {
        const city = cityFromQuery(ctx);
        if (!city || city.length < 3) return [];
        const r = await cffiFetch(SAFFRON_API, {
          impersonate: 'chrome', method: 'POST', timeoutMs: 25_000,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/plain, */*',
            Origin: 'https://www.saffronstays.com',
            Referer: 'https://www.saffronstays.com/',
          },
          body: JSON.stringify(saffronSearchBody(city)),
        });
        if (r.status !== 200) throw new AcquisitionError('SERVER_ERROR', `SaffronStays search-advance HTTP ${r.status}: ${r.body.slice(0, 160)}`, r.status);
        let body: any = null;
        try { body = JSON.parse(r.body); } catch { /* fallthrough */ }
        const villas = Array.isArray(body?.data) ? parseSaffronVillas(body.data) : [];
        if (!villas.length) throw new AcquisitionError('EMPTY_RESPONSE', `SaffronStays returned no villas for "${city}"`);
        return parseSaffronOffers(villas, ctx.source, city);
      },
    },
    {
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
        // OWNER 10 Nov: Yatra never appeared in the hotel answer because three 45s page fetches could outlive
        // the whole hotel sweep (measured: the task was still running at 45s). One shared deadline now bounds
        // the loop, and each page fetch gets only what is left of it.
        const deadline = Date.now() + Number(process.env.T1S_YATRA_HOTELS_BUDGET_MS || 22_000);
        for (let page = 1; page <= 3; page++) { // up to 30 offers per search
          const left = deadline - Date.now();
          if (left < 3_000) break;
          const r = await cffiFetch(yatraPageSearchUrl(city, checkin, checkout, page), {
            impersonate: 'chrome', timeoutMs: Math.min(12_000, left), headers,
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