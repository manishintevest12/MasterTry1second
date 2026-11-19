import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:try1second/core/funnel.dart';

/// OWNER 19 Nov growth brief: funnel telemetry across search -> results -> card click -> outbound ->
/// share. These tests pin the two safety rules of the app client: only allowlisted steps are sent, and a
/// repeat render cannot send the same step twice.
void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    Funnel.debugSendCount = 0;
  });

  test('an event outside the allowlist is never sent', () {
    Funnel.track('made_up_event', vertical: 'grocery');
    expect(Funnel.debugSendCount, 0);
  });

  test('a real step is sent', () {
    Funnel.track('card_click', vertical: 'movies', itemId: 'm1', seller: 'BookMyShow');
    expect(Funnel.debugSendCount, 1);
  });

  test('trackOnce sends once, however often the widget rebuilds', () {
    Funnel.trackOnce('rv:movies:inception:9', 'results_view', vertical: 'movies', value: 9);
    Funnel.trackOnce('rv:movies:inception:9', 'results_view', vertical: 'movies', value: 9);
    Funnel.trackOnce('rv:movies:inception:9', 'results_view', vertical: 'movies', value: 9);
    expect(Funnel.debugSendCount, 1);
    // a different search is a different view and must be counted
    Funnel.trackOnce('rv:movies:jawan:4', 'results_view', vertical: 'movies', value: 4);
    expect(Funnel.debugSendCount, 2);
  });
}
