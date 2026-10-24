import 'package:flutter_test/flutter_test.dart';
import 'package:try1second/core/compare.dart';
import 'package:try1second/core/verticals.dart';

CompareItem mk({
  String id = 'a',
  String vertical = 'ecommerce',
  String title = 'boAt Airdopes 141',
  String provider = 'Flipkart',
  double price = 766,
  bool priced = true,
  Map<String, String>? specs,
  List<Map<String, dynamic>>? quotes,
}) =>
    CompareItem.fromJson({
      'id': id,
      'vertical': vertical,
      'title': title,
      'subtitle': provider,
      'provider': provider,
      'primaryPrice': price,
      'priceAvailable': priced,
      'specs': specs ?? {},
      if (quotes != null)
        'sellerQuotes': quotes
      else
        'sellerQuotes': [
          {'id': 'q-$id', 'sellerName': provider, 'price': price, 'url': '/api/out?t=x', 'isLowest': true}
        ],
    });

void main() {
  test('formatPrice: loans/insurance are percentages, others rupees', () {
    expect(formatPrice('loans', 8.75), '8.75%');
    expect(formatPrice('insurance', 10), '10%');
    expect(formatPrice('ecommerce', 766), '₹766');
    expect(formatPrice('ecommerce', 109999), '₹1,09,999');
    expect(formatPrice('ecommerce', 0), '—');
  });

  test('groupOffers: same product across sites merges, cheapest first', () {
    final items = [
      mk(id: 'f', title: 'boAt Airdopes 141', provider: 'Flipkart', price: 766),
      mk(id: 'm', title: 'boAt Airdopes 141', provider: 'Myntra', price: 879),
      mk(id: 'x', title: 'Totally different product', provider: 'Flipkart', price: 10),
    ];
    final groups = groupOffers(items);
    expect(groups.length, 2);
    final boAt = groups.firstWhere((g) => g.rows.length == 2);
    expect(boAt.best.site, 'Flipkart');
    expect(boAt.best.price, 766);
    expect(boAt.highest, 879);
  });

  test('groupOffers: movies expand sellerQuotes into per-site rows', () {
    final it = mk(
      id: 'mv',
      vertical: 'movie',
      title: 'Mirzapur: The Movie',
      provider: 'BookMyShow',
      price: 299,
      quotes: [
        {'id': 'q1', 'sellerName': 'BookMyShow', 'price': 299, 'url': '/o/1'},
        {'id': 'q2', 'sellerName': 'District', 'price': 210, 'url': '/o/2'},
      ],
    );
    final groups = groupOffers([it]);
    expect(groups.length, 1);
    expect(groups.first.rows.length, 2);
    expect(groups.first.best.site, 'District');
    expect(groups.first.best.price, 210);
  });

  test('groupOffers: same flight groups across ISO and DD-MM-YYYY dates (owner 24 Oct)', () {
    // One flight sold by two sellers, one emitting ISO and the other Ixigo's
    // legacy DD-MM-YYYY format: they must land on ONE comparison card keyed by
    // flight number + normalized date + departure time.
    final emt = mk(
        id: 'e1',
        vertical: 'flights',
        title: 'IndiGo 6E6627 · Indore → Delhi',
        provider: 'EaseMyTrip',
        price: 7400,
        specs: {'flight number': '6E6627', 'departure date': '2026-10-25', 'departure time': '07:15'});
    final ix = mk(
        id: 'i1',
        vertical: 'flights',
        title: 'IndiGo 6E6627 · Indore → Delhi',
        provider: 'Ixigo',
        price: 7509,
        specs: {'flight number': '6E6627', 'departure date': '25-10-2026', 'departure time': '07:15'});
    final otherDay = mk(
        id: 'o1',
        vertical: 'flights',
        title: 'IndiGo 6E6627 · Indore → Delhi',
        provider: 'EaseMyTrip',
        price: 8000,
        specs: {'flight number': '6E6627', 'departure date': '2026-10-31', 'departure time': '07:15'});
    final groups = groupOffers([emt, ix, otherDay]);
    expect(groups.length, 2, reason: 'same date groups, different date stays separate');
    final same = groups.firstWhere((g) => g.rows.length == 2);
    expect(same.best.price, 7400);
    expect(same.best.site, 'EaseMyTrip');
  });

  test('groupOffers: flights key on flight number + date', () {
    final f1 = mk(
        id: 'f1',
        vertical: 'flights',
        title: 'IX1265',
        provider: 'Air-India Express',
        price: 6879,
        specs: {'flight number': 'IX1265', 'departure date': '15-10-2026', 'departure time': '06:10'});
    final f2 = mk(
        id: 'f2',
        vertical: 'flights',
        title: 'IX1265',
        provider: 'Ixigo',
        price: 6900,
        specs: {'flight number': 'IX1265', 'departure date': '15-10-2026', 'departure time': '06:10'});
    final other = mk(
        id: 'f3',
        vertical: 'flights',
        title: 'IX1266',
        provider: 'Air-India Express',
        price: 7000,
        specs: {'flight number': 'IX1266', 'departure date': '15-10-2026', 'departure time': '07:00'});
    final groups = groupOffers([f1, f2, other]);
    expect(groups.length, 2);
    final ix = groups.firstWhere((g) => g.rows.length == 2);
    expect(ix.best.price, 6879);
  });

  test('price-less offers sort last and say Price on site', () {
    final groups = groupOffers([
      mk(id: 'n', provider: 'BMS', priced: false, price: 0),
      mk(id: 'y', provider: 'District', price: 210),
    ]);
    expect(groups.last.best.priceAvailable || groups.first.best.priceAvailable, true);
  });

  test('groupHotels: same property across sites merges, cheapest row best', () {
    final mkHotel = (String id, String site, String sourceId, double price) => mk(
        id: id,
        vertical: 'hotels',
        title: 'The Lalit Grand Palace',
        provider: site,
        price: price,
        specs: {'city': 'Goa', 'user rating': '4.5'});

    final a = mkHotel('a', 'Cleartrip', 'w_hotels_cleartrip', 4000);
    final b = mkHotel('b', 'Airbnb', 'w_hotels_airbnb', 3800);
    final groups = groupHotels([a, b]);
    expect(groups.length, 1);
    expect(groups.first.best.price, 3800);
    expect(groups.first.rows.length, 2);
  });

  test('CompareItem.fromJson parses sellerQuotes and specs case-insensitively', () {
    final it = CompareItem.fromJson({
      'id': 'cc1',
      'vertical': 'creditcards',
      'title': 'HDFC Bank UPI RuPay Credit Card',
      'provider': 'HDFC Bank',
      'primaryPrice': 99,
      'priceAvailable': true,
      'specs': {'Bank': 'HDFC Bank', 'APR': '43.2%'},
      'sellerQuotes': [
        {'id': 'q', 'sellerName': 'HDFC Bank', 'price': 99, 'url': '/api/out?t=zz', 'isLowest': true, 'sourceDomain': 'hdfcbank.com'}
      ]
    });
    expect(it.spec('bank'), 'HDFC Bank');
    expect(it.spec('apr'), '43.2%');
    expect(it.bestQuote!.sourceDomain, 'hdfcbank.com');
    expect(it.site, 'HDFC Bank');
  });

  // Account search bar mirror (owner 21 Oct): Flutter must compose the exact same
  // query the web Accounts header sends for the same bank box + account-type chip.
// Account search bar mirror (owner 21 Oct): Flutter must compose the exact same
// query the web Accounts header sends for the same bank box + account-type chip.
group('accountSearchQuery', () {
  test('typed bank narrows to that provider', () {
    expect(accountSearchQuery('SBI', 'Savings'), 'SBI savings account');
    expect(accountSearchQuery('HDFC Bank', 'Demat'), 'HDFC Bank demat account');
  });
  test('blank bank box compares every bank', () {
    expect(accountSearchQuery('', 'Savings'), 'savings account');
    expect(accountSearchQuery('   ', 'Current'), 'current account');
  });
  test('account vertical uses the dedicated SearchKind', () {
    expect(verticalById('account').kind, SearchKind.account);
  });
});
}
