/**
 * Try1Second — ROUTE GATE (owner 9 Nov): "maine search kiya indore to hyderabad pr results aa raha hai
 * indore to delhi ka".
 *
 * A metasearch answer must be about the trip the visitor typed. The catalogue floor and the last-verified
 * chain can both replay offers that belong to a DIFFERENT city pair (a route that happens to be cached),
 * and nothing was checking it: travelDateGate only cares about the DATE, queryRelevance only scores text.
 * This module drops any flight/bus/cab row whose own route is readable and does not match the requested
 * origin and destination.
 *
 * Honesty rules:
 *  - only rows whose route is actually readable are judged (specs.route "Indore → Hyderabad",
 *    specs.origin/destination, attributes.origin/destination, or a "· A → B" title) - an unreadable row is
 *    kept, never guessed;
 *  - comparison tolerates the shapes our sources use: IATA codes, "New Delhi" vs "Delhi", "Indore Tahsil"
 *    vs "Indore", case and punctuation;
 *  - one mismatching end is enough to drop the row (a Delhi flight is not an Indore-Hyderabad result even
 *    if the destination were somehow right).
 */

export interface GateRoute { from: { city: string; code?: string }; to: { city: string; code?: string } }

/** Normalise a place for comparison: lowercase, letters only, common qualifiers removed. */
function normPlace(raw: unknown): string {
  return String(raw ?? '')
    .toLowerCase()
    .replace(/[^a-z ]+/g, ' ')
    .replace(/\b(tahsil|tehsil|taluka|district|village|gram|nagar|cantt|city|india|airport|intl|international|terminal)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when two place strings can be the same place. */
export function samePlace(a: unknown, b: unknown): boolean {
  const x = normPlace(a);
  const y = normPlace(b);
  if (!x || !y) return false;
  if (x === y) return true;
  // "new delhi" vs "delhi", "bengaluru" vs "bengaluru international"
  const xs = x.split(' ');
  const ys = y.split(' ');
  if (xs.includes(y) || ys.includes(x)) return true;
  const lastX = xs[xs.length - 1];
  const lastY = ys[ys.length - 1];
  if (lastX && lastX === lastY && lastX.length >= 4) return true;
  // IATA-style 3-letter codes only compared when both sides are codes
  if (/^[a-z]{3}$/.test(x) && /^[a-z]{3}$/.test(y)) return x === y;
  return false;
}

/** Read the route a row claims to be about, or null when it says nothing usable. */
/**
 * Read a named field from a row's spec bags REGARDLESS of how the producer spelled it.
 *
 * OWNER 9 Nov ("bus ko fix kro"): 55 of the 69 real bus rows carry `specs.Route = "Indore → Bhopal"`
 * (title-cased, because the answer pipeline maps attributes to display labels) while this function
 * looked only for `specs.route`. Those 55 rows came back "unreadable", the gate never guessed, and an
 * Indore -> Bhopal search could be painted with an Indore -> Nagpur card - exactly his screenshot.
 */
function bagValue(row: any, names: string[]): string {
  const want = new Set(names.map((n) => n.toLowerCase().replace(/[_\s-]+/g, '')));
  for (const bag of [row?.specs, row?.attributes, row?.specifications]) {
    if (!bag || typeof bag !== 'object') continue;
    for (const k of Object.keys(bag)) {
      if (!want.has(k.toLowerCase().replace(/[_\s-]+/g, ''))) continue;
      const v = String((bag as any)[k] ?? '').trim();
      if (v) return v;
    }
  }
  return '';
}

export function routeOfRow(row: any): { from: string; to: string } | null {
  const specs = row?.specs || row?.attributes || {};
  const direct = (v: unknown) => String(v ?? '').trim();
  // 1) explicit fields
  const fromField = direct(specs.from ?? specs.origin ?? specs.departureCity ?? row?.origin ?? row?.from)
    || bagValue(row, ['from', 'origin', 'departurecity', 'departure city', 'from city', 'source city']);
  const toField = direct(specs.to ?? specs.destination ?? specs.arrivalCity ?? row?.destination ?? row?.to)
    || bagValue(row, ['to', 'destination', 'arrivalcity', 'arrival city', 'to city', 'destination city']);
  if (fromField && toField) return { from: fromField, to: toField };
  // 2) a single "A → B" / "A to B" / "A-B" string
  const raw = direct(specs.route ?? specs.sector ?? row?.route ?? '') || bagValue(row, ['route', 'sector', 'journey', 'route name']);
  const arrow = raw.split(/\s*(?:→|->|=>|—|–|to)\s*/i).map((s) => s.trim()).filter(Boolean);
  if (arrow.length === 2 && arrow[0] && arrow[1]) return { from: arrow[0], to: arrow[1] };
  // 3) title tail: "IndiGo 6E147 · Indore → Hyderabad"
  const title = direct(row?.title);
  const m = title.match(/·\s*([^·]+?)\s*(?:→|->|to)\s*([^·]+)$/i);
  if (m) return { from: m[1].trim(), to: m[2].trim() };
  // 4) OWNER 9 Nov ("bus ko fix kro"): the bus sellers' own titles. A redBus/AbhiBus title reads
  //    "Hans Travels (I) Pvt Ltd 20:45 (Indore) to 08:00 (Nagpur)" and an aggregator title reads
  //    "Barkoti Travels Indore to Bhopal bus (19:50 - 00:30)". Neither shape carries from/to fields on
  //    the row, so this gate used to answer null ("unreadable route is never guessed") and KEEP the
  //    row - which is how Indore -> Nagpur cards were painted under an Indore -> Bhopal search.
  //    Both bus shapes are read now; the cities must sit in the two positions the title already uses.
  const paren = title.match(/\(([^()]{2,40})\)\s*(?:→|->|to)\s*[^()]*\(([^()]{2,40})\)/i);
  if (paren) return { from: paren[1].trim(), to: paren[2].trim() };
  const busTitle = title.match(/\s+to\s+([A-Za-z][A-Za-z .'-]{1,30}?)\s+(?:bus|volvo|sleeper|seater)\b/i);
  if (busTitle) {
    // The origin is the city word right before " to " (the operator name sits further left, so the
    // match is taken from the RIGHT, and a known multi-word prefix such as "New" is carried along).
    const before = title.slice(0, busTitle.index).trim().split(/\s+/).filter(Boolean);
    const PREFIX = new Set(['new', 'navi', 'north', 'south', 'east', 'west', 'old', 'greater']);
    let from = before[before.length - 1] || '';
    const prev = (before[before.length - 2] || '').toLowerCase();
    if (from && PREFIX.has(prev)) from = `${before[before.length - 2]} ${from}`;
    const to = busTitle[1].trim();
    if (from && to) return { from, to };
  }
  return null;
}

export interface RouteGateResult {
  rows: any[];
  dropped: number;
  /** Rows dropped because the ORIGIN did not match, and because the DESTINATION did not match. */
  droppedOn: { from: number; to: number };
  examples: string[];
}

/**
 * Keep only rows that are about the requested route. `requested` comes from parseRouteQuery, so a query
 * with no readable pair (e.g. "Hyderabad" alone) leaves every row untouched.
 */
export function enforceRequestedRoute(rows: any[], requested: GateRoute | null): RouteGateResult {
  if (!requested) return { rows, dropped: 0, droppedOn: { from: 0, to: 0 }, examples: [] };
  const keep: any[] = [];
  let from_M = 0;
  let to_M = 0;
  let droppedRows = 0;
  const examples: string[] = [];
  for (const row of rows || []) {
    const route = routeOfRow(row);
    if (!route) { keep.push(row); continue; } // unreadable route is never guessed
    const fromOk = samePlace(route.from, requested.from.city) || (requested.from.code ? samePlace(route.from, requested.from.code) : false);
    const toOk = samePlace(route.to, requested.to.city) || (requested.to.code ? samePlace(route.to, requested.to.code) : false);
    if (fromOk && toOk) { keep.push(row); continue; }
    droppedRows += 1;
    if (!fromOk) from_M += 1;
    if (!toOk) to_M += 1;
    if (examples.length < 4) examples.push(String(row?.title || `${route.from} → ${route.to}`).slice(0, 70));
  }
  // dropped = ROWS removed; droppedOn = per-end tallies (a row can miss both ends).
  return { rows: keep, dropped: droppedRows, droppedOn: { from: from_M, to: to_M }, examples };
}
