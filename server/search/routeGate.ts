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
export function routeOfRow(row: any): { from: string; to: string } | null {
  const specs = row?.specs || row?.attributes || {};
  const direct = (v: unknown) => String(v ?? '').trim();
  // 1) explicit fields
  const fromField = direct(specs.from ?? specs.origin ?? specs.departureCity ?? row?.origin ?? row?.from);
  const toField = direct(specs.to ?? specs.destination ?? specs.arrivalCity ?? row?.destination ?? row?.to);
  if (fromField && toField) return { from: fromField, to: toField };
  // 2) a single "A → B" / "A to B" / "A-B" string
  const raw = direct(specs.route ?? specs.sector ?? row?.route ?? '');
  const arrow = raw.split(/\s*(?:→|->|=>|—|–|to)\s*/i).map((s) => s.trim()).filter(Boolean);
  if (arrow.length === 2 && arrow[0] && arrow[1]) return { from: arrow[0], to: arrow[1] };
  // 3) title tail: "IndiGo 6E147 · Indore → Hyderabad"
  const title = direct(row?.title);
  const m = title.match(/·\s*([^·]+?)\s*(?:→|->|to)\s*([^·]+)$/i);
  if (m) return { from: m[1].trim(), to: m[2].trim() };
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
