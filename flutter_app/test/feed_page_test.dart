import 'package:flutter_test/flutter_test.dart';
import 'package:try1second/core/feed_page.dart';

/// OWNER 18 Nov ("load more option flutter app mai movie vertical mai kyun ni aa raha, phle aata tha").
///
/// A city's movie feed is one card per film: Indore returned 5 titles, Mumbai 15, Pune 13 in the live
/// catalogue. With a 12-card first paint the pill could never appear for a normal city, because nothing
/// was left behind it. Movies now page like the web (4 +4) while the compact verticals keep the owner's
/// 7 Nov rule (open with a full screen of 12, +8 per tap).
void main() {
  groceryGridPaging();
  test('movies reveal four cards first, like the web', () {
    expect(FeedPage.initialFor('movies'), 4);
    expect(FeedPage.stepFor('movies'), 4);
  });

  test('compact verticals keep the full first screen the owner asked for on 7 Nov', () {
    for (final v in ['grocery', 'ecommerce', 'food', 'flights', 'hotels', 'bus', 'cab', 'creditcards']) {
      expect(FeedPage.initialFor(v), 12, reason: v);
      expect(FeedPage.stepFor(v), 8, reason: v);
    }
  });

  test('a five-film city now shows the pill with one card behind it', () {
    const total = 5;
    final first = FeedPage.showLoadMore(vertical: 'movies', visible: FeedPage.initialFor('movies'), total: total);
    expect(first, isTrue, reason: 'Indore: 5 films, 4 on screen, 1 more available');
    expect(FeedPage.remaining(visible: 4, total: total), 1);
    // after one tap everything is visible and the pill must go away
    expect(FeedPage.showLoadMore(vertical: 'movies', visible: 8, total: total), isFalse);
    expect(FeedPage.remaining(visible: 8, total: total), 0);
  });

  test('a feed that hides nothing never offers a button', () {
    expect(FeedPage.showLoadMore(vertical: 'movies', visible: 4, total: 4), isFalse);
    expect(FeedPage.showLoadMore(vertical: 'movies', visible: 4, total: 3), isFalse);
    expect(FeedPage.showLoadMore(vertical: 'grocery', visible: 12, total: 12), isFalse);
    expect(FeedPage.showLoadMore(vertical: 'grocery', visible: 12, total: 0), isFalse);
  });

  test('a longer movie city pages in fours until it is exhausted', () {
    var visible = FeedPage.initialFor('movies');
    var taps = 0;
    const total = 15; // Mumbai's live count
    while (FeedPage.showLoadMore(vertical: 'movies', visible: visible, total: total)) {
      visible += FeedPage.stepFor('movies');
      taps++;
      expect(taps, lessThan(10), reason: 'must terminate');
    }
    expect(visible, greaterThanOrEqualTo(total));
    expect(taps, 3, reason: '4 -> 8 -> 12 -> 16 for 15 films');
  });
}

/// OWNER 20 Nov: "abhi 4 card ke baad hi load more aa raha hai, 12 card ke baad aana chaiye." The grocery feed is
/// a 2-up grid, so a full screen is 12 tiles and each tap adds 8 — the same numbers the web now uses. Pinned here
/// so a future pagination tweak cannot quietly cut the grocery grid back to 4.
void groceryGridPaging() {
  test('grocery opens with 12 tiles and adds 8', () {
    expect(FeedPage.initialFor('grocery'), 12);
    expect(FeedPage.stepFor('grocery'), 8);
  });

  test('12 shown of 20 offers the pill, 12 of 12 does not', () {
    expect(FeedPage.showLoadMore(vertical: 'grocery', visible: 12, total: 20), isTrue);
    expect(FeedPage.showLoadMore(vertical: 'grocery', visible: 12, total: 12), isFalse);
    expect(FeedPage.remaining(visible: 12, total: 20), 8);
  });

  test('movies keep the 4-at-a-time reveal', () {
    expect(FeedPage.initialFor('movies'), 4);
    expect(FeedPage.stepFor('movies'), 4);
  });
}
