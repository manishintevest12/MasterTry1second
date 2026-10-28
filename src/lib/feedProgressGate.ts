/**
 * Which view owns the feed right now: the progress panel, the rows, the "your filters hide
 * everything" notice, or the honest empty state.
 *
 * OWNER 28 Oct (second screenshot: the progress panel ran, then the page landed on
 * "No matching options found" while the sidebar still said live prices were loading):
 * "loader load hone ke baad ye issue nahi aana chahiye, ek baar loader load hua result 100%,
 * ye trust break karta hai."
 *
 * The empty state used to be reachable three wrong ways:
 *   1. a filter (category chip / smart filter) hid every row that had actually arrived,
 *   2. rows were present but tagged with the other spelling of the vertical (movie / movies),
 *   3. the poll chain released before the pipeline's warmed answer came back.
 *
 * So the gate now distinguishes "we have rows, your filters hid them" ('filtered') from
 * "the engine really returned nothing" ('empty'), and 'empty' needs the chain to be settled.
 */
export type FeedView = 'progress' | 'rows' | 'filtered' | 'empty';

export function feedProgressGate(input: {
  /** rows left after the user's filters */
  rows: number;
  /** rows the engine returned for this vertical, before any filter (defaults to `rows`) */
  availableRows?: number;
  liveProgress: boolean;
  isNewSearchPending: boolean;
  /** rows exist but every one of them was hidden by a filter -> offer a way back */
  filtersActive?: boolean;
}): FeedView {
  const rows = Number(input.rows) || 0;
  const available = Number(input.availableRows ?? rows) || 0;
  // A brand-new search owns the feed even while the previous search's rows are still in state
  // (they are stale, not an answer to this search).
  if (input.isNewSearchPending) return 'progress';
  // Real rows always win: background acquisition of extra sources must never hide a grid that
  // is already on screen (owner 28 Oct: the panel may not re-take the feed once rows exist).
  if (rows > 0) return 'rows';
  // Rows reached us but the user's own filter hides them: say that, never "nothing found".
  if (available > 0) return 'filtered';
  // Still acquiring and genuinely nothing yet -> the progress panel, not the empty page.
  if (input.liveProgress) return 'progress';
  return 'empty';
}
