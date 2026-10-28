/**
 * "Second card" gate for flight results (owner 28 Oct).
 *
 * Two card shapes exist in the feed today:
 *   1. FIRST type — no flight number / no departure-arrival times / no duration
 *      ("IndiGo · indore -> delhi 2026-10-28" + ₹price). Cheap to paint, useless
 *      to compare.
 *   2. SECOND type — flight number, real dep → arr, duration, non-stop, seller
 *      chip, BEST PRICE, Book.
 *
 * Owner rule: a row must render as the SECOND type. The server now completes the
 * timings from an observed row of the SAME flight number
 * (server/common/flightSchedule.ts); anything still incomplete is pushed to the
 * END of the feed instead of taking a top slot.
 */

const clock = (value: unknown): string | null => {
  const s = String(value ?? '').trim();
  if (!s) return null;
  const iso = /T(\d{2}):(\d{2})/.exec(s);
  if (iso) return `${iso[1]}:${iso[2]}`;
  const h24 = /^(\d{1,2}):(\d{2})/.exec(s);
  if (h24) return Number(h24[1]) > 23 ? null : `${h24[1].padStart(2, '0')}:${h24[2]}`;
  return null;
};

/** True when the card can render in full "second type" form. */
export function flightScheduleComplete(item: any): boolean {
  if (!item || item.vertical !== 'flights') return false;
  const specs = item.specs || {};
  const dep = clock(specs['departure time'] || specs.departure);
  const arr = clock(specs['arrival time'] || specs.arrival);
  if (dep && arr) return true;
  // A dep→arr range published as ONE value ("21:40 → 23:20") is equally complete.
  const range = String(specs.departure || specs['departure time'] || '');
  const both = range.match(/(\d{1,2}:\d{2})\s*(?:→|->|–|-)\s*(\d{1,2}:\d{2})/);
  return !!(both && clock(both[1]) && clock(both[2]));
}

/**
 * Stable partition: complete "second type" cards keep their current order and
 * lead the feed; the rest follow in their current order. Never re-sorts, so the
 * user's chosen sort (Cheapest / Fastest / Best) still holds inside each half.
 */
export function scheduleCompleteFirst<T>(groups: T[], leadOf: (group: T) => any): T[] {
  const complete: T[] = [];
  const incomplete: T[] = [];
  for (const group of groups) (flightScheduleComplete(leadOf(group)) ? complete : incomplete).push(group);
  if (!incomplete.length) return groups;
  return [...complete, ...incomplete];
}

const SCHEDULE_SPEC_KEYS = ['departure time', 'arrival time', 'duration minutes', 'stops', 'flight number', 'airline', 'departure date'];

/**
 * A comparison group holds the SAME flight sold by several sites. If the
 * cheapest row is bare but another seller's row for that same flight carries the
 * timings, the card must still render in full — so the schedule specs are lifted
 * onto the lead item (never the price, never the seller).
 */
export function liftGroupSchedule<T extends { best?: { item?: any }; lead?: any; rows?: Array<{ item?: any }> }>(group: T): T {
  const lead = group?.best?.item || group?.lead;
  if (!lead) return group;
  if (flightScheduleComplete(lead)) return group;
  const donor = (group.rows || []).map((r) => r.item).find((it) => flightScheduleComplete(it));
  if (!donor) return group;
  const specs = { ...(lead.specs || {}) };
  for (const key of SCHEDULE_SPEC_KEYS) {
    const value = donor.specs?.[key] ?? donor.specs?.[key.toLowerCase()];
    if (value !== undefined && value !== null && String(value).trim() !== '' && !specs[key]) specs[key] = String(value);
  }
  lead.specs = specs;
  return group;
}
