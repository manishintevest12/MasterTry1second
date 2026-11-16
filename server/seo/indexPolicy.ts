/**
 * INDEX POLICY: which templated pages deserve to be in Google's index.
 *
 * OWNER 16 Nov (Search Console on www.try1second.com): 1,449 pages "Discovered / Crawled - currently not
 * indexed", plus 2 Soft 404 and 2 Not found. Measured cause, not a guess:
 *   - 88% of the 6,716 sitemap URLs are templated: 3,258 /nearby/<category>/<city> and 2,620 /<vertical>/<city>.
 *   - Two /hotels/<city> pages, once the city name is masked, are 99% identical text (the same 3 sentences and
 *     the same 2-question FAQ). Only 2 of 70 sampled city pages carried any unique data at all.
 *   - ~55% of sampled /nearby city pages rendered "this page lists nothing" with HTTP 200: a Soft 404.
 * When Google sees thousands of near-identical thin pages it stops spending crawl budget on the whole directory,
 * including the good pages. The remedy is not to hide the problem, it is to index only what has substance.
 *
 * A page is indexable when it can honestly say something a sibling page cannot:
 *   1. a top metro (real demand, and the pages we put real work into);
 *   2. a city with hand-written local content (the movie-city corpus);
 *   3. any non-city page (hubs, routes, guides, answers, products) - those are not part of this template farm.
 * Everything else stays reachable for visitors and links, but is `noindex, follow` and absent from the sitemap.
 * It re-enters the moment it earns real content: add the city to the corpus below and it flips automatically.
 */
import { MOVIE_CITY_CONTENT } from './movieCities';

/** Cities that always get an index slot: the metros the product is actually used in. */
export const INDEXABLE_METROS = new Set([
  'mumbai', 'delhi', 'bengaluru', 'hyderabad', 'chennai', 'kolkata', 'pune', 'ahmedabad',
  'jaipur', 'lucknow', 'indore', 'bhopal', 'chandigarh', 'surat', 'nagpur', 'kochi', 'noida', 'gurugram', 'goa',
]);

/** The five verticals whose /<vertical>/<city> pages are generated for ~524 cities from one template. */
export const TEMPLATED_CITY_VERTICALS = new Set(['hotels', 'cabs', 'grocery', 'food', 'movies']);

/** Is this a /<vertical>/<city> page from the templated family? */
export function isTemplatedCityPath(path: string): boolean {
  const segs = String(path || '').split('?')[0].split('/').filter(Boolean);
  return segs.length === 2 && TEMPLATED_CITY_VERTICALS.has(segs[0]);
}

/** True when the page has enough of its own substance to deserve an index slot. */
export function isIndexableCityPage(path: string): boolean {
  if (!isTemplatedCityPath(path)) return true; // not part of the template farm
  const [vertical, city] = String(path).split('?')[0].split('/').filter(Boolean);
  if (INDEXABLE_METROS.has(city)) return true;
  if (vertical === 'movies' && MOVIE_CITY_CONTENT[city]) return true;
  return false;
}
