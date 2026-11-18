/**
 * Movie price -> THEATRE (owner 18 Nov: "maine kaha tha best price yaa cheapest price movie mai jb bata rahe ho
 * app mai tho movie theatre ka naam v batao").
 *
 * The movie card prints ONE headline number ("₹100 · BEST PRICE") that comes from the cheapest provider row,
 * and that row is a SELLER (BookMyShow / District / TicketNew). Nothing on the card named the cinema that
 * number belongs to, so the user could not tell where to go - and the same was true of the seller fallback on
 * the CHEAPEST line.
 *
 * The rule here is the one already proven on the CHEAPEST line (v1.8.99+106), now shared by BOTH the headline
 * price and the cheapest line, and mirrored byte-for-byte in the Flutter app
 * (flutter_app/lib/core/movie_venue.dart), so the two cards can never disagree:
 *
 *  1. the seat-level cheapest show may name its cinema only when its price EQUALS the advertised price,
 *  2. a printed showtime whose seat class carries exactly the advertised price names that cinema + time,
 *  3. a printed showtime whose seat class is CHEAPER than the advertised price still names its cinema (it can
 *     never contradict the headline, because it is below it),
 *  4. otherwise NO cinema is named from a price - the caller shows the real theatre list instead of an
 *     unproven hall. We never invent a venue: that is the "₹100 best price / ₹180 cheapest" bug all over again.
 */

export interface MovieShowtime {
  theatre?: string;
  time?: string;
  areas?: Array<{ label?: string; price?: number | string }>;
}

export interface MovieSeatCheapest {
  theatre?: string;
  time?: string;
  seatClass?: string;
  price?: number | string;
  url?: string;
  platform?: string;
}

export interface MovieVenue {
  theatre: string;
  time: string;
  price: number;
  seatClass: string;
  /** true when a printed show carries EXACTLY the advertised price (so the cinema truly owns that number). */
  exact: boolean;
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Parse a spec that may arrive as a JSON string (attribute pipeline) or an already-parsed array. */
export function parseMovieList(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  try {
    const v = JSON.parse(String(raw ?? '[]'));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Parse the `cheapest_show` spec (JSON string or object). */
export function parseSeatCheapest(raw: unknown): MovieSeatCheapest | null {
  if (raw && typeof raw === 'object') return raw as MovieSeatCheapest;
  try {
    const v = JSON.parse(String(raw ?? 'null'));
    return v && typeof v === 'object' ? (v as MovieSeatCheapest) : null;
  } catch {
    return null;
  }
}

/** The cinema that owns `best`, or null when no printed show can prove one. */
export function movieVenueForPrice(
  shows: MovieShowtime[],
  seatCheapest: MovieSeatCheapest | null,
  best: number,
): MovieVenue | null {
  if (!(best > 0)) return null;
  const seatPrice = num(seatCheapest?.price);

  // 1. The seat-level cheapest show is the strongest evidence: it is a live seat map at that exact fare.
  if (seatCheapest && seatPrice === best) {
    return {
      theatre: String(seatCheapest.theatre || ''),
      time: String(seatCheapest.time || ''),
      price: seatPrice,
      seatClass: String(seatCheapest.seatClass || ''),
      exact: true,
    };
  }

  // 2/3. Printed showtimes: exact match first (the cinema genuinely sells at the headline price), then any
  // show BELOW it (stale listing on the headline side - still cannot contradict it).
  let below: MovieVenue | null = null;
  for (const sh of shows) {
    for (const a of parseMovieList(sh?.areas)) {
      const p = num(a?.price);
      if (!p) continue;
      if (p === best) {
        return {
          theatre: String(sh?.theatre || ''),
          time: String(sh?.time || ''),
          price: p,
          seatClass: String(a?.label || ''),
          exact: true,
        };
      }
      if (p < best && !below) {
        below = {
          theatre: String(sh?.theatre || ''),
          time: String(sh?.time || ''),
          price: p,
          seatClass: String(a?.label || ''),
          exact: false,
        };
      }
    }
  }
  return below;
}

/** Theatre names the source itself lists for this movie (never price-linked - used only as context). */
export function movieTheatreNames(raw: unknown, shows: MovieShowtime[]): string[] {
  const out: string[] = [];
  const push = (v: unknown) => {
    const s = String(v ?? '').trim();
    if (s && !out.includes(s)) out.push(s);
  };
  // `theatres` spec: "PVR Treasure Island | Velocity 3D | ..." (gateway aggregate).
  String(raw ?? '')
    .split('|')
    .forEach(push);
  for (const sh of shows) push(sh?.theatre);
  return out;
}

/** "3:15 PM" from District's ISO time; free text passes through unchanged. */
export function movieTimeLabel(t: unknown): string {
  const s = String(t ?? '');
  const m = /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})/.exec(s);
  if (!m) return s;
  const h = Number(m[1]);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m[2]} ${ap}`;
}

/**
 * The one line the movie card prints under its price, so the theatre is ALWAYS named:
 *  - "at Drama Factory · 3:15 PM" when a show carries that price,
 *  - "in theatres: PVR Treasure Island, Velocity 3D +2" when no show can prove it (real names, no fake link).
 * Returns '' when the source gave us no theatre at all (nothing honest to say beyond the seller badge).
 */
export function movieVenueLine(opts: {
  showtimes?: unknown;
  cheapestShow?: unknown;
  theatres?: unknown;
  best: number;
}): string {
  const shows = parseMovieList(opts.showtimes) as MovieShowtime[];
  const seat = parseSeatCheapest(opts.cheapestShow);
  const venue = movieVenueForPrice(shows, seat, num(opts.best));
  if (venue && venue.theatre) {
    const time = movieTimeLabel(venue.time);
    return `at ${venue.theatre}${time ? ` · ${time}` : ''}`;
  }
  const names = movieTheatreNames(opts.theatres, shows);
  if (!names.length) return '';
  const shown = names.slice(0, 2).join(', ');
  const more = names.length > 2 ? ` +${names.length - 2}` : '';
  return `${names.length === 1 ? 'in theatre' : 'in theatres'}: ${shown}${more}`;
}
