import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';

/// Locally tracked product (local watchlist; the app re-checks prices on
/// open/refresh via the REAL backend — it never schedules fake updates).
class TrackedItem {
  final String key;
  final String title;
  final String vertical;
  final String query;
  final String? canonicalEntityId;
  final double lastPrice;
  final String? pageUrl;
  final DateTime addedAt;

  const TrackedItem({
    required this.key,
    required this.title,
    required this.vertical,
    required this.query,
    this.canonicalEntityId,
    required this.lastPrice,
    this.pageUrl,
    required this.addedAt,
  });

  Map<String, dynamic> toJson() => {
        'key': key,
        'title': title,
        'vertical': vertical,
        'query': query,
        'canonicalEntityId': canonicalEntityId,
        'lastPrice': lastPrice,
        'pageUrl': pageUrl,
        'addedAt': addedAt.toIso8601String(),
      };

  static TrackedItem fromJson(Map<String, dynamic> j) => TrackedItem(
        key: '${j['key']}',
        title: '${j['title']}',
        vertical: '${j['vertical']}',
        query: '${j['query']}',
        canonicalEntityId: j['canonicalEntityId'] == null ? null : '${j['canonicalEntityId']}',
        lastPrice: (j['lastPrice'] is num) ? (j['lastPrice'] as num).toDouble() : 0,
        pageUrl: j['pageUrl'] == null ? null : '${j['pageUrl']}',
        addedAt: DateTime.tryParse('${j['addedAt']}') ?? DateTime.now(),
      );
}

/// App settings + tracked list, persisted with shared_preferences.
class AppStore {
  /// Fires when the user toggles dark mode on the Settings screen.
  final ValueNotifier<bool> darkModeNotifier = ValueNotifier(false);

  static const _kTracked = 't1sTracked';
  static const _kCity = 't1sCity';
  static const _kPincode = 't1sPincode';
  static const _kApiBase = 't1sApiBase';
  static const _kRecents = 't1sRecents';
  static const _kDark = 't1sDarkMode';

  Future<SharedPreferences> get _p => SharedPreferences.getInstance();

  // -- settings ---------------------------------------------------------

  Future<String> city() async => (await _p).getString(_kCity) ?? '';
  Future<String> pincode() async => (await _p).getString(_kPincode) ?? '';
  Future<String> apiBase() async => (await _p).getString(_kApiBase) ?? '';
  Future<bool> darkMode() async => (await _p).getBool(_kDark) ?? false;

  Future<void> saveSettings({String? city, String? pincode, String? apiBase, bool? dark}) async {
    final p = await _p;
    if (city != null) await p.setString(_kCity, city.trim());
    if (pincode != null) await p.setString(_kPincode, pincode.trim());
    if (apiBase != null) await p.setString(_kApiBase, apiBase.trim());
    if (dark != null) {
      await p.setBool(_kDark, dark);
      darkModeNotifier.value = dark;
    }
  }

  /// API with the user's configured base URL applied.
  Future<Try1SecondApi> api() async => Try1SecondApi(baseUrl: await apiBase());

  // -- recents ----------------------------------------------------------

  Future<List<String>> recents() async =>
      ((await _p).getStringList(_kRecents) ?? const <String>[]);

  Future<void> clearRecents() async {
    final p = await _p;
    await p.remove(_kRecents);
  }

  Future<void> addRecent(String q) async {
    final p = await _p;
    final list = (p.getStringList(_kRecents) ?? <String>[])
        .where((e) => e.toLowerCase() != q.toLowerCase())
        .toList();
    list.insert(0, q);
    await p.setStringList(_kRecents, list.take(10).toList());
  }

  // -- tracked ----------------------------------------------------------

  Future<List<TrackedItem>> tracked() async {
    final raw = (await _p).getString(_kTracked);
    if (raw == null || raw.isEmpty) return const [];
    try {
      final list = (jsonDecode(raw) as List).whereType<Map<String, dynamic>>();
      return list.map(TrackedItem.fromJson).toList();
    } catch (_) {
      return const [];
    }
  }

  Future<void> _writeTracked(List<TrackedItem> list) async {
    final p = await _p;
    await p.setString(
      _kTracked,
      jsonEncode(list.map((t) => t.toJson()).toList()),
    );
  }

  Future<bool> isTracked(String key) async =>
      (await tracked()).any((t) => t.key == key);

  // -- on-disk live cache (21 Oct speed fix) -----------------------------
  // Persisted live-search responses so the app paints results INSTANTLY on a
  // cold start (before the first network byte arrives). Layout:
  //   {"city": "...", "pincode": "...", "v": {vertical: {"q": "...", "t": ms, "j": {...raw server json...}}}}
  // Entries whose city/pincode no longer match are dropped on load.

  static const _kLiveCache = 't1sLiveDiskCache';

  Future<Map<String, dynamic>> liveDiskCacheLoad() async {
    try {
      final raw = (await _p).getString(_kLiveCache);
      if (raw == null || raw.isEmpty) return const {};
      final j = jsonDecode(raw);
      if (j is! Map<String, dynamic>) return const {};
      return j;
    } catch (_) {
      return const {};
    }
  }

  Future<void> liveDiskCacheSave(Map<String, dynamic> doc) async {
    // Whole-body guard (owner 23 Oct hotels/cab hang): SharedPreferences
    // getInstance() itself can throw (missing plugin in tests, corrupted prefs
    // on some ROMs). Disk persistence is a pure optimization, so ANY failure
    // must swallow silently — an escaped error becomes an unhandled zone error
    // that silently poisons the in-flight async chain and hangs the loader.
    try {
      final p = await _p;
      await p.setString(_kLiveCache, jsonEncode(doc));
    } catch (_) {
      // Storage full / too large: drop the cache rather than crash.
      try {
        await (await _p).remove(_kLiveCache);
      } catch (_) {}
    }
  }

  Future<void> liveDiskCacheClear() async {
    try {
      await (await _p).remove(_kLiveCache);
    } catch (_) {}
  }

  Future<void> toggleTrack(TrackedItem item) async {
    final list = await tracked();
    final exists = list.any((t) => t.key == item.key);
    if (exists) {
      await _writeTracked(list.where((t) => t.key != item.key).toList());
    } else {
      list.insert(0, item);
      await _writeTracked(list.take(50).toList());
    }
  }

  /// Re-check every tracked item against the REAL backend. Returns entries
  /// whose verified price moved since the last observation. Items the engine
  /// could not verify are returned untouched — never guessed.
  Future<List<(TrackedItem, double, double)>> refreshTracked() async {
    final t1sApi = await api();
    final cityV = await city();
    final pinV = await pincode();
    final list = await tracked();
    final out = <(TrackedItem, double, double)>[];
    final updated = <TrackedItem>[];
    for (final item in list) {
      var current = item;
      try {
        final res = await t1sApi.search(item.query,
            vertical: item.vertical, city: cityV, pincode: pinV);
        final match = pickMatchingOffer(
            res.results, item.query, item.canonicalEntityId);
        if (match != null && match.hasPrice && match.effectivePrice != item.lastPrice) {
          out.add((item, item.lastPrice, match.effectivePrice));
          current = TrackedItem(
            key: item.key,
            title: item.title,
            vertical: item.vertical,
            query: item.query,
            canonicalEntityId: item.canonicalEntityId,
            lastPrice: match.effectivePrice,
            pageUrl: item.pageUrl,
            addedAt: item.addedAt,
          );
        }
      } catch (_) {
        // backend unreachable for this item — keep the last verified price
      }
      updated.add(current);
    }
    await _writeTracked(updated);
    return out;
  }
}
