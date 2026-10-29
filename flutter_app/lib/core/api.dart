/// Try1Second mobile app — shared models + pure-Dart core logic.
///
/// No Flutter imports here on purpose: this file is fully analyzable and
/// testable with a standalone Dart SDK and mirrors the web + extension
/// no-fabrication rules. Every price shown in the app originates from
/// these parsed API responses.
library;

import 'dart:async';

import 'dart:convert';
import 'dart:io' as io;

import 'package:http/http.dart' as http;
import 'package:http/io_client.dart';

import 'compare.dart';

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
    // Website-parity hero chain (routes.ts offerToComparisonItem): raw offers keep
    // their hero shot in attributes (image_url -> first image_urls gallery shot ->
    // image). Without this fallback every catalogue offer (bank accounts, loans,
    // insurance) rendered the shopping-bag placeholder (owner 22 Oct).
    if (image == null || image.isEmpty) {
      final imgUrls = attrs['image_urls'] ?? '';
      final first = imgUrls.split('|').where((u) => u.startsWith('https://')).toList();
      image = [attrs['image_url'] ?? '', first.isEmpty ? '' : first.first, attrs['image'] ?? '']
          .firstWhere((u) => u.startsWith('https://'), orElse: () => '');
      if (image.isEmpty) image = null;
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
  // Owner rule: Quick App taps route through the server masking pointer
  // (/api/out) so affiliate tracking fires server-side, exactly like the web.
  final String goUrl;
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
    this.goUrl = '',
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
        goUrl: '${j['goUrl'] ?? ''}',
      );

  /// Owner 22 Oct bug: the server sends {affiliates: [...]}; the app used to
  /// read res['apps'] only, so the Quick Apps screen always showed the
  /// 'No apps found' empty state. Accept BOTH keys (server evolution-safe)
  /// and prefix relative icon/go URLs with the API base for the app.
  static List<QuickApp> parseRows(dynamic res, {required String baseUrl}) {
    if (res is! Map<String, dynamic>) return const [];
    final rows = (res['apps'] as List?) ?? (res['affiliates'] as List?) ?? const [];
    return rows
        .whereType<Map<String, dynamic>>()
        .map(QuickApp.fromJson)
        .where((a) => a.name.isNotEmpty)
        .map((a) => QuickApp(
              id: a.id,
              name: a.name,
              iconUrl: a.iconUrl.startsWith('/') ? '$baseUrl${a.iconUrl}' : a.iconUrl,
              category: a.category,
              description: a.description,
              webUrl: a.webUrl,
              rating: a.rating,
              users: a.users,
              badge: a.badge,
              // masking pointers are relative (/api/out?t=...) — resolve to the
              // API base so the in-app browser can open and track them.
              goUrl: a.goUrl.startsWith('/') ? '$baseUrl${a.goUrl}' : a.goUrl,
            ))
        .toList();
  }
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


/// One priced row the assistant answered with (POST /api/assist/answer).
class AssistRow {
  final String vertical;
  final String title;
  final String provider;
  final double price;
  final bool priceAvailable;
  final String? imageUrl;
  final Map<String, String> specs;
  const AssistRow({
    required this.vertical,
    required this.title,
    required this.provider,
    required this.price,
    required this.priceAvailable,
    this.imageUrl,
    this.specs = const {},
  });
  factory AssistRow.fromJson(Map<String, dynamic> j) => AssistRow(
        vertical: '${j['vertical'] ?? ''}',
        title: '${j['title'] ?? ''}',
        provider: '${j['provider'] ?? ''}',
        price: Offer._num(j['price']),
        priceAvailable: j['priceAvailable'] == true,
        imageUrl: j['imageUrl'] == null ? null : '${j['imageUrl']}',
        specs: ((j['specs'] as Map?) ?? const {}).map((k, v) => MapEntry('$k', '$v')),
      );
}

/// OWNER 28 Oct: the assistant ANSWERS in every vertical instead of only routing —
/// the reply names the cheapest real row and carries the comparable rows with it.
class AssistAnswer {
  final bool understood;
  final String? vertical;
  final String? engineVertical;
  final String query;
  final String? date;
  final String reply;
  final int count;
  final bool pendingRefresh;
  final List<AssistRow> results;
  const AssistAnswer({
    required this.understood,
    this.vertical,
    this.engineVertical,
    required this.query,
    this.date,
    required this.reply,
    required this.count,
    required this.pendingRefresh,
    required this.results,
  });
  factory AssistAnswer.fromJson(Map<String, dynamic> j) => AssistAnswer(
        understood: j['understood'] == true,
        vertical: j['vertical'] == null ? null : '${j['vertical']}',
        engineVertical: j['engineVertical'] == null ? null : '${j['engineVertical']}',
        query: '${j['query'] ?? ''}',
        date: j['date'] == null ? null : '${j['date']}',
        reply: '${j['reply'] ?? ''}',
        count: (j['count'] is num) ? (j['count'] as num).toInt() : 0,
        pendingRefresh: j['pendingRefresh'] == true,
        results: ((j['results'] as List?) ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(AssistRow.fromJson)
            .toList(),
      );
}

/// A live scrape/live response: website-parity ComparisonItems + honest source report.
class LiveResponse {
  final List<CompareItem> items;
  final List<String> attempted;
  final List<String> succeeded;
  final List<String> failed;
  final String servedFrom;
  final int latencyMs;
  /// Progressive cold-start: fresh catalogue rows were served instantly and live
  /// prices are still being acquired in the background — poll the same search again.
  final bool pendingRefresh;
  /// Raw server JSON kept so AppState can persist this response to the on-disk
  /// cache (instant app-open paint) without a second serialization pass.
  final Map<String, dynamic>? rawJson;
  const LiveResponse(this.items, this.attempted, this.succeeded, this.failed, this.servedFrom, this.latencyMs, {this.pendingRefresh = false, this.rawJson});

