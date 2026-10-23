/**
 * Cinepolis India parser (browserless reverse engineering, movies vertical).
 *
 * Cinepolis India (cinepolisindia.com) is a Next.js SPA. The listing page
 *   GET https://cinepolisindia.com/movie-list/{cityKey}
 * server-renders pageProps.comingSoonMoviesData[] (city-independent) into
 * __NEXT_DATA__; nowPlayingMoviesData stays {} on that route.
 *
 * Owner 23 Oct upgrade (live-verified same day): the site's own JSON API
 *   GET {API}/movies/cities?all=all          -> city_id list (Delhi=9 ... Mumbai=15, Jaipur=24)
 *   GET {API}/movies/now-playing/?city_id=X  -> city-wise now-showing movies
 *     (headers city_id + Origin/Referer, guest access, no auth) with images
 *     served from api_new.cinepolisindia.com/uploads/... (HTTP 200 verified).
 * The API list is richer than the SSR page (rating, format, cast, cinema ids),
 * so the worker now prefers it and only falls back to the SSR scrape.
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
export const CINEPOLIS_API_BASE = 'https://api_new.cinepolisindia.com/api';

/** Guest JSON API headers the Next.js client itself sends (live-verified 23 Oct). */
export const CINEPOLIS_API_HEADERS: Record<string, string> = {
  Accept: 'application/json',
  Origin: 'https://cinepolisindia.com',
  Referer: 'https://cinepolisindia.com/',
};

const normName = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Module cache of city_name -> city_id (24h TTL, self-healing on fetch failure). */
let cinepolisCitiesCache: { at: number; map: Map<string, number> } | null = null;
export const CINEPOLIS_CITIES_TTL_MS = 24 * 60 * 60 * 1000;

/** Parse the /movies/cities payload into a normalized name -> id map. */
export function parseCinepolisCities(json: any): Map<string, number> {
  const map = new Map<string, number>();
  const rows = json?.data;
  if (!Array.isArray(rows)) return map;
  for (const r of rows) {
    const id = Number(r?.city_id);
    const name = String(r?.city_name || '').trim();
    if (Number.isFinite(id) && id > 0 && name) map.set(normName(name), id);
  }
  return map;
}

/** Resolve a user city (any casing/spelling) to a Cinepolis city id. */
export function cinepolisCityIdFor(map: Map<string, number>, city: string | undefined): number | null {
  const c = normName(String(city || ''));
  if (!c) return null;
  if (map.has(c)) return map.get(c)!;
  // tolerate suffixes like "new mumbai" -> "mumbai" handled below via contains match
  for (const [name, id] of map) if (name.includes(c) || c.includes(name)) return id;
  return null;
}

/**
 * Normalize one /movies/now-playing row to the CinepolisMovie shape used by
 * parseCinepolisMovies (plus rating/format/cast carried through).
 */
export function normalizeNowPlayingRow(mv: any): CinepolisMovie & { rating?: string; format?: string; cast?: string; cinema_ids?: string; sessions_count?: number; is_coming_soon?: any } {
  return {
    Title: String(mv?.Title || mv?.movie_title || '').trim(),
    movie_id: mv?.ID || mv?.movie_id,
    movie_lang: mv?.movie_lang || null,
    m_movie_genre_name: mv?.m_movie_genre_name || null,
    run_time: typeof mv?.RunTime === 'number' ? mv.RunTime : (typeof mv?.run_time === 'number' ? mv.run_time : null),
    movie_release_date: mv?.movie_release_date || null,
    movie_trailer: mv?.movie_trailer && mv.movie_trailer !== 'NA' ? mv.movie_trailer : null,
    movie_image_url_1: mv?.movie_image_url_1 || null,
    movie_image_url_2: mv?.movie_image_url_2 || null,
    rating: mv?.rating || null,
    format: mv?.m_movie_format_name || null,
    cast: mv?.movie_cast || null,
    cinema_ids: typeof mv?.cinemaIdSessions === 'string' ? mv.cinemaIdSessions : null,
    sessions_count: typeof mv?.sessions_count === 'number' ? mv.sessions_count : null,
    is_coming_soon: mv?.is_coming_soon,
  };
}

/**
 * Split a now-playing API list into now-showing vs coming-soon.
 * Live-verified 23 Oct: the site's is_coming_soon flag is USELESS (every row
 * ships "Y", even day-of releases with live sessions), so availability is
 * derived honestly from the release date: released (today or earlier) is
 * now-showing; a future date is upcoming (with an advance-booking note when
 * sessions already exist). Unknown dates stay now-showing only when the row
 * carries bookable sessions.
 */
export function splitNowPlaying(rows: any[], today = new Date()): { nowPlaying: CinepolisMovie[]; comingSoon: CinepolisMovie[] } {
  const nowPlaying: CinepolisMovie[] = [];
  const comingSoon: CinepolisMovie[] = [];
  const todayIso = today.toISOString().slice(0, 10);
  for (const raw of Array.isArray(rows) ? rows : []) {
    if (!raw || typeof raw.Title !== 'string' || !raw.Title.trim()) continue;
    const mv = normalizeNowPlayingRow(raw);
    const rel = raw?.movie_release_date ? String(raw.movie_release_date).slice(0, 10) : '';
    const sessions = Number(raw?.sessions_count) || 0;
    if (!rel) {
      if (sessions > 0) nowPlaying.push(mv); else comingSoon.push(mv);
      continue;
    }
    if (rel <= todayIso) nowPlaying.push(mv);
    else { (mv as any).advance_booking = sessions > 0 ? 'Advance booking open on Cinepolis India' : null; comingSoon.push(mv); }
  }
  return { nowPlaying, comingSoon };
}

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
      const apiMv = mv as any;
      const attrs: Record<string, any> = {
        image_url: img ? encodeURI(String(img)) : null,
        language: mv.movie_lang || null,
        genres: mv.m_movie_genre_name || null,
        duration_min: typeof mv.run_time === 'number' ? mv.run_time : null,
        trailer_url: mv.movie_trailer && mv.movie_trailer !== 'NA' ? mv.movie_trailer : null,
        release_date: release,
        availability: g.availability,
        data_note: g.note,
        // API-path extras (now-playing rows carry them; SSR rows stay null)
        rating: apiMv.rating || null,
        format: apiMv.format || null,
        cast: apiMv.cast || null,
        cinema_count: apiMv.cinema_ids ? String(apiMv.cinema_ids).split(',').filter(Boolean).length : null,
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
