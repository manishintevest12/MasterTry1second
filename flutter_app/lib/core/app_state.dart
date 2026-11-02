import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import 'api.dart';
import 'compare.dart';
import 'auth.dart';
import 'storage.dart';
import 'verticals.dart';

/// The five bottom-bar sections of the website (FixedBottomBar.tsx) + the secondary
/// screens reachable from the header menu.
enum NavTab { home, quickApps, insights, compare, rewards }

/// A search the Compare screen should run when it opens (website `pendingAssistantSearch`).
class PendingSearch {
  final String vertical;
  final String query;
  final String? date;
  /// When true the query is a pasted product link / product name: open the
  /// in-app Product page (website MainNavTab 'product') instead of the feed.
  final bool productPage;
  const PendingSearch(this.vertical, this.query, {this.date, this.productPage = false});
}

/// App-wide state: current tab, selected vertical, location, API, cached live results.
/// Equivalent of the website's AppContext (setVertical / setActiveNavTab / userLocation).
class AppState extends ChangeNotifier {

  /// Public, lint-clean way for screens to ask all listeners to rebuild after
  /// mutating public fields on this notifier from outside its instance methods.
  void refreshUi() => notifyListeners();

  AppState._();
  static final AppState instance = AppState._();

  final AppStore store = AppStore();
  Try1SecondApi api = Try1SecondApi();

  NavTab tab = NavTab.home;
  String vertical = 'flights';
  String city = 'Indore';
  String pincode = '452001';
  /// Exact map-picked pickup point (MapPinPicker); sent with every live search.
  double? pickLat;
  double? pickLng;
  PendingSearch? pending;

  /// Smart Cart (owner rule): grocery basket totals compared across stores.
  /// Basket lives in app state; comparison runs server-side (/api/smart-cart/compare).
  final List<({String name, int qty})> smartCart = [];
  bool smartCartOpen = false;

  void addToSmartCart(String name, {int qty = 1}) {
    final n = name.trim();
    if (n.isEmpty) return;
    final i = smartCart.indexWhere((x) => x.name.toLowerCase() == n.toLowerCase());
    if (i >= 0) {
      smartCart[i] = (name: smartCart[i].name, qty: (smartCart[i].qty + qty).clamp(1, 20));
    } else {
      smartCart.add((name: n, qty: 1));
      if (smartCart.length > 12) smartCart.removeAt(0);
    }
    smartCartOpen = true;
    notifyListeners();
  }

  void updateSmartCartQty(String name, int qty) {
    if (qty <= 0) {
      smartCart.removeWhere((x) => x.name == name);
    } else {
      final i = smartCart.indexWhere((x) => x.name == name);
      if (i >= 0) smartCart[i] = (name: smartCart[i].name, qty: qty.clamp(1, 20));
    }
    notifyListeners();
  }

  void removeFromSmartCart(String name) {
    smartCart.removeWhere((x) => x.name == name);
    notifyListeners();
  }

  void clearSmartCart() {
    smartCart.clear();
    notifyListeners();
  }

  void setSmartCartOpen(bool open) {
    smartCartOpen = open;
    notifyListeners();
  }

  int unread = 0;
  int trackedCount = 0;
  int points = 0;
  int spinsAvailable = 0;

  /// Last live result per vertical, so tabs reopen instantly (website keeps `items`).
  final Map<String, LiveResponse> cache = {};
  final Map<String, String> cacheQuery = {};
  /// Epoch ms when each vertical's cached response was fetched (TTL checks).
  final Map<String, int> cacheAt = {};
  final Map<String, Future<LiveResponse>> _inFlight = {};