  factory LiveResponse.fromJson(Map<String, dynamic> j) => LiveResponse(
        [
          for (final r in (j['results'] as List? ?? const []))
            if (r is Map<String, dynamic>) CompareItem.fromJson(r),
        ],
        [for (final x in (j['sourcesAttempted'] as List? ?? const [])) '$x'],
        [for (final x in (j['sourcesSucceeded'] as List? ?? const [])) '$x'],
        [for (final x in (j['sourcesFailed'] as List? ?? const [])) x is Map ? '${x['sourceId'] ?? x['id'] ?? x}' : '$x'],
        '${j['servedFrom'] ?? ''}',
        (j['latencyMs'] is num) ? (j['latencyMs'] as num).round() : 0,
        pendingRefresh: j['pendingRefresh'] == true,
        rawJson: j,
      );
}

/// One curated home-showcase item (GET /api/home/showcase). Every item is a
/// real catalogue/affiliate row; url is a masking pointer -> /api/out.
/// In-app engine launch (Top Destinations opens the REAL flights search
/// for the city instead of an external link).
class ShowcaseLaunch {
  final String vertical;
  final String query;
  const ShowcaseLaunch(this.vertical, this.query);
  factory ShowcaseLaunch.fromJson(Map<String, dynamic> j) => ShowcaseLaunch('${j['vertical'] ?? ''}', '${j['query'] ?? ''}');
}

class ShowcaseItem {
  final String id;
  final String title;
  final String merchant;
  final String? merchantLogo;
  final String? image;
  final double? price;
  final double? mrp;
  final int? discountPct;
  final double? rating;
  final String? badge;
  final String url;
  final ShowcaseLaunch? launch;
  const ShowcaseItem(this.id, this.title, this.merchant, this.merchantLogo, this.image, this.price, this.mrp, this.discountPct, this.rating, this.badge, this.url, [this.launch]);

  factory ShowcaseItem.fromJson(Map<String, dynamic> j) => ShowcaseItem(
        '${j['id'] ?? ''}',
        '${j['title'] ?? ''}',
        '${j['merchant'] ?? ''}',
        j['merchantLogo'] == null || '${j['merchantLogo']}'.isEmpty ? null : '${j['merchantLogo']}',
        j['image'] == null || '${j['image']}'.isEmpty ? null : '${j['image']}',
        (j['price'] is num) ? (j['price'] as num).toDouble() : null,
        (j['mrp'] is num) ? (j['mrp'] as num).toDouble() : null,
        (j['discountPct'] is num) ? (j['discountPct'] as num).round() : null,
        (j['rating'] is num) ? (j['rating'] as num).toDouble() : null,
        j['badge'] == null || '${j['badge']}'.isEmpty ? null : '${j['badge']}',
        '${j['url'] ?? ''}',
        (j['launch'] is Map<String, dynamic>) ? ShowcaseLaunch.fromJson(j['launch']) : null,
      );
}

/// One showcase section ("Picked Just for You", "Go Big", ...).
class ShowcaseSection {
  final String id;
  final String title;
  final String subtitle;
  final List<ShowcaseItem> items;
  const ShowcaseSection(this.id, this.title, this.subtitle, this.items);

  factory ShowcaseSection.fromJson(Map<String, dynamic> j) => ShowcaseSection(
        '${j['id'] ?? ''}',
        '${j['title'] ?? ''}',
        '${j['subtitle'] ?? ''}',
        [for (final x in (j['items'] as List? ?? const [])) if (x is Map<String, dynamic>) ShowcaseItem.fromJson(x)],
      );
}

/// One per-vertical Top Pick (GET /api/rewards/top-picks): admin-curated pick or
/// live auto-pick from the offers catalogue. url is a masking pointer -> /api/out.
class RewardTopPick {
  final String vertical;
  final String source; // 'admin' | 'live'
  final String partnerName;
  final String headline;
  final String? offerText;
  final String? priceBadge;
  final String? badgeText;
  final double? rating;
  final String? image;
  final String ctaText;
  final String url;
  const RewardTopPick(this.vertical, this.source, this.partnerName, this.headline, this.offerText, this.priceBadge, this.badgeText, this.rating, this.image, this.ctaText, this.url);

  factory RewardTopPick.fromJson(Map<String, dynamic> j) => RewardTopPick(
        '${j['vertical'] ?? ''}',
        '${j['source'] ?? 'live'}',
        '${j['partnerName'] ?? ''}',
        '${j['headline'] ?? ''}',
        j['offerText'] == null || '${j['offerText']}'.isEmpty ? null : '${j['offerText']}',
        j['priceBadge'] == null || '${j['priceBadge']}'.isEmpty ? null : '${j['priceBadge']}',
        j['badgeText'] == null || '${j['badgeText']}'.isEmpty ? null : '${j['badgeText']}',
        (j['rating'] is num) ? (j['rating'] as num).toDouble() : null,
        j['image'] == null || '${j['image']}'.isEmpty ? null : '${j['image']}',
        '${j['ctaText'] ?? 'Grab Deal'}',
        '${j['url'] ?? ''}',
      );
}

/// GET /api/rewards/top-picks — one best pick per vertical (Rewards Top Picks).
Future<List<RewardTopPick>> fetchRewardsTopPicks(Try1SecondApi api) async {
  final res = await api.getJson('/api/rewards/top-picks');
  return [for (final x in (res['picks'] as List? ?? const [])) if (x is Map<String, dynamic>) RewardTopPick.fromJson(x)];
}

/// One upcoming movie (GET /api/movies/upcoming): BookMyShow's own upcoming
/// tab — real posters, release dates (decoded from BMS's poster overlay) and a
/// YouTube trailer search link. `goUrl` is a masking pointer -> /api/out.
class UpcomingMovie {
  final String title;
  final String? genres;
  final String? likes;
  final String? releaseDate;
  final String? poster;
  final String pageUrl;
  final String? eventCode;
  final String trailerUrl;
  final String goUrl;
  const UpcomingMovie(this.title, this.genres, this.likes, this.releaseDate, this.poster, this.pageUrl, this.eventCode, this.trailerUrl, this.goUrl);

