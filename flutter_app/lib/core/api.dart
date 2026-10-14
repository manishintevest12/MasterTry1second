/// Try1Second mobile app — shared models + pure-Dart core logic.
///
/// No Flutter imports here on purpose: this file is fully analyzable and
/// testable with a standalone Dart SDK and mirrors the web + extension
/// no-fabrication rules. Every price shown in the app originates from
/// these parsed API responses.
library;

import 'dart:convert';

import 'package:http/http.dart' as http;

const String kDefaultApiBase = 'https://www.try1second.com';

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

/// A single verified offer returned by POST /api/search.
class Offer {
  final String id;
  final String? canonicalEntityId;
  final String title;
  final String? brand;
  final String vendor;
  final String seller;
  final String? sellerUrl;
  final String? image;
  final double effectivePrice; // 0 => unknown/not quoted
  final double listPrice;
  final String availability;
  final String? city;
  final Map<String, String> attributes;

  const Offer({
    required this.id,
    this.canonicalEntityId,
    required this.title,
    this.brand,
    required this.vendor,
    required this.seller,
    this.sellerUrl,
    this.image,
    this.effectivePrice = 0,
    this.listPrice = 0,
    this.availability = 'unknown',
    this.city,
    this.attributes = const {},
  });

  static Offer fromJson(Map<String, dynamic> j) {
    final prices = (j['prices'] as Map?) ?? const {};
    final attrs = <String, String>{};
    final rawAttrs = j['attributes'];
    if (rawAttrs is Map) {
      rawAttrs.forEach((k, v) => attrs['$k'] = '$v');
    }
    String? image;
    final media = j['media'];
    if (media is Map && media['images'] is List && (media['images'] as List).isNotEmpty) {
      image = '${(media['images'] as List).first}';
    } else if (j['image'] is String) {
      image = j['image'] as String?;
    }
    return Offer(
      id: '${j['id'] ?? ''}',
      canonicalEntityId: j['canonicalEntityId'] == null ? null : '${j['canonicalEntityId']}',
      title: '${j['title'] ?? ''}',
      brand: j['brand'] == null ? null : '${j['brand']}',
      vendor: '${j['vendor'] ?? ''}',
      seller: '${j['seller'] ?? j['vendor'] ?? ''}',
      sellerUrl: j['sellerUrl'] == null ? null : '${j['sellerUrl']}',
      image: image,
      effectivePrice: _num(prices['effectivePrice'] ?? prices['mandatoryTotal']),
      listPrice: _num(prices['listPrice']),
      availability: '${j['availability'] ?? 'unknown'}',
      city: (j['location'] is Map) ? '${(j['location'] as Map)['city']}' : null,
      attributes: attrs,
    );
  }

  static double _num(dynamic v) {
    if (v == null) return 0;
    final d = v is num ? v.toDouble() : double.tryParse('$v');
    return d != null && d > 0 ? d : 0;
  }

  bool get hasPrice => effectivePrice > 0;
  bool get inStock => availability == 'in_stock';
}

/// Response of POST /api/search.
class SearchResponse {
  final String query;
  final List<Offer> results;
  final String servedFrom; // live | catalogue | cache | partial | unavailable
  final String? honestNotice;

  const SearchResponse({
    required this.query,
    required this.results,
    required this.servedFrom,
    this.honestNotice,
  });

