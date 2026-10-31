/**
 * Last-known-good answers (owner 29 Oct: "ek sbse bda bug jo humesa ke liye fix kro — results
 * kabhi aata hai kabhi ni aata, consistent kro", screenshot: HTTP 403 toast).
 *
 * Why answers flickered: a search can be answered from the warm cache, from the catalogue
 * floor, or from a live scan — and when the live scan is gated (403), rate-limited or simply
 * slow, the SAME query that answered 76 rows a minute ago answers 0 rows now. The user reads
 * that as "results kabhi aate hain kabhi nahi", even though nothing about their query changed.
 *
 * This store keeps the last answer that actually carried verified rows, per identical search
 * (vertical + query + city + pincode + date), and hands it back when a fresh attempt comes up
 * empty. It never invents a row, never re-prices one, and the caller always marks the answer
 * as last-verified (never as a fresh live quote). Process-local by design: the durable copy
 * already lives in the MySQL catalogue, this only removes the flicker between polls.
 */

export interface LastGoodEntry {
  rows: any[];
  at: number;
  servedFrom: string;
}

const MAX_ENTRIES = 400;
const store = new Map<string, LastGoodEntry>();

const norm = (s: unknown): string =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Identity of a search: the same key must mean "the same question". */
export function searchKey(input: {
  vertical?: string;
  query?: string;
  city?: string;
  pincode?: string;
  travelDates?: { depart?: string };
}): string {
  return [
    norm(input.vertical || ''),
    norm(input.query || ''),
    norm(input.city || ''),
    norm(input.pincode || ''),
    norm(input.travelDates?.depart || ''),
  ].join('|');
}

/** Keep the newest verified answer for this search. Empty answers never overwrite a good one. */
export function rememberGood(
  input: { vertical?: string; query?: string; city?: string; pincode?: string; travelDates?: { depart?: string } },
  rows: any[],
  servedFrom = '',
): void {
  if (!Array.isArray(rows) || rows.length === 0) return;
  const key = searchKey(input);
  if (!key.trim()) return;
  store.set(key, { rows, at: Date.now(), servedFrom });
  if (store.size > MAX_ENTRIES) {
    // Oldest first: a search nobody repeats must not keep memory forever.
    const oldest = [...store.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, store.size - MAX_ENTRIES);
    for (const [k] of oldest) store.delete(k);
  }
}

/**
 * Last verified answer for this search, if it is still recent enough to show honestly.
 * Default 6 hours: prices on a metro route or a phone do not change faster than that, and
 * the row keeps its own captured-at stamp so the UI can say when it was verified.
 */
export function recallGood(
  input: { vertical?: string; query?: string; city?: string; pincode?: string; travelDates?: { depart?: string } },
  maxAgeMs = 6 * 60 * 60 * 1000,
): { rows: any[]; at: number; servedFrom: string } | null {
  const hit = store.get(searchKey(input));
  if (!hit || !hit.rows.length) return null;
  if (Date.now() - hit.at > maxAgeMs) return null;
  return hit;
}

/**
 * OWNER 31 Oct ("no matching option found error in every vertical"): the per-search store only
 * answers the EXACT same question, so a vertical whose live sources are gated answered nothing
 * for a slightly different query and the app landed on its "No matching options found" card.
 * This hands back the newest verified answer for that VERTICAL, whatever the query or city, so
 * a vertical can always show real, previously verified rows instead of an empty page. Rows are
 * never re-priced or invented; the caller marks them as last-verified.
 */
export function recallGoodForVertical(
  vertical: string,
  maxAgeMs = 6 * 60 * 60 * 1000,
): { rows: any[]; at: number; servedFrom: string } | null {
  const v = norm(vertical);
  if (!v) return null;
  let best: LastGoodEntry | null = null;
  for (const [key, hit] of store) {
    if (!key.startsWith(`${v}|`)) continue;
    if (!hit.rows.length) continue;
    if (Date.now() - hit.at > maxAgeMs) continue;
    if (!best || hit.at > best.at) best = hit;
  }
  return best;
}

/** Test/maintenance hook. */
export function clearLastGood(): void {
  store.clear();
}

export function lastGoodSize(): number {
  return store.size;
}