  factory UpcomingMovie.fromJson(Map<String, dynamic> j) => UpcomingMovie(
        '${j['title'] ?? ''}',
        j['genres'] == null || '${j['genres']}'.isEmpty ? null : '${j['genres']}',
        j['likes'] == null || '${j['likes']}'.isEmpty ? null : '${j['likes']}',
        j['releaseDate'] == null || '${j['releaseDate']}'.isEmpty ? null : '${j['releaseDate']}',
        j['poster'] == null || '${j['poster']}'.isEmpty ? null : '${j['poster']}',
        '${j['pageUrl'] ?? ''}',
        j['eventCode'] == null || '${j['eventCode']}'.isEmpty ? null : '${j['eventCode']}',
        '${j['trailerUrl'] ?? ''}',
        '${j['goUrl'] ?? ''}',
      );
}

/// GET /api/movies/upcoming — upcoming movies for the homepage section.
Future<List<UpcomingMovie>> fetchUpcomingMovies(Try1SecondApi api) async {
  final res = await api.getJson('/api/movies/upcoming');
  return [for (final m in (res['movies'] as List? ?? const [])) if (m is Map<String, dynamic>) UpcomingMovie.fromJson(m)];
}

/// GET /api/home/showcase — the curated homepage sections under the launch grid.
Future<List<ShowcaseSection>> fetchHomeShowcase(Try1SecondApi api) async {
  final res = await api.getJson('/api/home/showcase');
  return [for (final s in (res['sections'] as List? ?? const [])) if (s is Map<String, dynamic>) ShowcaseSection.fromJson(s)];
}

/// One deal / coupon / bank offer (GET /api/deals).
class DealsFeed {
  final List<Deal> deals;
  final Map<String, int> counts;
  const DealsFeed({required this.deals, this.counts = const {}});
}

class SellerDeals {
  final List<Deal> deals;
  final Deal? bestOffer;
  final Deal? bestCoupon;
  const SellerDeals({required this.deals, this.bestOffer, this.bestCoupon});
}

class Deal {
  final int id;
  final String merchantKey;
  final String merchantName;
  final String kind;
  final String title;
  final String? description;
  final String? code;
  final String? discountText;
  final String? terms;
  final String? validTill;
  final String goUrl;
  final String? imageUrl;
  final String? vertical;
  final String? minOrder;
  const Deal({
    required this.id,
    required this.merchantKey,
    required this.merchantName,
    required this.kind,
    required this.title,
    this.description,
    this.code,
    this.discountText,
    this.terms,
    this.validTill,
    required this.goUrl,
    this.imageUrl,
    this.vertical,
    this.minOrder,
  });
  factory Deal.fromJson(Map<String, dynamic> j) => Deal(
        id: (j['id'] is num) ? (j['id'] as num).toInt() : 0,
        merchantKey: '${j['merchantKey'] ?? ''}',
        merchantName: '${j['merchantName'] ?? ''}',
        kind: '${j['kind'] ?? ''}',
        title: '${j['title'] ?? ''}',
        description: j['description'] == null ? null : '${j['description']}',
        code: j['code'] == null ? null : '${j['code']}',
        discountText: j['discountText'] == null ? null : '${j['discountText']}',
        terms: j['terms'] == null ? null : '${j['terms']}',
        validTill: j['validTill'] == null ? null : '${j['validTill']}',
        goUrl: '${j['goUrl'] ?? ''}',
        imageUrl: (j['imageUrl'] is String && (j['imageUrl'] as String).startsWith('http')) ? j['imageUrl'] as String : null,
        vertical: j['vertical'] == null ? null : '${j['vertical']}',
        minOrder: j['minOrder'] == null ? null : '${j['minOrder']}',
      );

  /// Merchant -> vertical, mirroring the backend map (used when the API
  /// response predates the vertical column).
  static String verticalOfMerchant(String key) {
    const m = <String, String>{
      'amazon': 'ecommerce', 'flipkart': 'ecommerce', 'myntra': 'ecommerce', 'ajio': 'ecommerce',
      'tatacliq': 'ecommerce', 'meesho': 'ecommerce', 'croma': 'ecommerce', 'nykaa': 'ecommerce',
      'xiaomi': 'ecommerce', 'oppo': 'ecommerce', 'realme': 'ecommerce', 'lenovo': 'ecommerce',
      'makemytrip': 'flights', 'goibibo': 'hotels', 'easemytrip': 'flights', 'ixigo': 'flights',
      'yatra': 'flights', 'cleartrip': 'flights', 'goindigo': 'flights', 'akasaair': 'flights',
      'booking': 'hotels', 'agoda': 'hotels', 'airbnb': 'hotels',
      'redbus': 'bus', 'abhibus': 'bus', 'zingbus': 'bus',
      'ola': 'cab', 'uber': 'cab', 'rapido': 'cab', 'savaari': 'cab', 'quickride': 'cab',
      'swiggy': 'food', 'zomato': 'food', 'dominos': 'food', 'pizzahut': 'food', 'eatsure': 'food', 'toing': 'food',
      'blinkit': 'grocery', 'zepto': 'grocery', 'instamart': 'grocery', 'bigbasket': 'grocery',
      'bookmyshow': 'movies', 'district': 'movies', 'paytm': 'movies', 'ticketnew': 'movies', 'cinepolis': 'movies',
      'paisabazaar': 'loans', 'bankbazaar': 'loans', 'moneyview': 'loans', 'kreditbee': 'loans', 'navi': 'loans', 'bajajfinserv': 'loans',
      'policybazaar': 'insurance', 'acko': 'insurance', 'digit': 'insurance', 'insurancedekho': 'insurance', 'ditto': 'insurance', 'coverfox': 'insurance', 'hdfcergo': 'insurance',
      'cardinsider': 'creditcards', 'sbi': 'creditcards', 'hdfc': 'creditcards', 'axis': 'creditcards', 'icici': 'creditcards',
    };
    return m[key] ?? '';
  }

  String get verticalLabel => (vertical != null && vertical!.isNotEmpty) ? vertical! : verticalOfMerchant(merchantKey);
  int get percent => int.tryParse(RegExp(r'(\d{1,2})\s*%').firstMatch(discountText ?? '')?.group(1) ?? '') ?? 0;
}

// -- Spend Lens: user-confirmed purchases only (never inferred from clicks) --

class SpendEntryM {
  const SpendEntryM({required this.id, required this.merchant, required this.amount, this.itemTitle, this.entryDate = '', this.source = 'manual'});
  final int id;
  final String merchant;
  final double amount;
  final String? itemTitle;
  final String entryDate;
  final String source;

