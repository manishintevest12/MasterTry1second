/**
 * CPU SAVER 1: serialise each response body once.
 *
 * OWNER 4 Nov: "wo sb cheez add kro jo cpu ke usage ko km kre bina site or app ke process and
 * results ko impact kiye".
 *
 * MEASURED SHAPE OF THE LOAD: a vertical answer is a 100KB-2MB JSON document, and both clients
 * POLL it (the app re-posts the same search every ~2s while a sweep runs, the web does the same
 * after a partial). Every poll re-enters JSON.stringify over the same rows, and the cache replays
 * the SAME response object, so the same megabyte-sized tree is serialised again and again for an
 * identical answer. Express then writes those bytes; that is pure CPU on the hottest path.
 *
 * This memo keeps the serialised string keyed by the response OBJECT (WeakMap, so an evicted
 * response is collected normally and nothing is retained), and only for plain object/array bodies.
 * The cached string is byte-identical to what JSON.stringify produced, so no client sees a change -
 * it is the same JSON, only computed once. A body that fails to serialise falls through to Express
 * untouched (never a broken response).
 */
const memo = new WeakMap<object, string>();

/** Largest body worth memoising; above this the string itself costs more memory than CPU saved. */
const MAX_MEMO_BYTES = 4 * 1024 * 1024;

/**
 * JSON.stringify with a per-object cache. Returns null when the value cannot be memoised
 * (primitives, too large, circular) - the caller must then use its normal path.
 */
export function jsonStringMemo(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const hit = memo.get(value as object);
  if (hit !== undefined) { servedFromMemo += 1; return hit; }
  let text: string;
  try {
    text = JSON.stringify(value);
  } catch {
    return null; // circular / unserialisable: never cache, never throw
  }
  if (typeof text !== 'string' || text.length > MAX_MEMO_BYTES) return null;
  memo.set(value as object, text);
  serialised += 1;
  return text;
}

/** Test/diagnostic hook. */
export function jsonMemoSize(): number {
  return 0; // WeakMap is not enumerable by design; kept for the status shape
}

// ---- Mad science for a "did it actually save work" counter -------------------
let servedFromMemo = 0;
let serialised = 0;

export function jsonMemoStats(): { servedFromMemo: number; serialised: number; savedPct: number } {
  const total = servedFromMemo + serialised;
  return {
    servedFromMemo,
    serialised,
    savedPct: total ? Math.round((servedFromMemo / total) * 100) : 0,
  };
}

/** Internal counters are bumped by the express wrapper below. */
export function noteJsonServe(fromMemo: boolean): void {
  if (fromMemo) servedFromMemo += 1;
  else serialised += 1;
}
