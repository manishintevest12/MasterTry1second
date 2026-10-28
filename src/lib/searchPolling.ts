/**
 * Poll-chain bookkeeping for the search-progress panel (owner 28 Oct).
 *
 * The loader is gated on a per-vertical `pendingRefresh` flag copied from the last
 * response. That flag must only outlive the chain that is still polling: otherwise a
 * search whose sources never answered left "Checking Cleartrip… 8 of 9" on screen
 * forever with no data (the reported permanent loader). These helpers keep the rule in
 * one place so the panel and the poll scheduler can never disagree.
 */
export function pollDecision(
  pendingRefresh: boolean,
  pollCount: number,
  maxPolls: number,
  rows: number,
): { keepPolling: boolean; exhaustedWithoutRows: boolean; keepPendingFlag: boolean } {
  const keepPolling = pendingRefresh && pollCount < maxPolls;
  const exhaustedWithoutRows = pendingRefresh && !keepPolling && rows === 0;
  return { keepPolling, exhaustedWithoutRows, keepPendingFlag: pendingRefresh && !exhaustedWithoutRows };
}
