import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:try1second/core/api.dart';

/// OWNER 31 Oct, priority bug: the app showed a bare "HTTP 400" everywhere. The 400 comes from the
/// hop (Cloudflare relay / the edge) refusing the request, not from our API, so the fix must prove
/// that the very same call is replayed against the other host and that the app then sticks to it.
void main() {
  late HttpServer brokenHop;
  late HttpServer healthyHop;
  var brokenHits = 0;
  var healthyHits = 0;

  setUp(() async {
    brokenHits = 0;
    healthyHits = 0;
    brokenHop = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    brokenHop.listen((req) async {
      brokenHits++;
      req.response.statusCode = 400; // exactly what the app was showing
      req.response.headers.contentType = ContentType.html;
      req.response.write('<html><body><pre>Bad Request</pre></body></html>');
      await req.response.close();
    });
    healthyHop = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    healthyHop.listen((req) async {
      healthyHits++;
      req.response.headers.contentType = ContentType.json;
      req.response.write(jsonEncode({
        'success': true,
        'query': {'rawQuery': 'mobile phone', 'vertical': 'ecommerce'},
        'results': [
          {'id': 'r1', 'title': 'OnePlus 13', 'vendor': 'Amazon', 'prices': {'amount': 59999}},
        ],
      }));
      await req.response.close();
    });
  });

  tearDown(() async {
    await brokenHop.close(force: true);
    await healthyHop.close(force: true);
  });

  String base(HttpServer s) => 'http://${s.address.address}:${s.port}';

  test('a 400 from the serving hop is replayed against the other host instead of failing', () async {
    final api = Try1SecondApi(baseUrl: base(brokenHop), fallbackBase: base(healthyHop));
    final res = await api.search('mobile phone', vertical: 'ecommerce', city: 'Indore');
    expect(res.results, isNotEmpty, reason: 'the origin hop must serve the same call');
    expect(brokenHits, 1, reason: 'the broken hop is asked once, never hammered');
    expect(healthyHits, greaterThanOrEqualTo(1));
  });

  test('once a hop answers, later calls go there directly (no double latency)', () async {
    final api = Try1SecondApi(baseUrl: base(brokenHop), fallbackBase: base(healthyHop));
    await api.search('mobile phone', vertical: 'ecommerce');
    await api.search('laptop', vertical: 'ecommerce');
    expect(brokenHits, 1, reason: 'the app must stay on the working route');
    expect(healthyHits, greaterThanOrEqualTo(2));
  });

  test('a RESET hop (not just a 400) also fails over to the other way home', () async {
    // OWNER 31 Oct: "ClientException: Connection reset by peer, uri=https://www.try1second.com".
    // A dead socket on the preferred hop used to break out of the retry loop, so the app showed the
    // red Retry box even though the relay was serving the very same call. Nothing listens on the
    // dead port, which is what a reset looks like to dart:io.
    final dead = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final deadBase = base(dead);
    await dead.close(force: true); // port is now closed: every attempt throws a socket error

    final api = Try1SecondApi(baseUrl: deadBase, fallbackBase: base(healthyHop));
    final res = await api.search('mobile phone', vertical: 'ecommerce', city: 'Indore');
    expect(res.results, isNotEmpty, reason: 'the healthy hop must answer once the dead one fails');
    expect(healthyHits, greaterThanOrEqualTo(1));
  });
}
