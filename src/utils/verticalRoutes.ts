/**
 * Canonical URL paths for the comparison verticals (owner 28 Oct) and for Home
 * (owner 29 Oct).
 *
 * WHY THIS FILE EXISTS
 * The vertical switch used to write the address bar inline inside AppContext, and
 * Home had no entry at all — so `ecommerce` -> `Home` (top nav, bottom bar or the
 * logo) changed the visible screen but left the URL sitting on `/ecommerce`. The
 * link could not be shared as Home, Back sent the visitor into the vertical again,
 * and the browser tab contradicted what was on screen.
 *
 * One map, used by both the writer (vertical/tab switch) and the reader (popstate,
 * deep link restore), so the two can never drift apart again.
 */

/** vertical id -> canonical path */
export const VERTICAL_PATHS: Record<string, string> = {
  flights: '/flights',
  hotels: '/hotels',
  bus: '/bus',
  ecommerce: '/ecommerce',
  grocery: '/grocery',
  food: '/food',
  movie: '/movies',
  loans: '/loans',
  insurance: '/insurance',
  creditcards: '/credit-cards',
  account: '/bank-accounts',
  cab: '/cabs',
  banking: '/banking',
};

/** The Home screen lives at the site root. */
export const HOME_PATH = '/';

/** Trim trailing slashes so `/ecommerce/` and `/ecommerce` compare equal. */
export function normalizePath(pathname: string): string {
  const clean = (pathname || '').trim();
  if (!clean) return HOME_PATH;
  const trimmed = clean.replace(/\/+$/, '');
  return trimmed || HOME_PATH;
}

/** The canonical path for a vertical, or null when the id has no page of its own. */
export function verticalPathFor(verticalId: string): string | null {
  return VERTICAL_PATHS[String(verticalId)] || null;
}

/** Is this pathname one of the comparison vertical pages? */
export function isVerticalPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return Object.values(VERTICAL_PATHS).includes(path);
}

/** Is this pathname the product comparison page (/product/<slug>)? */
export function isProductPath(pathname: string): boolean {
  return /^\/product\/[a-z0-9-]{3,80}$/.test(normalizePath(pathname));
}

/**
 * The path Home should write when the visitor leaves a vertical/product page.
 * Returns null when the current URL is already Home, or when the visitor is on a
 * private admin/merchant screen (those routes own their own URL and must not be
 * rewritten by a tab click).
 */
export function homePathFrom(currentPathname: string): string | null {
  const current = normalizePath(currentPathname);
  if (current === HOME_PATH) return null;
  if (/admin|merchant/.test(current)) return null;
  if (isVerticalPath(current) || isProductPath(current)) return HOME_PATH;
  return null;
}
