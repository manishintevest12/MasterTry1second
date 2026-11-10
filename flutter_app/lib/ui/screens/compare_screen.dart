import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../../core/api.dart';
import '../../core/app_state.dart';
import '../../core/auth.dart';
import '../../core/autocomplete_data.dart';
import '../../core/compare.dart' as cmp;
import '../../core/theme.dart';
import '../../core/verticals.dart';
import '../../core/search_poll.dart';
import '../widgets/compare_cards.dart';
import '../widgets/hint_field.dart';
import '../widgets/journey_date_picker_modal.dart';
import '../widgets/location_hint_field.dart';
import '../widgets/filter_panel.dart';
import '../widgets/search_progress_card.dart';
import '../widgets/kit.dart';
import '../widgets/sponsored_slot.dart';
import '../widgets/typeahead_field.dart';
import 'hotel_picker_screen.dart';
import 'smart_cart_screen.dart';
import 'place_picker_screen.dart';
import 'address_picker_screen.dart';
import 'map_pin_picker_screen.dart';

/// Small const map of lat/lng for top ~40 Indian cities for geolocator pre-fill

String routeQuery(String from, String to) {
  String clean(String x) => x.replaceAll(RegExp(r'\s*\(\d{5,6}\)\s*$'), '').trim();
  final a = clean(from);
  final b = clean(to);
  if (a.isNotEmpty && b.isNotEmpty) return '$a to $b';
  return b.isNotEmpty ? b : a;
}

/// Website Compare tab: vertical tabs, per-vertical search form, live scrape feed
/// with grouped cards (one product = one card, cheapest site first), sort tabs,
/// source status, honest empty/loading states.
class CompareScreen extends StatefulWidget {
  const CompareScreen({super.key});

  @override
  State<CompareScreen> createState() => _CompareScreenState();
}

class _CompareScreenState extends State<CompareScreen> {
  final _state = AppState.instance;
  late VerticalMeta _meta;
  final _q = TextEditingController();
  final _from = TextEditingController();
  final _to = TextEditingController();
  final _foodAddr = TextEditingController(); // Food delivery address typeahead (owner 17 Oct)
  DateTime _date = DateTime.now().add(const Duration(days: 1));
  DateTime _checkOutDate = DateTime.now().add(const Duration(days: 3));
  String _hotelGuests = '2 Adults · 1 Room';

  bool _loading = false;
  // The old 3-2-1 one-shot loader window (WarpLoader + _loaderDone/_loaderTimer)
  // is fully retired: the SearchProgress panel now owns the whole acquisition.
  Timer? _bgPoll;
  int _bgPollCount = 0;
  /// Panel gate (owner 28 Oct): mirrors the website's per-vertical
  /// `pendingRefresh` handling so a finished/exhausted chain can never leave
  /// "Checking Yatra… 8 of 9" on screen with no rows below it.
  bool _pendingFlag = false;
  /// One settle read per search: after the chain gives up empty, a single
  /// non-forced fetch picks up the answer the server has since warmed.
  bool _settleDone = false;
  LiveResponse? _res;
  // OWNER 7 Nov ("jitne website ke results website pr aate hai utne app pr ni aate"): the
  // app opened with only 4 result groups (4 cards) while the web lists the whole feed, so the
  // app looked like it had half the results. It now opens with the full first screen of
  // groups (12) and Load More adds 8 at a time; nothing else about grouping changed.
  int _visibleCount = 12;

  /// House-sponsored card for this vertical (owner 9 Nov). Loaded once per vertical from
  /// /api/ads?slot=vertical_<id>; empty means the deals registry has nothing relevant, in which case
  /// the feed renders exactly as before and nothing is invented.
  List<SponsoredOffer> _sponsor = const [];

  /// Vertical ids that sell a CPA slot at the top instead of an in-feed card.
  static const _financeVerticals = <String>{'loans', 'insurance', 'creditcards', 'account'};

  /// Fire-and-forget sponsor lookup for [vertical]. Any failure leaves the feed untouched.
  Future<void> _loadSponsor(String vertical) async {
    final offers = await fetchSponsoredOffers(vertical);
    if (!mounted || vertical != _meta.id) return;
    setState(() => _sponsor = offers);
  }
  /// The cache key of the response currently on screen; lets a background
  /// revalidation (stale TTL refresh) swap in newer prices without a spinner.
  String? _shownCacheKey;
  String? _error;
  cmp.SortMode _sort = cmp.SortMode.best;
  FilterOptions _filterOpts = const FilterOptions();
  // Account vertical (owner 21 Oct): Savings/Current/Demat chip + bank search box.
  String _accountType = 'Savings';

  @override
  void initState() {
    super.initState();
    _meta = verticalById(_state.vertical);
    _state.addListener(_onState);
    _seedForm();
    _start();
    unawaited(_loadSponsor(_meta.id));
  }

  /// Owner 23 Oct (homepage pills 'results nahi aate'): MainShell mounts this
  /// screen only while the compare tab is active (a switch body, not an
  /// IndexedStack), so a pill / showcase / hero tap from the HOME tab sets a
  /// PendingSearch BEFORE this screen exists — _onState's listener fires during
  /// openVertical, before mount, so nothing consumed it and initState then ran
  /// an EMPTY auto search: the compare tab opened with no loader and no results
  /// at all. Consume the pending FIRST, exactly like the _onState path does.
  void _start() {
    var p = _state.takePending();
    // OWNER 3 Nov ("hotels mai Goa search kiya, e-commerce mai bhi Goa aa gaya; har vertical
    // alag hai, unka aapas mai kuch lena dena nahi"): a pending search used to be applied to
    // WHATEVER vertical happened to be on screen when it was consumed, so a leftover hotels
    // intent filled the e-commerce box and even ran an e-commerce search for it. A pending
    // intent now only belongs to the vertical that created it; anything else is dropped.
    if (p != null && !p.productPage && !pendingFitsVertical(p.vertical, _meta.id)) p = null;
    if (p == null) {
      // Owner 23 Oct mismatch fix: on (re)mount, if this vertical already has
      // results, the form must show THAT query — the auto search revalidates
      // what is on screen, never a different seed default.
      final cachedQ = _queryFromCacheKey(_state.cacheQuery[_meta.id]);
      if (_state.cache[_meta.id] != null && cachedQ.isNotEmpty) {
        _syncFormFromQuery(cachedQ);
      } else {
        // OWNER 4 Nov: the form must NEVER open blank, and must never carry another vertical's
        // text. The remembered query is used only when it fits THIS vertical's shape (a route for
        // flights/bus/cab, a city/product for hotels and the rest); otherwise the vertical's own
        // default seed is shown ("Goa" for hotels, "Indore to New Delhi" for flights,
        // "Indore to Nagpur" for bus...), so no tab can open on an empty screen.
        final seed = seedQueryFor(_meta.id, _state.city, _state.lastQueryFor(_meta.id));
        if (seed.isNotEmpty) _syncFormFromQuery(seed);
      }
      // OWNER 28 Oct: the automatic search belongs to the FIRST open of this
      // vertical. Once it has run, the result is fixed - leaving the compare tab
      // and coming back (this screen is rebuilt, it is not kept alive in an
      // IndexedStack) must repaint what was already found instead of quietly
      // searching again. A new search now only comes from the user's own Search
      // button, a pending tap (pill / hero / product link) or a location change
      // (AppState.setLocation clears `searched`).
      if (_state.searched.contains(_meta.id)) {
        _res = _state.cache[_meta.id];
        _markSettledIfComplete();
      _shownCacheKey = _state.cacheQuery[_meta.id];
        _pendingFlag = false;
        _loading = false;
        _error = null;
        if (mounted) setState(() {});
        return;
      }
      _state.searched.add(_meta.id);
      _runSearch(auto: true);
      return;
    }
    if (p.productPage) {
      _state.openProduct(p);
      return;
    }
    _syncFormFromQuery(p.query); // route verticals need from/to, not the raw _q
    _state.searched.add(_meta.id);
    _runSearch(query: p.query);
  }

  @override
  void dispose() {
    _bgPoll?.cancel();
    _state.removeListener(_onState);
    _q.dispose();
    _from.dispose();
    _to.dispose();
    super.dispose();
  }

  void _onState() {
    if (verticalById(_state.vertical).id != _meta.id) {
      _meta = verticalById(_state.vertical);
      _sort = cmp.SortMode.best;
      _filterOpts = const FilterOptions();
      _seedForm();
      _res = _state.cache[_meta.id];
      _shownCacheKey = _state.cacheQuery[_meta.id];
      // Form/results mismatch fix: whatever rows we adopt, their query goes
      // into the fields so the label on screen always matches the feed.
      final shownQ = _queryFromCacheKey(_shownCacheKey);
      if (_res != null && shownQ.isNotEmpty) _syncFormFromQuery(shownQ);
      if (mounted) setState(() {});
      // Owner 23 Oct: a vertical switch can carry a PendingSearch too (pill /
      // hero tap while this screen was on another vertical). _start() consumes
      // it first instead of returning before the pending check ever runs.
      _start();
      return;
    }
    var pending = _state.takePending();
    if (pending != null) {
      if (pending.productPage) {
        _state.openProduct(pending);
        return;
      }
      // Owner 3 Nov: never let another vertical's search text land in this one's box.
      if (!pendingFitsVertical(pending.vertical, _meta.id)) {
        pending = null;
      } else {
        _syncFormFromQuery(pending.query);
        _runSearch(query: pending.query);
        return;
      }
    }
    // Background revalidation finished: same query, fresher prices — adopt
    // them silently so the user never sees a spinner for data already shown.
    final fresh = _state.cache[_meta.id];
    final key = _shownCacheKey;
    if (fresh != null &&
        !identical(fresh, _res) &&
        key != null &&
        _state.cacheQuery[_meta.id] == key &&
        mounted) {
      setState(() => _res = fresh);
      _markSettledIfComplete();
    }
  }

  /// OWNER 6 Nov: remember WHEN this intent reached a complete answer, so an identical
  /// re-press reuses it instead of starting a new sweep (and a different seller mix).
  void _markSettledIfComplete() {
    final r = _res;
    if (r == null || r.pendingRefresh || r.items.isEmpty) return;
    _settledAtMs = _nowMs;
  }

  void _seedForm() {
    _q.text = '';
    _from.text = _meta.defaultFrom;
    _to.text = _meta.defaultTo;
    // OWNER 3 Nov (vertical independence): the box must show this vertical's OWN last search
    // (or its own seed) so switching verticals never shows another vertical's text or a blank
    // box over results the user did not ask for here.
    final own = _state.lastQueryFor(_meta.id);
    if (own.isNotEmpty) _syncFormFromQuery(own);
  }

