/**
 * Movie SEAT-BOOKING deeplinks (owner 28 Oct: "movies se redirection aap uss movies ke
 * seat booking tak le jaye jiska price dikhta hai humari site pr, abhi wo uss page pr le
 * jata hai jaha cinema hall aata hai, uske karan jo cinema cheapest hota hai user ko samaj
 * nahi aata").
 *
 * Our movie prices are real area-level seat prices read from the District/TicketNew public
 * sessions gateway. Until now the CTA dropped the user on the movie's cinema LIST (or the
 * movie page), so the ₹149 they clicked was nowhere in sight and the cheapest hall was
 * impossible to find. This builds the link for THAT show instead.
 *
 * LIVE-VERIFIED 28 Oct (curl_cffi chrome, from the real payload + the platforms' own
 * URL builder `getSeatLayoutUrl` / cinema route in the ticketnew-web bundle):
 *
 *   encsessionid = `${cid}-${sid}-${mid.toLowerCase()}-${entityDataCode}`
 *   (bundle: e.encSessionId = [e.cid, e.sid, e.mid.toLowerCase(), entityDataCode].join('-'))
 *
 *   TicketNew (SSR, richest page - the one we verified):
 *     https://ticketnew.com/movies/{city}/{cinema-slug}-c/{cinemaId}
 *        ?fromdate=YYYY-MM-DD&encsessionid=<enc>&freeseating=false
 *        &fromsessions=true&contentid=<contentId>
 *     -> HTTP 200, 225 KB, that cinema + that show, seat classes CLUB / SUPER PLATINUM
 *        with their prices and the session id present in the page. The slug segment is
 *        cosmetic (a made-up slug resolves identically); the cinema id is what counts.
 *
 *   District (same mesh, its own Next route - 200 verified):
 *     https://www.district.in/movies/seat-layout/{fid}
 *        ?fromdate=YYYY-MM-DD&encsessionid=<enc>&freeseating=false
 *        &fromsessions=true&type=movies&contentid=<contentId>
 *     District has NO cinema route (/movies/{city}/{slug}/-c/{id} 404s), so its cinema
 *     page links stay honest-empty and the seat-layout route is used instead.
 *
 * BookMyShow: its venue-level + session-level links need BMS's own venue code and session
 * id, which only come from its quickbook API - edge-blocked (Akamai) for this host, and a
 * guessed URL would be a dead link for the user. BMS rows therefore carry the seat link of
 * the show whose price we actually display (the mesh publishes it), labelled with the
 * platform that owns that link. No invented URLs, ever.
 */
import type { GwHost } from '../workers/parsers/districtGw';

export interface SeatCtx {
  /** gw host that published the session (district | ticketnew) */
  host?: GwHost | string;
  city?: string;
  cinemaId?: number | string;
  cinemaName?: string;
  /** session id */
  sid?: number | string;
  /** movie id inside the session (e.g. "OBCDF3") */
  mid?: string;
  /** cinema id as the sessions payload states it (== cinemaId) */
  cid?: number | string;
  /** gw contentId for the movie — carries language/poster context on the page */
  contentId?: number | string;
  /** show date, YYYY-MM-DD (IST) */
  dateISO?: string;
  /** session format id (fid), used by District's seat-layout route */
  fid?: string;
}

