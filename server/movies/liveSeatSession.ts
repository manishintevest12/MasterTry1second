/**
 * Seat-level exits for EVERY movie platform (owner 29 Oct: "sirf bookmyshow hi nahi, ticketnew,
 * district sb pr aisa hi kro" — after our own date rewrite made District/TicketNew *worse* by
 * dropping a session that belonged to another day, which landed the user on a cinema list).
 *
 * The platforms address a seat map by a session: `encsessionid = cid-sid-mid-cid` (verified
 * 28 Oct in server/affiliate/movieSeatLink.ts). A session belongs to ONE show on ONE day, so a
 * link captured yesterday can never open today's seat map — the session has to be resolved for
 * the day the user is actually buying for, at click time.
 *
 * This module does exactly that and nothing more:
 *   1. the destination is a District/TicketNew seat link -> resolve a LIVE session for the
 *      target date (today IST, or tomorrow once today's counters close) from the same public
 *      sessions gateway our price rows come from, picking that same cinema and the earliest
 *      show that has not started, then rebuild the seat URL;
 *   2. a session that is already for the target date and still upcoming is kept untouched (no
 *      extra round-trip, no needless churn);
 *   3. if resolution fails for any reason the date-corrected fallback from
 *      freshMovieLink.ts is used, so the exit never becomes a dead link.
 *
 * BookMyShow is deliberately different: its seat session only comes from an Akamai-gated API we
 * cannot call, so a BMS link stays the movie's own live showtime page (dated correctly) - the
 * page that leads to its seat screen. Nothing is invented for any platform.
 */
import { gwCityMovieAggregates, gwCitySlug, type GwHost } from '../workers/parsers/districtGw';
import { movieSeatLink } from '../affiliate/movieSeatLink';
import { movieShowDate, refreshMovieDestination } from './freshMovieLink';
import { lookupSeatCity } from './seatCityIndex';

const IST_OFFSET_MS = (5 * 60 + 30) * 60_000;

interface SeatDestination {
  host: GwHost;
  city: string;
  cinemaId: string;
  contentId: string;
  sid: string;
  mid: string;
  fid: string;
  dateISO: string;
}

/** Pull the session identifying parts out of a District / TicketNew seat URL. */
export function parseSeatDestination(url: string): SeatDestination | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.toLowerCase();
  const isTn = host.endsWith('ticketnew.com');
  const isDistrict = host.endsWith('district.in');
  if (!isTn && !isDistrict) return null;
  const enc = u.searchParams.get('encsessionid') || '';
  const [cid = '', sid = '', mid = ''] = enc.split('-');
  let city = '';
  let cinemaId = cid;
  let fid = '';
  if (isTn) {
    // /movies/{city}/{cinema-slug}-c/{cinemaId}
    const seg = u.pathname.split('/').filter(Boolean);
    city = seg[0] === 'movies' ? (seg[1] || '') : (seg[0] || '');
    const cIdx = seg.findIndex((x) => /-c$/.test(x));
    if (cIdx >= 0) cinemaId = seg[cIdx + 1] || cid;
  } else {
    // /movies/seat-layout/{fid}
    const seg = u.pathname.split('/').filter(Boolean);
    fid = seg[seg.length - 1] || '';
  }
  if (!sid || !cid) return null;
  return {
    host: isTn ? 'ticketnew' : 'district',
    city,
    cinemaId: String(cinemaId),
    contentId: String(u.searchParams.get('contentid') || ''),
    sid: String(sid),
    mid: String(mid),
    fid,
    dateISO: String(u.searchParams.get('fromdate') || ''),
  };
}

/** '12:30 PM' -> minutes since IST midnight (null when unparseable). */
function timeToMinutes(t: string): number | null {
  // The gateway states show times as an IST datetime ("2026-10-29T09:00"); the platforms show
  // them as "9:00 AM". Both must be read, or every show looks unparseable and the resolver
  // wrongly falls back to a list page.
  const iso = /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})/.exec(String(t || '').trim());
  if (iso) return Number(iso[1]) * 60 + Number(iso[2]);
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(String(t || '').trim());
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = (m[3] || '').toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

function istMinutesNow(now: Date): number {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

/**
 * The gateway stamps sessions in UTC, not IST: `showTime: '2026-10-29T17:15'` is the show
 * District itself renders as 10:45 PM. 29 Oct e2e render of that session showed 10:45 PM on the
 * platform's seat page, so every comparison below happens on the IST clock after this shift.
 * Returns null for anything that is not a full datetime stamp.
 */
function stampToIst(stamp: string | undefined): { dateISO: string; minutes: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(stamp || ''));
  if (!m) return null;
  const utcMs = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  const ist = new Date(utcMs + IST_OFFSET_MS);
  return {
    dateISO: ist.toISOString().slice(0, 10),
    minutes: ist.getUTCHours() * 60 + ist.getUTCMinutes(),
  };
}

/**
 * A counter shuts BEFORE the show starts, so "has not started yet" is not the same as "can still
 * buy". 29 Oct owner screenshots: the resolver picked the earliest not-yet-started show, which is
 * exactly the show whose window had just closed, and District answered "Sorry! Booking is now
 * closed". Only shows with real head-room and free seats are candidates now.
 */
const BOOKING_HEADROOM_MIN = 25;

// City aggregates cost a handful of gateway calls, so they are shared for a few minutes: a
// burst of clicks on the same city's movies must not fan out into a scrape each time.
const AGG_TTL_MS = 5 * 60_000;
const aggCache = new Map<string, { at: number; value: Awaited<ReturnType<typeof gwCityMovieAggregates>> }>();