  factory SpendEntryM.fromJson(Map<String, dynamic> j) => SpendEntryM(
        id: (j['id'] as num?)?.toInt() ?? 0,
        merchant: (j['merchant'] ?? '').toString(),
        amount: (j['amount'] as num?)?.toDouble() ?? 0,
        itemTitle: j['itemTitle']?.toString(),
        entryDate: (j['entryDate'] ?? '').toString().substring(0, (j['entryDate'] ?? '').toString().length < 10 ? (j['entryDate'] ?? '').toString().length : 10),
        source: (j['source'] ?? 'manual').toString(),
      );
}

class SpendSummary {
  const SpendSummary({this.total = 0, this.count = 0, this.byMerchant = const [], this.byMonth = const []});
  final double total;
  final int count;
  final List<Map<String, dynamic>> byMerchant; // {merchant, total, count}
  final List<Map<String, dynamic>> byMonth;     // {month, total}

  factory SpendSummary.fromJson(Map<String, dynamic>? j) => SpendSummary(
        total: ((j?['total'] as num?)?.toDouble() ?? 0),
        count: ((j?['entries'] as num?)?.toInt() ?? 0),
        byMerchant: [for (final m in (j?['byMerchant'] as List? ?? const [])) if (m is Map<String, dynamic>) m],
        byMonth: [for (final m in (j?['byMonth'] as List? ?? const [])) if (m is Map<String, dynamic>) m],
      );
}

class SpendData {
  const SpendData({required this.entries, required this.summary});
  final List<SpendEntryM> entries;
  final SpendSummary summary;

  static Future<SpendData> fromResponseFuture(Future<Map<String, dynamic>> f) async => SpendData.fromResponse(await f);

  static SpendData fromResponse(Map<String, dynamic> res) => SpendData(
        entries: [for (final e in (res['entries'] as List? ?? const [])) if (e is Map<String, dynamic>) SpendEntryM.fromJson(e)],
        summary: SpendSummary.fromJson(res['summary'] as Map<String, dynamic>?),
      );
}

class PriceAlert {
  final int id;
  final String productTitle;
  final String searchQuery;
  final String? sourceUrl;
  final String? image;
  final double targetPrice;
  final double? priceAtSet;
  final bool notified;
  const PriceAlert({
    required this.id,
    required this.productTitle,
    required this.searchQuery,
    this.sourceUrl,
    this.image,
    required this.targetPrice,
    this.priceAtSet,
    this.notified = false,
  });
  factory PriceAlert.fromJson(Map<String, dynamic> j) => PriceAlert(
        id: (j['id'] is num) ? (j['id'] as num).toInt() : 0,
        productTitle: '${j['productTitle'] ?? j['product_title'] ?? ''}',
        searchQuery: '${j['searchQuery'] ?? j['search_query'] ?? ''}',
        sourceUrl: (j['sourceUrl'] ?? j['source_url']) == null ? null : '${j['sourceUrl'] ?? j['source_url']}',
        image: j['image'] == null ? null : '${j['image']}',
        targetPrice: Offer._num(j['targetPrice'] ?? j['target_price']),
        priceAtSet: Offer._num(j['priceAtSet'] ?? j['price_at_set']) > 0 ? Offer._num(j['priceAtSet'] ?? j['price_at_set']) : null,
        notified: j['notified'] == true || j['notified'] == 1 || j['notifiedAt'] != null || j['notified_at'] != null,
      );
}

class AppNotification {
  final String id;
  final String title;
  final String body;
  final String kind;
  final String? createdAt;
  final bool read;
  const AppNotification(this.id, this.title, this.body, this.kind, this.createdAt, this.read);
  factory AppNotification.fromJson(Map<String, dynamic> j) => AppNotification(
        '${j['id'] ?? ''}',
        '${j['title'] ?? ''}',
        '${j['body'] ?? j['message'] ?? ''}',
        '${j['kind'] ?? j['type'] ?? ''}',
        (j['createdAt'] ?? j['created_at'])?.toString(),
        j['read'] == true || j['isRead'] == true,
      );
}

class NotificationFeed {
  final bool signedIn;
  final int unread;
  final List<AppNotification> items;
  const NotificationFeed(this.signedIn, this.unread, this.items);
}

/// POST /api/product-page: same-product offers, related, REAL history, deal score.
class ProductPage {
  final bool found;
  final String title;
  final String? message;
  final List<String> images;
  final List<ProductOffer> offers;
  final List<ProductOffer> related;
  final List<HistoryPoint> history;
  final String verdict; // great | good | fair | wait | unknown
  final int score;
  final String headline;
  // Owner 23 Oct (web parity — reference product-comparison layout): the app
  // now renders the web Deal Scanner: recorded-history stats + score breakup.
  final bool hasHistory;
  final int points;
  final double? allTimeLow;
  final double? allTimeHigh;
  final double? average;
  final List<DealBreakup> breakup;
  const ProductPage({
    required this.found,
    required this.title,
    this.message,
    this.images = const [],
    this.offers = const [],
    this.related = const [],
    this.history = const [],
    this.verdict = 'unknown',
    this.score = 0,
    this.headline = '',
    this.hasHistory = false,
    this.points = 0,
    this.allTimeLow,
    this.allTimeHigh,
    this.average,
    this.breakup = const [],
  });
}

/// One line of the Deal Score Breakup (web parity: label + pts/max).
class DealBreakup {
  final String label;
  final int pts;
  final int max;
  const DealBreakup(this.label, this.pts, this.max);
}

class ProductOffer {
  final String title;
  final String seller;
  final double price;
  final double listPrice;
  final String? image;
  final double? rating;
  final String goUrl;
  final int reviews;
  final String availability; // '' | 'out_of_stock' | ...
  final int variantCount;
  const ProductOffer(this.title, this.seller, this.price, this.listPrice, this.image, this.rating, this.goUrl,
      {this.reviews = 0, this.availability = '', this.variantCount = 0});
  factory ProductOffer.fromJson(Map<String, dynamic> j) => ProductOffer(
        '${j['title'] ?? ''}',
        '${j['seller'] ?? ''}',
        Offer._num(j['price']),
        Offer._num(j['listPrice']),
        j['image'] is String ? j['image'] as String : null,
        (j['rating'] is num) ? (j['rating'] as num).toDouble() : null,
        '${j['goUrl'] ?? ''}',
        reviews: (j['reviews'] is num) ? (j['reviews'] as num).toInt() : 0,
        availability: '${j['availability'] ?? ''}',
        variantCount: (j['variantCount'] is num) ? (j['variantCount'] as num).toInt() : 0,
      );
}


/// Admin-managed home banner (owner 23 Oct): wide landscape strip between
/// home sections. link is a vertical id ('movies') or an https URL.
class HomeBanner {
  const HomeBanner({required this.id, required this.imageUrl, required this.link, this.title, this.subtitle, this.gradient});
  final int id;
  final String imageUrl;
  final String link;
  final String? title;
  final String? subtitle;