/** Same slug the platforms use for city / cinema name paths. */
export function slugPath(s: string | undefined): string {
  return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function istDateISO(now: Date = new Date()): string {
  return new Date(now.getTime() + (5 * 60 + 30) * 60_000).toISOString().slice(0, 10);
}

/**
 * The `encsessionid` the platforms themselves compute client-side. Returns '' when any
 * part is missing — a partial id would land the user on the cinema page, not the seat map.
 */
export function encSessionId(ctx: SeatCtx): string {
  const cid = String(ctx.cid ?? ctx.cinemaId ?? '').trim();
  const sid = String(ctx.sid ?? '').trim();
  const mid = String(ctx.mid ?? '').trim();
  if (!cid || !sid || !mid) return '';
  return `${cid}-${sid}-${mid.toLowerCase()}-${cid}`;
}

/**
 * Deep link to the seat booking of ONE specific show, or '' when the session identifiers
 * needed for it are missing (never a link that silently degrades to a cinema list).
 */
export function movieSeatLink(ctx: SeatCtx): string {
  const enc = encSessionId(ctx);
  if (!enc) return '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(ctx.dateISO || '')) ? String(ctx.dateISO) : istDateISO();
  const contentId = String(ctx.contentId ?? '').trim();
  const host = String(ctx.host || 'district').toLowerCase();
  const q = [
    `fromdate=${date}`,
    `encsessionid=${encodeURIComponent(enc)}`,
    'freeseating=false',
    'fromsessions=true',
  ];
  if (host.includes('ticketnew')) {
    const city = slugPath(ctx.city);
    const cid = String(ctx.cid ?? ctx.cinemaId ?? '').trim();
    if (!city || !cid) return '';
    const slug = slugPath(ctx.cinemaName) || 'cinema';
    if (contentId) q.push(`contentid=${contentId}`);
    return `https://ticketnew.com/movies/${city}/${slug}-c/${cid}?${q.join('&')}`;
  }
  // District: same mesh, seat-layout route (no cinema route exists there).
  const fid = String(ctx.fid || '').trim();
  if (!fid) {
    // Without fid District cannot address the show; the TicketNew surface serves the same
    // session ids, so fall back to it rather than to a dead or list-level page.
    return movieSeatLink({ ...ctx, host: 'ticketnew' });
  }
  q.push('type=movies');
  if (contentId) q.push(`contentid=${contentId}`);
  return `https://www.district.in/movies/seat-layout/${encodeURIComponent(fid)}?${q.join('&')}`;
}

/** Human label for the platform that owns a seat link, for the honest CTA copy. */
export function seatLinkPlatform(url: string): string {
  if (/ticketnew\.com/.test(url)) return 'TicketNew';
  if (/district\.in/.test(url)) return 'District';
  return '';
}

export interface CheapestShow {
  theatre: string;
  time: string;
  /** cheapest seat class of this show, e.g. 'CLUB' */
  seatClass: string;
  price: number;
  url: string;
  platform: string;
}

/**
 * Pick the show whose cheapest seat is the lowest in the city and hand back everything the
 * card needs to say "cheapest: ₹149 CLUB · Miraj Cinemas, 11:15 AM" and to link straight to
 * that seat map. Rows without session ids still return the name/time/price (no url).
 */
export function cheapestShow(
  shows: Array<{ time: string; theatre: string; cinemaId?: number; sid?: string; fid?: string; mid?: string; contentId?: number | null; areas?: Array<{ label: string; price: number }> }>,
  base: { host?: GwHost | string; city?: string; dateISO?: string; contentId?: number | null },
): CheapestShow | null {
  let best: CheapestShow | null = null;
  for (const sh of shows || []) {
    const areas = (sh.areas || []).filter((a) => Number(a?.price) > 0);
    if (!areas.length) continue;
    const cheapestArea = areas.reduce((a, b) => (Number(a.price) <= Number(b.price) ? a : b));
    const price = Number(cheapestArea.price);
    if (!Number.isFinite(price) || price <= 0) continue;
    if (best && best.price <= price) continue;
    const url = movieSeatLink({
      host: base.host,
      city: base.city,
      cinemaId: sh.cinemaId,
      cinemaName: sh.theatre,
      sid: sh.sid,
      mid: sh.mid,
      cid: sh.cinemaId,
      fid: sh.fid,
      contentId: sh.contentId ?? base.contentId ?? undefined,
      dateISO: base.dateISO,
    });
    best = {
      theatre: String(sh.theatre || ''),
      time: String(sh.time || ''),
      seatClass: String(cheapestArea.label || ''),
      price,
      url,
      platform: seatLinkPlatform(url),
    };
  }
  return best;
}
