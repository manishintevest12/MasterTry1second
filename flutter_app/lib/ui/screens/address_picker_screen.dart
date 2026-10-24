import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../../core/app_state.dart';
import '../../core/theme.dart';
import '../widgets/kit.dart';
import 'map_pin_picker_screen.dart';

/// Full-screen granular address picker (owner 24 Oct, reference screenshots:
/// "Select Your Location" / "Plan your ride").
///
/// The 10-min delivery, food and cab verticals need EXACT addresses — colony,
/// street, even house number. This screen is a search-as-you-type picker over
/// GET /api/geo/suggest (Photon/OSM autocomplete): every row shows a bold place
/// name and its full granular address (street, colony, city, state, pincode)
/// plus the distance from the user when their coordinates are known.
/// "Use my current location" (GPS) and "Set location on map" (drag-and-drop pin)
/// sit above the results. Never invents a place: no matches = honest empty state.
///
/// Returns (Navigator.pop) a spot map, same shape as the map pin picker:
///   {lat, lng, address, label, locality, city, pincode}
class AddressPickerScreen extends StatefulWidget {
  const AddressPickerScreen({super.key, this.title = 'Select Your Location', this.initialQuery = ''});

  final String title;
  final String initialQuery;

  @override
  State<AddressPickerScreen> createState() => _AddressPickerScreenState();
}

class _AddressPickerScreenState extends State<AddressPickerScreen> {
  final _searchController = TextEditingController();
  final _focus = FocusNode();
  Timer? _debounce;
  List<Map<String, dynamic>> _rows = const [];
  bool _loading = false;
  bool _searched = false;
  bool _gpsBusy = false;
  int _seq = 0;

