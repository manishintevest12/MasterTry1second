/**
 * Feed ordering at the API boundary (owner 28 Oct, standing rule):
 * "Flight results: rows missing detailed timing/duration/flight number must be
 * sorted to the bottom of the feed (web AND Flutter)."
 *
 * Why HERE and not only in the UI: the installed Play Store app is a native
 * build we cannot patch remotely. Anything we order in the /api/search response
 * is what that build receives, so the rule holds for the app in the store today
 * — no new APK required for this part.
 *
 * Stable partition only: the pipeline's own order (rank/price/relevance) is kept
 * inside each half, complete rows lead, bare rows trail. Nothing is invented,
 * never re-priced.
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

const specOf = (item: any, ...keys: string[]): string => {
  const specs = item?.specs || {};
  for (const k of keys) {
    const v = specs[k] ?? specs[k.toLowerCase()] ?? specs[k.replace(/_/g, ' ')];
    if (v !== undefined && v !== null && String(v).trim() !== '' && String(v) !== 'undefined') return String(v);
  }
  return '';
};

/** A flight row is "complete" when the card can show dep → arr (plus a flight number). */
export function flightRowComplete(item: any): boolean {
  if (!item || String(item.vertical) !== 'flights') return false;
  const dep = clock(specOf(item, 'departure time', 'departure'));
  const arr = clock(specOf(item, 'arrival time', 'arrival'));
  if (!dep || !arr) return false;
  const flightNo = specOf(item, 'flight number', 'flight_number', 'flight no');
  // A card without its flight number is still the bare "first type" card the
  // owner rejected, even when timings exist.
  return /[A-Za-z]/.test(flightNo) && /\d/.test(flightNo);
}

/**
 * Complete flight rows keep the pipeline order and lead; rows missing flight
 * number / timings / duration follow in the same order. Non-flight verticals are
 * returned untouched (same array identity).
 */
export function orderFlightRowsLast<T extends Record<string, any>>(items: T[], vertical?: string): T[] {
  if (String(vertical || items?.[0]?.vertical || '') !== 'flights' || !items?.length) return items;
  const complete: T[] = [];
  const incomplete: T[] = [];
  for (const item of items) (flightRowComplete(item) ? complete : incomplete).push(item);
  if (!incomplete.length || !complete.length) return items;
  return [...complete, ...incomplete];
}