  static SearchResponse fromJson(Map<String, dynamic> j) {
    final state = (j['state'] as Map<String, dynamic>?) ?? const {};
    return SearchResponse(
      query: '${j['query'] ?? ''}',
      results: ((j['results'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(Offer.fromJson)
          .toList(),
      servedFrom: '${state['servedFrom'] ?? 'unavailable'}',
      honestNotice: state['honestNotice'] == null ? null : '${state['honestNotice']}',
    );
  }
}

/// One recorded price-history point (GET /api/history).
class HistoryPoint {
  final DateTime at;
  final double price;

  const HistoryPoint(this.at, this.price);

  static HistoryPoint fromJson(Map<String, dynamic> j) {
    final at = DateTime.tryParse('${j['capturedAt'] ?? j['captured_at'] ?? ''}') ?? DateTime.now();
    return HistoryPoint(at, Offer._num(j['price'] ?? j['effective_price']));
  }
}

/// A group of offers that belong to the SAME canonical product, plus the
/// group's cheapest price-owning offer.
class OfferGroup {
  final List<Offer> offers;
  final Offer best;

  OfferGroup(this.offers, this.best);

  double get bestPrice => best.effectivePrice;
}

/// Buy / wait / fair verdict computed ONLY from recorded history.
class Verdict {
  final String label; // Buy now | Wait | Fair price
  final String text;
  const Verdict(this.label, this.text);
}

// ---------------------------------------------------------------------------
// API client (pure Dart, uses package:http)
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Download links (admin-configured), Quick Apps, auth + rewards models.

class AppLink {
  final String url;
  final String? version;
  const AppLink(this.url, this.version);
}

class AppLinks {
  final AppLink? chromeExtension;
  final AppLink? androidApp;
  final AppLink? iosApp;
  const AppLinks({this.chromeExtension, this.androidApp, this.iosApp});

  static AppLink? _one(dynamic v) {
    if (v is! Map) return null;
    final url = '${v['url'] ?? ''}'.trim();
    if (!url.startsWith('https://')) return null; // never surface a non-https link
    final ver = v['version'];
    return AppLink(url, ver == null || '$ver'.isEmpty ? null : '$ver');
  }

  static AppLinks fromJson(Map<String, dynamic> j) {
    final l = j['links'];
    if (l is! Map) return const AppLinks();
    return AppLinks(
      chromeExtension: _one(l['chrome_extension']),
      androidApp: _one(l['android_app']),
      iosApp: _one(l['ios_app']),
    );
  }
}

class QuickApp {
  final String id;
  final String name;
  final String iconUrl;
  final String category;
  final String description;
  final String webUrl;
  final double rating;
  final String? users;
  final String? badge;
  const QuickApp({
    required this.id,
    required this.name,
    required this.iconUrl,
    required this.category,
    required this.description,
    required this.webUrl,
    required this.rating,
    this.users,
    this.badge,
  });

  static QuickApp fromJson(Map<String, dynamic> j) => QuickApp(
        id: '${j['id'] ?? ''}',
        name: '${j['name'] ?? ''}',
        iconUrl: '${j['iconUrl'] ?? ''}',
        category: '${j['category'] ?? ''}',
        description: '${j['description'] ?? ''}',
        webUrl: '${j['webUrl'] ?? ''}',
        rating: Offer._num(j['rating']),
        users: j['downloadsOrUsers'] == null ? null : '${j['downloadsOrUsers']}',
        badge: j['badge'] == null ? null : '${j['badge']}',
      );
}

class AuthUser {
  final int id;
  final String email;
  final String role;
  final String? displayName;
  final String? picture;
  const AuthUser({required this.id, required this.email, required this.role, this.displayName, this.picture});

  String get name => (displayName != null && displayName!.trim().isNotEmpty) ? displayName!.trim() : email.split('@').first;
  String get initials {
    final parts = name.split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '1S';
    return (parts.length == 1 ? parts.first.substring(0, parts.first.length.clamp(1, 2)) : '${parts.first[0]}${parts.last[0]}').toUpperCase();
  }

  static AuthUser fromJson(Map<String, dynamic> j) => AuthUser(
        id: (j['id'] is num) ? (j['id'] as num).toInt() : int.tryParse('${j['id']}') ?? 0,
        email: '${j['email'] ?? ''}',
        role: '${j['role'] ?? 'user'}',
        displayName: j['displayName'] == null ? null : '${j['displayName']}',
        picture: j['picture'] == null ? null : '${j['picture']}',
      );

  Map<String, dynamic> toJson() => {'id': id, 'email': email, 'role': role, 'displayName': displayName, 'picture': picture};
}

class AuthSession {
  final String token;
  final AuthUser user;
  const AuthSession(this.token, this.user);
}

class RewardsSummary {
  final int validPoints;
  final int availableSpins;
  final int pointsPerSpin;
  const RewardsSummary(this.validPoints, this.availableSpins, this.pointsPerSpin);

  static RewardsSummary fromJson(Map<String, dynamic> j) => RewardsSummary(
        Offer._num(j['validPoints']).toInt(),
        Offer._num(j['availableEligibilities']).toInt(),
        Offer._num(j['pointsPerSpinEligibility']).toInt() == 0 ? 100 : Offer._num(j['pointsPerSpinEligibility']).toInt(),
      );
}

class SpinPrize {
  final String name;
  final String? description;
  const SpinPrize(this.name, this.description);
}

class ScanResult {
  final String title;
  final String vertical;
  final String provider;
  final double price;
  final String? url;
  const ScanResult({required this.title, required this.vertical, required this.provider, required this.price, this.url});
}

/// One Price Lens result: a verified same-product offer with a real price.
class LensOffer {
  final String id;
  final String title;
  final String seller;
  final double price;
  final String goUrl;
  const LensOffer({required this.id, required this.title, required this.seller, required this.price, required this.goUrl});
  factory LensOffer.fromJson(Map<String, dynamic> j) => LensOffer(
        id: '${j['id'] ?? ''}',
        title: '${j['title'] ?? ''}',
        seller: '${j['seller'] ?? ''}',
        price: Offer._num(j['price']),
        goUrl: '${j['goUrl'] ?? ''}',
      );
}

/// POST /api/lens response: the product read from the pasted link + cheapest real offers.
class LensResponse {
  final bool found;
  final String? title;
  final String merchant;
  final double? pagePrice;
  final double? savingVsPage;
  final String? message;
  final List<LensOffer> offers;
  const LensResponse({required this.found, this.title, this.merchant = '', this.pagePrice, this.savingVsPage, this.message, this.offers = const []});
  factory LensResponse.fromJson(Map<String, dynamic> j) {
    final product = (j['product'] as Map?) ?? const {};
    final pvc = (j['pageVsCheapest'] as Map?);
    return LensResponse(
      found: j['found'] == true,
      title: product['title'] == null ? null : '${product['title']}',
      merchant: '${product['merchant'] ?? ''}',
      pagePrice: Offer._num(product['pagePrice']),
      savingVsPage: pvc == null ? null : Offer._num(pvc['saving']),
      message: j['message'] == null ? null : '${j['message']}',
      offers: ((j['results'] as List?) ?? const []).whereType<Map<String, dynamic>>().map(LensOffer.fromJson).toList(),
    );
  }
}

/// POST /api/assist/intent response: which vertical to open and what to search there.
class AssistIntent {
  final bool understood;
  final String? vertical;
  final String query;
  final String? date;
  final String reply;
  const AssistIntent({required this.understood, this.vertical, required this.query, this.date, required this.reply});
  factory AssistIntent.fromJson(Map<String, dynamic> j) => AssistIntent(
        understood: j['understood'] == true,
        vertical: j['vertical'] == null ? null : '${j['vertical']}',
        query: '${j['query'] ?? ''}',
        date: j['date'] == null ? null : '${j['date']}',
        reply: '${j['reply'] ?? ''}',
      );
}

class Try1SecondApi {
  Try1SecondApi({String? baseUrl})
      : baseUrl = (baseUrl == null || baseUrl.trim().isEmpty)
            ? kDefaultApiBase
            : baseUrl.trim().replaceAll(RegExp(r'/+$'), ''),
        _client = http.Client();

  Try1SecondApi.withClient(this.baseUrl, http.Client client) : _client = client;

  final String baseUrl;

  Future<SearchResponse> search(
    String query, {
    String vertical = 'ecommerce',
    String? city,
    String? pincode,
  }) async {
    final res = await _post('/api/search', {
      'query': query.trim().substring(0, query.trim().length.clamp(0, 300)),
      'vertical': vertical,
      if (city != null && city.trim().isNotEmpty) 'city': city.trim(),
      if (pincode != null && pincode.trim().isNotEmpty) 'pincode': pincode.trim(),
    });
    return SearchResponse.fromJson(res);
  }

  Future<List<HistoryPoint>> history(String entityId, {int limit = 120}) async {
    final res = await _get('/api/history?entity=${Uri.encodeQueryComponent(entityId)}&limit=$limit');
    final points = (res['points'] as List?) ?? const [];
    return points
        .whereType<Map<String, dynamic>>()
        .map(HistoryPoint.fromJson)
        .where((p) => p.price > 0)
        .toList();
  }

  /// Safe, click-recorded, affiliate-applied redirect via /api/go.
  Future<String> go(String url, String? offerId) async {
    final res = await _get(
      '/api/go?url=${Uri.encodeQueryComponent(url)}'
      '${offerId == null || offerId.isEmpty ? '' : '&offerId=${Uri.encodeQueryComponent(offerId)}'}',
    );
    if (res['success'] != true || res['redirectUrl'] == null) {
      throw Exception('Redirect refused');
    }
    return '${res['redirectUrl']}';
  }


  // -- public content --------------------------------------------------------

  Future<AppLinks> appLinks() async => AppLinks.fromJson(await _get('/api/app-links'));

  Future<List<QuickApp>> quickApps() async {
    final res = await _get('/api/quick-apps');
    return ((res['apps'] as List?) ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(QuickApp.fromJson)
        .where((a) => a.name.isNotEmpty)
        .toList();
  }

  /// AI Insights URL scanner: paste a product link, get the live-scraped price (or an honest failure).
  Future<ScanResult> scanUrl(String url) async {
    final res = await _post('/api/scan/url', {'url': url.trim()});
    final item = res['item'];
    if (item is! Map<String, dynamic>) throw Exception('Could not read that page');
    return ScanResult(
      title: '${item['title'] ?? ''}',
      vertical: '${item['vertical'] ?? ''}',
      provider: '${item['provider'] ?? ''}',
      price: Offer._num(item['primaryPrice']),
      url: url.trim(),
    );
  }

  /// Price Lens: paste ANY product link -> the same product's cheapest verified price across sites.
  Future<LensResponse> lens(String input) async =>
      LensResponse.fromJson(await _post('/api/lens', {'input': input.trim()}));

  /// Home AI assistant: a typed or spoken question -> which vertical + query (+ date).
  Future<AssistIntent> assistIntent(String text) async =>
      AssistIntent.fromJson(await _post('/api/assist/intent', {'text': text.trim()}));

  // -- auth + rewards --------------------------------------------------------

  /// Exchanges a Google ID token (from native Google Sign-In) for a Try1Second session.
  Future<AuthSession> loginWithGoogle(String idToken) async {
    final res = await _post('/api/auth/google-mobile', {'idToken': idToken});
    if (res['success'] != true || res['token'] == null || res['user'] is! Map<String, dynamic>) {
      throw Exception('Google sign-in failed');
    }
    return AuthSession('${res['token']}', AuthUser.fromJson(res['user'] as Map<String, dynamic>));
  }

  Future<AuthUser> me(String token) async {
    final res = await _get('/api/auth/me', token: token);
    final u = res['user'];
    if (u is! Map<String, dynamic>) throw Exception('Session expired');
    return AuthUser.fromJson(u);
  }

  Future<RewardsSummary> rewards(String token) async => RewardsSummary.fromJson(await _get('/api/rewards/me', token: token));

  Future<SpinPrize> spin(String token) async {
    final res = await _post('/api/rewards/spin', {'idempotencyKey': 'app-${DateTime.now().microsecondsSinceEpoch}'}, token: token);
    final p = res['prize'];
    if (p is Map) {
      return SpinPrize('${p['name'] ?? p['title'] ?? 'Prize'}', p['description'] == null ? null : '${p['description']}');
    }
    return const SpinPrize('Better luck next time', null);
  }

  Uri searchUrl(String query) => Uri.parse(
        '$baseUrl/?q=${Uri.encodeQueryComponent(query)}',
      );

  // -- internals -----------------------------------------------------------

  static const _jsonHeaders = {'Content-Type': 'application/json'};

  final http.Client _client;

  Map<String, String> _headers(String? token) =>
      token == null ? _jsonHeaders : {..._jsonHeaders, 'Authorization': 'Bearer $token'};

  Future<Map<String, dynamic>> _post(String path, Map<String, dynamic> body, {String? token}) async {
    final res = await _client.post(
      Uri.parse('$baseUrl$path'),
      headers: _headers(token),
      body: jsonEncode(body),
    );
    return _decode(res);
  }

  Future<Map<String, dynamic>> _get(String path, {String? token}) async {
    final res = await _client.get(Uri.parse('$baseUrl$path'), headers: _headers(token));
    return _decode(res);
  }

  Map<String, dynamic> _decode(http.Response res) {
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception('HTTP ${res.statusCode}');
    }
    final body = jsonDecode(res.body);
    if (body is! Map<String, dynamic>) throw Exception('Malformed response');
    if (body['error'] is String && (body['error'] as String).isNotEmpty) {
      throw Exception(body['error'] as String);
    }
    return body;
  }
}

// ---------------------------------------------------------------------------
// Pure logic (ported 1:1 from the web/extension no-fabrication rules)
// ---------------------------------------------------------------------------

/// Group offers by canonical entity. Offers without a canonical id stand
/// alone — they are never merged into another product's group.
List<OfferGroup> groupByEntity(List<Offer> offers) {
  final byKey = <String, List<Offer>>{};
  for (final o in offers) {
    final key = o.canonicalEntityId ?? o.id;
    byKey.putIfAbsent(key, () => []).add(o);
  }
  return byKey.values.map((group) => OfferGroup(group, cheapestOf(group))).toList();
}

/// Cheapest offer that actually owns a price. Zero prices are skipped.
Offer cheapestOf(List<Offer> offers) {
  final priced = offers.where((o) => o.hasPrice).toList();
  if (priced.isEmpty) return offers.first;
  priced.sort((a, b) => a.effectivePrice.compareTo(b.effectivePrice));
  return priced.first;
}

/// Pick the offer matching a page/query product: prefer canonical-entity
/// match, else >=60% title-token overlap. Returns null when nothing matches
/// honestly (the caller must then show "no verified offers").
Offer? pickMatchingOffer(List<Offer> offers, String reference, String? canonicalEntityId) {
  if (offers.isEmpty) return null;
  if (canonicalEntityId != null && canonicalEntityId.isNotEmpty) {
    final byEntity = offers.where((o) => o.canonicalEntityId == canonicalEntityId).toList();
    if (byEntity.isNotEmpty) return cheapestOf(byEntity);
  }
  final refTokens = _tokens(reference);
  Offer? best;
  double bestScore = 0;
  for (final o in offers) {
    final tokens = _tokens(o.title);
    if (tokens.isEmpty) continue;
    var overlap = 0;
    for (final t in tokens) {
      if (refTokens.contains(t)) overlap++;
    }
    final score = overlap / tokens.length;
    if (score >= 0.6 && score > bestScore) {
      best = o;
      bestScore = score;
    }
  }
  return best;
}

Set<String> _tokens(String s) => s
    .toLowerCase()
    .replaceAll(RegExp(r'[^a-z0-9]+'), ' ')
    .trim()
    .split(' ')
    .where((t) => t.length > 2)
    .toSet();

/// Buy/wait/fair advice derived ONLY from recorded history (>=3 points).
Verdict? verdictFromHistory(List<HistoryPoint> points, double currentPrice) {
  final prices = points.map((p) => p.price).toList();
  if (prices.length < 3 || currentPrice <= 0) return null;
  final low = prices.reduce((a, b) => a < b ? a : b);
  final high = prices.reduce((a, b) => a > b ? a : b);
  final avg = prices.reduce((a, b) => a + b) / prices.length;
  final span = (high - low) == 0 ? 1.0 : high - low;
  final pos = (currentPrice - low) / span;
  if (pos <= 0.15) {
    return Verdict('Buy now', 'Price is at/near the lowest recorded ($low).');
  }
  if (currentPrice > avg) {
    return Verdict('Wait', 'Above the recorded average ($avg.round()). Consider waiting for a drop.');
  }
  return Verdict('Fair price', 'Between the recorded low ($low) and high ($high).');
}

/// ₹ formatting, Indian digit grouping (1,09,999 style used on the web).
String inr(num n) {
  final whole = n.round().abs().toString();
  final sb = StringBuffer();
  if (whole.length <= 3) {
    sb.write(whole);
  } else {
    final last3 = whole.substring(whole.length - 3);
    var rest = whole.substring(0, whole.length - 3);
    final parts = <String>[];
    while (rest.length > 2) {
      parts.insert(0, rest.substring(rest.length - 2));
      rest = rest.substring(0, rest.length - 2);
    }
    if (rest.isNotEmpty) parts.insert(0, rest);
    sb.write(parts.join(','));
    sb.write(',');
    sb.write(last3);
  }
  return '${n < 0 ? '-' : ''}₹$sb';
}
