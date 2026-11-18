/// Feed pagination — how many result cards the app paints first, and how many "Load More" reveals.
///
/// WHY THIS FILE EXISTS
/// The rule lived as two magic numbers inside the compare screen (`_visibleCount = 12`, `+= 8`), so it
/// could not be tested and could not differ per vertical. That is exactly how the movies feed lost its
/// Load More pill:
///   - the pill only renders when the feed holds MORE groups than are visible (correct: it must never be
///     a dead button),
///   - a city's now-showing list is one card per film, and most Indian cities have 5–12 films,
///   - with the app's first paint at 12, a normal movie feed never exceeded the first screen, so there
///     was never anything to reveal and the pill silently disappeared (owner 18 Nov: "movie vertical mai
///     load more option kyun ni aa raha, pehle aata tha").
/// The web reveals 4 movie cards at a time, so a 5-film city shows "1 more" on the site but nothing in
/// the app. Movies now follow the web exactly; the compact verticals keep the owner's 7 Nov instruction
/// ("app should open with a full screen of groups, not 4"), which was about product/travel feeds.
library;

class FeedPage {
  const FeedPage._();

  /// Verticals whose cards are TALL (a film card carries poster, prices, theatre rows and showtimes), so a
  /// phone screen holds about four of them — the web's rule for these.
  static const Set<String> tallCardVerticals = {'movies', 'movie'};

  /// Groups painted before the first "Load More" tap.
  static int initialFor(String vertical) => tallCardVerticals.contains(vertical) ? 4 : 12;

  /// Groups a "Load More" tap adds. Web parity: +4 for the tall feeds, +8 elsewhere.
  static int stepFor(String vertical) => tallCardVerticals.contains(vertical) ? 4 : 8;

  /// The pill appears only when the feed really holds more groups than are on screen. A feed of exactly
  /// [initialFor] cards (or fewer) hides nothing, so it must not offer a button that reveals nothing.
  static bool showLoadMore({required String vertical, required int visible, required int total}) {
    if (total <= 0) return false;
    final shown = visible < 0 ? 0 : visible;
    return total > shown;
  }

  /// How many groups are still behind the pill, for its label.
  static int remaining({required int visible, required int total}) {
    final left = total - visible;
    return left > 0 ? left : 0;
  }
}