  // -- SPEED (21 Oct owner report: app slower than web) --------------------
  // TTLs mirror the server cache (server/routes searchCache): travel prices
  // move hourly and stay 'fresh' 5 min / persist 15; everything else 15/45.
  static const Set<String> _travelLike = {'flights', 'hotels', 'bus', 'cab', 'movies', 'movie'};
  static int freshTtlMs(String v) => _travelLike.contains(v) ? 5 * 60 * 1000 : 15 * 60 * 1000;
  static int staleTtlMs(String v) => _travelLike.contains(v) ? 15 * 60 * 1000 : 45 * 60 * 1000;

  static int get _nowMs => DateTime.now().millisecondsSinceEpoch;
  final Map<String, List<Deal>> _dealsByKind = {};
  List<Deal>? allDeals;

  Future<void> init() async {
    api = await store.api();
    final c = await store.city();
    final p = await store.pincode();
    if (c.isNotEmpty) city = c;
    if (p.isNotEmpty) pincode = p;
    AuthService.instance.addListener(_onAuth);
    await AuthService.instance.restore(api);
    unawaited(refreshBadges());
    // SPEED: paint every vertical instantly from the on-disk live cache
    // (previous session's real results) BEFORE any network warms up.
    await _loadDiskCache();
    // Warm-up runs in the background; the splash only watches it for its label.
    unawaited(prefetchDefaults());
    notifyListeners();
  }

  void _onAuth() {
    unawaited(refreshBadges());
    notifyListeners();
  }

  void go(NavTab t) {
    if (tab == t) return;
    tab = t;
    notifyListeners();
  }

  /// Website `setRewardsSubTab + setActiveNavTab('rewards')` mirror.
  /// pendingRewardsTab: 0 = Deals & Coupons, 1 = Spin & Earn, 2 = Refer & Earn.
  int pendingRewardsTab = 0;

  void goRewards({int tab = 0}) {
    pendingRewardsTab = tab;
    go(NavTab.rewards);
  }

  /// Website `setVertical(v) + setActiveNavTab('compare')`.
  void openVertical(String v, {PendingSearch? search}) {
    vertical = v == 'movies' ? 'movie' : v;
    pending = search;
    tab = NavTab.compare;
    notifyListeners();
  }

  /// Deep-link helpers used by hero buttons and the assistant.
  final GlobalKey<NavigatorState> navigator = GlobalKey<NavigatorState>();

  void openProduct(PendingSearch s) {
    navigator.currentState?.pushNamed('product', arguments: s);
  }

  void selectVertical(String v) {
    vertical = v == 'movies' ? 'movie' : v;
    notifyListeners();
  }

  PendingSearch? takePending() {
    final p = pending;
    pending = null;
    return p;
  }

  /// Owner 24 Oct ("vertical change karke wapas aata hoon to flights phir se
  /// Indore-Delhi support karne lagta hai"): the last query the user actually
  /// searched in each vertical. Sticky across vertical switches AND app
  /// restarts (persisted with the live disk cache) — a vertical reopens on
  /// the user's own last search instead of the registry seed default.
  final Map<String, String> lastQuery = {};

  /// OWNER 28 Oct ("ek baar results aa jaye to dusre tab me jaa kr wapas aao to
  /// phir se automatic search ni chahiye; search sirf tab jab user khud search
  /// button dabaye"): a vertical's FIRST open runs the automatic search once per
  /// app session. After that its results are FIXED - remounting the compare tab
  /// re-paints exactly what was found and never re-runs the search in the
  /// background. Only an explicit change of location (new city/pincode) or the
  /// user's own Search button starts a new one.
  final Set<String> searched = {};

  String lastQueryFor(String vertical) {
    final key = vertical == 'movies' ? 'movie' : vertical;
    return lastQuery[key] ?? '';
  }

  Future<void> setLocation(String newCity, String newPin, {double? lat, double? lng}) async {
    city = newCity.trim().isEmpty ? city : newCity.trim();
    pincode = newPin.trim().isEmpty ? pincode : newPin.trim();
    if (lat != null && lng != null) {
      pickLat = lat;
      pickLng = lng;
    }
    await store.saveSettings(city: city, pincode: pincode);
    cache.clear();
    cacheQuery.clear();
    cacheAt.clear();
    // A new city/pincode is a new intent, not a tab return: every vertical runs
    // its automatic search again for the new location.
    searched.clear();
    // Old-location prices are invalid for the new pincode.
    unawaited(store.liveDiskCacheClear());
    notifyListeners();
  }

