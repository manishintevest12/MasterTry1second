/**
 * Flight time backfill + honest hide (owner 30 Oct: "flight mai time ni aa raha
 * uska time le kr aao kaise v agar phir v naa aaye tho usko hide kr do jo time
 * naa de").
 *
 * Two jobs, in this order:
 *
 *  1. GET THE TIMES ("kaise v") — before a row is allowed to disappear, one live
 *     harvest is attempted for the searched route+date. Ixigo's SSR search page
 *     publishes flight number + departure + arrival for EVERY carrier flying that
 *     route, so a single page fetch teaches the schedule memory the timings of all
 *     the airlines in that search (server/common/flightSchedule.ts then copies them
 *     onto the rows that arrived without them). Harvests are cached per route+date
 *     (20 min positive / 5 min negative) and single-flighted, so a burst of searches
 *     on the same route costs one fetch, and a failed harvest is not retried in a loop.
 *
 *  2. HIDE WHAT STILL HAS NO TIME — flight rows that carry a fare but no departure +
 *     arrival are removed from the response, exactly as the owner asked. Two things
 *     are deliberately NOT hidden:
 *       - seller PRESENCE cards (route-prefilled seller search page, no fare claimed,
 *         attributes.price_basis === 'live_fares_unavailable'). They are a separate
 *         owner-requested feature (22 Oct: a gated seller still appears honestly) and
 *         they never claimed a flight or a time, so their absence of a schedule is not
 *         the same defect. Ask the owner before hiding those.
 *       - rows of any other vertical (this filter only touches `flights`).
 *
 * Timings are never invented: every filled time comes from a real Ixigo row for the
 * same flight number, and the schedule memory records provenance + observation time.
 */

import { cffiFetch } from '../common/curlCffiFetch';
import {
  enrichFlightSchedules,
  hasFlightSchedule,
  learnFlightSchedules,
} from '../common/flightSchedule';
import { parseIxigoFlights } from '../workers/parsers/ixigoFlights';
import { log } from '../common/logger';

const HARVEST_OK_TTL_MS = 20 * 60_000;
const HARVEST_FAIL_TTL_MS = 5 * 60_000;
const HARVEST_TIMEOUT_MS = 12_000;
const HARVEST_KEY_LIMIT = 2;

interface HarvestRecord { at: number; ok: boolean; learned: number }

const harvestCache = new Map<string, HarvestRecord>();
const harvestInflight = new Map<string, Promise<number>>();

const slug = (v: string) => String(v || '').trim().toLowerCase().replace(/\s+/g, '_');

/** "Indore → Delhi" / "indore to delhi" / "IDR-DEL" → city tokens for Ixigo. */
export function routeTokensOf(route: unknown): { from: string; to: string } | null {
  const raw = String(route ?? '').trim();
  if (!raw) return null;
  const parts = raw.split(/\s*(?:→|->|—|–|\bto\b)\s*/i).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { from: slug(parts[0]), to: slug(parts[1]) };
  }
  const codes = raw.match(/\b[A-Z]{3}\b/g);
  if (codes && codes.length >= 2) return { from: codes[0].toLowerCase(), to: codes[1].toLowerCase() };
  return null;
}

const isPresenceRow = (offer: any): boolean =>
  String(offer?.id || '').startsWith('presence_')
  || String(offer?.attributes?.price_basis || '') === 'live_fares_unavailable';

/** Route+date the row belongs to, as far as the row honestly tells us. */
function routeDateOf(offer: any): { route: string; date: string } | null {
  const route = offer?.attributes?.route || offer?.travel?.route || '';
  const date = String(offer?.travel?.date || offer?.attributes?.travel_date || '').trim();
  if (!route || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return { route: String(route), date };
}

/** One live Ixigo route page → schedule memory. Returns how many flights were learned. */
async function harvestRoute(from: string, to: string, date: string): Promise<number> {
  const url = `https://www.ixigo.com/search/flight/${from}/${to}/${date}/1/0`;
  const res = await cffiFetch(url, { impersonate: 'chrome', timeoutMs: HARVEST_TIMEOUT_MS });
  if (res.status !== 200) return 0;
  const m = String(res.body || '').match(/<script id="__NEXT_DATA__"[^>]*>(\{[\s\S]*?\})<\/script>/);
  if (!m) return 0;
  let next: any;
  try { next = JSON.parse(m[1]); } catch { return 0; }
  // No route guard codes here: the itinerary tokens themselves carry the real
  // IATA pairs, so each learned schedule is filed under the route it truly flies.
  const flights = parseIxigoFlights(next);
  if (!flights.length) return 0;
  const synthetic = flights
    .filter((f) => f.flightNumber && f.departureTime && f.arrivalTime)
    .map((f) => {
      const legs = f.legs || [];
      const fromCode = legs[0]?.from;
      const toCode = legs[legs.length - 1]?.to;
      return {
        vertical: 'flights',
        brand: f.airline,
        title: `${f.airline} ${f.flightNumber}`,
        attributes: {
          flight_number: f.flightNumber,
          airline: f.airline,
          departure: f.departureTime,
          arrival: f.arrivalTime,
          ...(f.durationMinutes ? { duration_minutes: f.durationMinutes } : {}),
          ...(f.stops !== null ? { stops: f.stops } : {}),
          ...(fromCode && toCode ? { route: `${fromCode} → ${toCode}` } : {}),
        },
      };
    });
  if (!synthetic.length) return 0;
  return learnFlightSchedules(synthetic as any[]);
}

/** Cached, single-flighted harvest for one route+date. */
function harvestOnce(from: string, to: string, date: string): Promise<number> {
  const key = `${from}|${to}|${date}`;
  const hit = harvestCache.get(key);
  if (hit && Date.now() - hit.at < (hit.ok ? HARVEST_OK_TTL_MS : HARVEST_FAIL_TTL_MS)) {
    return Promise.resolve(hit.learned);
  }
  const running = harvestInflight.get(key);
  if (running) return running;
  const job = (async () => {
    let learned = 0;
    try {
      learned = await harvestRoute(from, to, date);
    } catch {
      learned = 0;
    } finally {
      harvestInflight.delete(key);
      harvestCache.set(key, { at: Date.now(), ok: learned > 0, learned });
    }
    return learned;
  })();
  harvestInflight.set(key, job);
  return job;
}

const withBudget = <T>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
  new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    if (typeof (timer as any).unref === 'function') (timer as any).unref();
    p.then(
      (value) => { clearTimeout(timer); resolve(value); },
      () => { clearTimeout(timer); resolve(fallback); },
    );
  });

