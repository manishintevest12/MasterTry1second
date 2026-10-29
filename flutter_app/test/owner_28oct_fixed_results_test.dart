import 'dart:async';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:try1second/core/api.dart';
import 'package:try1second/core/app_state.dart';
import 'package:try1second/core/compare.dart';
import 'package:try1second/core/search_poll.dart';
import 'package:try1second/ui/screens/compare_screen.dart';

/// OWNER 28 Oct, two complaints in one screenshot:
///  1. "ye last mai ruk jata hai aur results ni deta, phir tab dusra open kro
///     aur wapas aao to results deta hai" - the progress panel froze on
///     "Checking Yatra… 8 of 9" because the poll chain ended while the last
///     response still reported pendingRefresh, and nothing ever refreshed the
///     answer afterwards. Only remounting the screen (tab switch) re-read it.
///  2. "ek baar results aa jaye to dusre tab me jaa kr wapas aao to phir se jo
///     automatic search ho raha hai wo v ni chaiye" - the first search per
///     vertical is automatic, after that the result stays fixed until the user
///     enters their own requirements and presses Search.
class _RecordingApi extends Try1SecondApi {
  _RecordingApi({this.pending = false, this.rows = 3});
  final bool pending;
  final int rows;
  final queries = <String>[];

  @override
  Future<LiveResponse> live(
    String vertical,
    String query, {
    String city = 'Indore',
    String pincode = '452001',
    double? lat,
    double? lng,
    String? depart,
    String? returnDate,
    String? from,
    String? to,
  }) async {
    queries.add(query);
    final items = List.generate(
      rows,
      (i) => CompareItem(
        id: 'row$i',
        vertical: vertical,
        title: 'Row $i',
        subtitle: 'seller $i',
        provider: 'site$i',
        primaryPrice: 100.0 + i,
      ),
    );
    return LiveResponse(
      items,
      const ['site0', 'site1'],
      const [],
      const [],
      'test',
      5,
      pendingRefresh: pending,
    );
  }
}

void main() {
  // setLocation writes city/pincode through shared_preferences before it resets
  // the per-vertical search flags; without the plugin mock that await never
  // returns under flutter_tester and the test hangs.
  setUp(() => SharedPreferences.setMockInitialValues({}));

  group('pollDecision (panel may only promise progress while a chain polls)', () {
    test('still pending inside the budget -> keeps polling and keeps the flag', () {
      final d = pollDecision(pendingRefresh: true, pollCount: 3, maxPolls: 40, rows: 0);
      expect(d.keepPolling, isTrue);
      expect(d.keepPendingFlag, isTrue);
      expect(d.exhaustedWithoutRows, isFalse);
    });

    test('budget exhausted with zero rows -> releases the panel and settles once', () {
      final d = pollDecision(pendingRefresh: true, pollCount: 40, maxPolls: 40, rows: 0);
      expect(d.keepPolling, isFalse);
      expect(d.exhaustedWithoutRows, isTrue,
          reason: 'the panel must let go so the honest empty state (with Retry) shows');
      expect(d.keepPendingFlag, isFalse, reason: 'a dead chain may not hold "Checking Yatra…"');
      expect(d.settle, isTrue, reason: 'one non-forced read picks up the warmed answer');
    });

    test('the settle read happens only once', () {
      final d = pollDecision(
          pendingRefresh: true, pollCount: 41, maxPolls: 40, rows: 0, settled: true);
      expect(d.settle, isFalse);
      expect(d.keepPendingFlag, isFalse);
    });

    test('a finished search never keeps the flag', () {
      final d = pollDecision(pendingRefresh: false, pollCount: 0, maxPolls: 40, rows: 9);
      expect(d.keepPolling, isFalse);
      expect(d.keepPendingFlag, isFalse);
    });

    test('an exhausted chain drops the flag even with rows on screen', () {
      final d = pollDecision(pendingRefresh: true, pollCount: 40, maxPolls: 40, rows: 4);
      expect(d.keepPendingFlag, isFalse);
      expect(d.exhaustedWithoutRows, isFalse, reason: 'rows exist: nothing to settle');
      expect(d.settle, isFalse);
    });
  });

  testWidgets('first open searches automatically, returning to the tab does NOT', (tester) async {
    final state = AppState.instance;
    final api = _RecordingApi();
    state.api = api;
    state.tab = NavTab.compare;
    state.vertical = 'ecommerce';
    state.cache.clear();
    state.cacheQuery.clear();
    state.cacheAt.clear();
    state.searched.clear();

    // First open: the automatic search runs once.
    await tester.pumpWidget(const MaterialApp(home: Scaffold(body: CompareScreen())));
    await tester.pump();
    await tester.pump(const Duration(seconds: 2));
    await tester.pump(const Duration(milliseconds: 400));
    final afterFirst = api.queries.length;
    expect(afterFirst, greaterThan(0), reason: 'the first open must search automatically');
    expect(state.searched, contains('ecommerce'));

    // Leave the tab (MainShell drops the screen) and come back.
    await tester.pumpWidget(const MaterialApp(home: Scaffold(body: SizedBox.shrink())));
    await tester.pump();
    await tester.pumpWidget(const MaterialApp(home: Scaffold(body: CompareScreen())));
    await tester.pump();
    await tester.pump(const Duration(seconds: 2));
    await tester.pump(const Duration(milliseconds: 400));

    expect(api.queries.length, afterFirst,
        reason: 'returning to the tab must repaint the fixed result, never re-search');
  });

  testWidgets('a location change arms the automatic search again', (tester) async {
    final state = AppState.instance;
    final api = _RecordingApi();
    state.api = api;
    state.tab = NavTab.compare;
    state.vertical = 'ecommerce';
    state.cache.clear();
    state.cacheQuery.clear();
    state.cacheAt.clear();
    state.searched.clear();

    await tester.pumpWidget(const MaterialApp(home: Scaffold(body: CompareScreen())));
    await tester.pump();
    await tester.pump(const Duration(seconds: 2));
    await tester.pump(const Duration(milliseconds: 400));
    final afterFirst = api.queries.length;

    // New city = new intent: setLocation clears `searched`, so the next open
    // searches again for the new location.
    await state.setLocation('Bhopal', '462001');
    expect(state.searched, isEmpty, reason: 'a new pincode must re-arm every vertical');
    await tester.pumpWidget(const MaterialApp(home: Scaffold(body: SizedBox.shrink())));
    await tester.pump();
    await tester.pumpWidget(const MaterialApp(home: Scaffold(body: CompareScreen())));
    await tester.pump();
    await tester.pump(const Duration(seconds: 2));
    await tester.pump(const Duration(milliseconds: 400));

    expect(api.queries.length, greaterThan(afterFirst),
        reason: 'the new location must run its own search');
  });
}