  /// Runs (or reuses) the live search for a vertical, exactly like the website's triggerLiveLocationScrape.
  Future<LiveResponse> live(String v, String query, {String? depart, String? returnDate, bool force = false, String? from, String? to}) async {
    final key = v == 'movies' ? 'movie' : v;
    final q = query.trim().isEmpty ? defaultQueryFor(key, city) : query.trim();
    lastQuery[key] = q; // sticky: this vertical reopens on its own last search
    final cacheKey = '$key|$q|${depart ?? ''}';
    if (!force && cache[key] != null && cacheQuery[key] == cacheKey) {
      final hit = cache[key]!;
      final age = _nowMs - (cacheAt[key] ?? 0);
      // Progressive partial rows (no seller quotes yet) are never a fresh
      // hit — paint them, but revalidate in the background like any stale
      // response so real quotes with working buttons land on their own.
      // Thin-response poison guard (owner 25 Oct "app pr ek hi result"): a
      // "completed" snapshot with <=2 rows (403-era tarpit: 1 JioMart row, 11
      // sources "verified") must never count as a FRESH hit — paint it
      // instantly but revalidate quietly in the background like a stale one,
      // so the healthy multi-row scan replaces it on its own.
      if (age <= freshTtlMs(key) && !hit.pendingRefresh && hit.items.length >= 3) return hit;
      // Stale-but-valid: paint INSTANTLY from cache and refresh quietly in the
      // background (web parity: never make the user watch a spinner for a
      // result we already have on screen).
      if (_inFlight[cacheKey] == null) {
        unawaited(_fetchAndStore(key, cacheKey, q, depart: depart, returnDate: returnDate, from: from, to: to));
      }
      return hit;
    }
    final flying = _inFlight[cacheKey];
    if (flying != null) return flying;
    // Account vertical (owner 23 Oct 'abhi v ni khul raha hai'): WEB PARITY —
    // the web account page runs triggerLiveLocationScrape() on the live search
    // pipeline, NOT the deals registry. The old app-only /api/deals?kind=account
    // path returned an empty registry on production, so the tab opened to a
    // permanent empty screen. Primary = live scrape (server normalizes
    // 'account' -> 'banking' catalogue, 40+ real bank rows); the admin deals
    // registry stays as an enrichment fallback when the scrape honestly
    // returns zero rows.
    if (key == 'account') {
      final f = () async {
        try {
          // 1) WEB PARITY: live scrape pipeline first (banking catalogue).
          var res = await api
              .live(key, q, city: city, pincode: pincode, lat: pickLat, lng: pickLng, depart: depart, returnDate: returnDate, from: from, to: to);
          // 2) Enrichment fallback: admin deals registry only when the scrape
          //    honestly returned zero rows (never mixed into a live result).
          if (res.items.isEmpty) {
            final deals = await _accountFeed();
            if (deals.items.isNotEmpty) res = deals;
          }
          cache[key] = res;
          cacheQuery[key] = cacheKey;
          cacheAt[key] = _nowMs;
          if (!res.pendingRefresh) _scheduleDiskSave();
          notifyListeners();
          return res;
        } finally {
          _inFlight.remove(cacheKey);
        }
      }();
      _inFlight[cacheKey] = f;
      return f;
    }
    final f = _fetchAndStore(key, cacheKey, q, depart: depart, returnDate: returnDate, from: from, to: to);
    _inFlight[cacheKey] = f;
    return f;
  }

