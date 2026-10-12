/**
 * Movies worker (India). A movies search runs ONLY this worker.
 * Real recently-released Indian films (Wikidata, CC0) for browse queries and real
 * movie facts for entity queries. Showtimes/ticket prices are honestly unknown —
 * booking platforms block plain HTTP and we never invent them.
 */
import { registerVerticalWorker, type VerticalWorker } from '../verticalWorker';
import { wikidataFetch, recentIndianFilms, parseRecentFilms, searchFilmEntity } from '../parsers/wikidataMovies';
import { AcquisitionError } from '../../common/httpClient';

let recentCache: { at: number; rows: any } | null = null;

export const moviesWorker: VerticalWorker = {
  vertical: 'movies',
  tasks: [
    {
      sourceId: 'w_movies_wikidata',
      name: 'Movies worker: Wikidata film releases (India)',
      priority: 10,
      maxPerMinute: 8,
      timeoutMs: 30_000,
      run: async (ctx) => {
        const entity = String(ctx.query.entityName || '').trim();
        if (entity && entity.length > 2 && !/now showing|nowsho|latest|current|movies? (near|in)/i.test(entity)) {
          const hits = await searchFilmEntity(entity, ctx.source);
          if (hits.length) return hits;
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
