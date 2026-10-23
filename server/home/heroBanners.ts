import { cffiFetch } from '../common/curlCffiFetch';
import { bmsUpcomingUrl, bmsDiscoverHeaders, parseUpcomingCards, resolveBmsRegion } from '../workers/parsers/bookmyshow';
import { fetchVerticalOffers, imageFromAttributes, servableRow, priceOf, pctOf, type OfferRow } from './showcase';
import { log } from '../common/logger';
import { getStore } from '../common/db';

/**
 * HeroBanner slides (owner 23 Oct): the BookMyShow-style dark hero carousel at
 * the top of the home page. MIXED content by design — one slide per vertical
 * (movie, food, e-commerce deal, ...) so the carousel is never a movie-only
 * strip. Every slide is composed from LIVE data (never mock, never fabricated):
 *
 *   1. movie    — BookMyShow upcoming tab (real poster, genres, likes, trailer)
 *   2. food     — newest servable food offer (real dish photo, restaurant, price)
 *   3. ecommerce— the deepest verified discount from the 'Go Big' pool (40%+ off)
 *
 * Admin-authored hero slides (home_banners rows with poster_url set, migration
 * 020) come FIRST in rotation; the live-composed ones follow. If a source is
 * unreachable its slide is honestly skipped (self-healing: next cache window
 * retries).
 */

export interface HeroSlide {
  id: string;
  kind: 'movie' | 'food' | 'ecommerce' | 'custom';
  badge: string;          // PREMIERE / FOOD PICK / MEGA DEAL / admin text
  subheading: string | null; // e.g. "Brand new releases every Friday"
  heading: string;        // big title
  meta: string | null;    // "2h 4m • Comedy, Thriller • U" style line
  language: string | null;
  synopsis: string | null;
  poster: string | null;  // portrait art
  backdrop: string | null; // wide art for the blurred background (falls back to poster)
  cta: string;            // "Watch Trailer" / "Order Now" / "Grab Deal"
  url: string | null;     // external link (masking pointer) — optional
  launch: { vertical: string; query: string } | null; // in-app engine launch
}

const HERO_TTL_MS = 10 * 60_000;
let heroCache: { at: number; slides: HeroSlide[] } | null = null;

const upcomingCache = new Map<string, { at: number; movies: any[] }>();