  /// The single acquisition pipeline used by live() and stale revalidation.
  /// Owner 23 Oct: this used to be a bare api.live().then(...).whenComplete(...)
  /// chain, which measurably STALLED in the Dart VM (the completion hops never
  /// ran — the loader hung forever with rows already in cache) unless
  /// incidental statements were added to the callback. Re-expressed as a
  /// plain async function with try/finally: the await/return path is the
  /// well-trodden async machinery, and the in-flight map is ALWAYS cleared.
  Future<LiveResponse> _fetchAndStore(
    String key,
    String cacheKey,
    String q, {
    String? depart,
    String? returnDate,
    String? from,
    String? to,
  }) async {
    try {
      final res = await api
          .live(key, q, city: city, pincode: pincode, lat: pickLat, lng: pickLng, depart: depart, returnDate: returnDate, from: from, to: to);
      cache[key] = res;
      cacheQuery[key] = cacheKey;
      cacheAt[key] = _nowMs;
      // Thin-response poison guard (owner 25 Oct): never persist a "completed"
      // <=2-row snapshot to disk — a poisoned entry survives app restarts and
      // re-serves a single stale row on every search for that query.
      if (!res.pendingRefresh && res.items.length >= 3) _scheduleDiskSave();
      notifyListeners();
      return res;
    } finally {
      _inFlight.remove(cacheKey);
    }
  }

  // -- on-disk live cache ---------------------------------------------------
  // Persist each vertical's latest full response so a cold app start paints
  // REAL results instantly (a second app-open is as fast as a tab reopen).
  // Only complete, fresh responses are stored; partial progressive rows
  // (pendingRefresh) never hit the disk.

  Timer? _diskSaveTimer;

  void _scheduleDiskSave() {
    _diskSaveTimer?.cancel();
    // Coalesce the 13-vertical warm-up burst into one write.
    _diskSaveTimer = Timer(const Duration(milliseconds: 1500), () {
      unawaited(store.liveDiskCacheSave(_buildDiskDoc()));
    });
  }

  Map<String, dynamic> _capDiskSize(Map<String, dynamic> raw) {
    var j = raw;
    for (final keep in [999999, 60, 40, 20]) {
      final out = Map<String, dynamic>.from(j);
      final r = out['results'];
      if (r is List && r.length > keep) out['results'] = r.sublist(0, keep);
      final enc = jsonEncode(out);
      if (enc.length <= 60000) return out;
    }
    return const {};
  }

  Map<String, dynamic> _buildDiskDoc() {
    final v = <String, dynamic>{};
    final now = _nowMs;
    cache.forEach((k, res) {
      final raw = res.rawJson;
      if (raw == null || res.pendingRefresh || res.items.isEmpty) return;
      final age = now - (cacheAt[k] ?? 0);
      if (age > staleTtlMs(k)) return; // ancient prices mislead on open
      final capped = _capDiskSize(raw);
      if (capped.isEmpty) return;
      v[k] = {'q': cacheQuery[k], 't': cacheAt[k], 'j': capped};
    });
    return {'city': city, 'pincode': pincode, 'v': v, 'lq': lastQuery};
  }

  Future<void> _loadDiskCache() async {
    final doc = await store.liveDiskCacheLoad();
    if (doc.isEmpty) return;
    // A different location means every stored price is wrong for this user.
    if ('${doc['city'] ?? ''}' != city || '${doc['pincode'] ?? ''}' != pincode) {
      await store.liveDiskCacheClear();
      return;
    }
    final v = doc['v'];
    if (v is! Map) return;
    var loaded = 0;
    v.forEach((k, entry) {
      if (entry is! Map) return;
      final j = entry['j'];
      if (j is! Map<String, dynamic>) return;
      try {
        final res = LiveResponse.fromJson(j);
        if (res.items.isEmpty) return;
        final key = '$k';
        cache[key] = res;
        cacheQuery[key] = '${entry['q'] ?? ''}';
        cacheAt[key] = (entry['t'] is num) ? (entry['t'] as num).toInt() : 0;
        loaded++;
      } catch (_) {
        // Corrupt entry: skip it, never crash the boot.
      }
    });
    final lq = doc['lq'];
    if (lq is Map) {
      lq.forEach((k, val) {
        if (val is String && val.trim().isNotEmpty) lastQuery['$k'] = val;
      });
    }
    if (loaded > 0) notifyListeners();
  }