  /// Owner 23 Oct ('results Indore to Mumbai, box Indore to New Delhi'): the
  /// form must always mirror the query whose results are on screen. When a
  /// cached response or a pending search is adopted, write its query back
  /// into the visible fields instead of leaving the seed defaults behind.
  void _syncFormFromQuery(String query) {
    final raw = query.trim();
    if (raw.isEmpty) return;
    switch (_meta.kind) {
      case SearchKind.route:
      case SearchKind.dateRoute:
      case SearchKind.cab:
        final m =
            RegExp('^(.*?)\\s+(?:to|\\u2192|->)\\s+(.+)\$', caseSensitive: false).firstMatch(raw);
        if (m != null) {
          _from.text = m.group(1)!.trim();
          _to.text = m.group(2)!.trim();
        } else {
          _q.text = raw;
        }
        break;
      case SearchKind.hotel:
        _to.text = raw;
        break;
      case SearchKind.account:
        break; // chip-driven: the bank box stays a browse-all filter
      default:
        _q.text = raw;
    }
  }

  /// cacheQuery values are '<vertical>|<query>|<depart>' composites.
  String _queryFromCacheKey(String? key) {
    if (key == null) return '';
    final parts = key.split('|');
    return parts.length >= 2 ? parts[1] : '';
  }

  String _effectiveQuery() {
    switch (_meta.kind) {
      case SearchKind.route:
      case SearchKind.dateRoute:
      case SearchKind.cab:
        return routeQuery(_from.text, _to.text);
      case SearchKind.hotel:
        return _to.text.trim().isNotEmpty ? _to.text.trim() : _state.city;
      case SearchKind.account:
        // Mirror of web accountSearchQuery: "<bank> <type> account"; a blank
        // bank box browses/compares every bank for the selected account type.
        return accountSearchQuery(_q.text, _accountType);
      default:
        return _q.text.trim();
    }
  }

  /// Signature of the answer currently on screen, and when it settled.
  int get _nowMs => DateTime.now().millisecondsSinceEpoch;
  String _settledSig = '';
  int _settledAtMs = 0;

