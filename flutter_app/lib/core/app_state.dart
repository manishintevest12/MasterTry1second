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
  final Map<String, Future<LiveResponse>> _inFlight = {};
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
    // Warm-up runs in the background; the splash watches [warmProgress].
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

  void openRadar() {
    navigator.currentState?.pushNamed('radar');
  }

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
    notifyListeners();
  }

  /// Runs (or reuses) the live search for a vertical, exactly like the website's triggerLiveLocationScrape.
  Future<LiveResponse> live(String v, String query, {String? depart, String? returnDate, bool force = false}) async {
    final key = v == 'movies' ? 'movie' : v;
    final q = query.trim().isEmpty ? defaultQueryFor(key, city) : query.trim();
    final cacheKey = '$key|$q|${depart ?? ''}';
    if (!force && cache[key] != null && cacheQuery[key] == cacheKey) return cache[key]!;
    final flying = _inFlight[cacheKey];
    if (flying != null) return flying;
    // Account vertical: real bank-account offers come from the admin-managed deals
    // registry (/api/deals?kind=account) — same shape as the web feed, no scraping.
    if (key == 'account') {
      final f = _accountFeed().then((res) {
        cache[key] = res;
        cacheQuery[key] = cacheKey;
        notifyListeners();
        return res;
      }).whenComplete(() => _inFlight.remove(cacheKey));
      _inFlight[cacheKey] = f;
      return f;
    }
    final f = api
        .live(key, q, city: city, pincode: pincode, lat: pickLat, lng: pickLng, depart: depart, returnDate: returnDate)
        .then((res) {
      cache[key] = res;
      cacheQuery[key] = cacheKey;
      notifyListeners();
      return res;
    }).whenComplete(() => _inFlight.remove(cacheKey));
    _inFlight[cacheKey] = f;
    return f;
  }

  /// Account feed: maps admin-managed account deals into the compare-card shape.
  Future<LiveResponse> _accountFeed() async {
    try {
      final feed = await api.deals(kind: 'account', vertical: 'account', limit: 200).timeout(const Duration(seconds: 8));
      final items = feed.deals.map((d) {
        final price = 0.0;
        return CompareItem(
          id: 'acct-\${d.id}',
          vertical: 'account',
          title: d.title,
          subtitle: d.merchantName,
          provider: d.merchantName,
          imageUrl: d.imageUrl,
          description: d.description ?? '',
          primaryPrice: price,
          priceAvailable: false,
          features: [if (d.discountText != null && d.discountText!.isNotEmpty) d.discountText!, if (d.code != null && d.code!.isNotEmpty) 'Code: \${d.code}'],
          specs: {'description': d.description ?? '', 'terms': d.terms ?? ''},
          sellerQuotes: [SellerQuote(id: 'acct-sq-\${d.id}', sellerName: d.merchantName, price: 0, url: d.goUrl, isLowest: true, badge: 'Verified Offer')],
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

    final jobs = <Future<void>>[
      for (final v in kVerticals)
        live(v.id, defaultQueryFor(v.id, city))
            .then<void>((_) {})
            .catchError((_) {})
            .whenComplete(tick),
      deals().then<void>((_) {}).catchError((_) {}).whenComplete(tick),
    ];
    await Future.wait(jobs);
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
