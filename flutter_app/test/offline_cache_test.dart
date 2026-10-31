import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:try1second/core/api.dart';

/// OWNER 31 Oct ("ye error kabhi na aaye"): when BOTH hops are resetting, the app must show the
/// last known good answer for that exact request instead of a red error box, and it must mark it
/// `fromCache` so nothing pretends it is a fresh price.
void main() {
  late HttpServer server;
  late String base;

  setUp(() async {
    OfflineCache.debugMemoryStore = <String, String>{};
    server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    base = 'http://${server.address.address}:${server.port}';
    server.listen((req) async {
      req.response.headers.contentType = ContentType.json;
      req.response.write(jsonEncode({
        'success': true,
        'results': [
          {
            'id': 'r1',
            'title': 'OnePlus 13',
            'vendor': 'Amazon',
            'prices': {'amount': 59999}
          },
        ],
      }));
      await req.response.close();
    });
  });

  tearDown(() async {
    OfflineCache.debugMemoryStore = null;
    try {
      await server.close(force: true);
    } catch (_) {}
  });

  test('a dead network replays the last good answer instead of throwing',
      () async {
    final api = Try1SecondApi(baseUrl: base, fallbackBase: base);
    final fresh =
        await api.search('mobile phone', vertical: 'ecommerce', city: 'Indore');
    expect(fresh.results, isNotEmpty);

    await server.close(
        force: true); // port is gone: every attempt now fails in transport

    final offlineApi = Try1SecondApi(baseUrl: base, fallbackBase: base);
    final cached = await offlineApi.search('mobile phone',
        vertical: 'ecommerce', city: 'Indore');
    expect(cached.results, isNotEmpty,
        reason: 'the offline copy must render, not an error box');
    expect(cached.results.first.title, contains('OnePlus'));
  });

  test('a different query never borrows another query\'s rows', () async {
    // OWNER 31 Oct: no error box may reach the screen, so a cache miss for a DIFFERENT query
    // answers the app's own scanning state instead of throwing - but it must never invent rows.
    final api = Try1SecondApi(baseUrl: base, fallbackBase: base);
    await api.search('mobile phone', vertical: 'ecommerce');
    await server.close(force: true);

    final offlineApi = Try1SecondApi(baseUrl: base, fallbackBase: base);
    final landed =
        await offlineApi.search('air purifier', vertical: 'ecommerce');
    expect(landed.results, isEmpty,
        reason: 'never invent results for a query we never saw');
    expect(landed.results, isEmpty,
        reason: 'never invent results for a query we never saw');
  });

  test(
      'the cache marks a replayed answer as cached and expires nothing it just wrote',
      () async {
    OfflineCache.debugMemoryStore = <String, String>{};
    addTearDown(() => OfflineCache.debugMemoryStore = null);
    final key = OfflineCache.instance.key('POST', '/api/search', '{"q":"x"}');
    await OfflineCache.instance.put(key, '{"success":true,"results":[]}');
    final hit = await OfflineCache.instance.get(key);
    expect(hit, isNotNull);
    expect(hit!['fromCache'], isTrue);
    expect(hit['cachedAt'], isA<String>());
    expect(await OfflineCache.instance.get('nope'), isNull);
  });
}
