import 'package:flutter_test/flutter_test.dart';
import 'package:try1second/core/api.dart';

void main() {
  test('LensResponse parses a found product with cheapest offers', () {
    final res = LensResponse.fromJson({
      'found': true,
      'product': {'title': 'Apple iPhone 17 (Black, 256 GB)', 'merchant': 'Flipkart', 'pagePrice': 89999},
      'pageVsCheapest': {'pagePrice': 89999, 'cheapest': 86999, 'saving': 3000},
      'results': [
        {'id': 'a', 'title': 'Apple iPhone 17 (Black, 256 GB)', 'seller': 'Flipkart', 'price': 86999, 'goUrl': '/api/out/x'},
        {'id': 'b', 'title': 'Apple iPhone 17 (White, 256 GB)', 'seller': 'Myntra', 'price': 87499, 'goUrl': '/api/out/y'},
      ],
    });
    expect(res.found, true);
    expect(res.merchant, 'Flipkart');
    expect(res.pagePrice, 89999);
    expect(res.savingVsPage, 3000);
    expect(res.offers.length, 2);
    expect(res.offers.first.seller, 'Flipkart');
    expect(res.offers.first.price, 86999);
  });

  test('LensResponse parses a not-found / bot-gated link honestly', () {
    final res = LensResponse.fromJson({
      'found': false,
      'message': 'Could not read a product name from that link.',
      'results': [],
    });
    expect(res.found, false);
    expect(res.offers, isEmpty);
    expect(res.message, contains('Could not read'));
  });

  test('AssistIntent parses a flights route with a date', () {
    final i = AssistIntent.fromJson({
      'understood': true,
      'vertical': 'flights',
      'query': 'Delhi to Mumbai',
      'date': '2026-10-15',
      'reply': 'Opening Flights and searching "Delhi to Mumbai" for 2026-10-15.',
    });
    expect(i.understood, true);
    expect(i.vertical, 'flights');
    expect(i.query, 'Delhi to Mumbai');
    expect(i.date, '2026-10-15');
  });

  test('AssistIntent parses an honestly-not-understood question', () {
    final i = AssistIntent.fromJson({
      'understood': false,
      'vertical': null,
      'query': '',
      'reply': 'I could not tell which category that is.',
    });
    expect(i.understood, false);
    expect(i.vertical, isNull);
  });
}
