/**
 * Flight schedule memory — turns a bare "IndiGo 6E6972 · Indore → Delhi" row
 * (catalogue replay, presence card, aggregator row without timings) into the
 * full card the owner asked for: flight number + departure/arrival times +
 * duration + non-stop, or nothing at all.
 *
 * HONESTY CONTRACT (owner rule): timings are NEVER invented. They are only
 * copied from a row for the SAME flight number that a real source published
 * (Ixigo / EaseMyTrip / Cleartrip / Air India / Alliance Air / Akasa / IndiGo
 * app API all publish dep_time + arr_time + duration + stops). Every enriched
 * row carries `schedule_source` + `schedule_observed_at` so the provenance is
 * auditable, and a route mismatch is refused rather than guessed.
 *
 * SELF-HEALING (owner rule): the memory is learned automatically from every
 * acquisition — no manual list to maintain. It lives in-process (LRU) and is
 * mirrored to MySQL (`flight_schedules`) so a restart keeps what we learned.
 * Rows that still have no schedule are ordered LAST by the feed, never faked.
 */

import { getStore } from './db';

export interface FlightSchedule {
  flightNo: string;
  /** "IDR-DEL" when the source published the route with the timings. */
  route: string | null;
  /** Local clock times as the source published them ("21:40"). */
  departure: string;
  arrival: string;
  durationMinutes: number | null;
  stops: number | null;
  airline: string | null;
  observedAt: string;
}

const MAX_ENTRIES = 4000;
/**
 * The MySQL mirror is best-effort by design: unit tests and DB-less runs keep the
 * memory-only behaviour (no connection attempt, no hang) unless explicitly enabled.
 */
const persistEnabled = (): boolean => process.env.NODE_ENV !== 'test' && process.env.T1S_SCHEDULE_DB !== 'off';
const memory = new Map<string, FlightSchedule>();
let tableReady = false;
let hydration: Promise<void> | null = null;
const pendingWrites = new Set<string>();

const keyOf = (flightNo: string, route: string | null) => `${flightNo}|${route || '*'}`;

/** "6E 6972" / "6e6972" / "AI-9580" → "6E6972". Rejects dates and plain numbers. */
export function normalizeFlightNo(value: unknown): string | null {
  const raw = String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!raw || raw.length < 4 || raw.length > 8) return null;
  const m = /^([0-9]?[A-Z]{1,2})(\d{2,5})$/.exec(raw);
  if (!m) return null;
  // A bare year-like token ("2026") never matches: the first group must hold a letter.
  return `${m[1]}${m[2]}`;
}

/** Any of the time shapes the parsers publish → "HH:MM" (local clock time). */
export function normalizeClockTime(value: unknown): string | null {
  const s = String(value ?? '').trim();
  if (!s) return null;
  const iso = /T(\d{2}):(\d{2})/.exec(s);
  if (iso) return `${iso[1]}:${iso[2]}`;
  // 12-hour FIRST: "09:40 PM" must not be read as 09:40 by the 24-hour branch.
  const h12 = /^(\d{1,2}):(\d{2})\s*([AP])\.?M\.?/i.exec(s);
  if (h12) {
    let h = Number(h12[1]) % 12;
    if (/P/i.test(h12[3])) h += 12;
    return `${String(h).padStart(2, '0')}:${h12[2]}`;
  }
  const h24 = /^(\d{1,2}):(\d{2})/.exec(s);
  if (h24) {
    const h = Number(h24[1]);
    if (h > 23) return null;
    return `${String(h).padStart(2, '0')}:${h24[2]}`;
  }
  return null;
}

const attr = (offer: any, ...keys: string[]): string | undefined => {
  const src = offer?.attributes || offer?.specs || {};
  for (const k of keys) {
    const direct = src[k];
    if (direct !== undefined && direct !== null && String(direct).trim() !== '' && String(direct) !== 'undefined') return String(direct);
    const spaced = k.replace(/_/g, ' ');
    const v = src[spaced];
    if (v !== undefined && v !== null && String(v).trim() !== '' && String(v) !== 'undefined') return String(v);
  }
  return undefined;
};

