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
import '../widgets/compare_cards.dart';
import '../widgets/hint_field.dart';
import '../widgets/journey_date_picker_modal.dart';
import '../widgets/location_hint_field.dart';
import '../widgets/filter_panel.dart';
import '../widgets/kit.dart';
import '../widgets/typeahead_field.dart';
import 'hotel_picker_screen.dart';
import 'smart_cart_screen.dart';
import 'place_picker_screen.dart';
import 'map_pin_picker_screen.dart';

/// Small const map of lat/lng for top ~40 Indian cities for geolocator pre-fill
const kCityCoords = <String, Map<String, double>>{
  'Mumbai': {'lat': 19.0760, 'lng': 72.8777},
  'New Delhi': {'lat': 28.6139, 'lng': 77.2090},
  'Bengaluru': {'lat': 12.9716, 'lng': 77.5946},
  'Hyderabad': {'lat': 17.3850, 'lng': 78.4867},
  'Chennai': {'lat': 13.0827, 'lng': 80.2707},
  'Kolkata': {'lat': 22.5726, 'lng': 88.3639},
  'Pune': {'lat': 18.5204, 'lng': 73.8567},
  'Ahmedabad': {'lat': 23.0225, 'lng': 72.5714},
  'Goa': {'lat': 15.2993, 'lng': 74.1240},
  'Jaipur': {'lat': 26.9124, 'lng': 75.7873},
  'Chandigarh': {'lat': 30.7333, 'lng': 76.7794},
  'Lucknow': {'lat': 26.8467, 'lng': 80.9462},
  'Dehradun': {'lat': 30.3165, 'lng': 78.0322},
  'Manali': {'lat': 32.2432, 'lng': 77.1892},
  'Shimla': {'lat': 31.1048, 'lng': 77.1734},
  'Srinagar': {'lat': 34.0837, 'lng': 74.7973},
  'Leh': {'lat': 34.1526, 'lng': 77.5771},
  'Agra': {'lat': 27.1767, 'lng': 78.0081},
  'Varanasi': {'lat': 25.3176, 'lng': 82.9739},
  'Surat': {'lat': 21.1702, 'lng': 72.8311},
  'Vadodara': {'lat': 22.3072, 'lng': 73.1812},
  'Nagpur': {'lat': 21.1458, 'lng': 79.0882},
  'Nashik': {'lat': 20.0059, 'lng': 73.7898},
  'Udaipur': {'lat': 24.5854, 'lng': 73.7125},
  'Indore': {'lat': 22.7196, 'lng': 75.8577},
  'Bhopal': {'lat': 23.2599, 'lng': 77.4126},
  'Gwalior': {'lat': 26.2183, 'lng': 78.1828},
  'Jabalpur': {'lat': 23.1815, 'lng': 79.9864},
  'Ujjain': {'lat': 23.1765, 'lng': 75.7885},
  'Patna': {'lat': 25.5941, 'lng': 85.1376},
  'Bhubaneswar': {'lat': 20.2961, 'lng': 85.8245},
  'Puri': {'lat': 19.8135, 'lng': 85.8312},
  'Ranchi': {'lat': 23.3441, 'lng': 85.3096},
  'Raipur': {'lat': 21.2514, 'lng': 81.6296},
  'Kochi': {'lat': 9.9312, 'lng': 76.2673},
  'Thiruvananthapuram': {'lat': 8.5241, 'lng': 76.9366},
  'Coimbatore': {'lat': 11.0168, 'lng': 76.9558},
  'Visakhapatnam': {'lat': 17.6868, 'lng': 83.2185},
  'Vijayawada': {'lat': 16.5062, 'lng': 80.6480},
  'Gurugram': {'lat': 28.4595, 'lng': 77.0266},
  'Noida': {'lat': 28.5355, 'lng': 77.3910},
  'Ludhiana': {'lat': 30.9010, 'lng': 75.8573},
  'Amritsar': {'lat': 31.6340, 'lng': 74.8723},
};

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
  Timer? _bgPoll;
  int _bgPollCount = 0;
  LiveResponse? _res;
  int _visibleCount = 4; // Load More (owner 22 Oct): 4 groups first, +4 per tap
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
  }

  /// Owner 23 Oct (homepage pills 'results nahi aate'): MainShell mounts this
  /// screen only while the compare tab is active (a switch body, not an
  /// IndexedStack), so a pill / showcase / hero tap from the HOME tab sets a
  /// PendingSearch BEFORE this screen exists — _onState's listener fires during
  /// openVertical, before mount, so nothing consumed it and initState then ran
  /// an EMPTY auto search: the compare tab opened with no loader and no results
  /// at all. Consume the pending FIRST, exactly like the _onState path does.
  void _start() {
    final p = _state.takePending();
    if (p == null) {
      _runSearch(auto: true);
      return;
    }
    if (p.productPage) {
      _state.openProduct(p);
      return;
    }
    _q.text = p.query;
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
      if (mounted) setState(() {});
      // Owner 23 Oct: a vertical switch can carry a PendingSearch too (pill /
      // hero tap while this screen was on another vertical). _start() consumes
      // it first instead of returning before the pending check ever runs.
      _start();
      return;
    }
    final pending = _state.takePending();
    if (pending != null) {
      if (pending.productPage) {
        _state.openProduct(pending);
        return;
      }
      _q.text = pending.query;
      _runSearch(query: pending.query);
      return;
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
    }
  }

  void _seedForm() {
    _q.text = '';
    _from.text = _meta.defaultFrom;
    _to.text = _meta.defaultTo;
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

  Future<void> _runSearch({String? query, bool auto = false, bool force = false}) async {
    final q = (query ?? _effectiveQuery()).trim();
    if (q.isEmpty) return;
    setState(() {
      _loading = true;
      _error = null;
      _visibleCount = 4; // Load More: new search starts from the first 4 groups
    });
    _bgPoll?.cancel();
    try {
      _res = await _state.live(_meta.id, q, depart: _iso(_date), force: force);
      _shownCacheKey = _state.cacheQuery[_meta.id];
      // Progressive cold-start: real catalogue rows arrived instantly and the
      // server is still scanning live sources. Poll the same search quietly
      // until the full live set replaces the partial rows (max ~25s of polls,
      // now 2s apart so live top-ups land progressively instead of one long wait).
      // Owner 22 Oct: poll budget 12 -> 30 (~60s coverage, 2s apart) so slow
      // cold searches keep topping up like the web instead of stopping early.
      if (mounted && _res?.pendingRefresh == true && _bgPollCount < 30) {
        _bgPoll = Timer(const Duration(milliseconds: 2000), () {
          if (!mounted) return;
          _bgPollCount += 1;
          // force: the partial progressive rows are STILL in the fresh-TTL
          // client cache — without force, live() would hand back the same
          // quote-less rows forever and every Book button would stay dead.
          _runSearch(query: q, auto: true, force: true);
        });
      } else {
        _bgPollCount = 0;
      }
    } catch (e) {
      _error = '$e'.replaceFirst(RegExp(r'^Exception: ?'), '');
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
              ] else if (!_loading && _error == null) ...[
                const SizedBox(height: 26),
                _EmptyState(onSearch: () => _runSearch(force: true)),
              ] else if (_loading && (_res == null || _res!.items.isEmpty)) ...[
                // WarpLoader (owner 22 Oct): engaging 3-2-1 countdown while the live
                // search runs in the background — results replace it automatically.
                const SizedBox(height: 20),
                const _WarpLoader(),
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
                      onLoadMore: () => setState(() => _visibleCount += 4),
                    ).cards(bc)
                  : const <Widget>[];

              return ListView.builder(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                itemCount: header.length + feed.length,
                itemBuilder: (c, i) => i < header.length ? header[i] : feed[i - header.length],
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
    final rev = await AppState.instance.api.geoReverse(lat, lng);
    final city = (rev?['city'] as String?)?.isNotEmpty == true ? rev!['city'] as String : _state.city;
    final pin = (rev?['pincode'] as String?)?.isNotEmpty == true ? rev!['pincode'] as String : _state.pincode;
    await _state.setLocation(city, pin);
    if (mounted) await _runSearch(force: true);
  }

  Future<void> _pickCity() async {
    final ctrl = TextEditingController(text: _state.city);
    final pin = TextEditingController(text: _state.pincode);
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text('Your location', style: tx(c, 16, w: FontWeight.w900)),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: ctrl, decoration: const InputDecoration(labelText: 'City')),
          const SizedBox(height: 8),
          TextField(controller: pin, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Pincode')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
          RedButton('Save', onTap: () => Navigator.pop(c, true), dense: true),
        ],
      ),
    );
    if (ok == true) {
      await _state.setLocation(ctrl.text, pin.text);
      if (mounted) await _runSearch(force: true);
    }
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
                      itemCount: _filtered.length,
                      separatorBuilder: (_, __) => Divider(height: 1, color: border(context)),
                      itemBuilder: (c, i) {
                        final item = _filtered[i];
                        return ListTile(
                          contentPadding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
                          title: Text(item.text, style: tx(c, 13.5, w: FontWeight.w800)),
                          subtitle: item.subtext.isNotEmpty
                              ? Text(item.subtext, style: tx(c, 11, color: muted(c)))
                              : (item.badge.isNotEmpty ? Text(item.badge, style: tx(c, 11, color: T1SColors.red)) : null),
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
    if (loading && res == null) {
      return Box(
        padding: const EdgeInsets.all(14),
        radius: 16,
        child: Row(children: [
          const SizedBox(width: 15, height: 15, child: CircularProgressIndicator(strokeWidth: 2.2, color: T1SColors.red)),
          const SizedBox(width: 12),
          Expanded(child: Text('Comparing prices across the web at warp speed… your ultimate steal is arriving in 3, 2, 1...', style: tx(context, 11.5, w: FontWeight.w600, color: muted(context)))),
        ]),
      );
    }
    // Progressive cold-start OR any live load/price refresh (owner 21 Oct): real
    // rows are on screen while live prices are still being acquired in the
    // background — tell the user, never leave them guessing.
    if ((loading && res != null) || (res != null && res!.pendingRefresh)) {
      return Box(
        padding: const EdgeInsets.all(11),
        radius: 16,
        borderColor: T1SColors.amber400.withValues(alpha: 0.45),
        color: isDark(context) ? T1SColors.slate900 : const Color(0xFFFEF7E6),
        child: Row(children: [
          const SizedBox(width: 13, height: 13, child: CircularProgressIndicator(strokeWidth: 2, color: T1SColors.amber400)),
          const SizedBox(width: 11),
          Expanded(child: Text('Comparing prices across the web at warp speed. Your ultimate steal is arriving in 3, 2, 1...', style: tx(context, 11, w: FontWeight.w600, color: muted(context)))),
        ]),
      );
    }
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

/// WarpLoader (owner 22 Oct): the one site-wide loading experience —
/// "Comparing prices across the web at warp speed... Your ultimate steal is
/// arriving in 3, 2, 1..." Animated pulsing warp core with a ticking 3-2-1
/// countdown, progress bar and shimmering skeleton cards. Unmounts the moment
/// real results arrive; the background fetch continues while it shows.
class _WarpLoader extends StatefulWidget {
  const _WarpLoader();
  @override
  State<_WarpLoader> createState() => _WarpLoaderState();
}

class _WarpLoaderState extends State<_WarpLoader> with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 1600))..repeat(reverse: true);
  int _count = 3;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _count = _count > 1 ? _count - 1 : 3);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dark = isDark(context);
    return Box(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 24),
      radius: 16,
      child: Column(children: [
        // Warp core: pulsing red ring + ticking countdown
        ScaleTransition(
          scale: Tween<double>(begin: 0.96, end: 1.06).animate(CurvedAnimation(parent: _pulse, curve: Curves.easeInOut)),
          child: Container(
            width: 74,
            height: 74,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: T1SColors.red,
              boxShadow: [BoxShadow(color: T1SColors.red.withValues(alpha: 0.18 + 0.14 * _pulse.value), blurRadius: 24, spreadRadius: 4 + 8 * _pulse.value)],
            ),
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 300),
              transitionBuilder: (w, a) => ScaleTransition(scale: a, child: w),
              child: Text('$_count', key: ValueKey<int>(_count), style: tx(context, 30, w: FontWeight.w900, color: Colors.white)),
            ),
          ),
        ),
        const SizedBox(height: 14),
        Text('Comparing prices across the web at warp speed...', style: tx(context, 14, w: FontWeight.w800, color: ink(context)), textAlign: TextAlign.center),
        const SizedBox(height: 4),
        FadeTransition(
          opacity: Tween<double>(begin: 0.75, end: 1.0).animate(_pulse),
          child: Text('Your ultimate steal is arriving in 3, 2, 1...', style: tx(context, 11.5, w: FontWeight.w600, color: muted(context)), textAlign: TextAlign.center),
        ),
        const SizedBox(height: 16),
        // Progress bar — eases toward done but only real results complete it
        TweenAnimationBuilder<double>(
          tween: Tween(begin: 0.06, end: 0.92),
          duration: const Duration(seconds: 18),
          curve: Curves.easeOut,
          builder: (c, v, _) => ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(value: v, minHeight: 5, backgroundColor: dark ? T1SColors.slate800 : T1SColors.slate100, valueColor: const AlwaysStoppedAnimation(T1SColors.red)),
          ),
        ),
        const SizedBox(height: 18),
        // Skeleton cards — the page never looks dead while loading
        Row(children: [
          // Owner 23 Oct: Interval end must stay <= 1.0 — the third card's
          // (i*0.12)+0.88 = 1.12 tripped the 'end <= 1.0' assertion and killed
          // the loading skeleton in debug builds. Clamp the stagger instead.
          for (int i = 0; i < 3; i++) ...[
            if (i > 0) const SizedBox(width: 8),
            Expanded(
              child: FadeTransition(
                opacity: Tween<double>(begin: 0.45, end: 1.0).animate(CurvedAnimation(parent: _pulse, curve: Interval(i * 0.12, ((i * 0.12) + 0.88).clamp(0.0, 1.0), curve: Curves.easeInOut))),
                child: Container(
                  height: 84,
                  decoration: BoxDecoration(color: dark ? T1SColors.slate800 : T1SColors.slate100, borderRadius: BorderRadius.circular(14)),
                ),
              ),
            ),
          ],
        ]),
      ]),
    );
  }
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

      // Owner 22 Oct: cab prices must be segmented by ride type — Auto, Bike and
      // Cab each get their own section so every class's fare is visible separately
      // for the same trip (before this, every class sat in one long mixed list).
      if (meta.id == 'cab' && groups.isNotEmpty && {
        for (final g in groups) cmp.cabVehicleClassOf(g.lead),
      }.length > 1) {
        const sectionOrder = ['bike', 'auto', 'cab'];
        final sections = <String, List<cmp.OfferGroup>>{};
        for (final g in groups) {
          (sections[cmp.cabVehicleClassOf(g.lead)] ??= []).add(g);
        }
        all = [
          for (final cls in sectionOrder.where(sections.containsKey))
            ..._cabSection(context, cls, sections[cls]!, meta),
        ];
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
