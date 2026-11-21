/// Vertical strip under the header — the app's copy of the website's `VerticalNav`
/// (src/components/VerticalNav.tsx).
///
/// OWNER 21 Nov (two screenshots, mobile site vs app home): the mobile site carries a horizontal
/// row directly under the header — Home · Nearby · Flights (20) · Hotels · … — and the app home
/// page had no such row at all, so a phone user could only reach a vertical by scrolling to the
/// launch grid or by opening the Compare tab first. This module is the ordering/label/badge rule,
/// kept free of Flutter so the widget and its test cannot drift apart.
///
/// Website parity rules reproduced here:
///  - the strip opens with Home and Nearby, then every vertical in `kVerticals` order,
///  - a chip's badge is a COUNT of rows already held for that vertical (the site counts the
///    current result set; the app counts its own per-vertical cache so the number survives a tab
///    switch, which is the same thing the user reads on the site),
///  - `movie` and `movies` are the same shelf, so a chip can never show 0 while the other id has rows,
///  - a zero badge is hidden (the site prints a 0 pill, which reads as "nothing here" on a phone).
library;

/// A single chip in the strip: Home, Nearby, or one of the verticals.
class VerticalNavItem {
  const VerticalNavItem({required this.id, required this.label, this.isHome = false, this.isNearby = false});

  /// `home`, `nearby`, or an engine vertical id (`flights`, `movie`, …).
  final String id;
  final String label;
  final bool isHome;
  final bool isNearby;
}

/// The engine id a chip stands for: the site and the engine disagree only on `movies`/`movie`.
String navVerticalId(String vertical) => vertical == 'movies' ? 'movie' : vertical;

/// Builds the strip: Home, Nearby, then every vertical in the order the site lists them.
List<VerticalNavItem> verticalNavItems(List<String> verticalIds, String Function(String id) labelFor) {
  final out = <VerticalNavItem>[
    const VerticalNavItem(id: 'home', label: 'Home', isHome: true),
    const VerticalNavItem(id: 'nearby', label: 'Nearby', isNearby: true),
  ];
  for (final v in verticalIds) {
    final id = navVerticalId(v);
    if (out.any((i) => i.id == id)) continue; // 'movies' and 'movie' are one chip
    out.add(VerticalNavItem(id: id, label: labelFor(id)));
  }
  return out;
}

/// How many rows each vertical already holds, keyed by chip id. Input is the vertical id of every
/// row the app has cached; the `movies`/`movie` pair is folded onto one key.
Map<String, int> navBadgeCounts(Iterable<String> rowVerticals) {
  final counts = <String, int>{};
  for (final v in rowVerticals) {
    final id = navVerticalId(v);
    if (id.isEmpty) continue;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

/// What a chip prints: the count when it has rows, nothing when it does not.
String navBadgeLabel(int count) => count > 0 ? (count > 99 ? '99+' : '$count') : '';
