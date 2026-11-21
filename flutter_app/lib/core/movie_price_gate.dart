/// MOVIE PRICE FRESHNESS (owner 21 Nov: "price kabhi app mai movie mai aata hai kabhi ni aata hai").
///
/// WHY THIS FILE EXISTS
/// A movie card's price does not come from the seller that names the film. BookMyShow publishes no
/// fare at all; the number comes from the seat band that District/TicketNew's public session gateway
/// reports, filled onto the film by the server (server/search/moviesPriceFill.ts). That band lands a
/// few seconds AFTER the film list does, so the pipeline has two honest states for the same search:
///
///   1. films present, not one priced yet  -> a SNAPSHOT, the chain is still working
///   2. films present with priced rows     -> the finished answer
///
/// The app treated state 1 as a finished answer. Movies are "travel-like", so a response is a FRESH
/// cache hit for five minutes (and the last session's answer is painted from disk at launch), which
/// meant one price-less snapshot froze the movie feed for the rest of the window while the website -
/// which revalidates - showed the prices. That is exactly the reported "sometimes the price is there,
/// sometimes it is not": it depended on whether the snapshot that got cached happened to carry the
/// band. Nothing here invents a price; it only decides that an unpriced film list is not an answer
/// yet, so the chain keeps asking until the band arrives or the budget honestly ends.
library;

class MoviePriceGate {
  const MoviePriceGate._();

  /// The site's id is `movies`, the engine accepts both.
  static bool isMovie(String vertical) => vertical == 'movie' || vertical == 'movies';

  /// A film list with no priced row is a snapshot, never a finished answer.
  static bool isUnpricedSnapshot(String vertical, int rows, int pricedRows) =>
      isMovie(vertical) && rows > 0 && pricedRows <= 0;

  /// How many of these rows carry a real price (the seat band counts as one, the server marks it
  /// `priceAvailable: true` when it fills a band).
  static int pricedCount(Iterable<bool> priceAvailable) =>
      priceAvailable.where((p) => p).length;

  /// A cached movie answer may be painted instantly, but it must never be served as FRESH while it
  /// holds films and no price: the revalidation is what turns state 1 into state 2.
  static bool cacheHitIsFresh(String vertical, {required int rows, required int pricedRows, required bool pendingRefresh}) =>
      !pendingRefresh && !isUnpricedSnapshot(vertical, rows, pricedRows);

  /// The poll chain's pending flag: the server's own `pendingRefresh` OR an unpriced film list, which
  /// is the same thing from the user's point of view. The caller still bounds this with its poll
  /// budget, so a gated gateway can never hold the panel forever.
  static bool stillPending(String vertical, {required int rows, required int pricedRows, required bool serverPending}) =>
      serverPending || isUnpricedSnapshot(vertical, rows, pricedRows);
}
