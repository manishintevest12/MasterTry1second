import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:try1second/core/compare.dart' as cmp;
import 'package:try1second/ui/widgets/search_progress_card.dart';

/// Owner 28 Oct: the live progress pill must appear in EVERY vertical of the app
/// (product page included) and it must be BRAND RED — the web keeps indigo.
/// These tests pin both halves of that decision, plus the flight feed rule:
/// bare rows (no flight number / dep-arr / duration) drop to the end.
Map<String, dynamic> flightRow(Map<String, String> specs) => {
      'id': 'r${specs.hashCode}',
      'vertical': 'flights',
      'title': 'IndiGo 6E6972 · Indore → Delhi',
      'provider': 'Ixigo',
      'subtitle': 'Ixigo',
      'price': 6786,
      'specs': specs,
    };

cmp.OfferGroup groupOf(Map<String, String> specs) =>
    cmp.groupOffers([cmp.CompareItem.fromJson(flightRow(specs))]).single;

void main() {
  testWidgets('progress pill paints in brand red, not the web indigo', (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(body: SingleChildScrollView(child: SearchProgressCard(verticalId: 'flights'))),
    ));
    await tester.pump(const Duration(milliseconds: 50));

    final bar = tester.widget<LinearProgressIndicator>(find.byType(LinearProgressIndicator).first);
    expect(bar.valueColor?.value, T1SProgressPalette.accent,
        reason: 'app rail must use the red accent');
    expect(T1SProgressPalette.accent, const Color(0xFFE11D48));
    // The capsule wash/border/label all come from the same red palette.
    expect(T1SProgressPalette.labelLight, const Color(0xFF9F1239));
    expect(find.textContaining('Checking'), findsOneWidget);
  });

  testWidgets('every vertical gets the same panel with its own sources', (tester) async {
    for (final v in ['flights', 'hotels', 'bus', 'cab', 'ecommerce', 'grocery', 'food', 'movie', 'loans', 'insurance', 'creditcards', 'account']) {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(body: SingleChildScrollView(child: SearchProgressCard(key: ValueKey(v), verticalId: v))),
      ));
      await tester.pump(const Duration(milliseconds: 30));
      expect(find.byType(LinearProgressIndicator), findsWidgets, reason: 'vertical $v must render the live bar');
    }
  });

  test('a flight row missing flight number or timings is incomplete', () {
    expect(cmp.flightScheduleComplete(cmp.CompareItem.fromJson(flightRow({
      'flight number': '6E6972', 'departure time': '21:40', 'arrival time': '23:20',
    }))), isTrue);
    expect(cmp.flightScheduleComplete(cmp.CompareItem.fromJson(flightRow({}))), isFalse);
    expect(cmp.flightScheduleComplete(cmp.CompareItem.fromJson(flightRow({'departure time': '21:40'}))), isFalse);
  });

  test('complete flight groups lead, bare groups trail, order kept inside each half', () {
    final full1 = groupOf({'flight number': '6E6972', 'departure time': '06:00', 'arrival time': '07:15'});
    final bare1 = groupOf({});
    final full2 = groupOf({'flight number': 'AI9580', 'departure time': '21:40', 'arrival time': '23:20'});
    final bare2 = groupOf({'flight number': 'UK999'});

    final ordered = cmp.scheduleCompleteFirst([bare1, full1, bare2, full2], 'flights');
    expect(ordered.map((g) => g.key).toList(), [full1.key, full2.key, bare1.key, bare2.key]);
  });

  test('timings from another seller row complete the same flight group', () {
    final g = groupOf({});
    expect(cmp.flightScheduleComplete(g.lead), isFalse);
    // Simulate a second seller's row for the same flight carrying the timings.
    g.rows.add(cmp.OfferRow(
      cmp.CompareItem.fromJson(flightRow({'flight number': '6E6972', 'departure time': '21:40', 'arrival time': '23:20'})),
      'EaseMyTrip',
      7100,
      true,
    ));
    cmp.liftGroupSchedule(g);
    expect(cmp.flightScheduleComplete(g.lead), isTrue, reason: 'the bare lead must inherit real timings');
  });
}
