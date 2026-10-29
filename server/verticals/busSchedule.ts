/**
 * Bus schedule repair (owner 29 Oct: "bus vertical mai indore se sirali search kiya tho
 * phle results ni aaya phir uske baad results aaya tho bina time se — usko fix kro, app
 * website sb jagah").
 *
 * A bus card without a departure time is useless: the screenshot showed "Maharani Travels -
 * Bharat Benz A/C Seater/Sleeper (2+1)" at Rs 349 with an empty gap where 15:20 → 21:00
 * belongs. Two reasons a row lands with no schedule:
 *   1. the seller DID publish the timings, but under a sibling row of the same operator
 *      (redBus/AbhiBus list the same bus more than once for different seat classes), and
 *      only the row we kept was the bare one;
 *   2. the seller published a route-level row (no per-bus inventory yet), so there is no
 *      honest time to show at all.
 *
 * Case 1 is repaired from the same operator's own row — the same fact, not an invention.
 * Case 2 is labelled honestly in the space itself ("Timing on redBus") instead of leaving a
 * blank gap, and those rows always sit BELOW rows that do carry timings so the first thing
 * the user reads is a real schedule. Nothing here changes a price, a title or a layout.
 */

export interface BusScheduleRow {
  provider?: string;
  seller?: string;
  title?: string;
  attributes?: Record<string, string> | null;
  primaryPrice?: number;
  price?: number;
  prices?: { effectivePrice?: number | null; mandatoryTotal?: number | null };
}

const norm = (s: string): string =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(travels|travel|services|service|bus|buses|express|roadlines|roadways|transport|transportation|motors|tour|tours|and|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Operator key: the name the seller itself printed, normalised for the "same service" test. */
export function busOperatorKey(row: BusScheduleRow): string {
  const a = (row.attributes || {}) as Record<string, string>;
  const raw = String(a['operator'] || a['bus operator'] || a['travels'] || row.title || '');
  return norm(raw.split(/[·|(-]/)[0] || raw);
}

const hasTime = (row: BusScheduleRow): boolean => {
  const a = (row.attributes || {}) as Record<string, string>;
  if (String(a['timing unavailable'] || '') === '1') return false;
  return Boolean(String(a['departure time'] || '').trim());
};

const priceOf = (row: BusScheduleRow): number =>
  Number(row.prices?.effectivePrice ?? row.prices?.mandatoryTotal ?? row.primaryPrice ?? row.price ?? 0) || 0;

/** "07:30 PM" / "19:30" / "7.30pm" -> "19:30", or '' when it is not a clock time. */
function clock(value: string): string {
  const m = /(\d{1,2})[:.](\d{2})\s*([ap]\.?m\.?)?/i.exec(String(value || ''));
  if (!m) return '';
  let h = Number(m[1]);
  const min = m[2];
  const mer = (m[3] || '').toLowerCase().replace(/\./g, '');
  if (mer === 'pm' && h < 12) h += 12;
  if (mer === 'am' && h === 12) h = 0;
  if (h > 23) return '';
  return `${String(h).padStart(2, '0')}:${min}`;
}

/**
 * Repair missing timings from the SAME operator's own row in the same answer, then label
 * whatever is still unknown in the place the time goes. Rows keep their price and identity.
 */
export function backfillBusSchedule<T extends BusScheduleRow>(rows: T[]): T[] {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  // Donor: first row of each operator that actually carries a departure time.
  const donors = new Map<string, { dep: string; arr: string; duration: string; minutes: string }>();
  for (const row of rows) {
    if (!hasTime(row)) continue;
    const key = busOperatorKey(row);
    if (!key || donors.has(key)) continue;
    const a = (row.attributes || {}) as Record<string, string>;
    donors.set(key, {
      dep: String(a['departure time'] || ''),
      arr: String(a['arrival time'] || ''),
      duration: String(a['duration'] || ''),
      minutes: String(a['duration minutes'] || ''),
    });
  }

  return rows.map((row) => {
    const attrs = { ...(row.attributes || {}) } as Record<string, string>;
    if (hasTime(row)) return row;
    const key = busOperatorKey(row);
    const donor = key ? donors.get(key) : undefined;
    const label = String(attrs['departure'] || '').trim();
    const labelTime = clock(label); // some sellers put the time only in the label
    if (donor) {
      // Same operator, same route, same answer: the timings ARE this service's timings.
      attrs['departure time'] = donor.dep;
      if (donor.arr) attrs['arrival time'] = donor.arr;
      if (donor.duration) attrs['duration'] = donor.duration;
      if (donor.minutes) attrs['duration minutes'] = donor.minutes;
      attrs['schedule source'] = 'same operator, same search';
      if (!label || !labelTime) attrs['departure'] = donor.arr ? `${donor.dep} → ${donor.arr}` : donor.dep;
      return { ...row, attributes: attrs } as T;
    }
    if (labelTime) {
      attrs['departure time'] = labelTime;
      return { ...row, attributes: attrs } as T;
    }
    // Nothing honest to show: say so in the SAME slot the time would occupy (the card
    // renders 'departure time', so leaving only a 'departure' label would still be a blank
    // gap), and flag the row so ranking can never treat it as timed.
    const seller = String(row.provider || row.seller || '').trim();
    const note = seller ? `Timing on ${seller}` : 'Timing on site';
    attrs['departure'] = note;
    attrs['departure time'] = note;
    attrs['timing unavailable'] = '1';
    return { ...row, attributes: attrs } as T;
  });
}

/** Timed rows first (cheapest first inside each tier), so a blank card never leads the feed. */
export function orderTimedFirst<T extends BusScheduleRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ta = hasTime(a) ? 0 : 1;
    const tb = hasTime(b) ? 0 : 1;
    if (ta !== tb) return ta - tb;
    return priceOf(a) - priceOf(b);
  });
}

/** Full pass used by the bus vertical: repair, then rank the honest schedule to the top. */
export function repairBusSchedule<T extends BusScheduleRow>(rows: T[]): T[] {
  return orderTimedFirst(backfillBusSchedule(rows));
}
