import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/foundation.dart';
import 'package:url_launcher/url_launcher.dart';

import 'app_state.dart';

/// OWNER 29 Oct ("clicking any universal link or custom scheme must open the app
/// directly in-app instead of redirecting to the external web browser"): ONE entry
/// point for every link that reaches the app, from either transport:
///   • Android App Links / iOS Universal Links — https://www.try1second.com/...
///   • the custom scheme — try1second://flights?query=Delhi%20to%20Mumbai
///
/// The routing table is a 1:1 mirror of the website's own reader in
/// src/context/AppContext.tsx (handleUrlRoute) and src/utils/verticalRoutes.ts, so a
/// link shared from the site or indexed by Google opens the same screen in the app:
///   `/`                              -> Home tab
///   `/<vertical>`                    -> that vertical's compare tab
///   `/<vertical>/<slug>`             -> vertical + pre-filled query (city / route / type)
///   `/product/<slug>`                -> Product page for that product name
///
/// Anything that is NOT an app screen (the /api/out affiliate hop, /redirect
/// interstitial, /api/*, /admininsta, /merchantinstab2b, /sitemap.xml, ...) is handed
/// to the system browser unchanged — those URLs are server pages that must keep doing
/// their own job (tracking, interstitial, AdSense, admin login). Opening them in-app
/// would break affiliate attribution, so they are deliberately NOT swallowed.
class DeepLinks {
  DeepLinks._();

  static const String scheme = 'try1second';
  static const List<String> hosts = <String>['www.try1second.com', 'try1second.com'];

  /// Website path -> app vertical id (identical to the site's vmap).
  static const Map<String, String> _verticalByPath = <String, String>{
    'flights': 'flights',
    'hotels': 'hotels',
    'bus': 'bus',
    'ecommerce': 'ecommerce',
    'grocery': 'grocery',
    'food': 'food',
    'movies': 'movie',
    'cabs': 'cab',
    'loans': 'loans',
    'insurance': 'insurance',
    'credit-cards': 'creditcards',
    'bank-accounts': 'account',
    'banking': 'banking',
  };

  /// City / place style slugs: the tail is the starting query as-is.
  static const Set<String> _citySlugVerticals = <String>{'hotels', 'cabs', 'grocery', 'food', 'movies'};

  static final AppLinks _links = AppLinks();
  static StreamSubscription<Uri>? _sub;
  static bool _started = false;

  /// Android delivers the SAME intent twice in some launches (onCreate plus the first
  /// uriLinkStream event), and a double-handled product deep link pushed the Product
  /// page twice. Identical URI within a couple of seconds is treated as one.
  static String? _lastUri;
  static DateTime? _lastAt;

  /// Called once from main(): handles both the cold-start link (the app was closed and
  /// the user tapped a link) and every link that arrives while the app is running.
  static Future<void> init() async {
    if (_started) return;
    _started = true;
    try {
      final Uri? initial = await _links.getInitialLink();
      if (initial != null) await handle(initial);
    } catch (e) {
      debugPrint('DeepLinks: initial link unavailable ($e)');
    }
    try {
      _sub = _links.uriLinkStream.listen(
        (Uri uri) => unawaited(handle(uri)),
        onError: (Object e) => debugPrint('DeepLinks: stream error ($e)'),
      );
    } catch (e) {
      debugPrint('DeepLinks: stream unavailable ($e)');
    }
  }

  static Future<void> dispose() async {
    await _sub?.cancel();
    _sub = null;
    _started = false;
  }

  /// Parse one incoming link and put the user on the matching screen.
  static Future<void> handle(Uri uri) async {
    if (!_isAppUri(uri)) return;
    final now = DateTime.now();
    final key = uri.toString();
    if (_lastUri == key && _lastAt != null && now.difference(_lastAt!).inSeconds <= 2) return;
    _lastUri = key;
    _lastAt = now;

    final app = AppState.instance;

    // Cold start: the link arrives while the splash is still painting and the
    // navigator has not been mounted yet, so pushNamed('product') would go nowhere.
    // Wait for the navigator (max 6s) instead of dropping the link.
    for (var i = 0; i < 60 && app.navigator.currentState == null; i++) {
      await Future<void>.delayed(const Duration(milliseconds: 100));
    }

    // A link must always land on top of the app's own root, never on top of a Product
    // page the user had open: pop back to the shell first, then switch tabs.
    app.navigator.currentState?.popUntil((r) => r.isFirst);

    // Custom scheme: try1second://flights?... — the vertical arrives as the HOST.
    final segments = <String>[];
    if (uri.scheme == scheme) {
      if (uri.host.isNotEmpty) segments.add(uri.host);
      segments.addAll(uri.pathSegments.where((s) => s.isNotEmpty));
    } else {
      segments.addAll(uri.pathSegments.where((s) => s.isNotEmpty));
    }

    // #product=<name> / #vertical=<id> (the site's hash deep links).
    final fragment = uri.fragment;
    if (fragment.startsWith('product=')) {
      final title = Uri.decodeComponent(fragment.substring('product='.length)).trim();
      if (title.isNotEmpty) {
        app.openProduct(PendingSearch('ecommerce', title, productPage: true));
        return;
      }
    }
    if (fragment.startsWith('vertical=')) {
      final v = _verticalByPath[fragment.substring('vertical='.length).trim()] ??
          (fragment.substring('vertical='.length).trim());
      if (_isAppVertical(v)) {
        app.openVertical(v, search: _searchFor(v, '', uri));
        return;
      }
    }

    if (segments.isEmpty) {
      app.go(NavTab.home);
      return;
    }

    // /product/<slug> — same de-slugging the website does.
    if (segments.first == 'product' && segments.length >= 2) {
      final title = titleFromSlug(segments[1]);
      if (title.isNotEmpty) {
        app.openProduct(PendingSearch('ecommerce', title, productPage: true));
        return;
      }
    }

    final vertical = _verticalByPath[segments.first];
    if (vertical == null || !_isAppVertical(vertical)) {
      await _openInSystemBrowser(uri);
      return;
    }

    final slug = segments.length >= 2 ? segments[1] : '';
    final query = slug.isEmpty ? '' : queryFromSlug(segments.first, slug);
    app.openVertical(vertical, search: _searchFor(vertical, query, uri));
  }

