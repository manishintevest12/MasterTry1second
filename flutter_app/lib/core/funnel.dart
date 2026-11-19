import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart' show kDefaultApiBase, kOriginFallbackBase;

/// Funnel telemetry (app) — owner 19 Nov: "Instrument clear funnel events across search, results, card
/// clicks, outbound redirects, shares, and repeat sessions so optimization focuses on real drop-off
/// points and retention rather than vanity metrics."
///
/// Mirror of the web client (`src/lib/funnel.ts`) and of the server contract
/// (`server/growth/funnel.ts`): allowlisted names only, no personal data (a random session id, the
/// vertical, the query, the item id, the seller — never an email, a phone, a location or a device id),
/// and it can never break a search: every call is fire-and-forget with failures swallowed.
///
/// Server-side steps (search, zero_result, outbound_click) are recorded by the API itself, so the app
/// only sends what only the app can know: results_view, card_click, share, app_open, alert_create,
/// push_open.
class Funnel {
  Funnel._();

  static const _sessionKey = 't1s_funnel_session';
  static String? _sessionId;
  static final Set<String> _sentOnce = <String>{};

  /// Test hook: how many payloads this process actually tried to send. Never shown to a user.
  static int debugSendCount = 0;

  static const Set<String> _events = {
    'search', 'results_view', 'zero_result', 'card_click', 'outbound_click',
    'share', 'app_open', 'alert_create', 'push_open',
  };

  /// A random, resettable session id. Clearing app data gives the user a new one, by design.
  static Future<String> _session() async {
    if (_sessionId != null) return _sessionId!;
    try {
      final prefs = await SharedPreferences.getInstance();
      final existing = prefs.getString(_sessionKey);
      if (existing != null && RegExp(r'^[A-Za-z0-9_-]{6,64}$').hasMatch(existing)) {
        _sessionId = existing;
        return existing;
      }
      final fresh = 'a_${Random().nextInt(1 << 32).toRadixString(36)}${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}';
      await prefs.setString(_sessionKey, fresh);
      _sessionId = fresh;
      return fresh;
    } catch (_) {
      final fallback = 'a_anon${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}';
      _sessionId = fallback;
      return fallback;
    }
  }

  /// Fire one step. Returns immediately; nothing here can throw into a caller.
  static void track(
    String event, {
    String? vertical,
    String? query,
    String? itemId,
    String? seller,
    String? city,
    num? value,
    Map<String, dynamic>? meta,
  }) {
    if (!_events.contains(event)) return;
    unawaited(_send({
      'event': event,
      if (vertical != null && vertical.isNotEmpty) 'vertical': vertical,
      if (query != null && query.isNotEmpty) 'query': query.length > 200 ? query.substring(0, 200) : query,
      if (itemId != null && itemId.isNotEmpty) 'itemId': itemId,
      if (seller != null && seller.isNotEmpty) 'seller': seller,
      if (city != null && city.isNotEmpty) 'city': city,
      if (value != null) 'value': value,
      if (meta != null) 'meta': meta,
      'platform': 'android',
    }));
  }

  /// Same step at most once per key for the life of the process, so a rebuild or a poll cannot inflate
  /// the funnel (the web mirror dedupes through sessionStorage).
  static void trackOnce(String key, String event, {
    String? vertical,
    String? query,
    String? itemId,
    String? seller,
    num? value,
  }) {
    if (!_sentOnce.add(key)) return;
    track(event, vertical: vertical, query: query, itemId: itemId, seller: seller, value: value);
  }

  static Future<void> _send(Map<String, dynamic> payload) async {
    debugSendCount += 1;
    try {
      final sessionId = await _session();
      final body = jsonEncode({...payload, 'sessionId': sessionId});
      // A short timeout and the same two-hops-home rule the rest of the app uses: a relay that refuses
      // telemetry must never cost the user anything, so the origin is tried once and failure is silent.
      // Both hops can be the same host in a direct-origin build, so the origin is only added when it
      // really is a second route.
      final hops = <String>[kDefaultApiBase];
      if (kOriginFallbackBase != kDefaultApiBase) hops.add(kOriginFallbackBase);
      for (final base in hops) {
        try {
          final res = await http
              .post(Uri.parse('$base/api/track'),
                  headers: const {'Content-Type': 'application/json'},
                  body: body)
              .timeout(const Duration(seconds: 4));
          if (res.statusCode < 400) return;
        } catch (_) {
          /* try the next hop */
        }
      }
    } catch (_) {
      /* telemetry is never allowed to surface */
    }
  }
}
