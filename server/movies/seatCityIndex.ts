/**
 * Which city does a movie SEAT link belong to?
 *
 * District's seat URL carries the session (`encsessionid = cid-sid-mid-cid`) and the
 * contentId, but NOT the city - and the sessions gateway is queried per city. So a stale
 * District link could not be re-resolved to a live session for today (owner 29 Oct: every
 * platform must land on the seat map), because we did not know which city's sessions to ask
 * for.
 *
 * The scrape already knows: gwCityMovieAggregates walks one city's cinemas, so every show it
 * returns is stamped here (fid / cinema id -> city slug). The click-time resolver reads this
 * index first, so a re-resolve costs one gateway call instead of guessing cities.
 */
const byFid = new Map<string, string>();
const byCinema = new Map<string, string>();
const MAX = 5_000;

function trim() {
  // Bounded: a long-running process must not grow this forever. Oldest entries go first.
  for (const map of [byFid, byCinema]) {
    while (map.size > MAX) {
      const first = map.keys().next().value;
      if (first === undefined) break;
      map.delete(first);
    }
  }
}

export function rememberSeatCity(citySlug: string, fid?: string | null, cinemaId?: string | number | null): void {
  const city = String(citySlug || '').trim().toLowerCase();
  if (!city) return;
  if (fid) byFid.set(String(fid).trim().toLowerCase(), city);
  if (cinemaId != null && String(cinemaId).trim()) byCinema.set(String(cinemaId).trim(), city);
  trim();
}

export function lookupSeatCity(fid?: string | null, cinemaId?: string | number | null): string {
  const f = String(fid || '').trim().toLowerCase();
  if (f && byFid.has(f)) return byFid.get(f) as string;
  const c = String(cinemaId || '').trim();
  if (c && byCinema.has(c)) return byCinema.get(c) as string;
  return '';
}
