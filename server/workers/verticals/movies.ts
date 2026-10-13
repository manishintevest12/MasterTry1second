/**
 * Movies worker (India). A movies search runs ONLY this worker.
 * Real recently-released Indian films (Wikidata, CC0) for browse queries and real
 * movie facts for entity queries. Showtimes/ticket prices are honestly unknown —
 * booking platforms block plain HTTP and we never invent them.
 */
import { registerVerticalWorker, type VerticalWorker } from '../verticalWorker';
import { wikidataFetch, recentIndianFilms, parseRecentFilms, searchFilmEntity } from '../parsers/wikidataMovies';
import { AcquisitionError } from '../../common/httpClient';
import { cffiFetch } from '../../common/curlCffiFetch';
import { resolveBmsRegion, bmsDiscoverUrl, bmsDiscoverHeaders, parseMovieCards, normCity, extractMovieQuery, matchesQuery } from '../parsers/bookmyshow';
import { ticketnewCityKeys, parseTicketNewMoviesPage, parseTicketNewMovies, TICKETNEW_BASE } from '../parsers/ticketnew';
import { createHash } from 'node:crypto';

let recentCache: { at: number; rows: any } | null = null;

/** BookMyShow now-showing discovery (mandatory source #1 for movies).
 * Akamai fingerprints TLS, so the request rides the curl_cffi bridge (still browserless);
 * region comes from the public CDN regions.json; prices are honestly absent until the
 * quickbook showtimes contract is recovered (never fabricated). */
async function fetchJsonNode(url: string): Promise<any> {
  const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new AcquisitionError('SERVER_ERROR', `regions fetch ${r.status}`);
  return r.json();
}

export const moviesWorker: VerticalWorker = {
  vertical: 'movies',
  tasks: [
    {
      sourceId: 'w_movies_bookmyshow',
      name: 'Movies worker: BookMyShow now-showing discovery (posters + deeplinks, city-aware)',
      priority: 1,
      maxPerMinute: 6,
      timeoutMs: 30_000,
      run: async (ctx) => {
        const raw = String(ctx.query.rawQuery || '').trim();
        const entity = String(ctx.query.entityName || '').trim();
        const region = await resolveBmsRegion(ctx.query.location?.city, fetchJsonNode);
        const res = await cffiFetch(bmsDiscoverUrl(region), { headers: bmsDiscoverHeaders(region), timeoutMs: 25_000 });
        if (res.status === 403 || res.status === 429) {
          throw new AcquisitionError(res.status === 403 ? 'FORBIDDEN' : 'RATE_LIMITED', `BMS blocked: ${res.status}`, res.status);
        }
        if (res.status !== 200) throw new AcquisitionError('SERVER_ERROR', `BMS discovery ${res.status}`, res.status);
        const payload = JSON.parse(res.body);
        // Strip generic + location tokens so strict title matching compares the movie
        // name only ("jailer 2 movie tickets bengaluru" -> "jailer 2").
        const stripTokens = (normCity(region.regionName) + ' ' + normCity(String(ctx.query.location?.city || ''))).split(' ').filter(Boolean);
        const queryTerm = entity ? extractMovieQuery(entity, stripTokens) : '';
        const fingerprint = createHash('sha256').update(res.body).digest('hex').slice(0, 16);
        return parseMovieCards(payload, ctx.source, region, queryTerm, fingerprint);
      },
    },
    {
      sourceId: 'w_movies_ticketnew',
      name: 'Movies worker: TicketNew now-showing (Next.js __NEXT_DATA__, city-aware)',
      priority: 8,
      maxPerMinute: 6,
      timeoutMs: 30_000,
      run: async (ctx) => {
        const entity = String(ctx.query.entityName || '').trim();
        const city = String(ctx.query.location?.city || '');
        const keys = ticketnewCityKeys(city);
        if (keys.length === 0) return []; // city unknown to TicketNew — honest empty, no substitute
        const queryTerm = entity ? extractMovieQuery(entity, (normCity(city)).split(' ').filter(Boolean)) : '';
        let lastErr: any = null;
        for (const key of keys.slice(0, 2)) {
          try {
            const res = await cffiFetch(`${TICKETNEW_BASE}/movies/${key}`, { timeoutMs: 25_000 });
            if (res.status === 403 || res.status === 429) {
              throw new AcquisitionError(res.status === 403 ? 'FORBIDDEN' : 'RATE_LIMITED', `TicketNew blocked: ${res.status}`, res.status);
            }
            if (res.status !== 200) { lastErr = new Error(`TN listing ${res.status}`); continue; }
            const movies = parseTicketNewMoviesPage(res.body, key);
            if (movies.length === 0) { lastErr = new Error('no movies parsed'); continue; }
            return parseTicketNewMovies(movies, ctx.source, key, queryTerm);
          } catch (e: any) {
            lastErr = e;
            if (e instanceof AcquisitionError && (e.failureClass === 'FORBIDDEN' || e.failureClass === 'RATE_LIMITED')) throw e;
          }
        }
        if (lastErr instanceof AcquisitionError) throw lastErr;
        return []; // honest empty when the listing pages do not resolve
      },
    },
    {
      sourceId: 'w_movies_wikidata',
      name: 'Movies worker: Wikidata film releases (India)',
      priority: 10,
      maxPerMinute: 8,
      timeoutMs: 30_000,
      run: async (ctx) => {
        const entity = String(ctx.query.entityName || '').trim();
        const cityToks = (normCity(String(ctx.query.location?.city || ''))).split(' ').filter(Boolean);
        const movieTerm = entity ? extractMovieQuery(entity, cityToks) : '';
        if (movieTerm) {
          // Strict token boundary: only keep hits whose label actually contains the query
          // tokens; an honest empty beats an irrelevant substitute (owner mandate).
          const hits = await searchFilmEntity(movieTerm, ctx.source);
          const strict = hits.filter((h: any) => matchesQuery(String(h.attributes?.match || h.title), movieTerm));
          return strict;
        }
        // SPARQL can take ~8-20s; cache the releases window for 30 minutes.
        if (!recentCache || Date.now() - recentCache.at > 30 * 60_000) {
          const json = await wikidataFetch('https://query.wikidata.org/sparql', {
            method: 'POST',
            body: `query=${encodeURIComponent(recentIndianFilms(45))}`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          });
          recentCache = { at: Date.now(), rows: json };
        }
        return parseRecentFilms(recentCache.rows, ctx.source, new Date().toISOString().slice(0, 10));
      },
    },
  ],
};
registerVerticalWorker(moviesWorker);