  /// Account feed: maps admin-managed account deals into the compare-card shape.
  Future<LiveResponse> _accountFeed() async {
    try {
      final feed = await api.deals(kind: 'account', vertical: 'account', limit: 200).timeout(const Duration(seconds: 8));
      final items = feed.deals.map((d) {
        final price = 0.0;
        return CompareItem(
          id: 'acct-${d.id}',
          vertical: 'account',
          title: d.title,
          subtitle: d.merchantName,
          provider: d.merchantName,
          imageUrl: d.imageUrl,
          description: d.description ?? '',
          primaryPrice: price,
          priceAvailable: false,
          features: [if (d.discountText != null && d.discountText!.isNotEmpty) d.discountText!, if (d.code != null && d.code!.isNotEmpty) 'Code: ${d.code}'],
          specs: {'description': d.description ?? '', 'terms': d.terms ?? ''},
          sellerQuotes: [SellerQuote(id: 'acct-sq-${d.id}', sellerName: d.merchantName, price: 0, url: d.goUrl, isLowest: true, badge: 'Verified Offer')],
        );
      }).toList();
      return LiveResponse(items, ['deals_registry'], ['deals_registry'], [], 'deals-registry', 50);
    } catch (_) {
      return LiveResponse(const [], [], [], [], 'unavailable', 0);
    }
  }

  /// Splash prefetch: warm every vertical's default search (plus the rewards
  /// deals feed) in the background so first taps open instantly with data.
  /// 0..1 progress of the splash warm-up (verticals + deals feed finished).
  final ValueNotifier<double> warmProgress = ValueNotifier<double>(0);

  Future<void> prefetchDefaults() async {
    final total = kVerticals.length + 1;
    var done = 0;
    void tick() {
      done++;
      warmProgress.value = done / total;
    }

    final jobs = <Future<void> Function()>[
      for (final v in kVerticals)
        () => live(v.id, defaultQueryFor(v.id, city))
            .then<void>((_) {})
            .catchError((_) {})
            .whenComplete(tick),
      () => deals().then<void>((_) {}).catchError((_) {}).whenComplete(tick),
    ];
    // SPEED: 14 simultaneous cold searches used to wedge Hostinger shared
    // hosting at app open and made the user's own first search slow. The
    // server keep-warms every seed on a 12-min cron anyway — trickle at 3.
    var next = 0;
    Future<void> worker() async {
      while (next < jobs.length) {
        await jobs[next++]();
      }
    }

    await Future.wait([worker(), worker(), worker()]);
  }

  Future<List<Deal>> deals({String? kind}) async {
    final k = kind ?? 'all';
    if (_dealsByKind[k] != null) return _dealsByKind[k]!;
    final d = (await api.deals(kind: kind)).deals;
    _dealsByKind[k] = d;
    return d;
  }

  void invalidateDeals() => _dealsByKind.clear();

  Future<void> refreshBadges() async {
    final auth = AuthService.instance;
    try {
      final feed = await api.notifications(token: auth.token);
      unread = feed.unread;
    } catch (_) {/* badge stays as is */}
    try {
      trackedCount = (await store.tracked()).length;
    } catch (_) {}
    if (auth.signedIn) {
      try {
        final r = await api.rewards(auth.token!);
        points = r.validPoints;
        spinsAvailable = r.availableSpins;
      } catch (_) {}
    } else {
      points = 0;
      spinsAvailable = 0;
    }
    notifyListeners();
  }
}

void unawaited(Future<void> f) {}
