/**
 * District / TicketNew public consumer gateway client — movies vertical.
 *
 * Both www.district.in and www.ticketnew.com expose the same "gw" consumer mesh
 * (TicketNew is on the merged District/Paytm movies platform). The web app talks
 * to it with a self-generated guest token header — no login, no signing:
 *
 *   x-guest-token: `<ms>_<random18digits>_<random10>`   api_source: district
 *
 * Verified live (Oct 2026, curl_cffi chrome):
 *   GET /gw/consumer/movies/v3/cinemas?city=<slug>            -> data.cinemas[] {id,name,address,cityId}
 *   GET /gw/consumer/movies/v3/cinema?meta=1&reqData=1&cinemaId=<int>
 *        -> pageData.sessions[] {sid, mid, showTime, areas[{label, price, sAvail}]}
 *        -> meta.movies[]  {id(=mid), name, censor, duration, grn}
 *        -> meta.groupedMovies[] {label, contentId, totalSessionCount}
 *   GET /gw/consumer/movies/v1/content/critique?content_id=<int>
 *        -> {reviews[{text, reviewer, dwh_source.name}], ratings[{value, rated_by, dwh_source.rating_base}]}
 *
 * Sessions carry REAL seat prices (area-level, the same prices the seat-selection
 * flow charges). Everything here is acquisition-only data; the deeplink policy is
 * unchanged (offer links to the price-owning platform's own web page).
 */
import { randomBytes } from 'node:crypto';
import { cffiFetch } from '../../common/curlCffiFetch';

export type GwHost = 'district' | 'ticketnew';

export const GW_HOSTS: Record<GwHost, string> = {
  district: 'https://www.district.in',
  ticketnew: 'https://www.ticketnew.com',
};

