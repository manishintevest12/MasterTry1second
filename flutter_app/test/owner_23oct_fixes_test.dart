import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:try1second/core/compare.dart';
import 'package:try1second/core/api.dart' show Try1SecondApi, LiveResponse;
import 'package:try1second/core/app_state.dart';
import 'package:try1second/ui/screens/compare_screen.dart';
import 'package:try1second/ui/widgets/compare_cards.dart';

/// Owner 23 Oct fixes, regression-pinned:
///  1) Food/grocery single-offer 'Order Now' must be the COMPACT pill
///     (height 30), never the full-size RedButton.
///  2) WarpLoader is ONE-SHOT: it hides when the 3-2-1 countdown finishes and
///     auto-polls must never revive it.
///  3) Accounts vertical opens with live rows (web-parity scrape pipeline).

class _SlowApi extends Try1SecondApi {
  int liveCalls = 0;
  final bool emptyFirst;
  final Duration delay;

  _SlowApi({this.emptyFirst = false, this.delay = const Duration(milliseconds: 100)});

  @override
  Future<LiveResponse> live(String vertical, String query,
      {String city = 'Indore', String pincode = '452001', double? lat, double? lng, String? depart, String? returnDate, String? from, String? to}) async {
    liveCalls += 1;
    if (emptyFirst) {
      await Future<void>.delayed(const Duration(milliseconds: 200));
      return const LiveResponse([], [], [], [], 'fresh', 0);
    }
    await Future<void>.delayed(delay);
    final it = CompareItem(
      id: 'f1-$vertical-$liveCalls',
      vertical: vertical,
      title: vertical == 'account' ? 'State Bank of India Savings Account' : 'Margherita Pizza large',
      subtitle: 'Swiggy',
      provider: 'Swiggy',
      primaryPrice: 299,
      priceAvailable: true,
      sellerQuotes: [SellerQuote(id: 'q1', sellerName: 'Swiggy', price: 299, url: 'https://try1second.com')],
    );
    return LiveResponse([it], const [], const [], const [], 'fresh', 1);
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('1) food single-offer card uses the compact Order Now pill (h30)', (tester) async {
    final it = CompareItem(
      id: 'pz',
      vertical: 'food',
      title: 'Margherita Pizza',
      subtitle: 'Swiggy',
      provider: 'Swiggy',
      primaryPrice: 299,
      priceAvailable: true,
      sellerQuotes: [SellerQuote(id: 'q1', sellerName: 'Swiggy', price: 299, url: 'https://try1second.com')],
    );
    final row = OfferRow(it, 'Swiggy', 299, true);
    final g = OfferGroup(it.id, 'food', it, [row], row);
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: SingleChildScrollView(child: GroupCard(g: g, vertical: 'food')))));
    final pill = find.text('Order Now');
    expect(pill, findsOneWidget);
    final box = tester.renderObject<RenderBox>(pill);
    // Compact pill height must be 30 (the old full-size RedButton was ~40+).
    expect(box.size.height, lessThan(34), reason: 'Order Now must be the small pill (owner 23 Oct)');
  });

  testWidgets('2) WarpLoader hides after the 3s countdown even while polls continue', (tester) async {
    final state = AppState.instance;
    state.api = _SlowApi(delay: const Duration(seconds: 5));
    state.vertical = 'food';
    await tester.pumpWidget(const MaterialApp(home: Scaffold(body: CompareScreen())));
    await tester.pump(const Duration(milliseconds: 300));
    // Loading, no rows yet -> the full-screen WarpLoader is visible (once).
    expect(find.byKey(const ValueKey('warp-loader')), findsOneWidget);
    // Countdown finishes -> loader gone even though _loading is still true
    // (the 5s search is still in flight at t=3.3s).
    await tester.pump(const Duration(seconds: 3));
    expect(find.byKey(const ValueKey('warp-loader')), findsNothing,
        reason: 'loader must vanish after one 3-2-1 countdown (owner: no repeat)');
    // Still loading, still no rows: the thin status strip stays (that is
    // fine) but the countdown loader must NOT come back.
    await tester.pump(const Duration(seconds: 2));
    expect(find.byKey(const ValueKey('warp-loader')), findsNothing);
    // Let the in-flight 5s search land so no timer is pending at teardown.
    await tester.pump(const Duration(seconds: 3));
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('Margherita Pizza large'), findsOneWidget);
  });

  testWidgets('3) accounts vertical renders live bank rows via the scrape pipeline', (tester) async {
    final api = _SlowApi();
    final state = AppState.instance;
    state.api = api;
    state.vertical = 'account';
    await tester.pumpWidget(const MaterialApp(home: Scaffold(body: CompareScreen())));
    await tester.pump(const Duration(seconds: 2));
    await tester.pump(const Duration(seconds: 2));
    expect(api.liveCalls, greaterThan(0), reason: 'account must use the live scrape pipeline, not deals-only');
    expect(find.text('State Bank of India Savings Account'), findsOneWidget);
  });
}