  Future<void> _runSearch({String? query, bool auto = false, bool force = false}) async {
    final q0 = (query ?? _effectiveQuery()).trim();
    // Web parity (AppContext triggerLive DEFAULT_QUERY): an empty search box
    // falls back to the vertical's own starting query ('personal loan',
    // 'health insurance', 'best credit card'...) so Loans / Insurance /
    // Credit Cards NEVER dead-end in 'No matching options found' — a tab
    // shows real data the moment it opens (owner 23 Oct complaint).
    // Owner 24 Oct: the vertical's OWN last searched query is sticky — it
    // wins over the registry seed, so reopening flights after switching
    // verticals re-runs the user's last route instead of Indore->Delhi.
    final stickyRaw = _state.lastQueryFor(_meta.id);
    // OWNER 4 Nov: a remembered query from ANOTHER vertical's shape ("Rau Tahsil to Bhopal" in
    // Hotels) is not this vertical's search - ignore it and use this vertical's own seed.
    final sticky = queryFitsVertical(_meta.id, stickyRaw) ? stickyRaw.trim() : '';
    final q = q0.isEmpty ? seedQueryFor(_meta.id, _state.city, sticky) : q0;
    if (q.isEmpty) return;
    // OWNER 6 Nov: "mai 5 baar flight mai search krta hoon aur 5 baar alag alag seller aate hai ...
    // results final wala complete search kr ke hi aana chaiye". A press with the SAME intent (same
    // vertical + query + date + route + address) while the answer on screen is already COMPLETE
    // reuses that answer: no new sweep, so the seller set cannot shuffle, and no CPU is spent
    // scanning the same question again. A changed intent (new place/product/city/date) still runs a
    // real search, and a still-scanning answer always keeps polling.
    final sig = searchSignature(
      vertical: _meta.id,
      query: q,
      depart: _iso(_date),
      from: _from.text,
      to: _to.text,
      city: _state.city,
      pincode: _state.pincode,
    );
    final settledSameIntent = _res != null &&
        !_res!.pendingRefresh &&
        _res!.items.isNotEmpty &&
        _settledSig == sig &&
        (_nowMs - _settledAtMs) < const Duration(minutes: 5).inMilliseconds;
    if (settledSameIntent) {
      // Same question, already answered completely: repaint it. Never a second sweep.
      if (mounted) {
        setState(() {
          _loading = false;
          _error = null;
        });
      }
      return;
    }
    if (!settledSameIntent) _settledSig = sig;
    if (!auto) {
      _bgPollCount = 0; // fresh user search: full poll budget again
      _settleDone = false; // ...and a fresh settle read if the chain ends empty
      // Owner 23 Oct (image-1 request): a NEW search is a new intent — drop
      // the previous search's rows so the engaging full-screen WarpLoader
      // (pulsing 3-2-1 core, progress bar, skeleton cards) holds the user,
      // instead of stale rows under a thin yellow strip. Auto polls never
      // clear: progressive rows keep growing in place.
      _res = null;
      _shownCacheKey = null;
      _filterOpts = const FilterOptions();
    }
    setState(() {
      _loading = true;
      _error = null;
      _visibleCount = 12; // Load More: a new search opens on 12 groups (web parity)
    });
    _bgPoll?.cancel();
    try {
      // Explicit PUDO (owner 25 Oct): for cab searches send the exact picker
      // labels too — the server geocodes them city-biased instead of regex-
      // extracting the raw query ("Rajwada" alone geocoded to Nashik).
      final isCab = _meta.kind == SearchKind.cab;
      // OWNER 7 Nov (issue 2: "future date choose karne par bhi aaj ka data"): the checkout /
      // return date was NEVER sent to the API - live() has accepted `returnDate` all along, but
      // this call only ever passed `depart`, so a 3-night hotel search reached the server as a
      // 1-night stay (and a return flight as one-way). Hotels and flights now carry it; every
      // other vertical keeps the single-date payload it had.
      // flights (route) and hotels (hotel) are the only verticals with a return/check-out date in
      // their picker; bus is a single-date route, so it must NOT receive a phantom return date.
      final needsReturn = _meta.kind == SearchKind.hotel || _meta.kind == SearchKind.route;
      _res = await _state.live(_meta.id, q,
          depart: _iso(_date),
          returnDate: needsReturn ? _iso(_checkOutDate) : null,
          force: force,
          // A user press asks for the settled answer (auto/background passes do not), so the first
          // press lands the complete priced set instead of needing 2-3 attempts.
          settle: !auto && force,
          from: isCab && _from.text.trim().isNotEmpty ? _from.text.trim() : null,
          to: isCab && _to.text.trim().isNotEmpty ? _to.text.trim() : null);

      _shownCacheKey = _state.cacheQuery[_meta.id];
      // Owner 23 Oct (loans/hotels 'results nahi dikhte' on device): the
      // await above resuming does NOT schedule a frame on its own —
      // AppState's notifyListeners fired INSIDE live() before _res/_shownCacheKey
      // were assigned, so the _onState 'fresh adoption' branch skipped, and a
      // warm-cache response (pendingRefresh=false, no poll timer to force a
      // repaint later) left the screen on the loader/form FOREVER until the
      // user happened to touch it. Repaint explicitly the moment rows land.
      if (mounted) setState(() {});
      // Progressive cold-start: real catalogue rows arrived instantly and the
      // server is still scanning live sources. Poll the same search quietly
      // until the full live set replaces the partial rows (max ~25s of polls,
      // now 2s apart so live top-ups land progressively instead of one long wait).
      // Owner 22 Oct: poll budget 12 -> 30 (~60s coverage, 2s apart) so slow
      // cold searches keep topping up like the web instead of stopping early.
      // OWNER 28 Oct ("ye last me ruk jata hai aur results ni deta; tab switch
      // kar ke wapas aao to deta hai"): the chain used to stop as soon as the
      // poll budget ran out while the LAST response still said pendingRefresh,
      // so the panel stayed mounted forever and the finished answer was only
      // picked up when the tab remounted. The panel gate now follows the web's
      // pollDecision rule (search_poll.dart): it survives only while a chain is
      // genuinely still polling, and an exhausted-empty chain does one final
      // non-forced read (the server's warmed cache) before releasing to the
      // honest empty state with Retry.
      final decision = pollDecision(
        pendingRefresh: _res?.pendingRefresh == true,
        pollCount: _bgPollCount,
        maxPolls: kSearchMaxPolls,
        rows: _res?.items.length ?? 0,
        settled: _settleDone,
      );
      _pendingFlag = decision.keepPendingFlag;
      if (mounted && decision.keepPolling) {
        _bgPoll = Timer(const Duration(milliseconds: 2000), () {
          if (!mounted) return;
          _bgPollCount += 1;
          // force: the partial progressive rows are STILL in the fresh-TTL
          // client cache — without force, live() would hand back the same
          // quote-less rows forever and every Book button would stay dead.
          _runSearch(query: q, auto: true, force: true);
        });
      } else if (mounted && decision.settle) {
        _settleDone = true;
        _bgPoll = Timer(const Duration(milliseconds: 1500), () {
          if (!mounted) return;
          _bgPollCount += 1;
          // No force: this deliberately reads the cache the pipeline has been
          // filling, which is exactly what a tab switch used to do by hand.
          _runSearch(query: q, auto: true);
        });
      } else {
        _bgPollCount = 0;
      }
    } catch (e) {
      final is403 = '$e'.contains('403');
      // An error ends this chain: never leave the panel promising progress.
      _pendingFlag = false;
      _error = is403
          ? 'Site security is temporarily blocking the app (HTTP 403). '
              'Please wait a few minutes and search again.'
          : '$e'.replaceFirst(RegExp(r'^Exception: ?'), '');
      // WAF self-healing (owner 25 Oct 403 report): when the CDN edge throws
      // a bot-challenge 403 at the app, the old chain kept auto-polling up to
      // 30 times (~75 requests/search) — hammering the WAF from the phone's
      // IP only EXTENDS any rate-based ban. A 403 is permanent for this
      // client: stop the chain cold, surface an honest message, and let the
      // user retry on their own schedule instead.
      if (is403) {
        _bgPollCount = 0;
      } else if (auto && _bgPollCount < kSearchMaxPolls) {
        // Chain resilience (owner 23 Oct 'bus sirf zingbus deta hai'): a single
        // failed poll (30s client timeout on a cold route, one flaky hop on
        // mobile data) used to strand the progressive chain forever — the user
        // kept the partial rows (zingbus-only) and never received the slow
        // sources' top-ups (AbhiBus lands ~40s in). Auto polls keep going.
        _bgPoll = Timer(const Duration(milliseconds: 2500), () {
          if (!mounted) return;
          _bgPollCount += 1;
          _runSearch(query: q, auto: true, force: true);
        });
      } else {
        _bgPollCount = 0;
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _iso(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  /// Uber-style map pin (17 Oct): open the draggable map, adopt the exact spot.
  Future<void> _pickOnMap(bool pickup) async {
    final spot = await Navigator.of(context).push<PickedSpot>(
      MaterialPageRoute(
        builder: (_) => MapPinPickerScreen(
          isPickup: pickup,
          initialLat: pickup ? _state.pickLat : null,
          initialLng: pickup ? _state.pickLng : null,
          initialLabel: _state.city,
        ),
      ),
    );
    if (spot == null || !mounted) return;
    if (pickup) {
      setState(() => _from.text = spot.label);
      // Exact pin becomes the user's location; every live search now carries
      // its coordinates (api.live -> /api/scrape/live `coordinates`).
      await _state.setLocation(spot.city.isNotEmpty ? spot.city : _state.city, spot.pincode ?? _state.pincode, lat: spot.lat, lng: spot.lng);
      toast(context, 'Pickup pinned: ${spot.address}');
    } else {
      setState(() => _to.text = spot.label);
      _runSearch(force: true);
    }
  }

  void _swap() {
    final f = _from.text;
    _from.text = _to.text;
    _to.text = f;
    _runSearch(force: true);
  }

  /// Reference-style journey date modal (owner 22 Oct: date hints MANDATORY on
  /// every vertical — same UI as the site: quick pills, locked past dates,
  /// legend, Apply button). Accent matches the web per vertical.
  Future<void> _pickDate() async {
    final v = _state.vertical;
    final res = await showJourneyDatePicker(
      context,
      title: v == 'flights'
          ? 'Flight Date'
          : v == 'bus'
              ? 'Date of Journey'
              : v == 'movies'
                  ? 'Select Movie Show Date'
                  : 'Schedule Ride Date',
      isRange: false,
      initialDeparture: _date,
      accent: v == 'flights'
          ? const Color(0xFFF97316)
          : v == 'bus'
              ? const Color(0xFFE11D48)
              : const Color(0xFFF59E0B),
    );
    if (res != null && mounted) {
      setState(() => _date = res.departure);
      await _runSearch();
    }
  }

  /// Hotels: check-in + check-out range in ONE modal (site parity).
  Future<void> _pickHotelDates() async {
    final res = await showJourneyDatePicker(
      context,
      title: 'Check-in & Check-out Dates',
      isRange: true,
      initialDeparture: _date,
      initialReturn: _checkOutDate,
      accent: const Color(0xFF1D64FF),
    );
    if (res != null && mounted) {
      setState(() {
        _date = res.departure;
        _checkOutDate = res.returnDate ?? _date.add(const Duration(days: 1));
      });
      await _runSearch();
    }
  }

  Future<void> _useCurrentLocationForCab() async {
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        if (mounted) toast(context, 'Location services are disabled', error: true);
        return;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          if (mounted) toast(context, 'Location permission denied', error: true);
          return;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        if (mounted) toast(context, 'Location permission permanently denied', error: true);
        return;
      }

      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.low,
        timeLimit: const Duration(seconds: 8),
      );

      // Find nearest city from top ~40 cities
      String? nearestCity;
      double minDistanceMeters = double.infinity;

      for (final entry in kCityCoords.entries) {
        final dist = Geolocator.distanceBetween(
          pos.latitude,
          pos.longitude,
          entry.value['lat']!,
          entry.value['lng']!,
        );
        if (dist < minDistanceMeters) {
          minDistanceMeters = dist;
          nearestCity = entry.key;
        }
      }

      if (minDistanceMeters > 150000) {
        // > 150 km away
        if (mounted) toast(context, 'You are far (>150 km) from supported cities', error: true);
        return;
      }

      if (nearestCity != null) {
        // Find matching suggestion in kAutoCities
        final match = kAutoCities.firstWhere(
          (c) => c.text.toLowerCase().contains(nearestCity!.toLowerCase()),
          orElse: () => CitySuggestion(nearestCity!, '', ''),
        );
        setState(() {
          _from.text = match.text;
        });
        if (mounted) toast(context, 'Location set to ${match.text}');
      }
    } catch (e) {
      if (mounted) toast(context, 'Could not detect location: $e', error: true);
    }
  }

  Future<void> _openCityPicker(TextEditingController targetController, String title) async {
    final res = await Navigator.push<String>(
      context,
      MaterialPageRoute(
        builder: (c) => _CityPickerScreen(
          title: title,
          busMode: _state.vertical == 'bus',
        ),
      ),
    );
    if (res != null && res.isNotEmpty) {
      setState(() {
        targetController.text = res;
      });
      _runSearch(force: true);
    }
  }

  Future<void> _openPlacePicker(bool isFrom) async {
    final res = await Navigator.push<String>(
      context,
      MaterialPageRoute(
        builder: (c) => PlacePickerScreen(
          isFrom: isFrom,
          fromCity: _from.text,
          toCity: _to.text,
        ),
      ),
    );
    if (res != null && res.isNotEmpty) {
      setState(() {
        if (isFrom) {
          _from.text = res;
        } else {
          _to.text = res;
        }
      });
      _runSearch(force: true);
    }
  }

  Future<void> _openHotelPicker() async {
    final res = await Navigator.push<HotelPickerResult>(
      context,
      MaterialPageRoute(
        builder: (c) => HotelPickerScreen(
          initialDestination: _to.text,
          initialCheckIn: _date,
          initialCheckOut: _checkOutDate,
        ),
      ),
    );
    if (res != null) {
      setState(() {
        _to.text = res.destination;
        _date = res.checkIn;
        _checkOutDate = res.checkOut;
        _hotelGuests = res.guestsSummary;
      });
      _runSearch(force: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    return Stack(children: [
      Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      _VerticalTabs(
        current: _meta.id,
        onPick: (id) {
          _state.selectVertical(id);
        },
      ),
      Expanded(
        child: RefreshIndicator(
          color: T1SColors.red,
          onRefresh: () => _runSearch(force: true),
          // SPEED (22 Oct): builder + prebuilt header/feed lists — the eager
          // ListView(children:) built EVERY result card (often 100+ image
          // cards) in one frame; now offscreen cards build lazily on scroll.
          child: Builder(
            builder: (bc) {
              final header = <Widget>[
                _SearchCard(
                onSwap: _swap,
                meta: _meta,
                q: _q,
                from: _from,
                to: _to,
                date: _date,
                checkOutDate: _checkOutDate,
                hotelGuests: _hotelGuests,
                city: _state.city,
                onPickDate: _pickDate,
                onPickHotelDates: _pickHotelDates,
                onSearch: () => _runSearch(force: true),
                onPickCity: _pickCity,
                onUseCurrentLocationForCab: _useCurrentLocationForCab,
                onOpenCityPicker: _openCityPicker,
                onPickOnMap: _pickOnMap,
                onOpenPlacePicker: _openPlacePicker,
                onOpenHotelPicker: _openHotelPicker,
                foodAddr: _foodAddr,
                onPickFoodAddress: _pickFoodAddress,
                onPickFoodAddressSheet: _openFoodAddressSheet,
                onOpenCabSpotPicker: _openCabSpotSheet,
                accountType: _accountType,
                onAccountType: (t) {
                  // Chip tap = immediate comparison for that account type (bank box keeps its text).
                  setState(() => _accountType = t);
                  _runSearch(force: true);
                },
              ),
              const SizedBox(height: 12),
              _StatusStrip(res: _res, loading: _loading, error: _error, onRetry: () => _runSearch(force: true)),
              if (_res != null && _res!.items.isNotEmpty) ...[
                const SizedBox(height: 12),
                FilterPanel(
                  vertical: _meta.id,
                  items: _res!.items,
                  options: _filterOpts,
                  onChanged: (opts) => setState(() => _filterOpts = opts),
                ),
                const SizedBox(height: 12),
                _SortBar(
                  sort: _sort,
                  onSort: (s) => setState(() => _sort = s),
                ),
                const SizedBox(height: 12),
              // OWNER 27 Oct (movie vertical: loader + "results not found" repeated 3x
              // before the real rows landed): a pendingRefresh poll leaves _loading false
              // for ~2s between attempts, which used to flip this screen to the honest
              // "No matching options found" card. While the engine is still acquiring,
              // that card is FALSE information — show the please-wait panel instead.
              ] else if (!_loading && !_pendingFlag && _error == null) ...[
                const SizedBox(height: 26),
                _EmptyState(onSearch: () => _runSearch(force: true)),
              ] else if ((_res == null || _res!.items.isEmpty) && (_loading || _pendingFlag)) ...[
                // Owner 27 Oct: no countdown any more. The progress panel (live site
                // name, "n of N sites", advancing bar, skeleton cards) stays up for the
                // whole acquisition and is replaced the moment real rows land.
                const SizedBox(height: 20),
                _WarpLoader(key: ValueKey('search-progress'), verticalId: _meta.id),
              ],
              ];

              // Feed cards build lazily below the header list.
              final feed = (_res != null && _res!.items.isNotEmpty)
                  ? _FeedBody(
                      meta: _meta,
                      res: _res!,
                      sort: _sort,
                      filterOpts: _filterOpts,
                      visibleCount: _visibleCount,
                      onLoadMore: () => setState(() => _visibleCount += 8),
                    ).cards(bc)
                  : const <Widget>[];

              // OWNER 9 Nov: sponsored placement, labelled and inside the design language.
              // Finance verticals (loans, credit cards, insurance, savings) get ONE "Featured partner"
              // card at the top of the list, the way comparison sites sell their CPA slot. Every other
              // vertical gets ONE "SPONSORED" card after the 6th result, matching the web feed. Never
              // both, never a popup, and never a card without a real partner deal behind it.
              final sponsoredFeed = _sponsor.isEmpty
                  ? feed
                  : _financeVerticals.contains(_meta.id)
                      ? <Widget>[SponsoredCard(offer: _sponsor.first, label: 'FEATURED PARTNER'), ...feed]
                      : injectSponsoredCard(feed, SponsoredCard(offer: _sponsor.first));

              return ListView.builder(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                itemCount: header.length + sponsoredFeed.length,
                itemBuilder: (c, i) => i < header.length ? header[i] : sponsoredFeed[i - header.length],
              );
            },
          ),
        ),
      ),
      ]),
      // Smart Cart (owner rule): floating basket on the grocery vertical.
      if (_meta.id == 'grocery' && app.smartCart.isNotEmpty)
        Positioned(
          right: 16,
          bottom: 18,
          child: ListenableBuilder(
            listenable: app,
            builder: (c, _) => GestureDetector(
              onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (c) => const SmartCartScreen())),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(color: Colors.black87, borderRadius: BorderRadius.circular(30), boxShadow: [BoxShadow(color: Colors.black26, blurRadius: 12, offset: const Offset(0, 4))]),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.shopping_cart_outlined, size: 17, color: Colors.white),
                  const SizedBox(width: 7),
                  Text('${app.smartCart.length} item${app.smartCart.length > 1 ? 's' : ''}', style: tx(context, 12, w: FontWeight.w900, color: Colors.white)),
                  const SizedBox(width: 6),
                  Text('Smart Cart', style: tx(context, 9, w: FontWeight.w800, color: Colors.white70)),
                ]),
              ),
            ),
          ),
        ),
    ]);
  }

  /// Owner 17 Oct (food): typed delivery address -> reverse-geocode -> city+pincode.
  Future<void> _pickFoodAddress(Map<String, dynamic> place) async {
    final lat = (place['lat'] as num?)?.toDouble();
    final lng = (place['lng'] as num?)?.toDouble();
    if (lat == null || lng == null) return;
    // Owner 24 Oct: suggest rows already carry the granular structured address
    // (colony/street/city/pincode) — use it directly; reverse-geocode only when
    // the city is missing so city/pincode stay real (never guessed).
    var city = (place['city'] as String?)?.isNotEmpty == true ? place['city'] as String : '';
    var pin = (place['pincode'] as String?)?.isNotEmpty == true ? place['pincode'] as String : '';
    if (city.isEmpty || pin.isEmpty) {
      final rev = await AppState.instance.api.geoReverse(lat, lng);
      city = city.isNotEmpty ? city : ((rev?['city'] as String?)?.isNotEmpty == true ? rev!['city'] as String : _state.city);
      pin = pin.isNotEmpty ? pin : ((rev?['pincode'] as String?)?.isNotEmpty == true ? rev!['pincode'] as String : _state.pincode);
    }
    // Exact picked point becomes the user's location; every live search now
    // carries its coordinates (api.live -> /api/scrape/live `coordinates`).
    await _state.setLocation(city, pin, lat: lat, lng: lng);
    if (mounted) await _runSearch(force: true);
  }

  /// Owner 24 Oct: the plain city/pincode dialog is replaced by the full-screen
  /// granular AddressPickerScreen (reference screenshots) — search-as-you-type
  /// over /api/geo/suggest (colony/street level), GPS, or map pin. Used by the
  /// 10-min delivery (grocery), food and every vertical's location chip.
  Future<void> _pickCity() async {
    final spot = await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => const AddressPickerScreen(title: 'Select Your Location'),
      ),
    );
    if (spot == null || spot is! Map<String, dynamic>) return;
    final lat = (spot['lat'] as num?)?.toDouble();
    final lng = (spot['lng'] as num?)?.toDouble();
    final city = (spot['city'] as String?)?.isNotEmpty == true ? spot['city'] as String : _state.city;
    final pin = (spot['pincode'] as String?)?.isNotEmpty == true ? spot['pincode'] as String : _state.pincode;
    await _state.setLocation(city, pin, lat: lat, lng: lng);
    if (mounted) {
      toast(context, 'Location set to ${spot['address'] ?? city}');
      await _runSearch(force: true);
    }
  }

  /// Owner 24 Oct evening: food delivery address gets the SAME full-screen
  /// granular picker as the 10-min grocery vertical — search-as-you-type over
  /// /api/geo/suggest (colony/street level), GPS and map pin. The inline field
  /// opens this sheet on tap and displays the chosen address.
  Future<void> _openFoodAddressSheet() async {
    final spot = await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => AddressPickerScreen(title: 'Delivery Address', initialQuery: _foodAddr.text),
      ),
    );
    if (spot == null || spot is! Map<String, dynamic> || !mounted) return;
    final address = (spot['address'] ?? spot['label'] ?? '').toString();
    if (address.isNotEmpty) {
      setState(() => _foodAddr.text = address);
    }
    await _pickFoodAddress(spot); // structured city/pincode + setLocation + search
  }

  /// Owner 24 Oct evening: cab pickup/drop get the SAME full-screen granular
  /// picker (grocery concept). Pickup also updates the user location context
  /// (exact coordinates ride on every live search), mirroring _pickOnMap.
  Future<void> _openCabSpotSheet(bool pickup) async {
    final spot = await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => AddressPickerScreen(
          title: pickup ? 'Pickup Location' : 'Drop Destination',
          initialQuery: (pickup ? _from : _to).text,
        ),
      ),
    );
    if (spot == null || spot is! Map<String, dynamic> || !mounted) return;
    final label = (spot['address'] ?? spot['label'] ?? '').toString();
    if (label.isEmpty) return;
    if (pickup) {
      setState(() => _from.text = label);
      final lat = (spot['lat'] as num?)?.toDouble();
      final lng = (spot['lng'] as num?)?.toDouble();
      final city = (spot['city'] as String?)?.isNotEmpty == true ? spot['city'] as String : _state.city;
      final pin = (spot['pincode'] as String?)?.isNotEmpty == true ? spot['pincode'] as String : _state.pincode;
      await _state.setLocation(city, pin, lat: lat, lng: lng);
      if (mounted) toast(context, 'Pickup set: $label');
    } else {
      setState(() => _to.text = label);
    }
    if (mounted) await _runSearch(force: true);
  }
}

