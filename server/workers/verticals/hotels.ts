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
import { AcquisitionError } from '../../common/httpClient';

function cityFromQuery(ctx: { query: any }): string | null {
  const q = ctx.query;
  const raw = String(q.rawQuery || '').trim();
  // The destination the USER TYPED always wins over their device/profile city
  // (searching "Goa" from Delhi must never return Delhi hotels).
  const strip = (x: string) => x.replace(/\b(hotels?|rooms?|stay|stays|resorts?|in|near|at|book|cheap|best|check-?in:?|tomorrow|today)\b/gi, ' ')
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
  ],
};
registerVerticalWorker(hotelsWorker);