  /// True for links this app owns: the custom scheme, or an https link on our hosts.
  static bool _isAppUri(Uri uri) {
    if (uri.scheme == scheme) return true;
    if (uri.scheme != 'https' && uri.scheme != 'http') return false;
    final h = uri.host.toLowerCase();
    return hosts.contains(h) || h.endsWith('.try1second.com');
  }

  static bool _isAppVertical(String v) =>
      v == 'banking' || v == 'account' || v == 'creditcards' || v == 'cab' || v == 'movie' || const <String>{
        'flights', 'hotels', 'bus', 'ecommerce', 'grocery', 'food', 'loans', 'insurance',
      }.contains(v);

  /// Query carried by the link itself. Explicit query parameters win (a shared search
  /// link), otherwise the SEO slug becomes the query exactly like the site does.
  static PendingSearch? _searchFor(String vertical, String slugQuery, Uri uri) {
    final params = uri.queryParameters;
    final q = (params['query'] ?? params['q'] ?? '').trim();
    final date = (params['date'] ?? params['depart'] ?? '').trim();
    final from = (params['from'] ?? '').trim();
    final to = (params['to'] ?? '').trim();
    String query = q.isNotEmpty ? q : slugQuery;
    if (query.isEmpty && from.isNotEmpty && to.isNotEmpty) {
      query = vertical == 'bus' ? '$from to $to' : '$from to $to';
    }
    if (query.isEmpty && date.isEmpty) return null;
    return PendingSearch(vertical, query, date: date.isEmpty ? null : date);
  }

  /// `"<from>-to-<to>-flights|bus"` -> `"From to To"`; city slugs -> `"City Name"`; any
  /// other tail slug -> natural phrase. Mirrors the site's slug reader.
  static String queryFromSlug(String pathVertical, String slug) {
    final route = RegExp(r'^([a-z]+(?:-[a-z]+)*?)-to-([a-z]+(?:-[a-z]+)*?)-(flights|bus)$').firstMatch(slug);
    if (route != null) {
      return '${_pretty(route.group(1)!)} to ${_pretty(route.group(2)!)}';
    }
    if (_citySlugVerticals.contains(pathVertical)) return _pretty(slug);
    return slug.split('-').where((w) => w.isNotEmpty).join(' ');
  }

  static String titleFromSlug(String slug) {
    final words = slug.split('-').where((w) => w.isNotEmpty).toList();
    return titleFromWords(words);
  }

  /// Same capitalisation rule as the site: numbers stay as-is, words get a capital.
  static String titleFromWords(List<String> words) => words
      .map((w) => RegExp(r'^[0-9]').hasMatch(w) ? w : w[0].toUpperCase() + w.substring(1))
      .join(' ');

  static String _pretty(String slug) => titleFromWords(slug.split('-').where((w) => w.isNotEmpty).toList());

  static Future<void> _openInSystemBrowser(Uri uri) async {
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (e) {
      debugPrint('DeepLinks: could not hand $uri to the browser ($e)');
    }
  }

  /// The link Android/iOS delivers when our own web view intercepts a tap on a
  /// try1second.com URL: true when the app should take it over instead of letting a
  /// browser tab open.
  static bool isInternal(Uri uri) => _isAppUri(uri) && _appOwns(uri);

  static bool _appOwns(Uri uri) {
    final segs = <String>[
      if (uri.scheme == scheme && uri.host.isNotEmpty) uri.host,
      ...uri.pathSegments.where((s) => s.isNotEmpty),
    ];
    if (segs.isEmpty) return true;
    if (segs.first == 'product') return segs.length >= 2;
    return _verticalByPath.containsKey(segs.first) && _isAppVertical(_verticalByPath[segs.first]!);
  }
}