/**
 * Fills timings on flight rows: learn from what we already have, then (only if rows
 * are still missing a schedule) one bounded live harvest for the searched route+date,
 * then fill again. Returns new objects; the caller decides what to hide.
 */
export async function backfillFlightTimes<T extends Record<string, any>>(
  offers: T[],
  opts: { budgetMs?: number; harvest?: boolean } = {},
): Promise<T[]> {
  const budgetMs = opts.budgetMs ?? 3_000;
  // Tests (and any caller that must stay offline) disable the network harvest; the
  // local learning/filling from rows already in hand still runs.
  const harvestAllowed = opts.harvest !== false;
  let out = enrichFlightSchedules(offers as any[]) as T[];

  const missing = out.filter((o: any) => String(o?.vertical) === 'flights' && !isPresenceRow(o) && !hasFlightSchedule(o));
  if (!missing.length || !harvestAllowed) return out;

  // Which route+date harvests would actually help these rows?
  const keys: Array<{ from: string; to: string; date: string }> = [];
  const seen = new Set<string>();
  for (const row of missing as any[]) {
    const rd = routeDateOf(row);
    if (!rd) continue;
    const toks = routeTokensOf(rd.route);
    if (!toks) continue;
    const k = `${toks.from}|${toks.to}|${rd.date}`;
    if (seen.has(k)) continue;
    seen.add(k);
    keys.push({ from: toks.from, to: toks.to, date: rd.date });
    if (keys.length >= HARVEST_KEY_LIMIT) break;
  }
  if (!keys.length) return out;

  const learned = await withBudget(
    Promise.all(keys.map((k) => harvestOnce(k.from, k.to, k.date))).then((r) => r.reduce((a, b) => a + b, 0)),
    budgetMs,
    0,
  );
  if (learned > 0) {
    out = enrichFlightSchedules(out as any[]) as T[];
  }
  return out;
}

/**
 * Owner 30 Oct: a flight row that still has no departure + arrival time after the
 * backfill is hidden. Presence cards (no fare claimed) and other verticals are kept.
 */
export function hideFlightRowsWithoutTimes<T extends Record<string, any>>(offers: T[]): {
  kept: T[];
  dropped: Array<{ title: string; seller: string; reason: 'no_time' }>;
} {
  const kept: T[] = [];
  const dropped: Array<{ title: string; seller: string; reason: 'no_time' }> = [];
  for (const offer of offers || []) {
    if (String((offer as any)?.vertical) !== 'flights') { kept.push(offer); continue; }
    if (isPresenceRow(offer as any)) { kept.push(offer); continue; }
    // A route-level card with no fare at all is not a bookable flight either; it has
    // nothing to compare, so it is not kept as a "flight with a missing time".
    if (hasFlightSchedule(offer as any)) { kept.push(offer); continue; }
    dropped.push({
      title: String((offer as any)?.title || '').slice(0, 80),
      seller: String((offer as any)?.seller || (offer as any)?.vendor || '').slice(0, 40),
      reason: 'no_time',
    });
  }
  return { kept, dropped };
}

/** Test/diagnostic helper. */
export function flightTimeBackfillStats(): { cached: number; inflight: number } {
  return { cached: harvestCache.size, inflight: harvestInflight.size };
}

export function resetFlightTimeBackfill(): void {
  harvestCache.clear();
  harvestInflight.clear();
}

export function noteFlightTimeDrop(vertical: string, dropped: Array<{ title: string; seller: string }>, remaining: number): void {
  if (!dropped.length) return;
  log.info('Search', 'Hid flight rows without a time (owner 30 Oct)', {
    vertical,
    dropped: dropped.length,
    kept: remaining,
    sample: dropped.slice(0, 3).map((d) => `${d.seller}: ${d.title}`.slice(0, 70)),
  });
}
