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
  opts: {
    strictUndated?: boolean;
    /**
     * HOTELS first-poll rule (owner 3 Nov: "fix hotels results now it should give results in
     * first poll").
     *
     * A hotel catalogue row is a PROPERTY, not a dated fare: the same Shimla hotel exists for
     * every check-in, and the row loses its date when it was mined without one. Strict mode used
     * to drop those rows, which emptied the first paint and made hotels answer only after the live
     * scan finished (~40s measured on 20 Nov Shimla: two polls of 0 rows, then 87 rows).
     *
     * With this flag an undated row is KEPT but stripped of every price and marked with the
     * existing owner-approved presence convention (price_basis 'live_fares_unavailable'), so the
     * first poll shows the hotels it knows while claiming no price, and the live scan replaces
     * them with dated, priced rows. Nothing wrong-dated is ever shown: a row carrying ANOTHER
     * date is still dropped exactly as before.
     */
    undatedAsPresence?: boolean;
  } = {},
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
  let presenceKept = 0;
  for (const o of offers) {
    const d = offerTravelDate(o);
    if (!d) {
      // STRICT mode (owner 3 Nov: "any row that does not match the exact requested date must
      // be instantly dropped"): a row we cannot date at all cannot be proven to answer this
      // search, and those are exactly the rows that produced "27 Nov search, 3 Nov card".
      // The one exception stays: a seller presence card never claims a fare or a day, so it is
      // honest reference (owner-requested 22 Oct) and is kept.
      if (opts.strictUndated && !isUndatedPresenceRow(o)) {
        if (opts.undatedAsPresence) {
          // keep the property/listing, claim no price, mark it with the presence convention
          const src: any = o;
          kept.push({
            ...src,
            prices: {
              ...(src?.prices || {}),
              listPrice: 0, mandatoryTotal: 0, effectivePrice: 0,
            },
            attributes: { ...(src?.attributes || {}), price_basis: 'live_fares_unavailable', undated_listing: '1' },
          } as T);
          presenceKept += 1;
          continue;
        }
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
  if (presenceKept) droppedOn['undated_as_presence'] = presenceKept;
  return { kept, dropped: offers.length - kept.length, droppedOn };
}

/**
 * CITY GATE for hotels (found 3 Nov while answering the owner's 5-7 Nov question).
 *
 * Measured on production: `hotels in Shimla 5 Nov -> 7 Nov 2 adults` answered 40 rows from
 * w_hotels_agoda whose attributes.city is "Manali" (ids cat_8248314..., titles like "Honeymoon
 * Inn - Manali", per-night Agoda prices). The date gate had nothing to say because a catalogue
 * row carries no travel date, so a Shimla search could paint another city's properties with
 * prices - the same class of bug the owner keeps reporting, one field over.
 *
 * Rule, deliberately conservative: drop a hotel row only when it NAMES a city and that city is
 * not the requested one. A row with no city attribute is left alone (unproven is not wrong), and
 * no other vertical is touched.
 */
export function enforceRequestedCity<T>(offers: T[], vertical: string, city: string | undefined): { kept: T[]; dropped: number; droppedCities: Record<string, number> } {
  const want = String(city || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (String(vertical) !== 'hotels' || !want) return { kept: offers, dropped: 0, droppedCities: {} };
  const kept: T[] = [];
  const droppedCities: Record<string, number> = {};
  const firstToken = want.split(' ')[0];
  for (const o of offers) {
    const src: any = o;
    const named = String(
      src?.attributes?.city ?? src?.travel?.city ?? src?.city ?? src?.attributes?.destination ?? '',
    ).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (named && !named.includes(want) && !(firstToken.length > 3 && named.includes(firstToken))) {
      droppedCities[named] = (droppedCities[named] || 0) + 1;
      continue;
    }
    kept.push(o);
  }
  return { kept, dropped: offers.length - kept.length, droppedCities };
}

/**
 * OWNER 3 Nov: "jab tak live price data ni aa raha tb tk kuch v show mt kro".
 *
 * The price-less cards (hotel properties kept as presence, seller presence rows, "price on site"
 * placeholders) must not appear at all until a live price exists for THIS search. This is a
 * deliberate reversal of the 2 Nov hotels first-poll behaviour: an empty answer with the honest
 * scan state beats a card that shows no price.
 *
 * Vertical-aware on purpose: loans / insurance / credit cards / bank accounts are lead requests
 * where no price exists at all, so they are never filtered here.
 */
const NO_PRICE_VERTICALS = ['loans', 'insurance', 'creditcards', 'account', 'banking'];

export function priceOfRow(o: any): number {
  const p = o?.prices || {};
  const n = (v: any) => {
    const x = Number(String(v ?? '').replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(x) && x > 0 ? x : 0;
  };
  return n(p.effectivePrice) || n(p.mandatoryTotal) || n(p.listPrice) || n(o?.price) || 0;
}

export function dropUnpricedRows<T>(offers: T[], vertical: string): { kept: T[]; dropped: number } {
  if (NO_PRICE_VERTICALS.includes(String(vertical))) return { kept: offers, dropped: 0 };
  const kept = (offers || []).filter((o) => priceOfRow(o) > 0);
  return { kept, dropped: (offers || []).length - kept.length };
}

/**
 * OWNER 3 Nov (screenshot): the app header read "40 live offers · 8 sources verified" while the
 * SELLERS facet listed only two shops (OYO, EaseMyTrip). Both numbers were true in isolation and
 * together they were a lie: 8 sources DID answer the sweep, but after the date/city/price gates
 * only two of them still had a row in the answer. The header is drawn from
 * state.sourcesSucceeded, so the fix belongs on the server: verified sources must mean "sources
 * whose row you can actually see", for every vertical, without touching any UI copy.
 */
const SOURCE_ALIASES: Record<string, string> = {
  emt: 'easemytrip', easemytrip: 'easemytrip',
  mmt: 'makemytrip', makemytrip: 'makemytrip', mytrip: 'makemytrip',
  ixigo: 'ixigo', cleartrip: 'cleartrip', ct: 'cleartrip',
  yatra: 'yatra', goibibo: 'goibibo', agoda: 'agoda', oyo: 'oyo',
  booking: 'booking', bookingcom: 'booking', expedia: 'expedia', hotelscom: 'hotelscom',
  airbnb: 'airbnb', saffronstays: 'saffronstays', akbar: 'akbartravels',
  abhibus: 'abhibus', redbus: 'redbus', zingbus: 'zingbus', paytm: 'paytm',
  ola: 'ola', uber: 'uber', rapido: 'rapido', indrive: 'indrive', meru: 'meru',
  zomato: 'zomato', swiggy: 'swiggy', amazon: 'amazon', flipkart: 'flipkart',
  myntra: 'myntra', ajio: 'ajio', croma: 'croma', reliance: 'reliance', vijaysales: 'vijaysales',
};

function normalizeShopName(raw: unknown): string {
  return String(raw ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function canonicalShop(raw: unknown): string {
  const n = normalizeShopName(raw);
  return SOURCE_ALIASES[n] || n;
}

/** Distinct shops a user can actually see in these rows. */
export function distinctSellerCount(rows: any[]): number {
  const seen = new Set<string>();
  for (const row of rows || []) {
    const name = canonicalShop(row?.seller || row?.vendor || row?.provider || row?.shop || row?.brand || '');
    if (name) seen.add(name);
  }
  return seen.size;
}

/**
 * Keep only the sources that contributed a row still present in the answer.
 * Falls back to trimming the list to the visible shop count when the source ids and the row
 * seller names do not line up (never claims more sources than shops on screen).
 */
export function reconcileVerifiedSources(rows: any[], sourcesSucceeded: string[] | undefined): string[] {
  const declared = (sourcesSucceeded || []).map((s) => String(s));
  if (!rows || rows.length === 0) return [];
  const rowTokens = new Set<string>();
  for (const row of rows) {
    const direct = canonicalShop(row?.seller || row?.vendor || row?.provider || row?.shop || row?.brand || '');
    if (direct) rowTokens.add(direct);
  }
  const matched = declared.filter((id) => {
    const bare = id.replace(/^w_[a-z]+_/i, '');
    const token = canonicalShop(bare);
    if (!token) return false;
    if (rowTokens.has(token)) return true;
    for (const rt of rowTokens) {
      if (rt.length >= 3 && token.length >= 3 && (rt.includes(token) || token.includes(rt))) return true;
    }
    return false;
  });
  if (matched.length) return matched;
  const visible = distinctSellerCount(rows);
  return visible > 0 ? declared.slice(0, Math.min(declared.length, visible)) : [];
}
