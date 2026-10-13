/**
 * Cinepolis India parser (browserless reverse engineering, movies vertical).
 *
 * Cinepolis India (cinepolisindia.com) is a Next.js SPA. The listing page
 *   GET https://cinepolisindia.com/movie-list/{cityKey}
 * server-renders pageProps.comingSoonMoviesData[] (city-independent) into
 * __NEXT_DATA__; nowPlayingMoviesData stays {} until a valid numeric city id
 * is supplied client-side (ids come from api_new.cinepolisindia.com, which resets
 * non-Indian datacenter TLS connections — see data_note honesty below).
 * Movie images are served from api_new.cinepolisindia.com/uploads/... and are
 * loaded by the end-user browser (verified unreachable from our egress, but the
 * site itself ships these URLs).
 *
 * Deeplink honesty: the site exposes no SSR-verified per-movie detail URL
 * (/movie-details/{id} is client-rendered and its param contract is unknown),
 * so each offer deeplinks to the site's own movie-list entry route.
 * Strict token matching: only titles containing every query token survive.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';
import { matchesQuery } from './bookmyshow';

export const CINEPOLIS_BASE = 'https://cinepolisindia.com';
export const CINEPOLIS_MOVIE_LIST_URL = `${CINEPOLIS_BASE}/movie-list/undefined`;

export interface CinepolisMovie {
  Title?: string;
  movie_id?: number;
  movie_lang?: string;
  m_movie_genre_name?: string;
  run_time?: number;
  movie_release_date?: string;
  movie_trailer?: string;
  movie_image_url_1?: string;
  movie_image_url_2?: string;
}

export interface CinepolisPageData {
  nowPlaying: CinepolisMovie[];
  comingSoon: CinepolisMovie[];
}

/** Parse the __NEXT_DATA__ movie payloads from a Cinepolis movie-list page body. */
export function parseCinepolisPage(body: string): CinepolisPageData {
  const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(body);
  if (!m) return { nowPlaying: [], comingSoon: [] };
  let d: any;
  try {
    d = JSON.parse(m[1]);
  } catch {
    return { nowPlaying: [], comingSoon: [] };
  }
  const pp = d?.props?.pageProps || {};
  const clean = (arr: any): CinepolisMovie[] =>
    Array.isArray(arr) ? arr.filter((mv) => mv && typeof mv.Title === 'string' && mv.Title.length > 0) : [];
  const np = pp.nowPlayingMoviesData;
  const nowPlaying: CinepolisMovie[] = np && typeof np === 'object' && !Array.isArray(np)
    ? clean(Object.values(np))
    : clean(np);
  return { nowPlaying, comingSoon: clean(pp.comingSoonMoviesData) };
}

/** Title cleanup for display: keep the real title, drop the parenthetical language suffix if present. */
export function cinepolisDisplayTitle(title: string): string {
  return title.replace(/\s*\((?:[A-Z]{2,8}(?:\s+WI\s+[A-Z]{2,8})?(?:\s+\([^)]*\))?(?:\s+\(\d+D\))?)?\)\s*$/i, '').trim() || title;
}

/** Cinepolis movies → raw offers (now-showing first, then coming-soon flagged). */
export function parseCinepolisMovies(
  data: CinepolisPageData,
  source: SourceConfig,
  queryTerm: string,
): RawSourceItem[] {
  const out: RawSourceItem[] = [];
  const groups: Array<{ movies: CinepolisMovie[]; availability: string; note: string }> = [
    { movies: data.nowPlaying, availability: 'now_showing', note: 'Now-showing discovery from Cinepolis India; ticket price appears in the seat-selection flow' },
    { movies: data.comingSoon, availability: 'coming_soon', note: 'Upcoming release listed by Cinepolis India; tickets open per the release date shown' },
  ];
  for (const g of groups) {
    for (const mv of g.movies.slice(0, 25)) {
      const rawTitle = String(mv.Title || '').trim();
      if (!rawTitle) continue;
      if (queryTerm && !matchesQuery(rawTitle, queryTerm)) continue; // strict, no fuzzy substitutes
      const display = cinepolisDisplayTitle(rawTitle);
      const img = mv.movie_image_url_1 || mv.movie_image_url_2;
      const release = mv.movie_release_date ? String(mv.movie_release_date).slice(0, 10) : null;
      const attrs: Record<string, any> = {
        image_url: img ? encodeURI(String(img)) : null,
        language: mv.movie_lang || null,
        genres: mv.m_movie_genre_name || null,
        duration_min: typeof mv.run_time === 'number' ? mv.run_time : null,
        trailer_url: mv.movie_trailer && mv.movie_trailer !== 'NA' ? mv.movie_trailer : null,
        release_date: release,
        availability: g.availability,
        data_note: g.note,
      };
      out.push(newRawItem(source, {
        title: display,
        seller: 'Cinepolis India',
        sellerUrl: CINEPOLIS_MOVIE_LIST_URL, // the site's own SSR-verified movie-list entry
        currency: 'INR',
        attributes: attrs,
        evidence: {
          sourceUrl: CINEPOLIS_MOVIE_LIST_URL,
          sourceReference: mv.movie_id ? String(mv.movie_id) : '',
          extractedFields: ['title', 'language', 'genres', 'duration', 'release_date', 'trailer', 'image'],
        },
      }));
    }
  }
  return out;
}
