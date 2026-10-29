/**
 * Movie exits must land on a page that is still selling (owner 29 Oct, screenshots: our
 * redirect opened BookMyShow's "Sorry! Booking is now closed — the booking window for this
 * show has closed", while the wanted destination is the seat-selection screen).
 *
 * Why it happened: a movie row stores the showtime/seat URL captured during a scrape. Those
 * URLs carry the scrape's DATE in them (BMS `/buytickets/{code}/{YYYYMMDD}`, District
 * `?fromdate=YYYY-MM-DD&encsessionid=…`, TicketNew `…/{yyyymmdd}`), and some carry a
 * per-show session id that the platform retires. A row scraped yesterday, or a session from
 * a window that has since closed, therefore lands on "booking closed" even though the movie
 * is still running.
 *
 * The fix is at CLICK time (this runs for every exit through /api/out), not at scrape time:
 * the destination date is rewritten to the show date the user can actually buy - today in
 * India, or tomorrow once today's last shows have closed - and a session id that belongs to
 * an older date is dropped instead of being replayed (a stale session is precisely what makes
 * BookMyShow say the window has closed; the platform's own showtime page then offers the live
 * sessions, which lead to the seat screen).
 *
 * Nothing is invented: the platform, the movie code and the venue are kept exactly as the row
 * carried them; only the buy-date (and a dead session) changes.
 */

const MOVIE_HOSTS = [
  'in.bookmyshow.com',
  'bookmyshow.com',
  'www.district.in',
  'district.in',
  'www.ticketnew.com',
  'ticketnew.com',
  'www.cinepolisindia.com',
  'cinepolisindia.com',
  'www.pvrcinemas.com',
  'pvrcinemas.com',
  'paytm.com',
];

const IST_OFFSET_MS = (5 * 60 + 30) * 60_000;

/** Indian date parts for "when can the user still buy a ticket". */
export function movieShowDate(now: Date = new Date()): { iso: string; compact: string } {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  // After 22:00 IST almost every cinema has closed its counters for the day, so a "today"
  // link opens on the closed-window screen. Roll to tomorrow instead.
  const late = ist.getUTCHours() >= 22;
  if (late) ist.setUTCDate(ist.getUTCDate() + 1);
  const iso = ist.toISOString().slice(0, 10);
  return { iso, compact: iso.replace(/-/g, '') };
}

export function isMovieDestination(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (!MOVIE_HOSTS.includes(host)) return false;
    // paytm.com is only a movie destination on its /movies path.
    if (host === 'paytm.com' && !/^\/movies?\//.test(new URL(url).pathname)) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Rewrite a movie destination so it opens on a bookable date, and drop a session that belongs
 * to a different day. Anything not recognised is returned untouched.
 */
export function refreshMovieDestination(destination: string, now: Date = new Date()): string {
  if (!destination || !isMovieDestination(destination)) return destination;
  const { iso, compact } = movieShowDate(now);
  let url: URL;
  try { url = new URL(destination); } catch { return destination; }
  const host = url.hostname.toLowerCase();
  let changed = false;

  // --- BookMyShow -----------------------------------------------------------
  if (host.endsWith('bookmyshow.com')) {
    // /movies/{region}/{slug}/buytickets/{ET code}/{YYYYMMDD}
    const buy = /^(.*\/buytickets\/[^/]+)\/(\d{8})\/?$/.exec(url.pathname);
    if (buy) {
      url.pathname = `${buy[1]}/${compact}`;
      changed = true;
    }
    // A retired seat-layout session (/booking/{sessionId}?…) cannot be resurrected; send the
    // user to the same movie's showtime page, which lists the live sessions that DO open the
    // seat map, rather than a screen that says the window has closed.
    if (/^\/booking\//.test(url.pathname)) {
      const code = url.searchParams.get('code') || url.searchParams.get('etCode') || '';
      const region = url.searchParams.get('region') || '';
      const slug = url.searchParams.get('slug') || '';
      if (code && region && slug) {
        url.pathname = `/movies/${region}/${slug}/buytickets/${code}/${compact}`;
        url.search = '';
      } else {
        return destination;
      }
      changed = true;
    }
  }

  // --- District (Zomato) ----------------------------------------------------
  if (host.endsWith('district.in')) {
    const from = url.searchParams.get('fromdate');
    if (from && from !== iso) {
      url.searchParams.set('fromdate', iso);
      // The session id is bound to the date it was captured for.
      url.searchParams.delete('encsessionid');
      url.searchParams.delete('fromsessions');
      changed = true;
    } else if (!from) {
      url.searchParams.set('fromdate', iso);
      changed = true;
    }
    // A seat-layout path without a live session opens the show list; that is the honest page.
  }

  // --- TicketNew ------------------------------------------------------------
  if (host.endsWith('ticketnew.com')) {
    const next = url.pathname.replace(/(\/)(\d{8})(?=\/|$)/, `$1${compact}`);
    if (next !== url.pathname) { url.pathname = next; changed = true; }
    for (const key of ['date', 'showdate', 'fromdate']) {
      const v = url.searchParams.get(key);
      if (!v) continue;
      const normalized = /^\d{8}$/.test(v) ? compact : iso;
      if (v !== normalized) { url.searchParams.set(key, normalized); changed = true; }
    }
  }

  // --- Cinepolis / PVR / Paytm ---------------------------------------------
  if (host.endsWith('cinepolisindia.com') || host.endsWith('pvrcinemas.com') || host === 'paytm.com') {
    for (const key of ['date', 'showdate', 'fromdate', 'bookingdate']) {
      const v = url.searchParams.get(key);
      if (!v) continue;
      const normalized = /^\d{8}$/.test(v) ? compact : iso;
      if (v !== normalized) { url.searchParams.set(key, normalized); changed = true; }
    }
  }

  return changed ? url.toString() : destination;
}
