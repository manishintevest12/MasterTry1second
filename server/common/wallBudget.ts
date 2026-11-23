/**
 * WALL vs SWEEP BUDGET (owner 23 Nov, "continue").
 *
 * MEASURED on production: POST /api/search hotels answered a 31-second plain-text
 * "Try1Second is busy right now" to the app. Two separate faults produced that:
 *
 *  1. /api/search waits up to 34 s for hotels (the owner's "one search = the whole seller set" rule), while the
 *     response wall fired at 30 s — so a cold hotels search ALWAYS hit the wall before its own budget, and the
 *     sellers it was waiting for (Goibibo, Booking.com, Expedia…) could never arrive.
 *  2. The wall decided "is this an API request?" from req.path, which inside a mounted router is the route-relative
 *     path ('/search'), so the API request got the human 503 page instead of the graceful JSON deadline answer.
 *
 * The wall must always outlive the longest sweep, and both live here so they can never drift apart again.
 */
export const RESPONSE_WALL_MS = Math.max(15_000, Number(process.env.T1S_RESPONSE_WALL_MS || 45_000));

/** Headroom kept between the sweep's own budget and the wall, so the pipeline answers before the wall does. */
export const SWEEP_SAFETY_MS = 4_000;

/** Clamp any per-vertical sweep budget so it always settles inside the wall. */
export function clampSweepMs(ms: number): number {
  const ceiling = Math.max(2_000, RESPONSE_WALL_MS - SWEEP_SAFETY_MS);
  return Math.max(2_000, Math.min(Math.round(ms), ceiling));
}
