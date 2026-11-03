/**
 * TRAVEL-DATE CORRECTNESS GATE (owner 2 Nov: "results yaha abhi v 2-11-2026 kas bata raha hai
 * jb ki maine 19-11-2026 search kiya please aise issue hr verticas fix kro").
 *
 * WHY: many fare-calendar sources (EaseMyTrip, MakeMyTrip, Air India, Air India Express, Akasa,
 * BudgetAir, AbhiBus...) publish a whole month of prices. Their parsers pick the requested day when
 * the calendar has it and otherwise fall back to "the cheapest upcoming day" - honest in intent, but
 * the row then enters a date-specific search carrying ANOTHER day's fare, and the card renders that
 * other day next to a 19 Nov search. On 2 Nov the cheapest upcoming day is often 2 Nov itself, which
 * is exactly the screenshot the owner sent.
 *
 * The catalogue floor already had a date check (searchOrchestrator buildLiveCtx). This module applies
 * the same rule to EVERY row that survives into the feed, whatever produced it (live source, cached
 * catalogue, presence card), so a new parser cannot reintroduce the bug.
 *
 * RULES
 *  - Only date-answering verticals are affected: flights, hotels, bus, cab, movies.
 *  - A row is dropped only when we can read its date AND it is provably not one of the requested
 *    dates. An undated row is kept (we cannot prove it wrong, and flight schedule/presence rows are
 *    honest reference rows).
 *  - Dates are compared as calendar dates after normalising the formats sources actually emit:
 *    ISO (2026-11-19), Indian (19/11/2026, 19-11-2026), US-ish (11/19/2026 only when unambiguous)
 *    and ISO-ish with slashes (2026/11/19).
 *  - A return trip accepts a row dated on the outbound OR the return date, never a third date.
 */

/** Verticals whose result rows answer a specific date. */
export const DATE_ANSWERING_VERTICALS = ['flights', 'hotels', 'bus', 'cab', 'movies'];

const iso = (y: number, m: number, d: number): string => {
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return '';
  if (m < 1 || m > 12 || d < 1 || d > 31) return '';
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
};

/**
 * Normalise a date string to YYYY-MM-DD, or '' when it cannot be read with confidence.
 * Indian formats are read day-first, which is what every partner site we read emits.
 */
export function normalizeTravelDate(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  // Drop a TIME part when one is present ("2026-11-19T00:00:00Z", "19/11/2026 06:00",
  // "19 Nov 2026 6:00 AM"). Splitting on the first space would eat "Nov 19, 2026", so only a
  // clock pattern is stripped.
  const head = s.replace(/[T ]\s*\d{1,2}:\d{2}.*$/, '').trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(head);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(head);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    // Day-first is the Indian convention (19/11/2026). Only fall back to month-first when the
    // day-first reading is impossible, so 11/19/2026 still resolves instead of being discarded.
    if (a > 12 && b <= 12) return iso(Number(m[3]), b, a);
    if (b > 12 && a <= 12) return iso(Number(m[3]), a, b);
    return iso(Number(m[3]), b, a);
  }
  // "19 Nov 2026" / "Nov 19, 2026"
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  m = /^(\d{1,2})\s*[- ]?\s*([a-zA-Z]{3,})\.?\s*[- ,]*\s*(\d{4})$/.exec(head);
  if (m) {
    const mi = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    if (mi >= 0) return iso(Number(m[3]), mi + 1, Number(m[1]));
  }
  m = /^([a-zA-Z]{3,})\.?\s*(\d{1,2}),?\s*(\d{4})$/.exec(head);
  if (m) {
    const mi = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
    if (mi >= 0) return iso(Number(m[3]), mi + 1, Number(m[2]));
  }
  return '';
}

/** The date a row actually answers, read from the fields sources and the catalogue use. */
export function offerTravelDate(offer: any): string {
  const candidates: unknown[] = [
    offer?.travel?.date,
    offer?.travel?.travel_date,
    offer?.attributes?.travel_date,
    offer?.attributes?.departure_date,
    offer?.attributes?.depart_date,
    offer?.attributes?.date,
    offer?.attributes?.checkin,
    offer?.attributes?.check_in,
    offer?.attributes?.show_date,
  ];
  for (const c of candidates) {
    const n = normalizeTravelDate(c);
    if (n) return n;
  }
  return '';
}

/** A seller/presence card never claims a fare or a specific day, so it may stay undated. */
export function isUndatedPresenceRow(o: any): boolean {
  const id = String(o?.id ?? '');
  const basis = String(o?.attributes?.price_basis ?? '');
  return id.startsWith('presence_') || basis === 'live_fares_unavailable';
}

export interface DateGateResult<T> {
  kept: T[];
  dropped: number;
  /** Rows dropped per resolved date, for the log line ("19th shows 2 Nov" debugging). */
  droppedOn: Record<string, number>;
}

/**
 * Drop rows that answer a different date than the one requested.
 * @param requested the travel dates the user actually asked for (depart, and return when set)
 */
export function enforceRequestedTravelDate<T>(
  offers: T[],
  vertical: string,
  requested: { depart?: string; return?: string; checkin?: string; checkout?: string } | undefined,
  opts: { strictUndated?: boolean } = {},
): DateGateResult<T> {
  if (!DATE_ANSWERING_VERTICALS.includes(String(vertical))) {
    return { kept: offers, dropped: 0, droppedOn: {} };
  }
  const allowed = new Set(
    [requested?.checkin, requested?.depart, requested?.return]
      .map((d) => normalizeTravelDate(d))
      .filter(Boolean),
  );
  if (!allowed.size) return { kept: offers, dropped: 0, droppedOn: {} };
  const kept: T[] = [];
  const droppedOn: Record<string, number> = {};
  for (const o of offers) {
    const d = offerTravelDate(o);
    if (!d) {
      // STRICT mode (owner 3 Nov: "any row that does not match the exact requested date must
      // be instantly dropped"): a row we cannot date at all cannot be proven to answer this
      // search, and those are exactly the rows that produced "27 Nov search, 3 Nov card".
      // The one exception stays: a seller presence card never claims a fare or a day, so it is
      // honest reference (owner-requested 22 Oct) and is kept.
      if (opts.strictUndated && !isUndatedPresenceRow(o)) {
        droppedOn['undated'] = (droppedOn['undated'] || 0) + 1;
        continue;
      }
      kept.push(o);
      continue;
    }
    if (allowed.has(d)) {
      kept.push(o);
      continue;
    }
    droppedOn[d] = (droppedOn[d] || 0) + 1;
  }
  return { kept, dropped: offers.length - kept.length, droppedOn };
}
