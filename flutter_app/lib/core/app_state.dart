import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import 'api.dart';
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
  PendingSearch? pending;

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

  Future<void> setLocation(String newCity, String newPin) async {
    city = newCity.trim().isEmpty ? city : newCity.trim();
    pincode = newPin.trim().isEmpty ? pincode : newPin.trim();
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
    final f = api
        .live(key, q, city: city, pincode: pincode, depart: depart, returnDate: returnDate)
        .then((res) {
      cache[key] = res;
      cacheQuery[key] = cacheKey;
      notifyListeners();
      return res;
    }).whenComplete(() => _inFlight.remove(cacheKey));
    _inFlight[cacheKey] = f;
    return f;
  }

  /// Splash prefetch: warm every vertical's default search (plus the rewards
  /// deals feed) in the background so first taps open instantly with data.
  Future<void> prefetchDefaults() async {
    for (final v in kVerticals) {
      unawaited(live(v.id, defaultQueryFor(v.id, city)).catchError((_) => const LiveResponse([], [], [], [], '', 0)));
    }
    unawaited(deals().catchError((_) => <Deal>[]));
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
