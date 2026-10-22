import 'package:flutter_test/flutter_test.dart';
import 'package:try1second/core/compare.dart';

/// Owner 22 Oct: Uber/Ola cab rows carry a server-built in-app booking link
/// (/api/cab/book -> /api/out) so the provider's own app opens with the trip
/// prefilled — real fare, direct booking, affiliate params injected server-side.
void main() {
  final j = {
    'id': 'c1',
    'vertical': 'cab',
    'title': 'Indore to Bhopal cab (Swift Dzire, one-way)',
    'subtitle': 'Bharat Taxi',
    'provider': 'Bharat Taxi',
    'appBookUrl': '/api/cab/book?provider=uber&pickup=Indore&drop=Bhopal&offerId=c1',
    'sellerQuotes': [
      {'id': 'q1', 'sellerName': 'Bharat Taxi', 'price': 2600, 'url': '/api/out?t=x', 'isLowest': true}
    ],
  };

  test('CompareItem.fromJson parses appBookUrl', () {
    final it = CompareItem.fromJson(j);
    expect(it.appBookUrl, '/api/cab/book?provider=uber&pickup=Indore&drop=Bhopal&offerId=c1');
  });

  test('appBookUrl is null for rows without one (other verticals unaffected)', () {
    final it = CompareItem.fromJson({...j, 'id': 'h1', 'vertical': 'hotels'});
    // vertical changed but appBookUrl present -> still parsed; drop it instead
    final no = CompareItem.fromJson({...j, 'appBookUrl': null});
    expect(no.appBookUrl, isNull);
    expect(CompareItem.fromJson({...j, 'appBookUrl': ''}).appBookUrl, isNull);
    expect(it.appBookUrl, isNotNull);
  });

  test('withQuote preserves appBookUrl (grouped per-site rows keep the link)', () {
    final it = CompareItem.fromJson(j);
    final row = it.withQuote(it.sellerQuotes.first);
    expect(row.appBookUrl, it.appBookUrl);
  });
}