/** District/TicketNew city slug: "New Delhi" -> "new-delhi". */
export function gwCitySlug(city: string | undefined): string {
  return (city || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Self-generated guest token, same shape the web bundle mints client-side. */
export function gwGuestToken(): string {
  const rnd = (n: number, alphabet: string) =>
    Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  const digits18 = String(Math.floor(Math.random() * 1e18)).padStart(18, '0');
  return `${Date.now()}_${digits18}_${rnd(10, '0123456789abcdefghijklmnopqrstuvwxyz')}`;
}

export function gwHeaders(host: GwHost): Record<string, string> {
  // NOTE: no Origin header — the gateway CORS-rejects cross-origin-looking server calls.
  return {
    Accept: 'application/json',
    Referer: `${GW_HOSTS[host]}/movies`,
    'api_source': 'district',
    'x-app-type': 'ed_web',
    'x-guest-token': gwGuestToken(),
  };
}

/** GET a gw endpoint and parse JSON. Returns null on any non-200/parse failure (honest skip). */
export async function gwJson(host: GwHost, path: string, timeoutMs = 12_000): Promise<any | null> {
  try {
    const res = await cffiFetch(`${GW_HOSTS[host]}${path}`, { headers: gwHeaders(host), timeoutMs });
    if (res.status !== 200) return null;
    return JSON.parse(res.body);
  } catch {
    return null;
  }
}

export interface GwCinema {
  id: number;
  name: string;
}

/** Cinemas for a city slug. Honest empty array when the gateway declines. */
export async function gwCityCinemas(host: GwHost, citySlug: string, timeoutMs = 12_000): Promise<GwCinema[]> {
  if (!citySlug) return [];
  const d = await gwJson(host, `/gw/consumer/movies/v3/cinemas?city=${encodeURIComponent(citySlug)}`, timeoutMs);
  const cinemas: any[] = d?.data?.cinemas || d?.cinemas || [];
  const out: GwCinema[] = [];
  for (const c of cinemas) {
    const id = Number(c?.id);
    const name = String(c?.name || '').trim();
    if (Number.isInteger(id) && name) out.push({ id, name });
  }
  return out;
}

export interface GwAreaPrice {
  label: string;
  price: number;
  avail: number;
}

export interface GwShowtime {
  /** gw cinema id — enables a venue-level deeplink (TicketNew verified live 27 Oct) */
  cinemaId?: number;
  /** show time exactly as the platform states it, e.g. '12:30 PM' — never reformatted/invented */
  time: string;
  theatre: string;
  /** seat-class prices for THIS show (areas are seat classes: Classic/Prime/Recliner...) */
  areas: GwAreaPrice[];
}

export interface GwMovieAgg {
  /** movie ids (mids) that carry this title in the fetched cinema sessions */
  mids: Set<string>;
  title: string;
  minPrice: number;
  maxPrice: number;
  showCount: number;
  theatres: string[];
  /** per-show time + seat-class prices (owner 22 Oct: time and seat-wise pricing on movie cards) */
  shows: GwShowtime[];
  contentId: number | null;
  posterUrl: string | null;
  censor: string | null;
  durationMin: number | null;
  genres: string | null;
}

/**
 * Aggregate REAL seat prices + theatre names for a city: fetch the cinema list, then the
 * sessions of up to `maxCinemas` cinemas (each session's areas carry the live seat prices),
 * and group by movie title.
 */
export async function gwCityMovieAggregates(
  host: GwHost,
  citySlug: string,
  maxCinemas = 10,
  timeoutMs = 12_000,
): Promise<Map<string, GwMovieAgg>> {
  const byTitle = new Map<string, GwMovieAgg>();
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const cinemas = await gwCityCinemas(host, citySlug, timeoutMs);
  for (const cinema of cinemas.slice(0, maxCinemas)) {
    const d = await gwJson(host, `/gw/consumer/movies/v3/cinema?meta=1&reqData=1&cinemaId=${cinema.id}`, timeoutMs);
    if (!d) continue;
    const meta = d?.meta || {};
    const moviesMeta: any[] = meta.movies || [];
    const grouped: any[] = meta.groupedMovies || [];
    const titleByMid = new Map<string, string>();
    for (const mv of moviesMeta) titleByMid.set(String(mv?.id || ''), String(mv?.name || '').trim());
    const contentByTitle = new Map<string, number>();
    for (const g of grouped) {
      const lbl = norm(String(g?.label || ''));
      if (lbl && Number(g?.contentId)) contentByTitle.set(lbl, Number(g.contentId));
    }
    const posterByMid = new Map<string, string>();
    for (const mv of moviesMeta) posterByMid.set(String(mv?.id || ''), String(mv?.appImgPath || '') || '');
    const sessions: any[] = d?.pageData?.sessions || d?.pageData?.showtimes || [];
    for (const ss of sessions) {
      const mid = String(ss?.mid || '');
      const title = titleByMid.get(mid) || '';
      if (!title) continue;
      const key = norm(title);
      if (!key) continue;
      const areas: GwAreaPrice[] = [];
      for (const a of ss?.areas || []) {
        const price = Number(a?.price);
        if (!Number.isFinite(price) || price <= 0) continue; // fixed-price areas only, never invent
        areas.push({ label: String(a?.label || ''), price, avail: Number(a?.sAvail) || 0 });
      }
      if (!areas.length) continue;
      let agg = byTitle.get(key);
      if (!agg) {
        agg = {
          mids: new Set(),
          title,
          minPrice: Infinity,
          maxPrice: 0,
          showCount: 0,
          theatres: [],
          shows: [],
          contentId: null,
          posterUrl: null,
          censor: null,
          durationMin: null,
          genres: null,
        };
        byTitle.set(key, agg);
      }
      agg.mids.add(mid);
      agg.showCount += 1;
      if (!agg.theatres.includes(cinema.name)) agg.theatres.push(cinema.name);
      // per-show time + seat-class prices (cap 8 shows, earliest first per source order)
      if (agg.shows.length < 8) {
        const t = String(ss?.showTime || ss?.showtime || '').trim();
        if (t) agg.shows.push({ time: t, theatre: cinema.name, cinemaId: cinema.id, areas: areas.slice(0, 4) });
      }
      const contentId = contentByTitle.get(key);
      if (contentId && !agg.contentId) agg.contentId = contentId;
      const mvMeta = moviesMeta.find((mv) => String(mv?.id) === mid);
      if (mvMeta) {
        agg.posterUrl = agg.posterUrl || (String(mvMeta?.appImgPath || '') || null);
        agg.censor = agg.censor || (mvMeta?.censor ? String(mvMeta.censor) : null);
        agg.durationMin = agg.durationMin || (Number(mvMeta?.duration) || null);
        agg.genres = agg.genres || (Array.isArray(mvMeta?.grn) ? mvMeta.grn.join(', ') : null);
      }
      for (const a of areas) {
        agg.minPrice = Math.min(agg.minPrice, a.price);
        agg.maxPrice = Math.max(agg.maxPrice, a.price);
      }
    }
  }
  return byTitle;
}

/** Strict-ish title match against an aggregate key (all query tokens present, order-free). */
export function gwMatch(agg: GwMovieAgg, title: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const toks = norm(title).split(' ').filter((t) => t.length > 1);
  if (!toks.length) return false;
  const hay = norm(agg.title);
  return toks.every((t) => hay.includes(t));
}

export interface GwCritique {
  reviews: Array<{ text: string; reviewer: string | null; source: string | null }>;
  ratings: Array<{ value: string; ratedBy: string; base: number | null }>;
}

/** Critic reviews + ratings for a District/TicketNew content id (e.g. groupedMovies.contentId). */
export async function gwCritique(host: GwHost, contentId: number, timeoutMs = 12_000): Promise<GwCritique | null> {
  if (!Number.isInteger(contentId) || contentId <= 0) return null;
  const d = await gwJson(host, `/gw/consumer/movies/v1/content/critique?content_id=${contentId}`, timeoutMs);
  if (!d) return null;
  const out: GwCritique = { reviews: [], ratings: [] };
  for (const r of d?.reviews || []) {
    const text = String(r?.text || '').trim();
    if (!text) continue;
    out.reviews.push({
      text: text.slice(0, 600),
      reviewer: r?.reviewer ? String(r.reviewer) : null,
      source: r?.dwh_source?.name ? String(r.dwh_source.name) : null,
    });
  }
  for (const rr of d?.ratings || []) {
    const value = String(rr?.value || '').trim();
    if (!value) continue;
    out.ratings.push({
      value,
      ratedBy: rr?.rated_by ? String(rr.rated_by) : (rr?.dwh_source?.name ? String(rr.dwh_source.name) : 'Critics'),
      base: Number(rr?.dwh_source?.rating_base) || null,
    });
  }
  return out.reviews.length || out.ratings.length ? out : null;
}

/** Extract a YouTube trailer URL from a District movie page body (SSR-embedded). */
export function extractTrailerUrl(body: string): string | null {
  const re = /https:\/\/www\.youtube\.com\/(?:embed\/|watch\?v=|live\/)([\w-]{6,20})/g;
  let m: RegExpExecArray | null;
  const skip = /trailer-page|\/channel|\/embed\/videoseries/i;
  while ((m = re.exec(body)) !== null) {
    const win = body.slice(Math.max(0, m.index - 80), m.index + 120);
    if (skip.test(win)) continue;
    if (/trailer|promo|teaser/i.test(win)) return `https://www.youtube.com/watch?v=${m[1]}`;
  }
  return null;
}
