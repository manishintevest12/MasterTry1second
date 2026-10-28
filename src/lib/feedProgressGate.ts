/**
 * Which view owns the feed right now: the progress panel, the rows, or the honest empty state.
 *
 * OWNER 28 Oct (screenshot + "city change karta hoon to aisa ni aa raha, sirf shuru me aata hai"):
 * the panel used to be gated on "no rows on screen", so it appeared on the first load and then
 * never again: changing the city left the previous city's rows in place and the new search ran
 * invisibly. The rule is now simple and vertical-agnostic:
 *
 *   - a new search is in flight (isNewSearchPending) -> the panel owns the feed, even while the
 *     previous search's rows are still in state (they are stale, not an answer to this search)
 *   - the engine is still acquiring and there is nothing to show yet -> the panel
 *   - nothing is running and there are no rows -> the honest empty state
 *   - otherwise -> the rows
 */
export type FeedView = 'progress' | 'rows' | 'empty';

export function feedProgressGate(input: {
  rows: number;
  liveProgress: boolean;
  isNewSearchPending: boolean;
}): FeedView {
  const rows = Number(input.rows) || 0;
  if (input.liveProgress && (rows === 0 || input.isNewSearchPending)) return 'progress';
  return rows === 0 ? 'empty' : 'rows';
}