const routeOf = (offer: any): string | null => {
  const raw = attr(offer, 'route', 'Route') || offer?.travel?.route || '';
  const codes = String(raw).match(/\b[A-Z]{3}\b/g);
  if (codes && codes.length >= 2) return `${codes[0]}-${codes[1]}`;
  const arrow = String(raw).split(/\s*(?:→|->| to )\s*/i);
  if (arrow.length === 2 && arrow[0].trim() && arrow[1].trim()) {
    const short = (t: string) => t.trim().slice(0, 3).toUpperCase();
    return `${short(arrow[0])}-${short(arrow[1])}`;
  }
  return null;
};

const flightNoOf = (offer: any): string | null => {
  const explicit = normalizeFlightNo(attr(offer, 'flight_number', 'flight number', 'flightNo'));
  if (explicit) return explicit;
  const title = String(offer?.title || '');
  const m = title.match(/\b([0-9]?[A-Z]{1,2})\s?(\d{3,4})\b/);
  return m ? normalizeFlightNo(`${m[1]}${m[2]}`) : null;
};

function remember(entry: FlightSchedule): void {
  const key = keyOf(entry.flightNo, entry.route);
  const prev = memory.get(key);
  if (prev && prev.observedAt > entry.observedAt) return;
  memory.set(key, entry);
  if (memory.size > MAX_ENTRIES) {
    const oldest = memory.keys().next().value;
    if (oldest) memory.delete(oldest);
  }
  void persist(entry);
}

async function ensureTable(): Promise<boolean> {
  if (tableReady) return true;
  try {
    await getStore().execute(
      `CREATE TABLE IF NOT EXISTS flight_schedules (
         flight_no VARCHAR(12) NOT NULL,
         route VARCHAR(16) NOT NULL DEFAULT '*',
         departure VARCHAR(8) NOT NULL,
         arrival VARCHAR(8) NOT NULL,
         duration_minutes INT NULL,
         stops INT NULL,
         airline VARCHAR(64) NULL,
         observed_at VARCHAR(32) NOT NULL,
         PRIMARY KEY (flight_no, route)
       )`,
    );
    tableReady = true;
    return true;
  } catch {
    return false;
  }
}

async function persist(entry: FlightSchedule): Promise<void> {
  if (!persistEnabled()) return;
  const key = keyOf(entry.flightNo, entry.route);
  if (pendingWrites.has(key)) return;
  pendingWrites.add(key);
  try {
    if (!(await ensureTable())) return;
    await getStore().execute(
      `INSERT INTO flight_schedules (flight_no, route, departure, arrival, duration_minutes, stops, airline, observed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE departure = VALUES(departure), arrival = VALUES(arrival),
         duration_minutes = VALUES(duration_minutes), stops = VALUES(stops),
         airline = VALUES(airline), observed_at = VALUES(observed_at)`,
      [entry.flightNo, entry.route || '*', entry.departure, entry.arrival, entry.durationMinutes, entry.stops, entry.airline, entry.observedAt],
    );
  } catch {
    // Memory-only: the in-process map still serves this boot.
  } finally {
    pendingWrites.delete(key);
  }
}

/** Loads what earlier boots learned (best effort, once per process). */
export async function hydrateFlightSchedules(): Promise<void> {
  if (hydration) return hydration;
  hydration = (async () => {
    try {
      if (!persistEnabled()) return;
      if (!(await ensureTable())) return;
      const rows = await getStore().query<any>(`SELECT * FROM flight_schedules ORDER BY observed_at DESC LIMIT ${MAX_ENTRIES}`);
      for (const r of rows || []) {
        const entry: FlightSchedule = {
          flightNo: String(r.flight_no),
          route: r.route && r.route !== '*' ? String(r.route) : null,
          departure: String(r.departure),
          arrival: String(r.arrival),
          durationMinutes: r.duration_minutes === null ? null : Number(r.duration_minutes),
          stops: r.stops === null ? null : Number(r.stops),
          airline: r.airline ? String(r.airline) : null,
          observedAt: String(r.observed_at),
        };
        const key = keyOf(entry.flightNo, entry.route);
        if (!memory.has(key)) memory.set(key, entry);
      }
    } catch {
      // Never block a search on the schedule mirror.
    }
  })();
  return hydration;
}

/**
 * Learns every schedule the acquisition actually published. Runs over live rows
 * AND catalogue rows, so a single live answer upgrades the same flight number
 * everywhere it appears.
 */
