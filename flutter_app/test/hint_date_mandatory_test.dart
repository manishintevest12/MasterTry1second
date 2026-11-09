import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:try1second/ui/widgets/hint_field.dart';
import 'package:try1second/ui/widgets/journey_date_picker_modal.dart';

/// Owner 22 Oct: autocomplete (place/name) + date-picker hints are MANDATORY on
/// every vertical in the app. These tests lock the two shared widgets that
/// deliver that: HintField (reference-style dropdown rows: bold title, grey
/// subtitle, badge pill, keyboard nav) and JourneyDatePickerModal (quick pills,
/// locked past dates, range selection, Apply button).

DateTime _today() {
  final n = DateTime.now();
  return DateTime(n.year, n.month, n.day);
}

Future<void> pumpHint(
  WidgetTester tester, {
  HintSource source = HintSource.cities,
  List<String> presets = const [],
  String? header,
}) async {
  final controller = TextEditingController();
  await tester.pumpWidget(MaterialApp(
    home: Scaffold(
      body: HintField(
        controller: controller,
        hint: 'Search',
        source: source,
        presets: presets,
        headerText: header,
      ),
    ),
  ));
  await tester.tap(find.byType(TextField));
  await tester.pump();
}

void main() {
  group('HintField (mandatory hints, owner 22 Oct)', () {
    testWidgets('cities source: typing shows city rows with badges', (tester) async {
      await pumpHint(tester, source: HintSource.cities, header: 'FLIGHT CITIES & AIRPORTS');
      await tester.enterText(find.byType(TextField), 'ind');
      await tester.pump();
      expect(find.text('Indore (IDR)'), findsWidgets);
      expect(find.text('FLIGHT CITIES & AIRPORTS'), findsOneWidget);
      expect(find.text('↕ TO NAVIGATE • ↵ SELECT'), findsOneWidget);
    });

    testWidgets('presets source: filters popular searches', (tester) async {
      await pumpHint(tester,
          source: HintSource.presets,
          presets: const ['iPhone 17', 'Samsung TV', 'Running Shoes']);
      await tester.enterText(find.byType(TextField), 'sams');
      await tester.pump();
      expect(find.text('Samsung TV'), findsOneWidget);
      expect(find.text('iPhone 17'), findsNothing);
    });

    testWidgets('tapping a row fills the field', (tester) async {
      await pumpHint(tester, source: HintSource.cities);
      await tester.enterText(find.byType(TextField), 'ind');
      await tester.pump();
      await tester.tap(find.text('Indore (IDR)').last);
      await tester.pump();
      final field = tester.widget<TextField>(find.byType(TextField));
      expect(field.controller!.text, 'Indore (IDR)');
    });

    testWidgets('keyboard navigation: arrows move highlight, Enter selects', (tester) async {
      await pumpHint(tester, source: HintSource.cities);
      await tester.enterText(find.byType(TextField), 'goa');
      await tester.pump();
      final node = FocusManager.instance.primaryFocus!;
      node.onKeyEvent!(
          node, const KeyDownEvent(physicalKey: PhysicalKeyboardKey.arrowDown, logicalKey: LogicalKeyboardKey.arrowDown, timeStamp: Duration.zero));
      await tester.pump();
      node.onKeyEvent!(
          node, const KeyDownEvent(physicalKey: PhysicalKeyboardKey.enter, logicalKey: LogicalKeyboardKey.enter, timeStamp: Duration.zero));
      await tester.pump();
      final field = tester.widget<TextField>(find.byType(TextField));
      expect(field.controller!.text, contains('Goa'));
    });

    testWidgets('empty remote source shows an honest "keep typing" message', (tester) async {
      await pumpHint(tester, source: HintSource.hotels, header: 'LIVE HOTELS • DESTINATIONS & PROPERTIES');
      await tester.enterText(find.byType(TextField), 'x');
      await tester.pump(const Duration(milliseconds: 400));
      // No live rows: honest empty state, never invented names.
      expect(find.textContaining('No live matches yet'), findsOneWidget);
    });
  });

  group('JourneyDatePickerModal (site-parity date hints)', () {
    testWidgets('single mode: Tomorrow pill + Apply returns tomorrow', (tester) async {
      DateTime? picked;
      await tester.pumpWidget(MaterialApp(home: Builder(builder: (c) {
        return Center(
          child: ElevatedButton(
            onPressed: () async {
              final r =
                  await showJourneyDatePicker(c, title: 'Date of Journey', isRange: false);
              picked = r?.departure;
            },
            child: const Text('open'),
          ),
        );
      })));
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();

      expect(find.text('Past dates locked'), findsOneWidget);
      await tester.tap(find.text('Tomorrow (+1D)'));
      await tester.pump();
      await tester.tap(find.text('Apply Selected Date'));
      await tester.pumpAndSettle();
      expect(picked, _today().add(const Duration(days: 1)));
    });

    testWidgets('range mode: This Weekend pill sets check-in + 2-night checkout', (tester) async {
      JourneyDateResult? res;
      await tester.pumpWidget(MaterialApp(home: Builder(builder: (c) {
        return Center(
          child: ElevatedButton(
            onPressed: () async {
              res = await showJourneyDatePicker(c,
                  title: 'Check-in & Check-out Dates', isRange: true);
            },
            child: const Text('open'),
          ),
        );
      })));
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();

      // Range flow: step labels + a live check-out readout (dep + 3 default).
      expect(find.text('Step 1: Select Check-in'), findsOneWidget);
      expect(find.textContaining('Check-out: '), findsOneWidget);

      await tester.tap(find.text('This Weekend'));
      await tester.pump();
      await tester.tap(find.text('Apply Selected Date'));
      await tester.pumpAndSettle();

      final dep = res?.departure;
      expect(dep, isNotNull);
      // Weekend pill: departure = coming Saturday, checkout = +2 days (Sat→Mon).
      expect(dep!.weekday, DateTime.saturday);
      expect(res!.returnDate, dep.add(const Duration(days: 2)));
    });

    testWidgets('range mode: manual two-tap selection and CONFIRMED CHOICE summary', (tester) async {
      JourneyDateResult? res;
      await tester.pumpWidget(MaterialApp(home: Builder(builder: (c) {
        return Center(
          child: ElevatedButton(
            onPressed: () async {
              res = await showJourneyDatePicker(c,
                  title: 'Check-in & Check-out Dates', isRange: true);
            },
            child: const Text('open'),
          ),
        );
      })));
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();

      final today = _today();
      var din = today.add(const Duration(days: 5));
      var dout = today.add(const Duration(days: 8));
      // Month-boundary safety (flake caught 23-24 Oct): when today+5 and
      // today+8 fall in DIFFERENT months, the second day number is not on the
      // visible grid (the picker renders only the viewed month), so the tap
      // landed on nothing and checkout came back wrong. Step to the next
      // month and pick early-day pairs there: always future, always unique.
      // ALSO step when the target month is not the month the picker OPENS on
      // (flake caught 28 Oct): late in a month, today+5 already falls in the next
      // month, so the two day numbers were not on the visible grid and the tap
      // hit a disabled past date instead.
      final opensOn = DateTime(today.year, today.month);
      final inOpenMonth = din.year == opensOn.year && din.month == opensOn.month;
      if (!inOpenMonth || din.month != dout.month) {
        // One chevron tap moves the grid to the month AFTER the one it opened on,
        // so the expected dates must be days 2 and 5 of THAT month.
        final firstOfNext = DateTime(opensOn.year, opensOn.month + 1, 1);
        din = firstOfNext.add(const Duration(days: 1)); // day 2 of next month
        dout = firstOfNext.add(const Duration(days: 4)); // day 5 of next month
        await tester.tap(find.byIcon(Icons.chevron_right_rounded));
        await tester.pump();
      }
      // Tap the day numbers (unique on screen within the visible month).
      // Tall surface so the whole month grid (incl. day 31 in 31-day months —
      // the off-by-one daysInMonth bug this test caught) is built.
      await tester.binding.setSurfaceSize(const Size(480, 1200));
      await tester.pump();
      await tester.tap(find.text('${din.day}'));
      await tester.pump();
      expect(find.text('Step 2: Select Check-out'), findsOneWidget);
      await tester.tap(find.text('${dout.day}'));
      await tester.pump();
      expect(find.text('CONFIRMED CHOICE'), findsOneWidget);
      await tester.tap(find.text('Apply Selected Date'));
      await tester.pumpAndSettle();
      expect(res?.departure, din);
      expect(res?.returnDate, dout);
    });

    testWidgets('past dates cannot be selected', (tester) async {
      await tester.pumpWidget(MaterialApp(home: Builder(builder: (c) {
        return Center(
          child: ElevatedButton(
            onPressed: () => showJourneyDatePicker(c, title: 'Flight Date', isRange: false),
            child: const Text('open'),
          ),
        );
      })));
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();

      final today = _today();
      if (today.day > 1) {
        final yesterday = '${today.day - 1}';
        // If yesterday is visible in the current month grid, tapping it must not select.
        if (find.text(yesterday).evaluate().isNotEmpty) {
          await tester.tap(find.text(yesterday).first);
          await tester.pump();
          // Header still shows today's date (selection unchanged). The stamp is derived from the real
          // clock: this line used to hardcode '-10-2026', so the test started failing on 1 Nov 2026
          // without any product change (owner run, 9 Nov).
          // the modal header prints DD-MM-YYYY (_fmt in journey_date_picker_modal.dart)
          final stamp = '${today.day.toString().padLeft(2, '0')}-'
              '${today.month.toString().padLeft(2, '0')}-${today.year}';
          expect(find.textContaining(stamp).evaluate().isNotEmpty, true,
              reason: 'a past day must not move the header off $stamp');
        }
      }
    });
  });
}