// ---------------------------------------------------------------------------
// Full-screen City Picker for Cab / Bus
// ---------------------------------------------------------------------------

class _CityPickerScreen extends StatefulWidget {
  const _CityPickerScreen({required this.title, this.busMode = false});
  final String title;
  final bool busMode;

  @override
  State<_CityPickerScreen> createState() => _CityPickerScreenState();
}

/// Row model for the picker: either a city/area suggestion or a section header.
class _PickerRow {
  final String text, subtext, badge;
  final bool isHeader;
  const _PickerRow(this.text, this.subtext, this.badge, {this.isHeader = false});
}

class _CityPickerScreenState extends State<_CityPickerScreen> {
  final _c = TextEditingController();
  List<CitySuggestion> _filtered = kAutoCities;
  List<_PickerRow> _busRows = const [];
  Timer? _debounce;
  bool _gpsBusy = false;
  String? _gpsAddress;

  @override
  void initState() {
    super.initState();
    _c.addListener(_onSearch);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _c.removeListener(_onSearch);
    _c.dispose();
    super.dispose();
  }

  /// Owner 23 Oct (web parity): one-tap GPS auto-detect for the city picker.
  /// GPS fix -> /api/geo/reverse for the real place name; falls back to the
  /// nearest supported city from kCityCoords (the same registry the cab
  /// location picker uses). Never invents a place.
  Future<void> _detectLocation() async {
    if (_gpsBusy) return;
    setState(() => _gpsBusy = true);
    try {
      bool enabled = await Geolocator.isLocationServiceEnabled();
      if (!enabled) {
        if (mounted) toast(context, 'Location services are disabled', error: true);
        return;
      }
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          if (mounted) toast(context, 'Location permission denied', error: true);
          return;
        }
      }
      if (permission == LocationPermission.deniedForever) {
        if (mounted) toast(context, 'Location permission permanently denied', error: true);
        return;
      }
      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.low,
        timeLimit: const Duration(seconds: 8),
      );
      // Real place name from the server's reverse-geocode (never invented).
      String? detected;
      try {
        final place = await AppState.instance.api
            .geoReverse(pos.latitude, pos.longitude);
        final city = (place?['city'] ?? place?['name'] ?? '') as String;
        if (city.isNotEmpty) {
          detected = kAutoCities
              .map((c) => c.text)
              .firstWhere((t) => t.toLowerCase().contains(city.toLowerCase()), orElse: () => '');
        }
      } catch (_) {/* offline reverse-geocode -> nearest-city fallback below */}
      if ((detected ?? '').isEmpty) {
        String? nearestCity;
        double minDistance = double.infinity;
        for (final entry in kCityCoords.entries) {
          final dist = Geolocator.distanceBetween(
            pos.latitude, pos.longitude, entry.value['lat']!, entry.value['lng']!,
          );
          if (dist < minDistance) {
            minDistance = dist;
            nearestCity = entry.key;
          }
        }
        if (nearestCity != null && minDistance <= 150000) {
          detected = kAutoCities
              .map((c) => c.text)
              .firstWhere((t) => t.toLowerCase().contains(nearestCity!.toLowerCase()), orElse: () => nearestCity!);
        }
      }
      if (!mounted) return;
      if ((detected ?? '').isNotEmpty) {
        setState(() => _gpsAddress = detected);
        Navigator.pop(context, detected);
      } else {
        toast(context, 'Could not detect a supported city here', error: true);
      }
    } catch (e) {
      if (mounted) toast(context, 'Could not detect location: $e', error: true);
    } finally {
      if (mounted) setState(() => _gpsBusy = false);
    }
  }

  void _onSearch() {
    final q = _c.text.trim();
    if (!widget.busMode) {
      final lq = q.toLowerCase();
      setState(() {
        if (lq.isEmpty) {
          _filtered = kAutoCities;
        } else {
          _filtered = kAutoCities.where((c) {
            return c.text.toLowerCase().contains(lq) ||
                c.subtext.toLowerCase().contains(lq) ||
                c.badge.toLowerCase().contains(lq);
          }).toList();
        }
      });
      return;
    }
    // Bus mode: live redBus registry (tier-1/2/3 towns + boarding points)
    _debounce?.cancel();
    if (q.length < 2) {
      setState(() => _busRows = const []);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 300), _fetchBusLocations);
  }

  Future<void> _fetchBusLocations() async {
    final q = _c.text.trim();
    if (q.length < 2) return;
    try {
      final data = await AppState.instance.api
          .getJson('/api/bus/locations?q=${Uri.encodeComponent(q)}');
      final locs = (data['locations'] as List?) ?? const [];
      final rows = <_PickerRow>[];
      for (final raw in locs) {
        final l = raw as Map<String, dynamic>;
        final name = (l['name'] ?? '') as String;
        if (l['type'] == 'CITY') {
          rows.add(_PickerRow(
            name,
            ((l['region'] ?? '') as String).isNotEmpty ? (l['region'] as String) : (l['parentName'] ?? '') as String,
            'City',
          ));
          // Popular boarding points of this city — same registry the redBus app shows
          final bps = (l['boardingPoints'] as List?) ?? const [];
          if (name.toLowerCase().contains(q.toLowerCase()) && bps.isNotEmpty) {
            rows.add(_PickerRow('Popular Boarding Points near you · $name', '', '', isHeader: true));
            for (final bp in bps) {
              final b = bp as Map<String, dynamic>;
              rows.add(_PickerRow((b['name'] ?? '') as String, (b['parentName'] ?? '') as String, 'Board at'));
            }
          }
        } else {
          rows.add(_PickerRow(
            name,
            ((l['parentName'] ?? '') as String).isNotEmpty ? 'Area in ${l['parentName']}' : 'Boarding area',
            'Board at',
          ));
        }
      }
      if (mounted) setState(() => _busRows = rows);
    } catch (_) {
      // network/API failure -> fall back to the static city list below
      if (mounted) setState(() => _busRows = const []);
    }
  }

  /// Bus-mode list: live redBus rows with 'Board at' pills + section headers;
  /// static city list as fallback when the registry call returned nothing.
  Widget _buildBusRows() {
    final rows = _busRows.isNotEmpty
        ? _busRows
        : _filtered
            .map((c) => _PickerRow(c.text, c.subtext, c.badge))
            .toList(growable: false);
    return ListView.separated(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: rows.length,
      separatorBuilder: (_, __) => Divider(height: 1, color: border(context)),
      itemBuilder: (c, i) {
        final r = rows[i];
        if (r.isHeader) {
          return Padding(
            padding: const EdgeInsets.fromLTRB(8, 14, 8, 6),
            child: Text(r.text, style: tx(c, 10.5, w: FontWeight.w900, color: T1SColors.red)),
          );
        }
        return ListTile(
          contentPadding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
          title: Text(r.text, style: tx(c, 13.5, w: FontWeight.w800)),
          subtitle: r.subtext.isNotEmpty ? Text(r.subtext, style: tx(c, 11, color: muted(c))) : null,
          trailing: r.badge.isNotEmpty
              ? Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: isDark(c) ? T1SColors.slate800 : T1SColors.slate50,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: border(c)),
                  ),
                  child: Text(r.badge, style: tx(c, 10, w: FontWeight.w800, color: muted(c))),
                )
              : null,
          onTap: () => Navigator.pop(c, r.text),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: surface(context),
      appBar: AppBar(
        backgroundColor: surface(context),
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.close_rounded, color: ink(context)),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(widget.title, style: tx(context, 16, w: FontWeight.w900)),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: TextField(
                controller: _c,
                autofocus: true,
                decoration: InputDecoration(
                  hintText: 'Search city or locality',
                  prefixIcon: const Icon(Icons.search_rounded, size: 20),
                  filled: true,
                  fillColor: isDark(context) ? T1SColors.slate800 : T1SColors.slate50,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: border(context)),
                  ),
                ),
                style: tx(context, 13.5, w: FontWeight.w700),
              ),
            ),
            Expanded(
              child: widget.busMode
                  ? _buildBusRows()
                  : ListView.separated(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: _filtered.length + 1, // +1: the GPS auto-detect row on top
                      separatorBuilder: (_, __) => Divider(height: 1, color: border(context)),
                      itemBuilder: (c, i) {
                        // Owner 23 Oct (web parity): 'Use Exact Current Location (GPS)'
                        // mint row — GPS probe + /api/geo/reverse, then Auto-Fill the field.
                        if (i == 0) {
                          return _GpsRow(
                            busy: _gpsBusy,
                            address: _gpsAddress,
                            onTap: _detectLocation,
                          );
                        }
                        final item = _filtered[i - 1];
                        return ListTile(
                          contentPadding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
                          leading: Icon(item.icon, size: 18, color: T1SColors.red),
                          title: Text(item.text, style: tx(c, 13.5, w: FontWeight.w800)),
                          subtitle: item.subtext.isNotEmpty
                              ? Text(item.subtext, maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(c, 10.5, color: muted(c)))
                              : null,
                          trailing: item.badge.isNotEmpty
                              ? Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    // Owner 23 Oct reference: capital-class badges orange,
                                    // every other badge gray-blue.
                                    color: kCapitalBadges.contains(item.badge)
                                        ? const Color(0xFFFFE0B2)
                                        : (isDark(c) ? T1SColors.slate800 : const Color(0xFFECEFF1)),
                                    borderRadius: BorderRadius.circular(999),
                                    border: Border.all(
                                      color: kCapitalBadges.contains(item.badge)
                                          ? const Color(0xFFF5CBA7)
                                          : border(c),
                                    ),
                                  ),
                                  child: Text(
                                    item.badge,
                                    style: tx(
                                      c, 10, w: FontWeight.w800,
                                      color: kCapitalBadges.contains(item.badge) ? const Color(0xFFCC5500) : muted(c),
                                    ),
                                  ),
                                )
                              : null,
                          onTap: () => Navigator.pop(c, item.text),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Vertical tabs
// ---------------------------------------------------------------------------

class _VerticalTabs extends StatelessWidget {
  const _VerticalTabs({required this.current, required this.onPick});
  final String current;
  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: isDark(context) ? T1SColors.slate900 : Colors.white,
        border: Border(bottom: BorderSide(color: border(context))),
      ),
      child: SizedBox(
        height: 52,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          itemCount: kVerticals.length,
          separatorBuilder: (_, __) => const SizedBox(width: 8),
          itemBuilder: (c, i) {
            final v = kVerticals[i];
            final active = v.id == current;
            final color = active ? T1SColors.red : muted(context);
            return GestureDetector(
              onTap: () => onPick(v.id),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                decoration: BoxDecoration(
                  color: active ? T1SColors.red50 : (isDark(context) ? T1SColors.slate800 : T1SColors.slate50),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: active ? T1SColors.red200 : border(context)),
                ),
                child: Row(children: [
                  Icon(v.icon, size: 15, color: active ? T1SColors.red : muted(context)),
                  const SizedBox(width: 6),
                  Text(v.name, style: tx(c, 11.5, w: FontWeight.w800, color: color)),
                ]),
              ),
            );
          },
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Search card per vertical
// ---------------------------------------------------------------------------

/// Test seam: lets widget tests render the real search card at a phone width.
@visibleForTesting
Widget buildSearchCardForTest({
  required VerticalMeta meta,
  required TextEditingController from,
  required TextEditingController to,
}) =>
    _SearchCard(
      onSwap: () {},
      meta: meta,
      q: TextEditingController(),
      from: from,
      to: to,
      date: DateTime(2026, 10, 23),
      checkOutDate: DateTime(2026, 10, 24),
      hotelGuests: '2 Guests',
      city: 'Indore',
      onPickDate: () {},
      onSearch: () {},
      onPickCity: () {},
      onUseCurrentLocationForCab: () {},
      onOpenCityPicker: (_, __) {},
      onPickOnMap: (_) {},
      onOpenPlacePicker: (_) {},
      onOpenHotelPicker: () {},
      onPickHotelDates: () {},
    );

class _SearchCard extends StatelessWidget {
  const _SearchCard({
    required this.onSwap,
    required this.meta,
    required this.q,
    required this.from,
    required this.to,
    required this.date,
    required this.checkOutDate,
    required this.hotelGuests,
    required this.city,
    required this.onPickDate,
    required this.onPickHotelDates,
    required this.onSearch,
    required this.onPickCity,
    required this.onUseCurrentLocationForCab,
    required this.onOpenCityPicker,
    required this.onPickOnMap,
    required this.onOpenPlacePicker,
    required this.onOpenHotelPicker,
    this.foodAddr,
    this.onPickFoodAddress,
    this.onPickFoodAddressSheet,
    this.onOpenCabSpotPicker,
    this.accountType = 'Savings',
    this.onAccountType,
  });

  final VoidCallback onSwap;
  final VerticalMeta meta;
  final TextEditingController q;
  final TextEditingController from;
  final TextEditingController to;
  final DateTime date;
  final DateTime checkOutDate;
  final String hotelGuests;
  final String city;
  final VoidCallback onPickDate;
  final VoidCallback onPickHotelDates;
  final VoidCallback onSearch;
  final VoidCallback onPickCity;
  final VoidCallback onUseCurrentLocationForCab;
  final Function(TextEditingController, String) onOpenCityPicker;
  final Function(bool) onPickOnMap; // Uber-style map pin: true = pickup, false = drop
  final Function(bool) onOpenPlacePicker;
  final VoidCallback onOpenHotelPicker;
  final TextEditingController? foodAddr;
  final void Function(Map<String, dynamic>)? onPickFoodAddress;
  final VoidCallback? onPickFoodAddressSheet;
  final Function(bool)? onOpenCabSpotPicker;
  final String accountType;
  final void Function(String)? onAccountType;

  @override
  Widget build(BuildContext context) {
    final presets = kAutoCategories[meta.id] ?? const <String>[];

    Widget body;
    switch (meta.kind) {
      case SearchKind.cab:
        // Owner 22 Oct: the old side-by-side layout crammed both fields into
        // half the phone width ("Inc"/"Bh" were clipped "Indore"/"Bhopal") and
        // typing felt impossible. Uber-style stack: each field gets the FULL
        // row width, big text, clear button and map pin.
        Widget mapPin(bool pickup) => InkWell(
              onTap: () => onPickOnMap(pickup),
              borderRadius: BorderRadius.circular(8),
              child: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: isDark(context) ? T1SColors.slate800 : T1SColors.slate50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: border(context)),
                ),
                child: Icon(Icons.map_outlined, size: 18, color: T1SColors.red),
              ),
            );
        body = Column(
          children: [
            LocationHintField(
              controller: from,
              label: 'Pickup Location',
              placeholder: 'Enter pickup point (e.g. Chappan Dukan, Indore)...',
              mode: 'pickup',
              large: true,
              onSelect: (_, __) => onSearch(),
              onSubmitted: (_) => onSearch(),
              trailing: mapPin(true),
              // Owner 24 Oct evening: tap opens the full-screen granular picker
              // (same concept as the 10-min grocery location input).
              onFieldTap: onOpenCabSpotPicker != null ? () => onOpenCabSpotPicker!(true) : null,
            ),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 2, horizontal: 4),
              child: Row(
                children: [
                  // Connector line between the pickup and drop dots (Uber-style).
                  Container(width: 2, height: 14, color: border(context).withValues(alpha: 0.7)),
                  const Spacer(),
                  GestureDetector(
                    onTap: onSwap,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                      decoration: BoxDecoration(
                        color: isDark(context) ? T1SColors.slate800 : T1SColors.slate50,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: border(context)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.swap_vert_rounded, size: 14, color: muted(context)),
                          const SizedBox(width: 3),
                          Text('Swap', style: tx(context, 9.5, w: FontWeight.w800, color: muted(context))),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            LocationHintField(
              controller: to,
              label: 'Drop Destination',
              placeholder: 'Enter drop destination (e.g. Martand Chowk, Bhopal)...',
              mode: 'drop',
              large: true,
              onSelect: (_, __) => onSearch(),
              onSubmitted: (_) => onSearch(),
              trailing: mapPin(false),
              // Owner 24 Oct evening: tap opens the full-screen granular picker.
              onFieldTap: onOpenCabSpotPicker != null ? () => onOpenCabSpotPicker!(false) : null,
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(child: _DateChip(date: date, onTap: onPickDate)),
                const SizedBox(width: 8),
                Expanded(
                  child: InkWell(
                    onTap: onUseCurrentLocationForCab,
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      height: 40,
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      decoration: BoxDecoration(
                        color: T1SColors.red.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: T1SColors.red.withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.my_location_rounded, size: 14, color: T1SColors.red),
                          const SizedBox(width: 4),
                          Flexible(
                            child: Text(
                              'Use current location',
                              style: tx(context, 10.5, w: FontWeight.w800, color: T1SColors.red),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        );

      case SearchKind.route:
      case SearchKind.dateRoute:
        if (meta.id == 'flights') {
          // Owner 22 Oct: hints MANDATORY on every vertical — From/To are now
          // inline typeaheads (reference dropdown: city list + badges + keyboard
          // nav), with the full-screen airport picker still one tap away.
          Widget browseBtn(VoidCallback onTap) => Padding(
                padding: const EdgeInsets.only(right: 2),
                child: IconButton(
                  onPressed: onTap,
                  icon: Icon(Icons.expand_more_rounded, size: 18, color: muted(context)),
                  tooltip: 'Browse all airports',
                ),
              );
          body = Column(
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: HintField(
                      controller: from,
                      hint: 'From City / Airport',
                      source: HintSource.cities,
                      headerText: 'FLIGHT CITIES & AIRPORTS',
                      icon: Icons.flight_takeoff_outlined,
                      onSelect: (_) => onSearch(),
                      onSubmitted: (_) => onSearch(),
                      trailing: browseBtn(() => onOpenPlacePicker(true)),
                      // Owner 23 Oct (images 3/4): tap opens the full-screen
                      // location picker (search + GPS + airport list inside).
                      onFieldTap: () => onOpenPlacePicker(true),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: GestureDetector(
                      onTap: onSwap,
                      child: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: isDark(context) ? T1SColors.slate800 : T1SColors.slate50,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: border(context)),
                        ),
                        child: Icon(Icons.swap_horiz_rounded, size: 18, color: muted(context)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: HintField(
                      controller: to,
                      hint: 'To City / Airport',
                      source: HintSource.cities,
                      headerText: 'FLIGHT CITIES & AIRPORTS',
                      icon: Icons.flight_land_outlined,
                      onSelect: (_) => onSearch(),
                      onSubmitted: (_) => onSearch(),
                      trailing: browseBtn(() => onOpenPlacePicker(false)),
                      // Owner 23 Oct (images 3/4): tap opens the full-screen
                      // location picker.
                      onFieldTap: () => onOpenPlacePicker(false),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(child: _DateChip(date: date, onTap: onPickDate)),
                  const SizedBox(width: 8),
                  Expanded(child: _CityChip(city: city, onTap: onPickCity)),
                ],
              ),
            ],
          );
        } else {
          // Bus
          // Owner 22 Oct: hints MANDATORY — inline LIVE redBus typeahead
          // (tier-1/2/3 towns + boarding points, same registry as the site).
          Widget browseBtnBus(VoidCallback onTap) => Padding(
                padding: const EdgeInsets.only(right: 2),
                child: IconButton(
                  onPressed: onTap,
                  icon: Icon(Icons.expand_more_rounded, size: 18, color: muted(context)),
                  tooltip: 'Browse all cities',
                ),
              );
          body = Column(
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: HintField(
                      controller: from,
                      hint: 'From City / Town',
                      source: HintSource.bus,
                      headerText: 'LIVE BUS CITIES • TOWNS & BOARDING POINTS',
                      icon: Icons.directions_bus_outlined,
                      onSelect: (_) => onSearch(),
                      onSubmitted: (_) => onSearch(),
                      trailing: browseBtnBus(() => onOpenCityPicker(from, 'Select From City / Town / Boarding Point')),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: GestureDetector(
                      onTap: onSwap,
                      child: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: isDark(context) ? T1SColors.slate800 : T1SColors.slate50,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: border(context)),
                        ),
                        child: Icon(Icons.swap_horiz_rounded, size: 18, color: muted(context)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: HintField(
                      controller: to,
                      hint: 'To City / Town',
                      source: HintSource.bus,
                      headerText: 'LIVE BUS CITIES • TOWNS & BOARDING POINTS',
                      icon: Icons.location_on_outlined,
                      onSelect: (_) => onSearch(),
                      onSubmitted: (_) => onSearch(),
                      trailing: browseBtnBus(() => onOpenCityPicker(to, 'Select To City / Town')),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(child: _DateChip(date: date, onTap: onPickDate)),
                  const SizedBox(width: 8),
                  Expanded(child: _CityChip(city: city, onTap: onPickCity)),
                ],
              ),
            ],
          );
        }

      case SearchKind.hotel:
        // Owner 22 Oct: hints MANDATORY — the hotel field is now an inline
        // LIVE typeahead (destinations + real properties via /api/hotels/locations,
        // reference image: icon + bold name + grey line + Destination/Hotel badge),
        // with check-in/check-out chips opening the site's range date modal.
        // The full picker (guests/rooms, popular destinations) stays one tap away.
        body = Column(
          children: [
            HintField(
              controller: to,
              hint: 'City, resort or landmark',
              source: HintSource.hotels,
              headerText: 'LIVE HOTELS • DESTINATIONS & PROPERTIES',
              icon: Icons.search_rounded,
              onSelect: (_) => onSearch(),
              onSubmitted: (_) => onSearch(),
              // Owner 23 Oct (images 3/4): tap opens the full-screen hotel
              // picker (search + popular destinations inside).
              onFieldTap: onOpenHotelPicker,
              trailing: IconButton(
                onPressed: onOpenHotelPicker,
                icon: Icon(Icons.manage_search_rounded, size: 18, color: muted(context)),
                tooltip: 'Guests, rooms & popular destinations',
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(child: _DateChip(date: date, onTap: onPickHotelDates, label: 'Check-in')),
                const SizedBox(width: 8),
                Expanded(child: _DateChip(date: checkOutDate, onTap: onPickHotelDates, label: 'Check-out')),
                const SizedBox(width: 8),
                Expanded(
                  child: InkWell(
                    onTap: onOpenHotelPicker,
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      height: 40,
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      decoration: BoxDecoration(
                        color: isDark(context) ? T1SColors.slate800 : T1SColors.slate50,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: border(context)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.people_outline_rounded, size: 14, color: muted(context)),
                          const SizedBox(width: 4),
                          Flexible(
                            child: Text(
                              hotelGuests,
                              style: tx(context, 10.5, w: FontWeight.w800),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        );

      case SearchKind.account:
        // Mirror of the web Accounts header (21 Oct): account-type chips +
        // bank-name search. The q controller holds the BANK name; the query
        // composed for the server is "<bank> <type> account" (blank bank =
        // compare every bank).
        body = Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Text('Account Type:', style: tx(context, 10, w: FontWeight.w900, color: T1SColors.red)),
                const SizedBox(width: 6),
                for (final t in const ['Savings', 'Current', 'Demat'])
                  Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: GestureDetector(
                      onTap: () => onAccountType?.call(t),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: accountType == t ? T1SColors.red : (isDark(context) ? T1SColors.slate800 : T1SColors.slate50),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: accountType == t ? T1SColors.red : border(context)),
                        ),
                        child: Text(
                          t,
                          style: tx(context, 10, w: FontWeight.w900,
                              color: accountType == t ? Colors.white : ink(context)),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              'Search a bank to see only its accounts — leave blank to compare every bank.',
              style: tx(context, 9, color: muted(context)),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TypeaheadField(
                    controller: q,
                    hint: 'Search bank (e.g. SBI, HDFC, Kotak, Zerodha...)',
                    cities: false,
                    presets: presets,
                    icon: Icons.search,
                    onSubmitted: (_) => onSearch(),
                  ),
                ),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: onSearch,
                  child: Container(
                    height: 44,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    decoration: BoxDecoration(color: T1SColors.red, borderRadius: BorderRadius.circular(10)),
                    alignment: Alignment.center,
                    child: Text('Compare', style: tx(context, 12, w: FontWeight.w900, color: Colors.white)),
                  ),
                ),
              ],
            ),
          ],
        );

      case SearchKind.movie:
        body = Column(
          children: [
            Row(
              children: [
                Expanded(
                  child: TypeaheadField(
                    controller: q,
                    hint: 'Movie or cinema name',
                    cities: false,
                    presets: presets,
                    icon: Icons.search,
                    onSubmitted: (_) => onSearch(),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(child: _DateChip(date: date, onTap: onPickDate, label: 'Show date')),
                const SizedBox(width: 8),
                Expanded(child: _CityChip(city: city, onTap: onPickCity)),
              ],
            ),
          ],
        );

      default:
        body = Column(
          children: [
            Row(
              children: [
                Expanded(
                  child: TypeaheadField(
                    controller: q,
                    hint: meta.placeholder,
                    cities: false,
                    presets: presets,
                    icon: Icons.search,
                    onSubmitted: (_) => onSearch(),
                  ),
                ),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: onSearch,
                  child: Container(
                    height: 44,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    decoration: BoxDecoration(color: T1SColors.red, borderRadius: BorderRadius.circular(10)),
                    alignment: Alignment.center,
                    child: Text('Search', style: tx(context, 12, w: FontWeight.w900, color: Colors.white)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (meta.id == 'food' && foodAddr != null && onPickFoodAddress != null)
              LocationHintField(
                controller: foodAddr!,
                label: 'Delivery address',
                placeholder: 'Search delivery address...',
                mode: 'pickup',
                onSelect: (_, place) => onPickFoodAddress!(place),
                // Owner 24 Oct evening: tap opens the full-screen granular
                // picker (grocery concept) instead of inline typing.
                onFieldTap: onPickFoodAddressSheet,
              )
            else
              Row(children: [Expanded(child: _CityChip(city: city, onTap: onPickCity))]),
          ],
        );
    }

    // WEB-PARITY SURFACES (21 Oct owner report): every vertical on the website
    // has its own distinctive full-width colored search bar (hotels #003580,
    // bus #d84e55, food #fc8019, grocery emerald/teal, cab slate-950, ecommerce
    // #232f3e, movie #333545, loans indigo-950, insurance #0f3d64, account
    // red-950, creditcards rose-950). The app used to show one plain white
    // card for all 13 — this map mirrors the web surface per vertical.
    final surface = T1SSearchSurface.of(meta.id);
    final dark = surface.dark;
    final accent = Color(surface.accent);

    Widget content = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Icon(meta.icon, size: 14, color: dark ? Colors.white : T1SColors.red),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                meta.name.toUpperCase(),
                style: tx(context, 11, w: FontWeight.w900, ls: 0.7, color: dark ? Colors.white : null),
              ),
            ),
            Text(
              meta.tagline,
              style: tx(context, 9.5, w: FontWeight.w700, color: dark ? accent : muted(context)),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
        const SizedBox(height: 10),
        body,
        if (meta.kind != SearchKind.text) ...[
          const SizedBox(height: 10),
          RedButton('Search', onTap: onSearch, icon: Icons.search_rounded, expand: true),
        ],
        if (meta.samples.isNotEmpty) ...[
          const SizedBox(height: 10),
          SizedBox(
            height: 26,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: meta.samples.length,
              separatorBuilder: (_, __) => const SizedBox(width: 6),
              itemBuilder: (c, i) => GestureDetector(
                onTap: () {
                  q.text = meta.samples[i];
                  onSearch();
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                  decoration: BoxDecoration(
                    // White pill on a colored surface, exactly like the web's sample chips.
                    color: surface.dark ? Colors.white : T1SColors.slate50,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: surface.dark ? Colors.white.withValues(alpha: 0.2) : border(context)),
                  ),
                  child: Text(
                    meta.samples[i],
                    style: tx(c, 9.5, w: FontWeight.w700, color: surface.dark ? Colors.black87 : muted(context)),
                  ),
                ),
              ),
            ),
          ),
        ],
      ],
    );

    // The inner form widgets pick their colors from the theme brightness: force
    // the light palette so fields render as white/slate pills with dark text —
    // the exact look the website uses on its colored search surfaces — in both
    // app light and dark modes.
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Color(surface.bg),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.12), blurRadius: 12, offset: const Offset(0, 4))],
      ),
      child: Theme(data: Theme.of(context).copyWith(brightness: Brightness.light), child: content),
    );
  }
}

class _DateChip extends StatelessWidget {
  const _DateChip({required this.date, required this.onTap, this.label = 'Date'});
  final DateTime date;
  final VoidCallback onTap;
  final String label;

  @override
  Widget build(BuildContext context) {
    final d = '${date.day}/${date.month}';
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 40,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(
          color: isDark(context) ? T1SColors.slate800 : T1SColors.slate50,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: border(context)),
        ),
        child: Row(
          children: [
            const Icon(Icons.calendar_today_rounded, size: 14, color: T1SColors.red),
            const SizedBox(width: 8),
            Text('$label $d', style: tx(context, 11.5, w: FontWeight.w800), overflow: TextOverflow.ellipsis),
          ],
        ),
      ),
    );
  }
}

