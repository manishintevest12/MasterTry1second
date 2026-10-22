import 'package:flutter_test/flutter_test.dart';

import 'package:try1second/core/api.dart';
import 'package:try1second/core/app_state.dart';
import 'package:try1second/core/theme.dart';
import 'package:try1second/core/verticals.dart';

/// 21 Oct speed fixes: rawJson disk-cache payload, TTL revalidation constants,
/// and the per-vertical web-parity search surfaces must all stay wired.
void main() {
  test('LiveResponse.fromJson keeps the raw server JSON for the disk cache', () {
    final j = {
      'results': [
        {
          'id': 'g1',
          'vertical': 'hotels',
          'title': 'Ginger Goa',
          'primaryPrice': 5899,
          'sellerQuotes': [
            {'sellerName': 'Goibibo', 'price': 5899, 'url': 'https://x.example/hotel'}
          ],
        }
      ],
      'sourcesAttempted': ['goibibo'],
      'sourcesSucceeded': ['goibibo'],
      'sourcesFailed': [],
      'servedFrom': 'live',
      'latencyMs': 321,
      'pendingRefresh': false,
    };
    final res = LiveResponse.fromJson(j);
    expect(res.rawJson, isNotNull);
    expect(res.rawJson!['results'], isA<List>());
    // Round-trip: the disk cache rehydrates through the same factory.
    final again = LiveResponse.fromJson(res.rawJson!);
    expect(again.items.first.title, res.items.first.title);
    expect(again.items.first.bestQuote!.price, res.items.first.bestQuote!.price);
  });

  test('TTLs mirror the server cache (travel 5/15 min, others 15/45 min)', () {
    expect(AppState.freshTtlMs('flights'), 5 * 60 * 1000);
    expect(AppState.freshTtlMs('hotels'), 5 * 60 * 1000);
    expect(AppState.freshTtlMs('bus'), 5 * 60 * 1000);
    expect(AppState.freshTtlMs('cab'), 5 * 60 * 1000);
    expect(AppState.freshTtlMs('movie'), 5 * 60 * 1000);
    expect(AppState.staleTtlMs('hotels'), 15 * 60 * 1000);
    expect(AppState.freshTtlMs('ecommerce'), 15 * 60 * 1000);
    expect(AppState.staleTtlMs('food'), 45 * 60 * 1000);
    expect(AppState.staleTtlMs('loans'), 45 * 60 * 1000);
  });

  test('every registered vertical has a web-parity search surface', () {
    for (final v in kVerticals) {
      final s = T1SSearchSurface.of(v.id);
      // The white default must never silently apply to a real vertical.
      expect(s.bg, isNot(0xFFFFFFFF), reason: '${v.id} has no themed surface');
    }
    expect(T1SSearchSurface.of('hotels').bg, 0xFF003580); // web Booking blue
    expect(T1SSearchSurface.of('flights').dark, isFalse); // web slate-100 light bar
    expect(T1SSearchSurface.of('cab').bg, 0xFF0B1220); // web slate-950
  });
}
