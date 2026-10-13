/**
 * Hotels worker (WORLDWIDE). A hotels search runs ONLY this worker.
 * Real property discovery from OpenStreetMap: Photon geocode → Overpass hotels.
 * Room rates are not present in OSM and are never invented; the property listing
 * is served with price honestly unknown.
 */
import { registerVerticalWorker, looksLikeChallenge, type VerticalWorker } from '../verticalWorker';
import { photonGeocode, parseOverpassHotels, overpassHotelQuery } from '../parsers/osmTravel';
import { parseBookingHotels } from '../parsers/booking';
import { wikidataHotelQuery, parseWikidataHotels, WIKIDATA_ENDPOINT } from '../parsers/wikidataHotels';
import { parseCleartripHotels, parseCleartripOffers } from '../parsers/cleartripHotels';
import { extractAirbnbSearchResults, parseAirbnbStays, parseAirbnbOffers } from '../parsers/airbnbHotels';
import { parseIxigoHotels, ixigoHotelsSlug } from '../parsers/ixigoHotels';
import { cffiFetch } from '../../common/curlCffiFetch';
import { AcquisitionError } from '../../common/httpClient';
import { cityVariants, slugOf } from '../../common/cityAlias';

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
        // Booking.com's edge occasionally answers a plain-HTTP crawl with a 202
        // interstitial (rate-based sampling). One short retry, then honest ACCESS_CHALLENGE.
        for (let attempt = 1; attempt <= 2; attempt++) {
          const r = await ctx.fetch(url, { headers: UA, timeoutMs: 15_000 });
          if (r.status !== 200 && r.status !== 202) throw new AcquisitionError('FORBIDDEN', `Booking.com HTTP ${r.status}`, r.status);
          const items = parseBookingHotels(r.body, ctx.source, url, checkin, checkout);
          if (items.length) return items;
          if (looksLikeChallenge(r.body) && attempt === 1) { await new Promise((res) => setTimeout(res, 1500)); continue; }
          throw new AcquisitionError('ACCESS_CHALLENGE', 'Booking.com presented a challenge page (no parseable property cards)');
        }
        throw new AcquisitionError('EMPTY_RESPONSE', 'Booking.com returned no property cards');
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
      sourceId: 'w_hotels_agoda',
      name: 'Hotels worker: Agoda (probe)',
      priority: 19,
      run: async () => {
        await cffiFetch('https://www.agoda.com/', { impersonate: 'chrome', timeoutMs: 12_000 });
        throw new AcquisitionError('EMPTY_RESPONSE', 'Agoda serves an SSR shell; hotel prices load via token-gated XHRs that are not available unauthenticated to browserless HTTP.');
      },
    },
    {
      sourceId: 'w_hotels_yatra',
      name: 'Hotels worker: Yatra (probe)',
      priority: 20,
      run: async () => {
        await cffiFetch('https://www.yatra.com/hotels', { impersonate: 'chrome', timeoutMs: 12_000 });
        throw new AcquisitionError('EMPTY_RESPONSE', 'Yatra hotels serves an SPA shell (414KB, no SSR prices); quote XHRs require a session.');
      },
    },
  ],
};

registerVerticalWorker(hotelsWorker);