import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../../core/api.dart';
import '../../core/app_state.dart';
import '../../core/auth.dart';
import '../../core/autocomplete_data.dart';
import '../../core/compare.dart';
import '../../core/theme.dart';
import '../../core/verticals.dart';
import '../widgets/compare_cards.dart';
import '../widgets/filter_panel.dart';
import '../widgets/kit.dart';
import '../widgets/typeahead_field.dart';
import 'hotel_picker_screen.dart';
import 'place_picker_screen.dart';

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
  DateTime _date = DateTime.now().add(const Duration(days: 1));
  DateTime _checkOutDate = DateTime.now().add(const Duration(days: 3));
  String _hotelGuests = '2 Adults · 1 Room';

  bool _loading = false;
  LiveResponse? _res;
  String? _error;
  SortMode _sort = SortMode.best;
  FilterOptions _filterOpts = const FilterOptions();

  @override
  void initState() {
    super.initState();
    _meta = verticalById(_state.vertical);
    _state.addListener(_onState);
    _seedForm();
    _runSearch(auto: true);
  }

  @override
  void dispose() {
    _state.removeListener(_onState);
    _q.dispose();
    _from.dispose();
    _to.dispose();
    super.dispose();
  }

  void _onState() {
    if (verticalById(_state.vertical).id != _meta.id) {
      _meta = verticalById(_state.vertical);
      _sort = SortMode.best;
      _filterOpts = const FilterOptions();
      _seedForm();
      _res = _state.cache[_meta.id];
      if (mounted) setState(() {});
      _runSearch(auto: true);
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
    });
    try {
      _res = await _state.live(_meta.id, q, depart: _iso(_date), force: force);
    } catch (e) {
      _error = '$e'.replaceFirst(RegExp(r'^Exception: ?'), '');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _iso(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  void _swap() {
    final f = _from.text;
    _from.text = _to.text;
    _to.text = f;
    _runSearch(force: true);
  }

  Future<void> _pickDate() async {
    final d = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (d != null) {
      setState(() => _date = d);
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
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
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
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
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
                onSearch: () => _runSearch(force: true),
                onPickCity: _pickCity,
                onUseCurrentLocationForCab: _useCurrentLocationForCab,
                onOpenCityPicker: _openCityPicker,
                onOpenPlacePicker: _openPlacePicker,
                onOpenHotelPicker: _openHotelPicker,
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
                _FeedBody(
                  meta: _meta,
                  res: _res!,
                  sort: _sort,
                  filterOpts: _filterOpts,
                ),
              ] else if (!_loading && _error == null) ...[
                const SizedBox(height: 26),
                _EmptyState(onSearch: () => _runSearch(force: true)),
              ],
            ],
          ),
        ),
      ),
    ]);
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
    required this.onSearch,
    required this.onPickCity,
    required this.onUseCurrentLocationForCab,
    required this.onOpenCityPicker,
    required this.onOpenPlacePicker,
    required this.onOpenHotelPicker,
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
  final VoidCallback onSearch;
  final VoidCallback onPickCity;
  final VoidCallback onUseCurrentLocationForCab;
  final Function(TextEditingController, String) onOpenCityPicker;
  final Function(bool) onOpenPlacePicker;
  final VoidCallback onOpenHotelPicker;

  @override
  Widget build(BuildContext context) {
    final presets = kAutoCategories[meta.id] ?? const <String>[];

    Widget body;
    switch (meta.kind) {
      case SearchKind.cab:
        body = Column(
          children: [
            Row(
              children: [
                Expanded(
                  child: InkWell(
                    onTap: () => onOpenCityPicker(from, 'Select Pickup City'),
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                      decoration: BoxDecoration(
                        color: isDark(context) ? T1SColors.slate800 : T1SColors.slate50,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: border(context)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.location_on_outlined, size: 16, color: T1SColors.red),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              from.text.isNotEmpty ? from.text : 'Pickup City',
                              style: tx(context, 12, w: FontWeight.w800),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 4),
                GestureDetector(
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
                const SizedBox(width: 4),
                Expanded(
                  child: InkWell(
                    onTap: () => onOpenCityPicker(to, 'Select Drop City'),
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                      decoration: BoxDecoration(
                        color: isDark(context) ? T1SColors.slate800 : T1SColors.slate50,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: border(context)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.navigation_outlined, size: 16, color: T1SColors.red),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              to.text.isNotEmpty ? to.text : 'Drop City',
                              style: tx(context, 12, w: FontWeight.w800),
                              maxLines: 1,
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
          body = Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: InkWell(
                      onTap: () => onOpenPlacePicker(true),
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                        decoration: BoxDecoration(
                          color: isDark(context) ? T1SColors.slate800 : T1SColors.slate50,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: border(context)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.flight_takeoff_outlined, size: 16, color: T1SColors.red),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                from.text.isNotEmpty ? from.text : 'From City / Airport',
                                style: tx(context, 12, w: FontWeight.w800),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 4),
                  GestureDetector(
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
                  const SizedBox(width: 4),
                  Expanded(
                    child: InkWell(
                      onTap: () => onOpenPlacePicker(false),
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                        decoration: BoxDecoration(
                          color: isDark(context) ? T1SColors.slate800 : T1SColors.slate50,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: border(context)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.flight_land_outlined, size: 16, color: T1SColors.red),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                to.text.isNotEmpty ? to.text : 'To City / Airport',
                                style: tx(context, 12, w: FontWeight.w800),
                                maxLines: 1,
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
          body = Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: InkWell(
                      onTap: () => onOpenCityPicker(from, 'Select From City / Town / Boarding Point'),
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                        decoration: BoxDecoration(
                          color: isDark(context) ? T1SColors.slate800 : T1SColors.slate50,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: border(context)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.directions_bus_outlined, size: 16, color: T1SColors.red),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                from.text.isNotEmpty ? from.text : 'From City',
                                style: tx(context, 12, w: FontWeight.w800),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 4),
                  GestureDetector(
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
                  const SizedBox(width: 4),
                  Expanded(
                    child: InkWell(
                      onTap: () => onOpenCityPicker(to, 'Select To City / Town'),
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                        decoration: BoxDecoration(
                          color: isDark(context) ? T1SColors.slate800 : T1SColors.slate50,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: border(context)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.location_on_outlined, size: 16, color: T1SColors.red),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                to.text.isNotEmpty ? to.text : 'To City',
                                style: tx(context, 12, w: FontWeight.w800),
                                maxLines: 1,
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
        body = Column(
          children: [
            InkWell(
              onTap: onOpenHotelPicker,
              borderRadius: BorderRadius.circular(10),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                decoration: BoxDecoration(
                  color: isDark(context) ? T1SColors.slate800 : T1SColors.slate50,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: border(context)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.search_rounded, size: 18, color: T1SColors.red),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            to.text.isNotEmpty ? to.text : 'City, resort or landmark',
                            style: tx(context, 12.5, w: FontWeight.w800),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${date.day}/${date.month} - ${checkOutDate.day}/${checkOutDate.month} · $hotelGuests',
                            style: tx(context, 10.5, color: muted(context)),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right_rounded, size: 18, color: T1SColors.slate400),
                  ],
                ),
              ),
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
            Row(children: [Expanded(child: _CityChip(city: city, onTap: onPickCity))]),
          ],
        );
    }

    return Box(
      padding: const EdgeInsets.all(12),
      radius: 16,
      shadow: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(meta.icon, size: 14, color: T1SColors.red),
              const SizedBox(width: 6),
              Expanded(child: Text(meta.name.toUpperCase(), style: tx(context, 11, w: FontWeight.w900, ls: 0.7))),
              Text(meta.tagline, style: tx(context, 9.5, color: muted(context))),
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
                      color: isDark(c) ? T1SColors.slate800 : T1SColors.slate50,
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: border(context)),
                    ),
                    child: Text(meta.samples[i], style: tx(c, 9.5, w: FontWeight.w600, color: muted(context))),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
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
          Expanded(child: Text('Scanning live sources… real prices only, nothing invented.', style: tx(context, 11.5, color: muted(context)))),
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

class _SortBar extends StatelessWidget {
  const _SortBar({required this.sort, required this.onSort});
  final SortMode sort;
  final ValueChanged<SortMode> onSort;

  @override
  Widget build(BuildContext context) {
    const tabs = [SortMode.best, SortMode.cheapest, SortMode.highestRated];
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

class _FeedBody extends StatelessWidget {
  const _FeedBody({
    required this.meta,
    required this.res,
    required this.sort,
    required this.filterOpts,
  });

  final VerticalMeta meta;
  final LiveResponse res;
  final SortMode sort;
  final FilterOptions filterOpts;

  int? _parseHour(String depTime) {
    final match = RegExp(r'(\d{1,2}):(\d{2})').firstMatch(depTime);
    if (match != null) {
      return int.tryParse(match.group(1)!);
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
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
      effectiveSort = SortMode.cheapest;
    }

    if (meta.id == 'hotels') {
      var groups = groupHotels(items);
      groups = sortHotels(groups, effectiveSort);
      if (filterOpts.sortOrder == SortOrder.priceHighToLow) {
        groups.sort((a, b) => b.best.price.compareTo(a.best.price));
      }
      return Column(children: [
        for (final g in groups) ...[HotelCard(g: g), const SizedBox(height: 12)],
      ]);
    }

    var groups = groupOffers(items);
    groups = sortGroups(groups, effectiveSort);
    if (filterOpts.sortOrder == SortOrder.priceHighToLow) {
      groups.sort((a, b) => b.best.price.compareTo(a.best.price));
    }

    return Column(children: [
      for (final g in groups) ...[
        if (meta.id == 'creditcards')
          CreditCardTile(g: g)
        else if (const ['flights', 'bus', 'cab'].contains(meta.id))
          TravelTile(g: g, meta: meta)
        else
          GroupCard(g: g, vertical: meta.id),
        const SizedBox(height: 12),
      ],
    ]);
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
}