  @override
  void initState() {
    super.initState();
    _searchController.text = widget.initialQuery;
    _searchController.addListener(_onChanged);
    if (_searchController.text.trim().length >= 2) {
      _fetch();
    } else {
      WidgetsBinding.instance.addPostFrameCallback((_) => _focus.requestFocus());
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.removeListener(_onChanged);
    _searchController.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _onChanged() {
    final q = _searchController.text.trim();
    _debounce?.cancel();
    if (q.length < 2) {
      if (_loading) setState(() => _loading = false);
      return;
    }
    setState(() => _loading = true);
    _debounce = Timer(const Duration(milliseconds: 250), _fetch);
  }

  Future<void> _fetch() async {
    final q = _searchController.text.trim();
    if (q.length < 2) return;
    final seq = ++_seq;
    try {
      final state = AppState.instance;
      final rows = await state.api.geoSuggest(q, lat: state.pickLat, lng: state.pickLng);
      if (!mounted || seq != _seq) return;
      setState(() {
        _rows = rows.take(10).toList();
        _loading = false;
        _searched = true;
      });
    } catch (_) {
      // Geo suggestions are best-effort; the picker still works with GPS/map.
      if (mounted && seq == _seq) setState(() => _loading = false);
    }
  }

  void _choose(Map<String, dynamic> p) {
    final lat = (p['lat'] as num?)?.toDouble();
    final lng = (p['lng'] as num?)?.toDouble();
    if (lat == null || lng == null) return;
    final name = (p['name'] ?? '').toString();
    final address = (p['address'] ?? '').toString();
    final locality = [p['colony'], p['street']]
        .whereType<String>()
        .where((s) => s.trim().isNotEmpty)
        .join(', ');
    Navigator.pop(context, {
      'lat': lat,
      'lng': lng,
      'address': name.isNotEmpty && address.isNotEmpty ? '$name, $address' : (name.isNotEmpty ? name : address),
      'label': name,
      'locality': locality.isNotEmpty ? locality : name,
      'city': (p['city'] ?? '').toString(),
      'pincode': (p['pincode'] ?? '').toString(),
    });
  }

  /// GPS: current position → reverse-geocoded exact address (never invented).
  Future<void> _useCurrentLocation() async {
    if (_gpsBusy) return;
    setState(() => _gpsBusy = true);
    try {
      final enabled = await Geolocator.isLocationServiceEnabled();
      if (!enabled) {
        if (mounted) toast(context, 'Location services are disabled', error: true);
        return;
      }
      var permission = await Geolocator.checkPermission();
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
      final pos = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.low);
      final place = await AppState.instance.api.geoReverse(pos.latitude, pos.longitude);
      if (!mounted) return;
      Navigator.pop(context, {
        'lat': pos.latitude,
        'lng': pos.longitude,
        'address': (place?['address'] ?? 'Current location').toString(),
        'label': (place?['locality'] ?? 'Current location').toString(),
        'locality': (place?['locality'] ?? 'Current location').toString(),
        'city': (place?['city'] ?? '').toString(),
        'pincode': (place?['pincode'] ?? '').toString(),
      });
    } catch (_) {
      if (mounted) toast(context, 'Could not detect location', error: true);
    } finally {
      if (mounted) setState(() => _gpsBusy = false);
    }
  }

  Future<void> _openMap() async {
    final spot = await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => MapPinPickerScreen(
          isPickup: true,
          initialLat: AppState.instance.pickLat,
          initialLng: AppState.instance.pickLng,
          initialLabel: AppState.instance.city,
        ),
      ),
    );
    if (spot == null || !mounted) return;
    Navigator.pop(context, spot);
  }

  String _distanceText(Map<String, dynamic> p) {
    final km = (p['distanceKm'] as num?)?.toDouble();
    if (km == null) return '';
    if (km < 1) return '${(km * 1000).round()} m';
    return '$km km';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: surface(context),
      appBar: AppBar(
        backgroundColor: surface(context),
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_rounded, color: ink(context)),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(widget.title, style: tx(context, 17, w: FontWeight.w900)),
      ),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Search input + clear button (reference: rounded grey-bordered field).
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
              child: TextField(
                controller: _searchController,
                focusNode: _focus,
                textInputAction: TextInputAction.search,
                onSubmitted: (_) => _fetch(),
                decoration: InputDecoration(
                  hintText: 'Search colony, street, landmark or shop...',
                  hintStyle: tx(context, 14, color: isDark(context) ? T1SColors.slate400 : T1SColors.slate500),
                  prefixIcon: Icon(Icons.search_rounded, color: isDark(context) ? T1SColors.slate400 : T1SColors.slate600),
                  suffixIcon: _searchController.text.isNotEmpty
                      ? IconButton(
                          icon: Icon(Icons.close_rounded, color: isDark(context) ? T1SColors.slate400 : T1SColors.slate600),
                          onPressed: () {
                            _searchController.clear();
                            setState(() {
                              _rows = const [];
                              _searched = false;
                            });
                          },
                        )
                      : null,
                  filled: true,
                  fillColor: isDark(context) ? T1SColors.slate800 : Colors.white,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: isDark(context) ? T1SColors.slate700 : T1SColors.slate300),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: T1SColors.red, width: 1.6),
                  ),
                ),
                style: tx(context, 15, w: FontWeight.w600),
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                children: [
                  // GPS + map shortcuts above the results (reference rows).
                  _shortcutRow(
                    icon: Icons.my_location_rounded,
                    busy: _gpsBusy,
                    title: 'Use my current location',
                    subtitle: 'Detects your exact position via GPS',
                    onTap: _useCurrentLocation,
                  ),
                  const SizedBox(height: 8),
                  _shortcutRow(
                    icon: Icons.map_outlined,
                    title: 'Set location on map',
                    subtitle: 'Drag the pin to your exact spot',
                    onTap: _openMap,
                  ),
                  if (_searched) ...[
                    const SizedBox(height: 14),
                    Text(
                      'SEARCH RESULTS',
                      style: tx(
                        context,
                        11,
                        w: FontWeight.w800,
                        color: isDark(context) ? T1SColors.slate400 : T1SColors.slate500,
                      ),
                    ),
                  ],
                  if (_loading) ...[
                    const SizedBox(height: 10),
                    Center(
                      child: SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(strokeWidth: 2.4, color: T1SColors.red),
                      ),
                    ),
                  ],
                  if (!_loading && _rows.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(14),
                      child: Container(
                        color: isDark(context) ? T1SColors.slate900 : T1SColors.slate50,
                        child: Column(
                          children: [
                            for (var i = 0; i < _rows.length; i++) ...[
                              if (i > 0) Divider(height: 1, color: isDark(context) ? T1SColors.slate800 : T1SColors.slate200),
                              _resultTile(_rows[i]),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ],
                  if (!_loading && _searched && _rows.isEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 24),
                      child: Center(
                        child: Text(
                          'No matching address found.\nTry a nearby colony, street or landmark.',
                          textAlign: TextAlign.center,
                          style: tx(context, 13, color: isDark(context) ? T1SColors.slate400 : T1SColors.slate500),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _shortcutRow({
    required IconData icon,
    required String title,
    String? subtitle,
    bool busy = false,
    VoidCallback? onTap,
  }) {
    return Material(
      color: isDark(context) ? T1SColors.slate800 : Colors.white,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: isDark(context) ? T1SColors.slate700 : T1SColors.slate100,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: busy
                    ? SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2, color: T1SColors.red),
                      )
                    : Icon(icon, size: 19, color: T1SColors.red),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: tx(context, 14, w: FontWeight.w800)),
                    if (subtitle != null && subtitle.isNotEmpty)
                      Text(
                        subtitle,
                        style: tx(context, 11.5, color: isDark(context) ? T1SColors.slate400 : T1SColors.slate500),
                      ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, size: 20, color: isDark(context) ? T1SColors.slate500 : T1SColors.slate400),
            ],
          ),
        ),
      ),
    );
  }

  /// Result row (reference: white card list on light-grey background, pin icon
  /// in a grey square, bold name, grey granular address, distance on the left).
  Widget _resultTile(Map<String, dynamic> p) {
    final name = (p['name'] ?? '').toString();
    final address = (p['address'] ?? '').toString();
    final dist = _distanceText(p);
    return Material(
      color: isDark(context) ? T1SColors.slate900 : T1SColors.slate50,
      child: InkWell(
        onTap: () => _choose(p),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          child: Row(
            children: [
              if (dist.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(right: 10),
                  child: SizedBox(
                    width: 42,
                    child: Text(dist, style: tx(context, 11, w: FontWeight.w700, color: T1SColors.slate500)),
                  ),
                ),
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: isDark(context) ? T1SColors.slate700 : T1SColors.slate200,
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Icon(Icons.location_on_outlined, size: 19, color: isDark(context) ? T1SColors.slate300 : T1SColors.slate700),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 14.5, w: FontWeight.w800)),
                    if (address.isNotEmpty)
                      Text(
                        address,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: tx(context, 12, color: isDark(context) ? T1SColors.slate400 : T1SColors.slate600),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