  /// Owner 24 Oct colourful banners: [startHex, endHex] served by the API;
  /// null falls back to the per-vertical brand pair in the widget.
  final List<String>? gradient;
}

/// Hero carousel slide (owner 23 Oct, BookMyShow reference): mixed content —
/// movie / food / ecom-deal slides composed live by /api/home/hero-banners.
class HeroSlide {
  const HeroSlide({
    required this.id,
    required this.kind,
    required this.badge,
    required this.heading,
    required this.cta,
    this.subheading,
    this.meta,
    this.language,
    this.synopsis,
    this.poster,
    this.backdrop,
    this.url,
    this.launchVertical,
    this.launchQuery,
    this.gradient,
  });
  final String id;
  final String kind; // movie | food | ecommerce | custom
  final String badge;
  final String heading;
  final String cta;
  final String? subheading;
  final String? meta;
  final String? language;
  final String? synopsis;
  final String? poster;
  final String? backdrop;
  final String? url;
  final String? launchVertical;
  final String? launchQuery;

  /// Owner 24 Oct colourful banners: [startHex, endHex] from the API.
  final List<String>? gradient;
}

/// HTTP-level failure with its status code, so callers can tell a permanent
/// edge block (403 bot-challenge, 410) from a transient hop and react with a
/// backoff instead of hammering a WAF that is already rate-limiting them.
class ApiHttpException implements Exception {
  final int statusCode;
  ApiHttpException(this.statusCode);
  bool get isPermanentBlock => statusCode == 403 || statusCode == 410 || statusCode == 451;
  @override
  String toString() => 'HTTP $statusCode';
}

class Try1SecondApi {
  /// Device network fix (owner 22 Oct): Indian mobile carriers are IPv6-first
  /// (Jio/Airtel). dart:io's default HttpClient has NO connectionTimeout, so a
  /// silently-blackholed IPv6 route stalled every request for the full 60s
  /// per-address before ever trying IPv4 — the browser (Happy Eyeballs) fell
  /// back in ~300ms, which is exactly why the site was fast but the app looped
  /// the 3-2-1 loader with zero results. A tight 6s connect deadline makes the
  /// socket stack fail fast on dead addresses and dial IPv4 within the same
  /// request, and the retry belt gives one more chance on flaky mobile links.
  /// Honest app UA (owner 25 Oct): history — dart:io's default
  /// "Dart/x.y (dart:io)" UA got WAF-403ed on 23 Oct, so we impersonated
  /// Chrome; on 25 Oct the edge started scoring UA/TLS MISMATCH (claimed
  /// Chrome but dart:io TLS) as a bot signal — phone IPs got challenge
  /// 403s escalating to connection resets (errno 104). Verified live 25
  /// Oct: the edge now accepts an honest, self-identifying app UA (real
  /// apps identify themselves; they don't pretend to be browsers), so the
  /// app drops the impersonation entirely. Cleanest long-term posture:
  /// identified client, no fingerprint conflict, no mismatch trigger.
  static const String kAppUserAgent =
      'Try1Second/1.8.22 (Android; app; +https://try1second.com)';

  static http.Client _hardenedClient() {
    final inner = io.HttpClient()
      ..connectionTimeout = const Duration(seconds: 6)
      ..idleTimeout = const Duration(seconds: 20)
      ..maxConnectionsPerHost = 8
      ..userAgent = kAppUserAgent;
    return IOClient(inner);
  }

  Try1SecondApi({String? baseUrl})
      : baseUrl = (baseUrl == null || baseUrl.trim().isEmpty)
            ? kDefaultApiBase
            : baseUrl.trim().replaceAll(RegExp(r'/+$'), ''),
        _client = _hardenedClient();

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

