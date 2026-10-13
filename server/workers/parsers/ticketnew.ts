/**
 * TicketNew parser (browserless reverse engineering, movies vertical).
 *
 * TicketNew (a Zomato/District group company — images ride b.zmtcdn.com) renders
 * server-side Next.js pages with an embedded __NEXT_DATA__ payload:
 *   GET https://www.ticketnew.com/movies/{cityKey}
 *     → props.pageProps.data.serverState.currentlyRunningMovies.{cityKey}.data.movies[]
 *        fields: name, lang, grn[] (genres), censor, duration, appImgPath,
 *                totalSessionCount, id
 *   movie deeplink pattern (verified): https://www.ticketnew.com/{cityKey}/movies/{slug}
 *   transport: curl_cffi chrome TLS impersonation (Next.js edge tolerates it; Node
 *   undici also works but the bridge keeps fingerprinting uniform).
 *
 * Honesty: the listing payload has no ticket price (prices appear in the seat
 * selection flow). We emit price-less discovery offers with the real deeplink and
 * real artwork; NEVER invent a price. Strict token matching: only movies whose
 * title contains every query token survive (owner mandate).
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';
import { matchesQuery } from './bookmyshow';

export const TICKETNEW_BASE = 'https://www.ticketnew.com';

/** Common city-key aliases: user city → TicketNew pCityKey candidates. */
const CITY_ALIASES: Record<string, string[]> = {
  bengaluru: ['bengaluru', 'bangalore'],
  bangalore: ['bangalore', 'bengaluru'],
  mumbai: ['mumbai'],
  delhi: ['delhi', 'new-delhi'],
  'new delhi': ['new-delhi', 'delhi'],
  ncr: ['delhi', 'ncr'],
  hyderabad: ['hyderabad'],
  chennai: ['chennai'],
  kolkata: ['kolkata'],
  pune: ['pune'],
  ahmedabad: ['ahmedabad'],
  kochi: ['kochi'],
  coimbatore: ['coimbatore'],
  madurai: ['madurai'],
  jaipur: ['jaipur'],
  lucknow: ['lucknow'],
};

export function ticketnewCityKeys(city: string | undefined): string[] {
  const c = (city || '').toLowerCase().trim().replace(/\s+/g, '-');
  if (!c) return [];
  return CITY_ALIASES[c] || [c];
}

export function ticketnewSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export interface TicketNewMovie {
  name?: string;
  lang?: string;
  grn?: string[];
  censor?: string;
  duration?: number;
  appImgPath?: string;
  totalSessionCount?: number;
  id?: string;
}

/** Extract the currently-running movie list from a TicketNew Next.js listing page body. */
export function parseTicketNewMoviesPage(body: string, cityKey: string): TicketNewMovie[] {
  const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(body);
  if (!m) return [];
  let d: any;
  try {
    d = JSON.parse(m[1]);
  } catch {
    return [];
  }
  const serverState = d?.props?.pageProps?.data?.serverState;
  const running = serverState?.currentlyRunningMovies;
  const entry = running?.[cityKey] || Object.values(running || {})[0] as any;
  const movies: any[] = entry?.data?.movies || [];
  return movies.filter((mv) => mv && typeof mv.name === 'string' && mv.name.length > 0);
}

/** Movies → raw offers. `queryTerm` may be '' (browse) — then the whole now-showing list is relevant. */
export function parseTicketNewMovies(
  movies: TicketNewMovie[],
  source: SourceConfig,
  cityKey: string,
  queryTerm: string,
): RawSourceItem[] {
  const out: RawSourceItem[] = [];
  for (const mv of movies.slice(0, 25)) {
    const title = String(mv.name || '').trim();
    if (!title) continue;
    if (queryTerm && !matchesQuery(title, queryTerm)) continue; // strict, no fuzzy substitutes
    const slug = ticketnewSlug(title);
    const attrs: Record<string, any> = {
      image_url: mv.appImgPath ? String(mv.appImgPath) : null,
      language: mv.lang || null,
      genres: Array.isArray(mv.grn) ? mv.grn.join(', ') : null,
      certification: mv.censor || null,
      duration_min: typeof mv.duration === 'number' ? mv.duration : null,
      sessions_today: typeof mv.totalSessionCount === 'number' ? mv.totalSessionCount : null,
      data_note: 'Now-showing discovery from TicketNew; ticket price appears in the seat-selection flow',
    };
    out.push(newRawItem(source, {
      title,
      seller: 'TicketNew',
      sellerUrl: slug ? `${TICKETNEW_BASE}/${cityKey}/movies/${slug}` : `${TICKETNEW_BASE}/movies/${cityKey}`,
      currency: 'INR',
      attributes: attrs,
      evidence: {
        sourceUrl: `${TICKETNEW_BASE}/movies/${cityKey}`,
        sourceReference: String(mv.id || ''),
        extractedFields: ['title', 'language', 'genres', 'certification', 'duration', 'sessions', 'image'],
      },
    }));
  }
  return out;
}