class _CityChip extends StatelessWidget {
  const _CityChip({required this.city, required this.onTap});
  final String city;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 40,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(
          color: isDark(context) ? T1SColors.slate800 : T1SColors.slate50,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: border(context)),
        ),
        child: Row(
          children: [
            const Icon(Icons.location_on_outlined, size: 14, color: T1SColors.red),
            const SizedBox(width: 8),
            Expanded(child: Text(city, style: tx(context, 11.5, w: FontWeight.w800), overflow: TextOverflow.ellipsis)),
            const Icon(Icons.expand_more_rounded, size: 15, color: T1SColors.slate400),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Status strip + sort
// ---------------------------------------------------------------------------

class _StatusStrip extends StatelessWidget {
  const _StatusStrip({required this.res, required this.loading, required this.error, required this.onRetry});
  final LiveResponse? res;
  final bool loading;
  final String? error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    // OWNER 28 Oct: the cream/amber "Please wait … Comparing live prices across
    // the web…" strip (and the duplicate initial-load strip above it) are REMOVED
    // from every vertical. The red SearchProgress panel is the one and only loading
    // indicator now, so no second banner repeats the same sentence above the feed.
    // Nothing is lost: errors still get their retry strip and, once prices are on
    // screen, the live-verified summary strip below still renders.
    if (loading || (res?.pendingRefresh ?? false)) return const SizedBox.shrink();
    if (error != null) {
      return Box(
        padding: const EdgeInsets.all(12),
        radius: 16,
        borderColor: T1SColors.red200,
        color: isDark(context) ? T1SColors.slate900 : T1SColors.red50,
        child: Row(children: [
          const Icon(Icons.wifi_off_rounded, size: 16, color: T1SColors.red),
          const SizedBox(width: 8),
          Expanded(child: Text(error!, style: tx(context, 11.5, color: T1SColors.red))),
          TextButton(onPressed: onRetry, child: Text('Retry', style: tx(context, 11.5, w: FontWeight.w800, color: T1SColors.red))),
        ]),
      );
    }
    final r = res;
    if (r == null) return const SizedBox.shrink();
    final ok = r.succeeded.length;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: isDark(context) ? T1SColors.slate900 : Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: border(context)),
      ),
      child: Row(children: [
        Icon(ok > 0 ? Icons.verified_rounded : Icons.info_outline_rounded, size: 14, color: ok > 0 ? T1SColors.emerald600 : T1SColors.slate400),
        const SizedBox(width: 7),
        Expanded(
          child: Text(
            ok > 0 ? '${r.items.length} live offers · $ok source${ok == 1 ? '' : 's'} verified · ${(r.latencyMs / 1000).toStringAsFixed(1)}s' : 'Sources attempted but no live data right now.',
            style: tx(context, 10.5, w: FontWeight.w700, color: muted(context)),
          ),
        ),
        if (loading) const SizedBox(width: 12, height: 12, child: CircularProgressIndicator(strokeWidth: 2, color: T1SColors.red)),
      ]),
    );
  }
}

