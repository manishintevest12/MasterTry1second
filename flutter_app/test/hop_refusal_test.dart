import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:try1second/core/api.dart';

/// OWNER 31 Oct, angry: "i dont want to see 400 or those error ... for app nothing is working".
/// The edge/WAF answers 400 with an HTML page; that is a refusal, not an answer, so it must never
/// reach the screen as "HTTP 400". It is covered by cache, or by the app's own scanning state, while
/// a genuine JSON error from OUR api must still surface.
void main() {
  late HttpServer server;
  late String base;
  int mode = 0; // 0 = good data, 1 = edge 400 HTML, 2 = our api 400 JSON

  setUp(() async {
    OfflineCache.debugMemoryStore = <String, String>{};
    mode = 0;
    server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    base = 'http://${server.address.address}:${server.port}';
    server.listen((req) async {
      if (mode == 1) {
        req.response.statusCode = 400;
        req.response.headers.contentType = ContentType.html;
        req.response.write('<html><body>Bad Request</body></html>');
      } else if (mode == 2) {
        req.response.statusCode = 400;
        req.response.headers.contentType = ContentType.json;
        req.response.write(
            jsonEncode({'error': 'bad_request_body', 'retryable': true}));
      } else {
        req.response.headers.contentType = ContentType.json;
        req.response.write(jsonEncode({
          'success': true,
          'results': [
            {'id': 'r1', 'title': 'OnePlus 13', 'vendor': 'Amazon'},
          ],
        }));
      }
      await req.response.close();
    });
  });

  tearDown(() async {
    OfflineCache.debugMemoryStore = null;
    try {
      await server.close(force: true);
    } catch (_) {}
  });

  test(
      'an edge 400 with a cached answer shows the cached answer, not "HTTP 400"',
      () async {
    final api = Try1SecondApi(baseUrl: base, fallbackBase: base);
    expect((await api.search('mobile phone', vertical: 'ecommerce')).results,
        isNotEmpty);

    mode = 1; // every hop now refuses with HTML 400
    final again = await Try1SecondApi(baseUrl: base, fallbackBase: base)
        .search('mobile phone', vertical: 'ecommerce');
    expect(again.results, isNotEmpty, reason: 'cached rows must render');
  });

  test(
      'an edge 400 with NO cache returns the scanning state instead of throwing',
      () async {
    mode = 1;
    final api = Try1SecondApi(baseUrl: base, fallbackBase: base);
    final res = await api.search('never cached query', vertical: 'ecommerce');
    expect(res.results, isEmpty);
  });

  test('a genuine 400 from our own API is still surfaced honestly', () async {
    mode = 2;
    final api = Try1SecondApi(baseUrl: base, fallbackBase: base);
    await expectLater(
        api.search('bad body', vertical: 'ecommerce'), throwsA(anything));
  });
}
