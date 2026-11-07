import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:try1second/core/api.dart';
import 'package:try1second/core/app_state.dart';
import 'package:try1second/ui/screens/compare_screen.dart';

/// Owner 23 Oct ('home page ke category pills pe results nahi aate'):
/// MainShell mounts CompareScreen only while the compare tab is selected, so a
/// pill tap from the HOME tab set a PendingSearch before the screen existed.
/// The old initState ran an EMPTY auto search and never consumed the pending —
/// the compare tab opened with no loader and no results. The screen must
/// consume the pending FIRST (regression guard for every home entry point:
/// pills, showcase cards, hero buttons, assistant).
class _RecordingApi extends Try1SecondApi {
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
    bool settle = false,
    int? settleMs,
    String? from,
    String? to,
  
}) async {
    queries.add(query);
    return LiveResponse(const [], const [], const [], const [], 'test', 5);
  }
}

void main() {
  testWidgets('pill tap from HOME tab -> compare screen runs the pill query', (tester) async {
    final state = AppState.instance;
    final api = _RecordingApi();
    state.api = api;
    state.tab = NavTab.home;
    state.vertical = 'flights'; // fresh boot state: home tab, not ecommerce

    // Exactly what HomeShowcase._launchQuery does when a pill is tapped.
    state.openVertical('ecommerce', search: PendingSearch('ecommerce', "men's Wrist Watches"));

    // Pumping CompareScreen directly after the tap reproduces the real mount
    // order: the screen did not exist when openVertical fired the listener.
    await tester.pumpWidget(const MaterialApp(home: Scaffold(body: CompareScreen())));
    await tester.pump(); // first frame: initState consumes the pending and fires the search
    // The loading skeleton's _pulse controller repeats forever, so pumpAndSettle
    // can never settle — advance fake time in fixed steps instead.
    await tester.pump(const Duration(seconds: 2)); // one-shot timers (debounce/points) fire
    await tester.pump(const Duration(milliseconds: 400)); // a pulse frame + builder rebuild

    // The pending must be consumed, not left rotting in state.
    expect(state.pending, isNull, reason: 'initState must consume the PendingSearch');
    // The compare tab must have actually searched the pill's query.
    expect(api.queries, contains("men's Wrist Watches"),
        reason: 'the pill query must reach the live search, not an empty auto search');
  });
}