/// Load More (owner 22 Oct, web parity): full-width white pill revealing the
/// next 4 result groups — mirrors the site's 'Load More Results in X'
/// button, shown only when 4+ groups are already visible and more remain.
class _LoadMoreButton extends StatelessWidget {
  const _LoadMoreButton({required this.remaining, required this.noun, this.onTap});
  final int remaining;
  final String noun;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 13),
        decoration: BoxDecoration(
          color: isDark(context) ? T1SColors.slate900 : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: isDark(context) ? T1SColors.slate700 : T1SColors.slate200),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.search_rounded, size: 15, color: T1SColors.red),
            const SizedBox(width: 8),
            Text(
              'Load More Results ($remaining more $noun available)',
              style: tx(context, 11.5, w: FontWeight.w800, color: muted(context)),
            ),
            const SizedBox(width: 7),
            Icon(Icons.keyboard_arrow_down_rounded, size: 16, color: muted(context)),
          ],
        ),
      ),
    );
  }
}

class _SortBar extends StatelessWidget {
  const _SortBar({required this.sort, required this.onSort});
  final cmp.SortMode sort;
  final ValueChanged<cmp.SortMode> onSort;

  @override
  Widget build(BuildContext context) {
    const tabs = [cmp.SortMode.best, cmp.SortMode.cheapest, cmp.SortMode.highestRated];
    const labels = ['Best value', 'Cheapest', 'Highest rated'];
    return Row(children: [
      for (var i = 0; i < tabs.length; i++) ...[
        GestureDetector(
          onTap: () => onSort(tabs[i]),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
            decoration: BoxDecoration(
              color: sort == tabs[i] ? T1SColors.red : (isDark(context) ? T1SColors.slate800 : T1SColors.slate50),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: sort == tabs[i] ? T1SColors.red : border(context)),
            ),
            child: Text(labels[i], style: tx(context, 10.5, w: FontWeight.w800, color: sort == tabs[i] ? Colors.white : muted(context))),
          ),
        ),
        const SizedBox(width: 6),
      ],
    ]);
  }
}

