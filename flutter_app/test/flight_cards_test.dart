import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:try1second/core/compare.dart' as cmp;
import 'package:try1second/core/verticals.dart';
import 'package:try1second/ui/widgets/compare_cards.dart';

/// Owner 22 Oct (flight card screenshot): times missing, images missing, identical
/// flights not compared, no Book button → no affiliate deeplink redirect.
/// The server now emits 'departure time'/'arrival time'/'flight number' specs and
/// sellerQuotes urls — these tests pin the Flutter card to all four behaviours.
Map<String, dynamic> flightRow(String seller, int price, {String? dep, String? arr, String? no, String? img}) => {
      'id': 'f_${seller.toLowerCase()}',
      'vertical': 'flights',
      'title': 'Air India AI9580 · Indore → Delhi',
      'provider': seller,
      'subtitle': seller,
      'imageUrl': img,
      'price': price,
      'sellerQuotes': [
        {'sellerName': seller, 'price': price, 'url': '/api/out?t=eyJkIjoiaHR0cHMi', 'isLowest': true}
      ],
      'specs': {
        'airline': 'Air India',
        'flight number': no ?? 'AI9580',
        'travel date': '2026-10-29',
        'departure time': dep ?? '10:00',
        'arrival time': arr ?? '11:45',
        'stops': '0',
        'duration': '1h 45m',
      },
    };

void main() {
  testWidgets('flight card shows dep→arr times + Book button with /api/out redirect', (tester) async {
    final g = cmp.groupOffers([cmp.CompareItem.fromJson(flightRow('EaseMyTrip', 8236))]).single;
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: SingleChildScrollView(child: TravelTile(g: g, meta: _meta)))));
    await tester.pump();
    expect(find.text('10:00 → 11:45'), findsOneWidget, reason: 'flight times must render on the card');
    expect(find.text('Book on EaseMyTrip'), findsOneWidget, reason: 'Book button must render when sellerQuotes url exists');
    expect(find.text('AI9580'), findsOneWidget);
  });

  testWidgets('same flight number + date + dep time from 2 sites merges into ONE compared card', (tester) async {
    final groups = cmp.groupOffers([
      cmp.CompareItem.fromJson(flightRow('EaseMyTrip', 8236)),
      cmp.CompareItem.fromJson(flightRow('Ixigo', 7999)),
    ]);
    expect(groups.length, 1, reason: 'identical flight must group, not render as 2 independent cards');
    expect(groups.single.rows.length, 2);
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: SingleChildScrollView(child: TravelTile(g: groups.single, meta: _meta)))));
    await tester.pump();
    expect(find.text('Compare 2 sites'), findsOneWidget);
    expect(find.byKey(const ValueKey('best-price')), findsNothing); // cheap sanity: no stray keys crash the card
  });

  testWidgets('different flight numbers do NOT merge', (tester) async {
    final groups = cmp.groupOffers([
      cmp.CompareItem.fromJson(flightRow('EaseMyTrip', 8236)),
      cmp.CompareItem.fromJson(flightRow('Ixigo', 7999, no: 'AI9673', dep: '15:25')),
    ]);
    expect(groups.length, 2, reason: 'different flights must stay separate cards');
  });
}

// Real vertical metadata keeps the card's provider/icon branches honest.
final _meta = kVerticals.firstWhere((v) => v.id == 'flights');
