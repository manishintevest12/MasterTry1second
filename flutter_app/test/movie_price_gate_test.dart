import 'package:flutter_test/flutter_test.dart';
import 'package:try1second/core/movie_price_gate.dart';
import 'package:try1second/core/search_poll.dart';

/// OWNER 21 Nov ("price kabhi app mai movie mai aata hai kabhi ni aata hai").
///
/// Measured against production: the same movie search answers twice in a row with the SAME films and
/// a different priced count (28 rows / 5 priced, then 41 rows / 10 priced) because the seat band that
/// prices a film arrives from District/TicketNew's session gateway a few seconds after the film list.
/// A response in that first state used to be cached as FRESH for five minutes and painted from disk on
/// the next launch, so the movie feed could stay price-less while the website showed the fares.
///
/// These tests pin the rule: films with no price is a snapshot, never a finished answer.
void main() {
  test('a film list with no priced row is never a finished answer', () {
    expect(MoviePriceGate.isUnpricedSnapshot('movies', 28, 0), isTrue);
    expect(MoviePriceGate.isUnpricedSnapshot('movie', 41, 0), isTrue);
    // One priced film is enough: the band landed.
    expect(MoviePriceGate.isUnpricedSnapshot('movies', 41, 1), isFalse);
    // An honest empty answer is not a snapshot either - it must release to the empty state.
    expect(MoviePriceGate.isUnpricedSnapshot('movies', 0, 0), isFalse);
  });

  test('other verticals are untouched by the movie rule', () {
    for (final v in ['grocery', 'food', 'ecommerce', 'flights', 'hotels', 'bus', 'cab']) {
      expect(MoviePriceGate.isUnpricedSnapshot(v, 12, 0), isFalse, reason: v);
      expect(
        MoviePriceGate.cacheHitIsFresh(v, rows: 12, pricedRows: 0, pendingRefresh: false),
        isTrue,
        reason: v,
      );
    }
  });

  test('an unpriced movie cache hit is painted but revalidated', () {
    // The five-minute fresh window must not freeze a price-less movie feed.
    expect(
      MoviePriceGate.cacheHitIsFresh('movies', rows: 28, pricedRows: 0, pendingRefresh: false),
      isFalse,
    );
    // A priced movie answer keeps the normal cache behaviour.
    expect(
      MoviePriceGate.cacheHitIsFresh('movies', rows: 28, pricedRows: 9, pendingRefresh: false),
      isTrue,
    );
    // The server's own pending flag always wins.
    expect(
      MoviePriceGate.cacheHitIsFresh('movies', rows: 28, pricedRows: 9, pendingRefresh: true),
      isFalse,
    );
  });

  test('the movie chain keeps polling until a price lands, within the same budget', () {
    expect(
      MoviePriceGate.stillPending('movies', rows: 28, pricedRows: 0, serverPending: false),
      isTrue,
    );
    expect(
      MoviePriceGate.stillPending('movies', rows: 28, pricedRows: 9, serverPending: false),
      isFalse,
    );
    expect(
      MoviePriceGate.stillPending('grocery', rows: 28, pricedRows: 0, serverPending: false),
      isFalse,
    );
  });

  test('the poll budget still ends a gateway that never answers', () {
    // 40 polls x 2s: the same bound the web uses, so an unpriced film list can never hold the
    // progress panel forever. Rows that stop growing hit the budget; growth resets it.
    final stale = pollDecision(
      pendingRefresh: MoviePriceGate.stillPending('movies', rows: 28, pricedRows: 0, serverPending: false),
      pollCount: kSearchMaxPolls,
      maxPolls: kSearchMaxPolls,
      rows: 28,
      prevRows: 28,
    );
    expect(stale.keepPolling, isFalse);
    expect(stale.keepPendingFlag, isFalse);

    final early = pollDecision(
      pendingRefresh: MoviePriceGate.stillPending('movies', rows: 28, pricedRows: 0, serverPending: false),
      pollCount: 3,
      maxPolls: kSearchMaxPolls,
      rows: 28,
      prevRows: 20,
    );
    expect(early.keepPolling, isTrue);
  });

  test('priced rows are counted, not guessed', () {
    expect(MoviePriceGate.pricedCount([true, false, true, false]), 2);
    expect(MoviePriceGate.pricedCount(const <bool>[]), 0);
  });
}