async function cityAggregates(host: GwHost, citySlug: string) {
  const key = `${host}|${citySlug}`;
  const hit = aggCache.get(key);
  if (hit && Date.now() - hit.at < AGG_TTL_MS) return hit.value;
  const value = await gwCityMovieAggregates(host, citySlug, 8).catch(() => null);
  if (!value) return null;
  aggCache.set(key, { at: Date.now(), value });
  return value;
}

/**
 * The exit URL for a movie destination: a live seat map for District/TicketNew when the
 * session can be resolved, otherwise the date-corrected page. Never throws, never invents.
 */
export async function refreshSeatDestination(destination: string, now: Date = new Date()): Promise<string> {
  const fallback = refreshMovieDestination(destination, now);
  // Parse the ORIGINAL link: the date-corrected fallback has already dropped a session that
  // belonged to another day, and that session is exactly what tells us which cinema/show to
  // re-resolve for today.
  const parsed = parseSeatDestination(destination);
  if (!parsed) return fallback;

  const target = movieShowDate(now).iso;
  // District's seat URL carries no city; the city index (stamped during aggregation) tells us
  // which sessions to ask for. Without it we would be guessing, so we fall back instead.
  if (!parsed.city) parsed.city = lookupSeatCity(parsed.fid, parsed.cinemaId);
  // Same day: the stored session may still be live, but its link is only valid if it carries the
  // show's format code. Legacy rows repeated the cinema id there (what District answered with
  // "booking is now closed"), so the link is always REBUILT from the live show - never replayed.
  if (parsed.dateISO === target) {
    const aggs = await cityAggregates(parsed.host, gwCitySlug(parsed.city)).catch(() => null);
    const show = aggs ? findShow(aggs, parsed, target, now) : null;
    if (!show) return fallback; // no bookable show left -> the platform's own dated page
    return buildSeatLink(parsed, show, target, fallback);
  }

  const citySlug = gwCitySlug(parsed.city);
  // District publishes fewer cinemas per city than TicketNew does from the same mesh, so a
  // movie that District has no upcoming show for still has a LIVE seat map on the sibling
  // surface (that is exactly how movieSeatLink already behaves when District has no fid).
  // Try the clicked platform first; only then the sibling, never a list page.
  for (const host of [parsed.host, parsed.host === 'district' ? 'ticketnew' : 'district'] as GwHost[]) {
    const aggs = await cityAggregates(host, citySlug).catch(() => null);
    if (!aggs) continue;
    const show = findShow(aggs, parsed, target, now);
    if (!show) continue;
    const link = buildSeatLink({ ...parsed, host }, show, target, '');
    if (link) return link;
  }
  return fallback;
}

interface ResolvedShow {
  sid: string;
  mid: string;
  /** session format code = the platform's own `entityDataCode` (4th encsessionid segment) */
  fid: string;
  contentId: string;
  cinemaId: string;
  cinemaName: string;
  time: string;
}

/** The same cinema's earliest show that has not started on the target date. */
function findShow(
  aggs: NonNullable<Awaited<ReturnType<typeof gwCityMovieAggregates>>>,
  parsed: SeatDestination,
  target: string,
  now: Date,
): ResolvedShow | null {
  const today = movieShowDate(now).iso;
  const nowMin = istMinutesNow(now);
  const candidates: ResolvedShow[] = [];
  for (const agg of aggs.values()) {
    for (const s of agg.shows || []) {
      if (!s.sid) continue;
      const cinemaId = String(s.cinemaId ?? '');
      const sameCinema = parsed.cinemaId ? cinemaId === parsed.cinemaId : true;
      const sameMid = parsed.mid ? String(s.mid || '').toLowerCase() === parsed.mid.toLowerCase() : true;
      if (!sameCinema && !sameMid) continue;
      // Sold-out shows have no seat map to show, so they are never a destination.
      if (typeof s.avail === 'number' && s.avail <= 0) continue;
      // Prices in this gateway are today's live sessions; tomorrow's rows only exist when the
      // platform has opened them. Either way the date is stamped from `target`.
      if (target === today) {
        // Prefer the platform's own closeTime: that is the moment it stops selling, which is
        // always earlier than the show start. Only when the payload has none do we fall back to
        // a start-time margin.
        const close = stampToIst(s.closeTime);
        if (close && close.dateISO === today) {
          if (close.minutes <= nowMin + 10) continue; // window already shut -> "Booking is now closed"
        } else {
          const start = stampToIst(s.showTime);
          const mins = start && start.dateISO === today ? start.minutes : timeToMinutes(s.time);
          if (mins === null || mins <= nowMin + BOOKING_HEADROOM_MIN) continue;
        }
      }
      candidates.push({
        sid: String(s.sid),
        mid: String(s.mid || parsed.mid || ''),
        fid: String(s.fid || parsed.fid || ''),
        contentId: String(s.contentId ?? agg.contentId ?? parsed.contentId ?? ''),
        cinemaId,
        cinemaName: String(s.theatre || ''),
        time: String(s.time || ''),
      });
    }
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => (timeToMinutes(a.time) ?? 9_999) - (timeToMinutes(b.time) ?? 9_999));
  return candidates[0];
}

function buildSeatLink(parsed: SeatDestination, show: ResolvedShow, dateISO: string, fallback: string): string {
  const link = movieSeatLink({
    host: parsed.host,
    city: parsed.city,
    cinemaId: show.cinemaId || parsed.cinemaId,
    cid: show.cinemaId || parsed.cinemaId,
    cinemaName: show.cinemaName,
    sid: show.sid,
    mid: show.mid,
    fid: show.fid,
    entityDataCode: show.fid,
    contentId: show.contentId,
    dateISO,
  });
  return link || fallback;
}