/** BMS upcoming cards (own cache; mirrors /api/movies/upcoming but default region). */
async function upcomingMovies(): Promise<any[]> {
  const key = 'default';
  const hit = upcomingCache.get(key);
  if (hit && Date.now() - hit.at < 30 * 60_000) return hit.movies;
  const fetchJson = async (url: string) => {
    const r = await cffiFetch(url, { impersonate: 'safari', timeoutMs: 15_000, headers: { Accept: 'application/json' } });
    if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
    return JSON.parse(r.body || '{}');
  };
  const region = await resolveBmsRegion(undefined, fetchJson);
  let r = await cffiFetch(bmsUpcomingUrl(region), { impersonate: 'safari', timeoutMs: 15_000, headers: bmsDiscoverHeaders(region) });
  if (r.status !== 200) r = await cffiFetch(bmsUpcomingUrl(region), { impersonate: 'chrome', timeoutMs: 15_000, headers: bmsDiscoverHeaders(region) });
  if (r.status !== 200) return [];
  const movies = parseUpcomingCards(JSON.parse(r.body || '{}'), region).map((m: any) => ({
    title: m.title, genres: m.genres, likes: m.likes, releaseDate: m.releaseDate, poster: m.poster, pageUrl: m.pageUrl,
    trailerUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent((m.title || '') + ' official trailer')}`,
  }));
  if (movies.length) upcomingCache.set(key, { at: Date.now(), movies });
  return movies;
}

async function movieSlide(): Promise<HeroSlide | null> {
  const movies = await upcomingMovies();
  const m = movies.find((x) => x.poster);
  if (!m) return null;
  const metaBits = [m.genres, m.likes].filter(Boolean).join(' • ') || null;
  return {
    id: `movie-${m.title}`,
    kind: 'movie',
    badge: 'PREMIERE',
    subheading: 'Brand new releases every Friday',
    heading: m.title,
    meta: metaBits,
    language: null,
    synopsis: null, // BMS's upcoming tab carries no plot text — honestly omitted
    poster: m.poster,
    backdrop: m.poster,
    cta: 'Watch Trailer',
    url: m.trailerUrl,
    launch: { vertical: 'movies', query: m.title },
  };
}

async function foodSlide(): Promise<HeroSlide | null> {
  const rows = await fetchVerticalOffers('food', 200);
  const c = rows
    .filter((r: OfferRow) => servableRow(r, 14) && imageFromAttributes(r.attributes))
    .sort((a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime());
  const r = c[0];
  if (!r) return null;
  return {
    id: `food-${r.id}`,
    kind: 'food',
    badge: 'FOOD PICK',
    subheading: 'Fresh dishes from top-rated kitchens near you',
    heading: r.title,
    meta: [r.seller, r.location_city].filter(Boolean).join(' · ') || null,
    language: null,
    synopsis: null,
    poster: imageFromAttributes(r.attributes),
    backdrop: imageFromAttributes(r.attributes),
    cta: 'Order Now',
    url: null,
    launch: { vertical: 'food', query: r.title },
  };
}

async function ecomSlide(): Promise<HeroSlide | null> {
  const rows = await fetchVerticalOffers('ecommerce', 600);
  const c = rows
    .filter((r: OfferRow) => servableRow(r, 14) && imageFromAttributes(r.attributes) && pctOf(r) >= 0.40)
    .sort((a, b) => pctOf(b) - pctOf(a));
  const r = c[0];
  if (!r) return null;
  const price = priceOf(r);
  const pct = Math.round(pctOf(r) * 100);
  return {
    id: `ecom-${r.id}`,
    kind: 'ecommerce',
    badge: 'MEGA DEAL',
    subheading: 'Biggest savings, live-verified prices',
    heading: r.title,
    meta: `${pct}% OFF · now ₹${price.toLocaleString('en-IN')}`,
    language: null,
    synopsis: null,
    poster: imageFromAttributes(r.attributes),
    backdrop: imageFromAttributes(r.attributes),
    cta: 'Grab Deal',
    url: null,
    launch: { vertical: 'ecommerce', query: r.title },
  };
}

/** Admin-authored hero slides (home_banners rows with poster_url, migration 020). */
async function customSlides(): Promise<HeroSlide[]> {
  try {
    const rows = await getStore().query<any>('SELECT * FROM home_banners WHERE poster_url IS NOT NULL AND (is_active = 1)');
    return rows
      .sort((a, z) => (Number(a.position ?? 0) - Number(z.position ?? 0)) || (Number(a.id) - Number(z.id)))
      .map((r) => ({
        id: `custom-${r.id}`,
        kind: 'custom' as const,
        badge: String(r.badge || 'FEATURED'),
        subheading: r.subheading ? String(r.subheading) : null,
        heading: String(r.heading || r.title || 'Featured'),
        meta: r.meta ? String(r.meta) : null,
        language: r.language ? String(r.language) : null,
        synopsis: r.synopsis ? String(r.synopsis) : null,
        poster: String(r.poster_url || ''),
        backdrop: String(r.image_url || r.poster_url || ''),
        cta: String(r.cta || 'Explore'),
        url: /^https?:\/\//.test(String(r.link_url || '')) ? String(r.link_url) : null,
        launch: /^https?:\/\//.test(String(r.link_url || '')) ? null : { vertical: String(r.link_url || 'ecommerce'), query: String(r.heading || r.title || '') },
      }));
  } catch (e) {
    log.debug('HeroBanners', 'custom slides unavailable', { error: String(e).slice(0, 100) });
    return [];
  }
}

export async function buildHeroBanners(): Promise<HeroSlide[]> {
  if (heroCache && Date.now() - heroCache.at < HERO_TTL_MS) return heroCache.slides;
  const [custom, movie, food, ecom] = await Promise.all([
    customSlides().catch(() => [] as HeroSlide[]),
    movieSlide().catch(() => null),
    foodSlide().catch(() => null),
    ecomSlide().catch(() => null),
  ]);
  // Interleave: one movie, one food, one ecom — exactly the owner's mix — then any admin customs on top.
  const live = [movie, food, ecom].filter((s): s is HeroSlide => !!s);
  const slides = [...custom, ...live].slice(0, 8);
  if (slides.length) heroCache = { at: Date.now(), slides };
  return slides;
}