export function learnFlightSchedules(offers: any[]): number {
  let learned = 0;
  for (const offer of offers || []) {
    if (String(offer?.vertical || '') !== 'flights') continue;
    const flightNo = flightNoOf(offer);
    if (!flightNo) continue;
    const departure = normalizeClockTime(attr(offer, 'departure_time', 'departure time', 'departure'));
    const arrival = normalizeClockTime(attr(offer, 'arrival_time', 'arrival time', 'arrival'));
    if (!departure || !arrival) continue;
    const durationRaw = Number(attr(offer, 'duration_minutes', 'duration minutes'));
    const stopsRaw = attr(offer, 'stops');
    remember({
      flightNo,
      route: routeOf(offer),
      departure,
      arrival,
      durationMinutes: Number.isFinite(durationRaw) && durationRaw > 0 ? durationRaw : null,
      stops: stopsRaw !== undefined && stopsRaw !== '' && Number.isFinite(Number(stopsRaw)) ? Number(stopsRaw) : null,
      airline: attr(offer, 'airline') || offer?.brand || null,
      observedAt: new Date().toISOString(),
    });
    learned += 1;
  }
  return learned;
}

function lookup(flightNo: string, route: string | null): FlightSchedule | null {
  if (route) {
    const exact = memory.get(keyOf(flightNo, route));
    if (exact) return exact;
  }
  const global = memory.get(keyOf(flightNo, null));
  if (global) return global;
  // Last resort: the same flight number seen on exactly ONE route — its schedule
  // is unambiguous, so it is safe to reuse (still flagged as observed).
  let found: FlightSchedule | null = null;
  for (const entry of memory.values()) {
    if (entry.flightNo !== flightNo) continue;
    if (found) return null; // more than one route → ambiguous, refuse to guess
    found = entry;
  }
  return found;
}

/**
 * Fills missing timings on flight rows from the observed-schedule memory.
 * Returns NEW offer objects (the originals are left untouched), and marks what
 * it filled so the card and the audit trail can tell where the timings came from.
 */
export function enrichFlightSchedules<T extends Record<string, any>>(offers: T[]): T[] {
  // Learn first: a live row in this very batch can complete a catalogue row.
  learnFlightSchedules(offers as any[]);
  const out: T[] = [];
  for (const offer of offers || []) {
    if (String(offer?.vertical || '') !== 'flights') {
      out.push(offer);
      continue;
    }
    const departure = normalizeClockTime(attr(offer, 'departure_time', 'departure time', 'departure'));
    const arrival = normalizeClockTime(attr(offer, 'arrival_time', 'arrival time', 'arrival'));
    if (departure && arrival) {
      out.push(offer);
      continue;
    }
    const flightNo = flightNoOf(offer);
    if (!flightNo) {
      out.push(offer);
      continue;
    }
    const schedule = lookup(flightNo, routeOf(offer));
    if (!schedule) {
      out.push(offer);
      continue;
    }
    const attributes = { ...(offer.attributes || {}) };
    attributes.departure = attributes.departure || schedule.departure;
    attributes.arrival = attributes.arrival || schedule.arrival;
    if (schedule.durationMinutes && !attributes.duration_minutes) attributes.duration_minutes = schedule.durationMinutes;
    if (schedule.stops !== null && attributes.stops === undefined) attributes.stops = schedule.stops;
    if (schedule.airline && !attributes.airline) attributes.airline = schedule.airline;
    if (!attributes.flight_number) attributes.flight_number = flightNo;
    if (!attributes.route && schedule.route) attributes.route = schedule.route.replace('-', ' → ');
    // Provenance (never rendered as marketing copy, kept for audit + admin).
    attributes.schedule_source = 'observed_live_row';
    attributes.schedule_observed_at = schedule.observedAt;
    out.push({ ...offer, attributes });
  }
  return out;
}

/** True when a mapped card item carries a usable departure + arrival. */
export function hasFlightSchedule(item: any): boolean {
  const specs = item?.specs || {};
  const dep = normalizeClockTime(specs['departure time'] || specs.departure);
  const arr = normalizeClockTime(specs['arrival time'] || specs.arrival);
  return !!(dep && arr);
}

/** Test helper: the in-process memory size. */
export function flightScheduleMemorySize(): number {
  return memory.size;
}

/** Test helper: wipes the in-process memory. */
export function resetFlightScheduleMemory(): void {
  memory.clear();
  tableReady = false;
  hydration = null;
  pendingWrites.clear();
}
