import 'package:flutter_test/flutter_test.dart';
import 'package:try1second/core/api.dart';

/// E2E (owner 23 Oct: product page "website jaisa" reference layout): the app's
/// EXACT client must surface everything the new product screen renders —
/// same-product compare offers (cheapest first), gallery, deal scanner stats
/// (all-time low / average / high + score breakup) and real history points.
void main() {
  final api = Try1SecondApi(baseUrl: 'http://127.0.0.1:4545');

  test('product-page: compare offers, gallery and deal scanner data (web parity)', () async {
    final page = await api.productPage('boat airdopes 141').timeout(const Duration(seconds: 60));
    expect(page.found, isTrue, reason: 'typed name must resolve like the website');
    expect(page.title, contains('boat'));
    expect(page.offers, isNotEmpty, reason: 'compare list must have seller rows');

    // Cheapest-first ordering (web shows 'Lowest price' on the first row).
    final prices = page.offers.map((o) => o.price).toList();
    for (var i = 1; i < prices.length; i++) {
      expect(prices[i], greaterThanOrEqualTo(prices.first),
          reason: 'first offer must be the cheapest (Lowest price row)');
    }
    for (final o in page.offers) {
      expect(o.seller, isNotEmpty);
      expect(o.price, greaterThan(0));
      expect(o.goUrl, isNotEmpty, reason: 'every compare row must carry an exit link');
    }

    // Gallery: the reference layout is a big hero + thumbnail rail.
    expect(page.images, isNotEmpty);

    // Deal Scanner tab: recorded-history stats + score breakup.
    expect(page.hasHistory, isTrue, reason: 'real recorded history must exist (no invented stats)');
    expect(page.allTimeLow, allOf(isNotNull, greaterThan(0)));
    expect(page.average, allOf(isNotNull, greaterThan(0)));
    expect(page.allTimeHigh, allOf(isNotNull, greaterThanOrEqualTo(page.allTimeLow!)));
    expect(page.score, greaterThan(0));
    expect(page.breakup, isNotEmpty, reason: 'score breakup rows drive the scanner list');
    expect(page.history, isNotEmpty, reason: 'history chart needs real points');
  }, timeout: const Timeout(Duration(seconds: 90)));
}
