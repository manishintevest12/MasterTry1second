/**
 * CPU reducers for the hottest endpoint: POST /api/scrape/live.
 *
 * OWNER 4 Nov: "existing results और flow को बिना delete किए CPU-reducer code लगाकर /api/scrape/live का
 * load कम kre."
 *
 * WHAT THE ROUTE DOES ON EVERY POLL (measured by reading it, not guessed): both clients re-post the
 * same search every ~2s while a sweep runs, and each one re-runs the whole answer assembly over the
 * SAME cached rows - a regex per query word per row for relevance, the accessory check, and a full
 * offer -> comparison-item mapping per row (masking pointer, merchant deep link, history object,
 * seller quote). For a 240-row hotel answer that is thousands of regex tests and hundreds of link
 * builds, per poll, for an answer that is identical.
 *
 * Both memos below are pure: same input, same value. They never reorder, drop or add a row, and they
 * never touch a price. A value is only reused when the INPUT is identical, so a fresh pipeline answer
 * (new row objects) is assembled from scratch exactly as before.
 */

// ---- 1. Relevance hit per (query, normalised title) -------------------------
const REL_MAX = Math.max(500, Number(process.env.T1S_RELEVANCE_MEMO_MAX) || 20_000);
/** Kill switch: T1S_LIVE_MEMO=0 turns both memos off (measurement / instant rollback). */
const ENABLED = () => process.env.T1S_LIVE_MEMO !== '0';
const relMemo = new Map<string, number>();

/**
 * `hit` for one row title, computed once per (query, title). The scoring itself is the expensive part
 * (a RegExp built per query word per row plus a synonym walk), and the same titles come back on every
 * poll of the same answer.
 */
export function memoRelevanceHit(queryKey: string, titleLower: string, compute: () => number): number {
  if (!ENABLED()) { relComputed += 1; return compute(); }
  const key = `${queryKey}\u0000${titleLower}`;
  const hit = relMemo.get(key);
  if (hit !== undefined) { relHits += 1; return hit; }
  const value = compute();
  if (relMemo.size >= REL_MAX) relMemo.clear(); // bounded; a new query simply warms again
  relMemo.set(key, value);
  relComputed += 1;
  return value;
}

// ---- 2. Offer -> comparison item per (offer object, request travel) ---------
const itemMemo = new WeakMap<object, Map<string, any>>();

/**
 * The legacy item shape for one offer, built once per (offer, travel context).
 *
 * IMPORTANT: the caller hands these objects to groupSameProduct(), which merges quotes into its
 * output. Returning the memoised object itself would let a later poll see merged quotes, so the memo
 * hands back a SHALLOW COPY with its own sellerQuotes array: identical JSON, no shared mutation, and
 * still far cheaper than rebuilding the masking pointer, deep link, history block and quote.
 */
export function memoComparisonItem<T extends Record<string, any>>(offer: any, travelSig: string, compute: () => T): T {
  const holder = (ENABLED() && offer && typeof offer === 'object') ? offer as object : null;
  if (!holder) { itemsComputed += 1; return compute(); }
  let bySig = itemMemo.get(holder);
  if (!bySig) { bySig = new Map(); itemMemo.set(holder, bySig); }
  const hit = bySig.get(travelSig);
  if (hit) { itemsServed += 1; return cloneItem(hit) as T; }
  const built = compute();
  bySig.set(travelSig, built);
  itemsComputed += 1;
  return cloneItem(built) as T;
}

function cloneItem<T extends Record<string, any>>(item: T): T {
  const copy: any = { ...item };
  if (Array.isArray(item.sellerQuotes)) copy.sellerQuotes = item.sellerQuotes.map((q: any) => ({ ...q }));
  if (Array.isArray(item.priceHistory)) copy.priceHistory = item.priceHistory.slice();
  if (item.specs && typeof item.specs === 'object') copy.specs = { ...item.specs };
  return copy as T;
}

// ---- counters (served from /api/status so the saving is measured) -----------
let relHits = 0;
let relComputed = 0;
let itemsServed = 0;
let itemsComputed = 0;

export function liveAnswerMemoStats(): {
  relevance: { servedFromMemo: number; computed: number; savedPct: number };
  items: { servedFromMemo: number; computed: number; savedPct: number };
} {
  const relTotal = relHits + relComputed;
  const itemTotal = itemsServed + itemsComputed;
  return {
    relevance: { servedFromMemo: relHits, computed: relComputed, savedPct: relTotal ? Math.round((relHits / relTotal) * 100) : 0 },
    items: { servedFromMemo: itemsServed, computed: itemsComputed, savedPct: itemTotal ? Math.round((itemsServed / itemTotal) * 100) : 0 },
  };
}

/** Test hook: clear the (bounded) relevance memo between cases. */
export function _resetLiveAnswerMemo(): void {
  relMemo.clear();
  relHits = 0;
  relComputed = 0;
  itemsServed = 0;
  itemsComputed = 0;
}
