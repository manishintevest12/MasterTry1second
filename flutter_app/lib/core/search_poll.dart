/// Poll-chain bookkeeping for the SearchProgress panel (owner 28 Oct).
///
/// The panel is gated on a per-vertical `pendingRefresh` flag copied from the
/// last response. That flag must only outlive the chain that is still polling:
/// otherwise a search whose slowest sources never answered left "Checking
/// Yatra… 8 of 9 airlines & booking sites" on screen forever with no data — the
/// reported permanent loader ("last me ruk jata hai, results ni deta; tab
/// switch kar ke wapas aao to aa jate hain").
///
/// Web parity: the website already routes this through src/lib/searchPolling.ts
/// (pollDecision). This is the same rule, so the two clients can never disagree
/// about when the panel is allowed to let go.
library;

/// How many extra pendingRefresh polls one search may make. 2s apart, so ~80s of
/// background acquisition: enough for the cold travel pipelines that finish at
/// 40-60s, and still bounded so a gated source cannot hold the panel forever.
const int kSearchMaxPolls = 40;

class PollDecision {
  const PollDecision({
    required this.keepPolling,
    required this.exhaustedWithoutRows,
    required this.keepPendingFlag,
    required this.settle,
  });

  /// Another forced poll should be scheduled.
  final bool keepPolling;

  /// The chain is over and it never produced a single row, so the panel must be
  /// released (the honest empty state, which offers Retry, takes over).
  final bool exhaustedWithoutRows;

  /// The response still represents work in progress (panel may stay mounted).
  final bool keepPendingFlag;

  /// One final NON-forced read is worth doing: the server's warmed cache usually
  /// holds the finished answer a moment after the chain gave up, so the results
  /// land on their own instead of waiting for the user to leave the tab and come
  /// back (which is what used to "fix" it).
  final bool settle;

  @override
  String toString() =>
      'PollDecision(keepPolling: $keepPolling, exhaustedWithoutRows: $exhaustedWithoutRows, '
      'keepPendingFlag: $keepPendingFlag, settle: $settle)';
}

/// Mirrors src/lib/searchPolling.ts `pollDecision`, plus the settle step the app
/// needs because remounting the screen used to be the only way to refresh the
/// cached answer.
PollDecision pollDecision({
  required bool pendingRefresh,
  required int pollCount,
  required int maxPolls,
  required int rows,
  bool settled = false,
}) {
  final keepPolling = pendingRefresh && pollCount < maxPolls;
  final exhaustedWithoutRows = pendingRefresh && !keepPolling && rows == 0;
  // The flag survives ONLY while another poll is actually coming. That is the
  // one rule that makes a frozen panel impossible: no scheduled poll means no
  // "Checking Yatra… 8 of 9" left on screen.
  final keepPendingFlag = keepPolling;
  return PollDecision(
    keepPolling: keepPolling,
    exhaustedWithoutRows: exhaustedWithoutRows,
    keepPendingFlag: keepPendingFlag,
    settle: exhaustedWithoutRows && !settled,
  );
}