  /// Real coupon codes returned by partner networks (GET /api/v1/offers). Never invented.
  Future<List<Map<String, dynamic>>> liveCoupons({int limit = 8}) async {
    final res = await _get('/api/v1/offers?limit=60');
    final list = (res['offers'] as List? ?? const [])
        .whereType<Map>()
        .map((m) => Map<String, dynamic>.from(m))
        .where((o) => '${o['coupon_code'] ?? ''}'.trim().isNotEmpty)
        .toList();
    return list.take(limit).toList();
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

  /// Smart Cart (owner rule): server totals the basket at every grocery store
  /// and ranks by FULL-basket cost; exits route through /api/out pointers.
  Future<Map<String, dynamic>> smartCartCompare(
    List<({String name, int qty})> items, {
    String? pincode,
    String? city,
  }) async {
    final res = await _post('/api/smart-cart/compare', {
      'items': items.map((x) => {'name': x.name, 'qty': x.qty}).toList(),
      if (pincode != null && pincode.isNotEmpty) 'pincode': pincode,
      if (city != null && city.isNotEmpty) 'city': city,
    });
    if (res['success'] != true) throw Exception('Comparison failed');
    return res['comparison'] as Map<String, dynamic>;
  }

  Future<List<QuickApp>> quickApps() async {
    final res = await _get('/api/quick-apps');
    return QuickApp.parseRows(res, baseUrl: baseUrl);
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

  /// Home AI assistant, full answer: routes the question AND returns the real priced
  /// rows for that vertical (all 12 verticals, every product).
  Future<AssistAnswer> assistAnswer(String text, {String? city, String? pincode, String? date}) async =>
      AssistAnswer.fromJson(await _post('/api/assist/answer', {
        'text': text.trim(),
        if (city != null && city.isNotEmpty) 'city': city,
        if (pincode != null && pincode.isNotEmpty) 'pincode': pincode,
        if (date != null && date.isNotEmpty) 'travelDates': {'depart': date},
      }));

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


  // -- website-parity data (same endpoints the site calls) -------------------

  /// POST /api/scrape/live: the exact call the website makes for every vertical search.
  Future<LiveResponse> live(
    String vertical,
    String query, {
    String city = 'Indore',
    String pincode = '452001',
    double? lat,
    double? lng,
    String? depart,
    String? returnDate,
    String? from,
    String? to,
  }) async {
    final dateSensitive = const ['hotels', 'flights', 'bus', 'cab', 'movies', 'movie'].contains(vertical);
    final res = await _post('/api/scrape/live', {
      'vertical': vertical == 'movie' ? 'movies' : vertical,
      'query': query.trim(),
      'pincode': pincode,
      'city': city,
      // Exact map pin (MapPinPicker): the engine gets the precise point, not just the city.
      if (lat != null && lng != null) 'coordinates': {'lat': lat, 'lng': lng},
      if (dateSensitive && depart != null) 'travelDates': {'depart': depart, if (returnDate != null) 'return': returnDate},
      // Explicit PUDO labels (owner 25 Oct): the cab worker geocodes the exact
      // picker labels city-biased instead of regex-extracting the raw query
      // ("Rajwada" alone geocoded to Nashik, 467 km from Indore).
      if (from != null && from.trim().isNotEmpty) 'from': from.trim(),
      if (to != null && to.trim().isNotEmpty) 'to': to.trim(),
    });
    return LiveResponse.fromJson(res);
  }

  /// POST /api/leads — server-side persistence for finance enquiries
  /// (Loans / Insurance / Credit Cards / Accounts). Returns the MySQL row id.
  Future<int> submitLead({
    required String vertical,
    String? serviceType,
    required String firstName,
    required String lastName,
    required int age,
    double? salary,
    String? location,
    String? phone,
    String? email,
    String? destUrl,
  }) async {
    final res = await _post('/api/leads', {
      'source': 'lead_form',
      'vertical': vertical,
      if (serviceType != null && serviceType.isNotEmpty) 'serviceType': serviceType,
      'firstName': firstName,
      'lastName': lastName,
      'age': age,
      if (salary != null) 'salary': salary,
      if (location != null && location.isNotEmpty) 'location': location,
      if (phone != null && phone.isNotEmpty) 'phone': phone,
      if (email != null && email.isNotEmpty) 'email': email,
      if (destUrl != null && destUrl.startsWith('https://')) 'destUrl': destUrl,
    });
    return (res['id'] is num) ? (res['id'] as num).toInt() : 0;
  }

  Future<DealsFeed> deals({String? kind, String? merchant, String? vertical, bool hasImage = false, int limit = 200}) async {
    final q = <String>[
      'limit=$limit',
      if (kind != null) 'kind=${Uri.encodeQueryComponent(kind)}',
      if (merchant != null) 'merchant=${Uri.encodeQueryComponent(merchant)}',
      if (vertical != null) 'vertical=${Uri.encodeQueryComponent(vertical)}',
      if (hasImage) 'hasImage=1',
    ];
    final res = await _get('/api/deals?${q.join('&')}');
    final counts = <String, int>{};
    (res['counts'] as Map? ?? const {}).forEach((k, v) { if (k is String && v is num) counts[k] = v.toInt(); });
    return DealsFeed(
      deals: [for (final d in (res['deals'] as List? ?? const [])) if (d is Map<String, dynamic>) Deal.fromJson(d)],
      counts: counts,
    );
  }

  Future<SellerDeals> dealsForSeller(String seller, {int limit = 6}) async {
    final res = await _get('/api/deals/for-seller?seller=${Uri.encodeQueryComponent(seller)}&limit=$limit');
    final deals = [for (final d in (res['deals'] as List? ?? const [])) if (d is Map<String, dynamic>) Deal.fromJson(d)];
    final best = res['best'] as Map?;
    final offer = (best?['offer'] is Map<String, dynamic>) ? Deal.fromJson(best!['offer'] as Map<String, dynamic>) : null;
    final coupon = (best?['coupon'] is Map<String, dynamic>) ? Deal.fromJson(best!['coupon'] as Map<String, dynamic>) : null;
    return SellerDeals(deals: deals, bestOffer: offer, bestCoupon: coupon);
  }

  /// POST /api/product-page: link or typed product -> same-product offers + history + deal score.
  /// [seed] mirrors the website's Compare button: the originating card's own
  /// sellerQuotes ride along so 100% of the sellers already found for this
  /// product stay on the detail page even if the fresh search flakes (circuit
  /// backoff). [gallery] carries the card's image urls (parity with web).
  Future<ProductPage> productPage(
    String input, {
    String? city,
    String? pincode,
    List<Map<String, Object?>> seed = const [],
    List<String> gallery = const [],
  }) async {
    final isUrl = RegExp(r'https?://', caseSensitive: false).hasMatch(input);
    final res = await _post('/api/product-page', {
      if (isUrl) 'input': input.trim() else 'query': input.trim(),
      if (city != null) 'city': city,
      if (pincode != null) 'pincode': pincode,
      if (seed.isNotEmpty) 'seed': seed,
      if (gallery.isNotEmpty) 'gallery': gallery,
    });
    final product = (res['product'] is Map) ? res['product'] as Map : const {};
    if (res['found'] != true) {
      return ProductPage(found: false, title: '${product['title'] ?? input}', message: res['message']?.toString());
    }
    final deal = (res['deal'] is Map) ? res['deal'] as Map : const {};
    return ProductPage(
      found: true,
      title: '${product['title'] ?? input}',
      message: res['message']?.toString(),
      images: [for (final i in (res['images'] as List? ?? const [])) '$i'],
      offers: [for (final o in (res['offers'] as List? ?? const [])) if (o is Map<String, dynamic>) ProductOffer.fromJson(o)],
      related: [for (final o in (res['related'] as List? ?? const [])) if (o is Map<String, dynamic>) ProductOffer.fromJson(o)],
      history: [
        for (final p in (res['history'] as List? ?? const []))
          if (p is Map<String, dynamic>) HistoryPoint.fromJson({'price': p['price'], 'capturedAt': p['capturedAt'], 'captured_at': p['capturedAt']}),
      ].where((p) => p.price > 0).toList(),
      verdict: '${deal['verdict'] ?? 'unknown'}',
      score: (deal['score'] is num) ? (deal['score'] as num).round() : 0,
      headline: '${deal['headline'] ?? deal['label'] ?? ''}',
      hasHistory: deal['hasHistory'] == true,
      points: (deal['points'] is num) ? (deal['points'] as num).toInt() : 0,
      allTimeLow: (deal['allTimeLow'] is num) ? (deal['allTimeLow'] as num).toDouble() : null,
      allTimeHigh: (deal['allTimeHigh'] is num) ? (deal['allTimeHigh'] as num).toDouble() : null,
      average: (deal['average'] is num) ? (deal['average'] as num).toDouble() : null,
      breakup: [
        for (final b in (deal['breakup'] as List? ?? const []))
          if (b is Map<String, dynamic>)
            DealBreakup('${b['label'] ?? ''}', (b['pts'] is num) ? (b['pts'] as num).toInt() : 0,
                (b['max'] is num) ? (b['max'] as num).toInt() : 0),
      ],
    );
  }

  Future<List<PriceAlert>> alerts(String token) async {
    final res = await _get('/api/alerts', token: token);
    return [for (final a in (res['alerts'] as List? ?? const [])) if (a is Map<String, dynamic>) PriceAlert.fromJson(a)];
  }

  Future<void> createAlert(
    String token, {
    required String productTitle,
    required String searchQuery,
    required double targetPrice,
    double? priceAtSet,
    String? sourceUrl,
    String? image,
  }) async {
    await _post('/api/alerts', {
      'productTitle': productTitle,
      'searchQuery': searchQuery,
      'targetPrice': targetPrice,
      if (priceAtSet != null) 'priceAtSet': priceAtSet,
      if (sourceUrl != null) 'sourceUrl': sourceUrl,
      if (image != null) 'image': image,
    }, token: token);
  }

  Future<void> deleteAlert(String token, int id) async {
    final res = await _client.delete(Uri.parse('$baseUrl/api/alerts/$id'), headers: _headers(token));
    if (res.statusCode < 200 || res.statusCode >= 300) throw Exception('Could not delete alert');
  }

  Future<SpendData> spend(String token) async => SpendData.fromResponse(await _get('/api/spend', token: token));

  Future<SpendData> addSpend(String token, {required String merchant, required double amount, String? itemTitle, required String entryDate, String source = 'manual'}) =>
      SpendData.fromResponseFuture(_post('/api/spend', {
        'merchant': merchant,
        'amount': amount,
        if (itemTitle != null && itemTitle.isNotEmpty) 'itemTitle': itemTitle,
        'entryDate': entryDate,
        'source': source,
      }, token: token));

  Future<SpendData> deleteSpend(String token, int id) async {
    final res = await _client.delete(Uri.parse('$baseUrl/api/spend/$id'), headers: _headers(token));
    return SpendData.fromResponse(_decode(res));
  }

  Future<NotificationFeed> notifications({String? token}) async {
    final res = await _get('/api/notifications', token: token);
    return NotificationFeed(
      res['signedIn'] == true,
      (res['unread'] is num) ? (res['unread'] as num).toInt() : 0,
      [for (final n in (res['items'] as List? ?? const [])) if (n is Map<String, dynamic>) AppNotification.fromJson(n)],
    );
  }

  Future<void> markNotificationsRead(String token, {List<String>? ids}) async {
    await _post('/api/notifications/read', {if (ids != null) 'ids': ids}, token: token);
  }

  Future<String?> referralLink(String token) async {
    final res = await _post('/api/rewards/referral', {}, token: token);
    final v = res['link'] ?? res['url'] ?? res['referralLink'] ?? res['code'];
    return v?.toString();
  }

  /// GET /api/geo/search — Nominatim proxy (India-bounded) for the map pin picker.
  Future<List<Map<String, dynamic>>> geoSearch(String q) async {
    final res = await _get('/api/geo/search?q=${Uri.encodeQueryComponent(q)}');
    return [for (final r in (res['results'] as List? ?? const [])) if (r is Map<String, dynamic>) r];
  }

  /// GET /api/geo/suggest — colony/street-level address typeahead (Photon/OSM,
  /// owner 24 Oct). Rows carry name + granular structured address (street, colony,
  /// city, pincode) + exact coords, optional distance when user coords are given.
  Future<List<Map<String, dynamic>>> geoSuggest(String q, {double? lat, double? lng}) async {
    var path = '/api/geo/suggest?q=\${Uri.encodeQueryComponent(q)}';
    if (lat != null && lng != null) {
      path += '&lat=\${lat.toStringAsFixed(5)}&lng=\${lng.toStringAsFixed(5)}';
    }
    final res = await _get(path);
    return [for (final r in (res['results'] as List? ?? const [])) if (r is Map<String, dynamic>) r];
  }

  /// GET /api/hotels/locations — LIVE hotel-name + destination typeahead
  /// (TravelGuru autosuggest proxy, same registry Yatra's hotel site uses).
  /// Returns [{name, type: HOTEL|CITY, cityName, stateName, propertyType, sourceId}].
  Future<List<Map<String, dynamic>>> hotelLocations(String q) async {
    final res = await _get('/api/hotels/locations?q=${Uri.encodeQueryComponent(q)}');
    return [for (final r in (res['locations'] as List? ?? const [])) if (r is Map<String, dynamic>) r];
  }

  /// GET /api/geo/reverse — name a dropped pin; null when the map has no name (never invented).
  Future<Map<String, dynamic>?> geoReverse(double lat, double lng) async {
    final res = await _get('/api/geo/reverse?lat=${lat.toStringAsFixed(6)}&lng=${lng.toStringAsFixed(6)}');
    final place = res['place'];
    return place is Map<String, dynamic> ? place : null;
  }

  /// Public GET for ad-hoc read endpoints (status, provenance, picks, ...).
  Future<Map<String, dynamic>> getJson(String path, {String? token}) => _get(path, token: token);

  Uri searchUrl(String query) => Uri.parse(
        '$baseUrl/?q=${Uri.encodeQueryComponent(query)}',
      );

  // -- internals -----------------------------------------------------------

  static const _jsonHeaders = {'Content-Type': 'application/json'};

  final http.Client _client;

  Map<String, String> _headers(String? token) =>
      token == null ? _jsonHeaders : {..._jsonHeaders, 'Authorization': 'Bearer $token'};

  /// Speed fix (21 Oct): no request may hang forever — a stuck socket used to
  /// leave a vertical's spinner up indefinitely. 30s covers every endpoint
  /// (live search is progressive and returns within ~1s, worst cases included).
  static const _httpTimeout = Duration(seconds: 30);

  /// One POST/GET attempt, with a single same-request retry belt for the
  /// transient socket failures typical on mobile networks (device fix 22 Oct):
  /// a dropped carrier link, a dead pooled connection or a connect that died
  /// between addresses. Real API errors (HTTP status, error payloads) are NOT
  /// retried — the retry is purely for transport blips.
  Future<Map<String, dynamic>> _send(Future<http.Response> Function() fn, {String? token}) async {
    http.Response res;
    try {
      res = await fn().timeout(_httpTimeout);
    } on TimeoutException {
      res = await fn().timeout(_httpTimeout);
    } on http.ClientException {
      await Future<void>.delayed(const Duration(milliseconds: 600));
      res = await fn().timeout(_httpTimeout);
    } on io.SocketException {
      await Future<void>.delayed(const Duration(milliseconds: 600));
      res = await fn().timeout(_httpTimeout);
    }
    // Owner 23 Oct: hPanel's edge occasionally answers a transient 400 with an
    // HTML error page (reproduced on /api/scrape/live hotels+loans). One quiet
    // retry clears it; a second failure is reported honestly.
    try {
      return _decode(res);
    } on ApiHttpException {
      rethrow; // 403/410 edge block: retrying is pointless and feeds the WAF
    } on Exception {
      await Future<void>.delayed(const Duration(milliseconds: 400));
      try {
        res = await fn().timeout(_httpTimeout);
      } catch (_) { /* fall through: report the original failure */ }
      return _decode(res);
    }
  }


  /// Home banners (owner 23 Oct): admin-managed wide landscape strips between
  /// every home section on the home tab.
  Future<List<HeroSlide>> heroBanners() async {
    final data = await _get('/api/home/hero-banners');
    final rows = data['slides'];
    if (rows is! List) return const [];
    return [
      for (final r in rows)
        HeroSlide(
          id: (r['id'] as String?) ?? '',
          kind: (r['kind'] as String?) ?? 'custom',
          badge: (r['badge'] as String?) ?? 'FEATURED',
          subheading: r['subheading'] as String?,
          heading: (r['heading'] as String?) ?? '',
          meta: r['meta'] as String?,
          language: r['language'] as String?,
          synopsis: r['synopsis'] as String?,
          poster: r['poster'] as String?,
          backdrop: r['backdrop'] as String?,
          cta: (r['cta'] as String?) ?? 'Explore',
          url: r['url'] as String?,
          launchVertical: (r['launch'] as Map<String, dynamic>?)?['vertical'] as String?,
          launchQuery: (r['launch'] as Map<String, dynamic>?)?['query'] as String?,
          gradient: (r['gradient'] as List?)?.whereType<String>().toList(),
        ),
    ];
  }

  /// Owner 24 Oct: section-targeted banners ('home' keeps the mixed strip,
  /// 'rewards'/'quickapps' serve that section's admin-authored set).
  /// OWNER 29 OCT: the server owns the banner cadence (Admin -> Home Banners),
  /// so the app repeats a strip after the same number of results as the web.
  /// 12 is the honest default until /api/home-banners answers.
  final Map<String, int> _bannerCadence = {};
  int bannerCadence(String section) => _bannerCadence[section] ?? 12;

  Future<List<HomeBanner>> homeBanners({String section = 'home'}) async {
    final data = await _get(section == 'home'
        ? '/api/home-banners'
        : '/api/home-banners?section=${Uri.encodeQueryComponent(section)}');
    final slot = data['slot'];
    if (slot is Map && slot['everyN'] is num) {
      final n = (slot['everyN'] as num).toInt();
      _bannerCadence[section] = (slot['enabled'] == false) ? 0 : n;
    }
    final rows = data['banners'];
    if (rows is! List) return const [];
    return [
      for (final r in rows)
        HomeBanner(
          id: (r['id'] as num?)?.toInt() ?? 0,
          imageUrl: (r['imageUrl'] as String?) ?? '',
          link: (r['link'] as String?) ?? 'movies',
          title: r['title'] as String?,
          subtitle: r['subtitle'] as String?,
          gradient: (r['gradient'] as List?)?.whereType<String>().toList(),
        ),
    ];
  }

  /// Referral code of the signed-in user — mints a T1S-XXXXXX idempotently.
  Future<Map<String, dynamic>?> referralMe(String token) async {
    try {
      return await _get('/api/rewards/referral/me', token: token);
    } on Exception {
      return null; // honest: signed-out or offline leaves the tab in guest mode
    }
  }

  /// Apply a friend's referral code (once per account; +1 point to the friend).
  /// Returns null on success, an error message otherwise.
  Future<String?> referralApply(String token, String code) async {
    try {
      await _post('/api/rewards/referral/apply', {'code': code}, token: token);
      return null;
    } on Exception catch (e) {
      return e.toString().replaceFirst('Exception: ', '');
    }
  }

  Future<Map<String, dynamic>> _post(String path, Map<String, dynamic> body, {String? token}) async {
    final uri = Uri.parse('$baseUrl$path');
    final h = _headers(token);
    final b = jsonEncode(body);
    return _send(() => _client.post(uri, headers: h, body: b), token: token);
  }

  Future<Map<String, dynamic>> _get(String path, {String? token}) async {
    final uri = Uri.parse('$baseUrl$path');
    final h = _headers(token);
    return _send(() => _client.get(uri, headers: h), token: token);
  }

  Map<String, dynamic> _decode(http.Response res) {
    if (res.statusCode < 200 || res.statusCode >= 300) {
      // Typed: a 403/410 from the CDN bot-challenge is PERMANENT for a
      // non-browser client — retrying it just extends any IP-based ban.
      throw ApiHttpException(res.statusCode);
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
