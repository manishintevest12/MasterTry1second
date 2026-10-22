import 'package:flutter_test/flutter_test.dart';
import 'package:try1second/core/api.dart';

/// E2E (owner 22 Oct: home search "web jaisa result" check): run the app's
/// EXACT client pipeline against the local server. Typed name must come back
/// found with same-product compare offers; a real product link must resolve.
void main() {
  final api = Try1SecondApi(baseUrl: 'http://127.0.0.1:4545');

  test('typed product name -> product-page compare offers (web parity)', () async {
    final page = await api.productPage('boat airdopes 141').timeout(const Duration(seconds: 60));
    expect(page.found, isTrue, reason: 'typed name must resolve like the website');
    expect(page.title, contains('boat'));
    expect(page.offers, isNotEmpty, reason: 'compare offers must be present');
    final o = page.offers.first;
    expect(o.seller, isNotEmpty);
    expect(o.price, greaterThan(0));
    expect(o.goUrl, isNotEmpty);
  }, timeout: const Timeout(Duration(seconds: 90)));

  test('AI insights scan: real Flipkart link resolves through the app pipeline', () async {
    const url = 'https://www.flipkart.com/apple-iphone-15-blue-128-gb/p/itm6f70841e0e6f0';
    final r = await api.scanUrl(url).timeout(const Duration(seconds: 90));
    expect(r.title.trim(), isNotEmpty, reason: 'hardened resolver should read or slug-fallback the link');
    expect(r.vertical, isNotEmpty);
  }, timeout: const Timeout(Duration(seconds: 120)));

  test('AI insights probe: vertical live search returns a real spread (polling path)', () async {
    final res = await api.search('iphone 15', vertical: 'ecommerce').timeout(const Duration(seconds: 60));
    expect(res.results, isNotEmpty, reason: 'ecommerce probe must return live rows');
    final priced = res.results.where((o) => o.effectivePrice > 0).length;
    expect(priced, greaterThan(1), reason: 'insight cards need >=2 priced offers');
  }, timeout: const Timeout(Duration(seconds: 90)));
}
