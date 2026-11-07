import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:try1second/core/api.dart';

void main() {
  group('Offer parsing', () {
    test('parses prices, seller, canonical id, attributes', () {
      final o = Offer.fromJson({
        'id': 'a1',
        'canonicalEntityId': 101,
        'title': 'boAt Airdopes 141',
        'vendor': 'flipkart',
        'seller': 'Flipkart',
        'sellerUrl': 'https://flipkart.com/x',
        'prices': {'effectivePrice': 999, 'listPrice': 1799, 'currency': 'INR'},
        'availability': 'in_stock',
        'location': {'city': 'Indore'},
        'attributes': {'color': 'black'},
      });
      expect(o.canonicalEntityId, '101');
      expect(o.effectivePrice, 999);
      expect(o.listPrice, 1799);
      expect(o.seller, 'Flipkart');
      expect(o.inStock, true);
      expect(o.city, 'Indore');
      expect(o.attributes['color'], 'black');
      expect(o.hasPrice, true);
    });

    test('zero / missing prices are unknown, never fabricated', () {
      final o = Offer.fromJson({'id': 'x', 'title': 't', 'prices': {}});
      expect(o.hasPrice, false);
      expect(o.effectivePrice, 0);
    });
  });

  group('groupByEntity', () {
    final offers = [
      Offer(id: 'a', canonicalEntityId: '101', title: 'Airdopes 141 black', vendor: 'fk', seller: 'Flipkart', effectivePrice: 1099),
      Offer(id: 'b', canonicalEntityId: '101', title: 'Airdopes 141', vendor: 'az', seller: 'Amazon India', effectivePrice: 999),
      Offer(id: 'c', canonicalEntityId: '202', title: 'Nord Buds 2', vendor: 'cr', seller: 'Croma', effectivePrice: 1799),
      Offer(id: 'd', canonicalEntityId: null, title: 'standalone', vendor: 'x', seller: 'X'),
    ];

    test('groups same entity, picks cheapest', () {
      final groups = groupByEntity(offers);
      expect(groups.length, 3);
      final g = groups.firstWhere((g) => g.best.id == 'b');
      expect(g.offers.length, 2);
      expect(g.bestPrice, 999);
    });

    test('unpriced offer stands alone and is never a best with fake price', () {
      final groups = groupByEntity(offers);
      final solo = groups.firstWhere((g) => g.offers.length == 1 && g.best.id == 'd');
      expect(solo.best.hasPrice, false);
    });
  });

  group('pickMatchingOffer', () {
    final offers = [
      Offer(id: 'a', canonicalEntityId: '101', title: 'boAt Airdopes 141 TWS Earbuds', vendor: 'fk', seller: 'F'),
      Offer(id: 'b', canonicalEntityId: '202', title: 'OnePlus Nord Buds 2 Earbuds', vendor: 'az', seller: 'A'),
    ];

    test('canonical-entity match wins and returns cheapest', () {
      final m = pickMatchingOffer(offers, 'boAt Airdopes 141', '101');
      expect(m, isNotNull);
      expect(m!.id, 'a');
    });

    test('>=60% title overlap matches when no canonical id', () {
      final m = pickMatchingOffer(offers, 'boAt Airdopes 141 TWS Earbuds', null);
      expect(m!.id, 'a');
    });

    test('no honest overlap returns null', () {
      expect(pickMatchingOffer(offers, 'Samsung Galaxy S24 Ultra', null), isNull);
    });
  });

  group('verdictFromHistory', () {
    test('needs at least 3 recorded points', () {
      expect(
        verdictFromHistory([
          HistoryPoint(DateTime(2026), 1000),
          HistoryPoint(DateTime(2026), 900),
        ], 900),
        isNull,
      );
    });

    test('near-lowest => Buy now', () {
      final pts = [
        for (var i = 0; i < 5; i++) HistoryPoint(DateTime(2026, 1, i + 1), 1000 + i * 100.0),
      ];
      final v = verdictFromHistory(pts, 1010);
      expect(v!.label, 'Buy now');
    });

    test('above average => Wait', () {
      final pts = [
        HistoryPoint(DateTime(2026, 1, 1), 900),
        HistoryPoint(DateTime(2026, 1, 2), 1000),
        HistoryPoint(DateTime(2026, 1, 3), 1100),
      ];
      final v = verdictFromHistory(pts, 1080);
      expect(v!.label, 'Wait');
    });
  });

  group('inr formatting (Indian grouping)', () {
    test('formats like the website', () {
      expect(inr(999), '₹999');
      expect(inr(1099), '₹1,099');
      expect(inr(10999), '₹10,999');
      expect(inr(109999), '₹1,09,999');
    });
  });

  group('Try1SecondApi (MockClient)', () {
    test('search posts query+vertical and parses state', () async {
      late http.Request captured;
      final api = Try1SecondApi.withClient(
        'https://x.test',
        MockClient((req) async {
          captured = req;
          return http.Response(
            jsonEncode({
              'success': true,
              'query': {'raw': 'milk'},
              'results': [
                {
                  'id': 'o1',
                  'canonicalEntityId': 7,
                  'title': 'Amul Taaza 500ml',
                  'vendor': 'blinkit',
                  'seller': 'Blinkit',
                  'prices': {'effectivePrice': 27},
                },
              ],
              'state': {'servedFrom': 'live', 'honestNotice': 'note'},
            }),
            200,
          );
        }),
      );
      final res = await api.search('milk', vertical: 'grocery', city: 'Indore');
      expect(captured.url.path, '/api/search');
      expect(captured.body, contains('"vertical":"grocery"'));
      expect(captured.body, contains('"city":"Indore"'));
      expect(res.servedFrom, 'live');
      expect(res.honestNotice, 'note');
      expect(res.results.single.seller, 'Blinkit');
    });

    test('history parses real points only', () async {
      final api = Try1SecondApi.withClient(
        'https://x.test',
        MockClient((req) async {
          expect(req.url.path, '/api/history');
          return http.Response(jsonEncode({
            'success': true,
            'points': [
              {'price': 100, 'capturedAt': '2026-10-01T00:00:00Z'},
              {'price': 0, 'capturedAt': '2026-10-02T00:00:00Z'},
              {'price': 90, 'capturedAt': '2026-10-03T00:00:00Z'},
            ],
          }), 200);
        }),
      );
      final pts = await api.history('7');
      expect(pts.length, 2); // zero-price point dropped, never fabricated
      expect(pts.last.price, 90);
    });

    test('go returns server-resolved redirectUrl', () async {
      final api = Try1SecondApi.withClient(
        'https://x.test',
        MockClient((req) async {
          expect(req.url.path, '/api/go');
          expect(req.url.queryParameters['offerId'], 'o1');
          return http.Response(
            jsonEncode({'success': true, 'redirectUrl': 'https://seller/offer?aff=1'}),
            200,
          );
        }),
      );
      expect(await api.go('https://seller/offer', 'o1'),
          'https://seller/offer?aff=1');
    });

    test('our own JSON refusal surfaces honestly', () async {
      final api = Try1SecondApi.withClient(
        'https://x.test',
        MockClient((req) async => http.Response(
            jsonEncode({'error': 'bad_request'}), 400,
            headers: {'content-type': 'application/json'})),
      );
      expect(() => api.search('q'), throwsException);
    });

    test('an edge refusal (no API body) becomes the retrying state, never a box', () async {
      // Owner rule 31 Oct: a 503 from the hosting edge / a WAF page is NOT an answer the user
      // should read as an error; the app keeps its own scanning state so the screen stays alive.
      final api = Try1SecondApi.withClient(
        'https://x.test',
        MockClient((req) async => http.Response('', 503)),
      );
      final res = await api.search('q');
      expect(res.results, isEmpty);
      expect(res.servedFrom, anyOf('unavailable', ''));
    });
  });

  // ---- App links: only admin-configured https links are surfaced ----
group('AppLinks', () {
  test('non-https or malformed links are never shown', () {
    final l = AppLinks.fromJson({'links': {
      'chrome_extension': {'url': 'javascript:alert(1)', 'version': 'v1'},
      'android_app': {'url': 'http://insecure.example/a'},
      'ios_app': {'url': 'https://apps.apple.com/app/id1', 'version': ''},
    }});
    expect(l.chromeExtension, isNull);
    expect(l.androidApp, isNull);
    expect(l.iosApp, isNotNull);
    expect(l.iosApp!.version, isNull); // empty version stays null
  });

  test('missing links payload yields all-null links (honest empty state)', () {
    final l = AppLinks.fromJson({});
    expect(l.chromeExtension, isNull);
    expect(l.androidApp, isNull);
    expect(l.iosApp, isNull);
  });

  test('valid link keeps url and version', () {
    final l = AppLinks.fromJson({'links': {
      'android_app': {'url': 'https://play.google.com/store/apps/details?id=com.try1second', 'version': 'v1.1.1'},
    }});
    expect(l.androidApp!.url, startsWith('https://play.google.com'));
    expect(l.androidApp!.version, 'v1.1.1');
  });
});

// ---- Auth user display helpers ----
group('AuthUser', () {
  test('initials from full name, single name and email fallback', () {
    expect(AuthUser.fromJson({'id': 1, 'email': 'a@example.com', 'role': 'user', 'displayName': 'Petro Staff'}).initials, 'PS');
    expect(AuthUser.fromJson({'id': 2, 'email': 'a@example.com', 'role': 'user', 'displayName': 'Petro'}).initials, 'PE');
    expect(AuthUser.fromJson({'id': 3, 'email': 'owner@example.com', 'role': 'user'}).initials, 'owner'.substring(0, 2).toUpperCase());
    expect(AuthUser.fromJson({'id': 4, 'email': 'x@y.z', 'role': 'user'}).name, 'x');
  });

  test('displayName wins over email local-part for name', () {
    final u = AuthUser.fromJson({'id': 5, 'email': 'zzz@example.com', 'role': 'user', 'displayName': 'Try1 User'});
    expect(u.name, 'Try1 User');
  });
});

// ---- Rewards summary mapping (backend /api/rewards/me) ----
group('RewardsSummary', () {
  test('maps validPoints, eligibility and spin cost', () {
    final r = RewardsSummary.fromJson({
      'validPoints': 240, 'availableEligibilities': 2, 'pointsPerSpinEligibility': 100,
    });
    expect(r.validPoints, 240);
    expect(r.availableSpins, 2);
    expect(r.pointsPerSpin, 100);
  });

  test('missing spin cost falls back to 100 and absent fields to zero', () {
    final r = RewardsSummary.fromJson({});
    expect(r.validPoints, 0);
    expect(r.availableSpins, 0);
    expect(r.pointsPerSpin, 100);
  });
});

// ---- Quick apps parsing (customer-safe fields only) ----
group('QuickApp', () {
  test('parses name, rating and optional fields', () {
    final a = QuickApp.fromJson({
      'id': 'qapp-x', 'name': 'Swiggy', 'iconUrl': 'https://example.com/i.png',
      'category': 'Food', 'description': 'Delivery', 'webUrl': 'https://swiggy.com',
      'rating': 4.6, 'downloadsOrUsers': '100M+ Downloads', 'badge': 'Trending',
    });
    expect(a.name, 'Swiggy');
    expect(a.rating, 4.6);
    expect(a.users, '100M+ Downloads');
    expect(a.badge, 'Trending');
  });

  test('empty-name apps are filtered by the caller contract', () {
    final a = QuickApp.fromJson({'id': 'q', 'name': '', 'webUrl': '', 'rating': 0});
    expect(a.name, '');
  });
});

  // Owner 22 Oct bug: Quick Apps screen showed 'No apps found' — the server
  // sends {affiliates: [...]}, the app read res['apps'] only.
  group('Quick Apps parsing (server sends affiliates key)', () {
    final serverShape = {
      'success': true,
      'affiliates': [
        {
          'id': 'qa-swiggy', 'name': 'Swiggy', 'category': 'Food',
          'iconUrl': 'https://icons.duckduckgo.com/ip3/swiggy.com.ico',
          'webUrl': 'https://swiggy.com', 'rating': 0,
          'description': 'Live-tracked coupons', 'downloadsOrUsers': '', 'badge': 'Live Coupons',
          'goUrl': '/api/out?t=abc.sig',
        },
        {'id': 'qa-x', 'name': '', 'webUrl': 'https://x.example'}, // malformed, skipped
      ],
    };

    test('reads the affiliates key (and still tolerates the old apps key)', () {
      final apps = QuickApp.parseRows(serverShape, baseUrl: 'https://www.try1second.com');
      expect(apps.length, 1, reason: 'empty-name rows are skipped');
      expect(apps.first.name, 'Swiggy');
      expect(apps.first.category, 'Food');
      // relative masking pointer resolved against the API base
      expect(apps.first.goUrl, 'https://www.try1second.com/api/out?t=abc.sig');
    });

    test('old {apps: [...]} shape still parses (server-evolution safe)', () {
      final apps = QuickApp.parseRows({'apps': serverShape['affiliates']}, baseUrl: 'https://www.try1second.com');
      expect(apps.length, 1);
      expect(apps.first.goUrl, startsWith('https://www.try1second.com/api/out?'));
    });

    test('empty/failed responses stay empty, never crash', () {
      expect(QuickApp.parseRows(null, baseUrl: 'b'), isEmpty);
      expect(QuickApp.parseRows('nope', baseUrl: 'b'), isEmpty);
      expect(QuickApp.parseRows(<String, dynamic>{}, baseUrl: 'b'), isEmpty);
    });
  });
}