/// SearchProgress (owner 27 Oct, replacing the 3-2-1 countdown): the one
/// loading experience for every vertical in the app.
///
/// Real progress instead of a number ticking down — the vertical's own heading,
/// a green-dot pill naming the source being queried right now, a hard
/// "7 of 9 stores" count, an advancing bar and result-shaped skeleton cards.
/// The copy the owner asked to keep ("please wait, we are getting the best deal
/// for you", "comparing prices across the web at warp speed ... your ultimate
/// steal") sits under the bar. Stays up for the whole acquisition and is
/// replaced the moment real rows land.
class _WarpLoader extends StatelessWidget {
  const _WarpLoader({super.key, this.verticalId});
  final String? verticalId;
  // OWNER 28 Oct: one shared panel now serves the feed AND the product page
  // (web does the same), so the app can never drift from the site again.
  @override
  Widget build(BuildContext context) => SearchProgressCard(verticalId: verticalId);
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.onSearch});
  final VoidCallback onSearch;
  @override
  Widget build(BuildContext context) {
    return Box(
      padding: const EdgeInsets.all(22),
      radius: 16,
      child: Column(children: [
        const Icon(Icons.travel_explore_rounded, size: 34, color: T1SColors.slate300),
        const SizedBox(height: 12),
        Text('No matching options found', style: tx(context, 14, w: FontWeight.w900)),
        const SizedBox(height: 6),
        Text('Try the search above — the engine scans live sources for the exact thing you typed.',
            textAlign: TextAlign.center, style: tx(context, 11.5, color: muted(context), h: 1.4)),
        const SizedBox(height: 12),
        RedButton('Scan again', onTap: onSearch, dense: true),
      ]),
    );
  }
}

// ---------------------------------------------------------------------------
// Feed body: groups per vertical + filter application
// ---------------------------------------------------------------------------

/// SPEED (22 Oct): emits the result cards as a plain List so the outer
/// ListView.builder can build them lazily on scroll (was an eager Column
/// that built every image card in one frame).
class _FeedBody {
  const _FeedBody({
    required this.meta,
    required this.res,
    required this.sort,
    required this.filterOpts,
    this.visibleCount = 1000000,
    this.onLoadMore,
  });

  final VerticalMeta meta;
  final LiveResponse res;
  final cmp.SortMode sort;
  final FilterOptions filterOpts;
  final int visibleCount;
  final VoidCallback? onLoadMore;

  int? _parseHour(String depTime) {
    final match = RegExp(r'(\d{1,2}):(\d{2})').firstMatch(depTime);
    if (match != null) {
      return int.tryParse(match.group(1)!);
    }
    return null;
  }

  List<Widget> cards(BuildContext context) {
    var items = res.items;

    // Apply FilterOptions
    items = items.where((it) {
      final price = it.bestQuote?.price ?? 0;
      if (filterOpts.minPrice != null && price < filterOpts.minPrice!) return false;
      if (filterOpts.maxPrice != null && price > filterOpts.maxPrice!) return false;

      if (filterOpts.selectedSellers.isNotEmpty) {
        final hasSeller = it.sellerQuotes.any((q) => filterOpts.selectedSellers.contains(q.sellerName)) ||
            filterOpts.selectedSellers.contains(it.provider);
        if (!hasSeller) return false;
      }

      if (meta.id == 'food' && filterOpts.vegOnly) {
        final isVeg = it.spec('is_veg') == 'true' ||
            it.spec('veg') == 'true' ||
            (it.title.toLowerCase().contains('veg') && !it.title.toLowerCase().contains('non-veg'));
        if (!isVeg) return false;
      }

      if (meta.id == 'bus' && filterOpts.busFacets.isNotEmpty) {
        for (final f in filterOpts.busFacets) {
          if (!busFacetMatch(f, it)) return false;
        }
      }
      if (meta.id == 'bus' && filterOpts.busBoardingPoint != null) {
        if (it.spec('boarding point') != filterOpts.busBoardingPoint) return false;
      }

      if ((meta.id == 'flights' || meta.id == 'bus') && filterOpts.departureBuckets.isNotEmpty) {
        final depTime = it.spec('departure time').isNotEmpty ? it.spec('departure time') : it.spec('departure_time');
        final hour = _parseHour(depTime);
        if (hour != null) {
          String bucket = 'Night (00-06)';
          if (hour >= 6 && hour < 12) {
            bucket = 'Morning (06-12)';
          } else if (hour >= 12 && hour < 18) {
            bucket = 'Afternoon (12-18)';
          } else if (hour >= 18 && hour < 24) {
            bucket = 'Evening (18-24)';
          }

          if (!filterOpts.departureBuckets.contains(bucket)) return false;
        }
      }

      if (meta.id == 'hotels' && filterOpts.starRatings.isNotEmpty) {
        final starsStr = it.spec('stars').isNotEmpty ? it.spec('stars') : it.spec('rating');
        final stars = int.tryParse(starsStr) ?? (it.rating > 0 ? it.rating.round() : null);
        if (stars != null && !filterOpts.starRatings.contains(stars)) return false;
      }

      return true;
    }).toList();

    // Sort items if filterOpts sortOrder overrides
    var effectiveSort = sort;
    if (filterOpts.sortOrder == SortOrder.priceLowToHigh) {
      effectiveSort = cmp.SortMode.cheapest;
    }

    List<Widget> all;
    if (meta.id == 'hotels') {
      var groups = cmp.groupHotels(items);
      groups = cmp.sortHotels(groups, effectiveSort);
      if (filterOpts.sortOrder == SortOrder.priceHighToLow) {
        groups.sort((a, b) => b.best.price.compareTo(a.best.price));
      }
      all = [
        for (final g in groups) ...[HotelCard(g: g), const SizedBox(height: 12)],
      ];
    } else {
      var groups = cmp.groupOffers(items);
      groups = cmp.sortGroups(groups, effectiveSort);
      if (filterOpts.sortOrder == SortOrder.priceHighToLow) {
        groups.sort((a, b) => b.best.price.compareTo(a.best.price));
      }
      // Owner 28 Oct: bare flight rows (no flight number / timings / duration)
      // sit at the very end of the list instead of taking the top slots.
      // Same flight sold by several sites: timings from ANY row complete the
      // card, then bare rows drop to the end of the feed.
      if (meta.id == 'flights') {
        for (final g in groups) {
          cmp.liftGroupSchedule(g);
        }
      }
      groups = cmp.scheduleCompleteFirst(groups, meta.id);

      // Owner 22 Oct: cab prices must be segmented by ride type — Auto, Bike and
      // Cab each get their own section so every class's fare is visible separately
      // for the same trip (before this, every class sat in one long mixed list).
      if (meta.id == 'cab' && groups.isNotEmpty && {
        for (final g in groups) cmp.cabVehicleClassOf(g.lead),
      }.length > 1) {
        // Owner 23 Oct ('cab mai load more ni dikh raha'): the shared
        // widget-pair math below counted SECTION HEADERS and gaps as
        // 'groups', so the multi-class feed was cut mid-section (whole
        // Auto/Cab sections could hide behind the pill) and the pill's
        // remaining count was nonsense. Multi-class cab now paginates by
        // real GROUPS: the first `visibleCount` groups build COMPLETE
        // sections, the pill reveals +4 groups and the sections re-form.
        var shown = groups;
        var extraGroups = 0;
        if (groups.length > visibleCount) {
          shown = groups.take(visibleCount).toList();
          extraGroups = groups.length - visibleCount;
        }
        const sectionOrder = ['bike', 'auto', 'cab'];
        final sections = <String, List<cmp.OfferGroup>>{};
        for (final g in shown) {
          (sections[cmp.cabVehicleClassOf(g.lead)] ??= []).add(g);
        }
        all = [
          for (final cls in sectionOrder.where(sections.containsKey))
            ..._cabSection(context, cls, sections[cls]!, meta),
        ];
        if (extraGroups > 0) {
          all.addAll([
            _LoadMoreButton(
              remaining: extraGroups,
              noun: 'deals',
              onTap: onLoadMore,
            ),
            const SizedBox(height: 12),
          ]);
        }
        // Multi-class pagination is fully handled above — never re-enter the
        // shared pair math (it would double-paginate widget lists).
        return all;
      } else {
        all = [
          for (final g in groups) ...[
            if (meta.id == 'creditcards')
              CreditCardTile(g: g)
            else if (const ['flights', 'bus', 'cab'].contains(meta.id))
              TravelTile(g: g, meta: meta)
            else
              GroupCard(g: g, vertical: meta.id),
            const SizedBox(height: 12),
          ],
        ];
      }
    }

    // Load More pagination (owner 22 Oct, web parity): paint the first 4
    // result groups instantly, then a 'Load More' button reveals +4 per tap —
    // the feed feels instant on mobile and long result sets stay cheap to build.
    final totalPairs = all.length ~/ 2;
    if (totalPairs <= visibleCount) return all;
    return [
      ...all.take(visibleCount * 2),
      _LoadMoreButton(
        remaining: totalPairs - visibleCount,
        noun: meta.id == 'hotels' ? 'hotels' : 'deals',
        onTap: onLoadMore,
      ),
      const SizedBox(height: 12),
    ];
  }

  /// One ride-type section: a header ("Bike Rides · cheapest ₹80") followed by
  /// that class's tiles, cheapest first (the list is already sorted).
  List<Widget> _cabSection(BuildContext context, String cls, List<cmp.OfferGroup> gs, VerticalMeta meta) {
    const meta0 = {
      'bike': ('Bike Rides', Icons.bike_scooter_rounded, Color(0xFF059669)),
      'auto': ('Auto Rides', Icons.local_taxi_rounded, Color(0xFFD97706)),
      'cab': ('Cab & Taxi', Icons.directions_car_rounded, Color(0xFF0284C7)),
    };
    final (label, icon, color) = meta0[cls]!;
    final priced = gs.where((g) => g.best.priceAvailable).toList();
    final from = priced.isNotEmpty
        ? priced.map((g) => g.best.price).reduce((a, b) => a < b ? a : b)
        : null;
    return [
      Padding(
        padding: const EdgeInsets.only(top: 14, bottom: 6),
        child: Row(
          children: [
            Container(
              width: 26,
              height: 26,
              decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
              child: Icon(icon, size: 15, color: color),
            ),
            const SizedBox(width: 8),
            Text(label, style: tx(context, 13, w: FontWeight.w900)),
            const SizedBox(width: 6),
            Text('${gs.length} option${gs.length == 1 ? '' : 's'}',
                style: tx(context, 10, w: FontWeight.w700, color: muted(context))),
            const Spacer(),
            if (from != null)
              Text('from ${cmp.formatPrice('cab', from)}',
                  style: tx(context, 11, w: FontWeight.w800, color: T1SColors.emerald600)),
          ],
        ),
      ),
      for (final g in gs) ...[TravelTile(g: g, meta: meta), const SizedBox(height: 12)],
    ];
  }
}

// ---------------------------------------------------------------------------
// Track/alert action shared by cards
// ---------------------------------------------------------------------------

Future<void> showTrackSheet(
  BuildContext context, {
  required String title,
  required String query,
  required String vertical,
  double? price,
  String? image,
  String? sourceUrl,
}) async {
  final targetController = TextEditingController(
    text: price != null && price > 0 ? (price * 0.95).round().toString() : '',
  );
  // SPEED (22 Oct): every track sheet created a TextEditingController that was
  // never disposed — a small listener/bitmap leak per sheet open. Dispose once
  // the sheet closes.
  try {
  final ok = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (c) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(c).viewInsets.bottom),
      child: Container(
        margin: const EdgeInsets.all(12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: surface(c),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: border(c)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(children: [
              const Icon(Icons.notifications_active_rounded, color: T1SColors.red, size: 20),
              const SizedBox(width: 8),
              Expanded(child: Text('Track price alerts', style: tx(c, 15, w: FontWeight.w900))),
            ]),
            const SizedBox(height: 8),
            Text('We scan live sources every hour. When the price drops below your target, you get notified.',
                style: tx(c, 11, color: muted(c), h: 1.35)),
            const SizedBox(height: 12),
            TextField(
              controller: targetController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Target price (₹)', hintText: 'e.g. 1200'),
            ),
            const SizedBox(height: 14),
            RedButton('Save price alert', onTap: () => Navigator.pop(c, true), dense: true),
          ],
        ),
      ),
    ),
  );

  if (ok == true) {
    final target = double.tryParse(targetController.text.trim()) ?? (price != null ? price * 0.95 : 0);
    try {
      final token = AuthService.instance.token;
      if (token == null) throw Exception('Please sign in from Profile to save price alerts');
      await AppState.instance.api.createAlert(
        token,
        productTitle: title,
        searchQuery: query,
        targetPrice: target,
        priceAtSet: price,
        sourceUrl: sourceUrl,
        image: image,
      );
      if (context.mounted) toast(context, 'Price alert saved for "$title"');
    } catch (e) {
      if (context.mounted) toast(context, 'Could not save alert: $e', error: true);
    }
  }
  } finally {
    targetController.dispose();
  }
}

// ---------------------------------------------------------------------------
// Owner 23 Oct (web parity): one-tap GPS auto-detect row — mint-green card,
// crosshair chip, LIVE + Auto-Fill pills, exactly like the web dropdown.
// ---------------------------------------------------------------------------
class _GpsRow extends StatelessWidget {
  const _GpsRow({required this.busy, this.address, required this.onTap});
  final bool busy;
  final String? address;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final dark = isDark(context);
    return InkWell(
      onTap: busy ? null : onTap,
      child: Container(
        margin: const EdgeInsets.fromLTRB(8, 10, 8, 6),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        decoration: BoxDecoration(
          color: dark ? const Color(0xFF0E2A22) : const Color(0xFFE6F4EA),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFF2E7D32).withValues(alpha: .35)),
        ),
        child: Row(
          children: [
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: const Color(0xFF2E7D32),
                borderRadius: BorderRadius.circular(9),
              ),
              child: busy
                  ? const Padding(
                      padding: EdgeInsets.all(8),
                      child: CircularProgressIndicator(strokeWidth: 1.8, color: Colors.white),
                    )
                  : const Icon(Icons.my_location_rounded, size: 16, color: Colors.white),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Use Exact Current Location (GPS)',
                    style: tx(context, 12.5, w: FontWeight.w900, color: const Color(0xFF1B5E20)),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    busy
                        ? 'Detecting your exact location…'
                        : (address != null ? address! : 'Detects your GPS position & Auto-Fills this field'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: tx(context, 9.5, color: const Color(0xFF37623C)),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
              decoration: BoxDecoration(
                color: const Color(0xFF2E7D32),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text('LIVE', style: tx(context, 8, w: FontWeight.w900, color: Colors.white)),
            ),
            const SizedBox(width: 5),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: .75),
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: const Color(0xFF2E7D32).withValues(alpha: .4)),
              ),
              child: Text('Auto-Fill', style: tx(context, 8, w: FontWeight.w900, color: const Color(0xFF1B5E20))),
            ),
          ],
        ),
      ),
    );
  }
}
