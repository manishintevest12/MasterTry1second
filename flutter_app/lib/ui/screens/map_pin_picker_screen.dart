import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import '../../core/app_state.dart';
import '../../core/theme.dart';
import '../widgets/kit.dart';

/// The exact spot the user pinned on the map (Nominatim-provided names, real
/// coordinates — never an invented address; unnamed spots keep their coords).
class PickedSpot {
  const PickedSpot({
    required this.lat,
    required this.lng,
    required this.address,
    required this.locality,
    required this.city,
    this.pincode,
  });

  final double lat;
  final double lng;
  final String address;
  final String locality;
  final String city;
  final String? pincode;

  /// Short chip label for the cab form ("Indirapuram, Ghaziabad").
  String get label {
    final base = locality.trim().isNotEmpty ? locality.trim() : address.trim();
    if (city.trim().isNotEmpty && !base.toLowerCase().contains(city.trim().toLowerCase())) {
      return '$base, ${city.trim()}';
    }
    return base;
  }
}

/// Uber-style pin picker (owner request 17 Oct): the pin stays fixed in the
/// center while the map moves under it; drop it anywhere and the exact point
/// becomes the cab pickup or drop. flutter_map + OSM tiles — open data, no API
/// keys; address names come from the backend Nominatim proxy.
class MapPinPickerScreen extends StatefulWidget {
  const MapPinPickerScreen({
    super.key,
    required this.isPickup,
    this.initialLat,
    this.initialLng,
    this.initialLabel,
  });

  final bool isPickup;
  final double? initialLat;
  final double? initialLng;
  final String? initialLabel;

  @override
  State<MapPinPickerScreen> createState() => _MapPinPickerScreenState();
}

class _MapPinPickerScreenState extends State<MapPinPickerScreen> {
  final MapController _mapController = MapController();
  final TextEditingController _searchController = TextEditingController();

  List<Map<String, dynamic>> _results = const [];
  PickedSpot? _spot;
  bool _busy = false;
  bool _searching = false;
  Timer? _revTimer;

  @override
  void initState() {
    super.initState();
    _boot();
  }

  @override
  void dispose() {
    _revTimer?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _boot() async {
    if (widget.initialLat != null && widget.initialLng != null) {
      _reverse(widget.initialLat!, widget.initialLng!);
      return;
    }
    if (widget.initialLabel != null && widget.initialLabel!.trim().isNotEmpty) {
      try {
        final rows = await AppState.instance.api.geoSearch(widget.initialLabel!);
        if (rows.isNotEmpty && mounted) {
          final lat = (rows.first['lat'] as num).toDouble();
          final lng = (rows.first['lng'] as num).toDouble();
          _mapController.move(LatLng(lat, lng), 15);
          _reverse(lat, lng);
          return;
        }
      } catch (_) {/* fall through to Delhi default */}
    }
    _reverse(28.6139, 77.209);
  }

  void _onMapMoved(MapCamera camera, bool hasGesture) {
    // The pin stays centered (Uber-style): wherever the map stops IS the spot.
    final c = camera.center;
    _revTimer?.cancel();
    _revTimer = Timer(const Duration(milliseconds: 600), () => _reverse(c.latitude, c.longitude));
  }

  Future<void> _reverse(double lat, double lng) async {
    setState(() { _busy = true; });
    try {
      final place = await AppState.instance.api.geoReverse(lat, lng);
      if (!mounted) return;
      setState(() {
        _spot = PickedSpot(
          lat: lat,
          lng: lng,
          address: (place?['address'] as String?) ?? '${lat.toStringAsFixed(5)}, ${lng.toStringAsFixed(5)}',
          locality: (place?['locality'] as String?) ?? '',
          city: (place?['city'] as String?) ?? '',
          pincode: place?['pincode'] as String?,
        );
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _spot = PickedSpot(
          lat: lat, lng: lng,
          address: '${lat.toStringAsFixed(5)}, ${lng.toStringAsFixed(5)}',
          locality: '', city: '', pincode: null,
        );
      });
    } finally {
      if (mounted) setState(() { _busy = false; });
    }
  }

  Future<void> _runSearch() async {
    final q = _searchController.text.trim();
    if (q.length < 2) return;
    setState(() { _searching = true; _results = const []; });
    try {
      final rows = await AppState.instance.api.geoSearch(q);
      if (mounted) setState(() => _results = rows);
    } catch (_) {
      if (mounted) setState(() => _results = const []);
    } finally {
      if (mounted) setState(() { _searching = false; });
    }
  }

  void _jumpTo(Map<String, dynamic> r) {
    final lat = (r['lat'] as num).toDouble();
    final lng = (r['lng'] as num).toDouble();
    _mapController.move(LatLng(lat, lng), 17);
    setState(() => _results = const []);
    _reverse(lat, lng);
  }

  Future<void> _useGps() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        _toast('Location services are disabled');
        return;
      }
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
        if (perm == LocationPermission.denied) { _toast('Location permission denied'); return; }
      }
      if (perm == LocationPermission.deniedForever) { _toast('Location permission permanently denied'); return; }
      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 10),
      );
      _mapController.move(LatLng(pos.latitude, pos.longitude), 17);
      _reverse(pos.latitude, pos.longitude);
    } catch (_) {
      _toast('GPS unavailable — drag the map instead');
    }
  }

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: T1SColors.red),
    );
  }

  @override
  Widget build(BuildContext context) {
    final accent = widget.isPickup ? const Color(0xFF10B981) : T1SColors.red;
    final dark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.isPickup ? 'Pin your exact pickup point' : 'Pin your exact drop point',
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
        ),
      ),
      body: Column(
        children: [
          // Search + GPS row
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _searchController,
                    textInputAction: TextInputAction.search,
                    onSubmitted: (_) => _runSearch(),
                    decoration: InputDecoration(
                      isDense: true,
                      hintText: 'Search a place, landmark or hotspot…',
                      prefixIcon: const Icon(Icons.search, size: 18),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                      filled: true,
                      fillColor: dark ? T1SColors.slate800 : T1SColors.slate50,
                    ),
                    style: tx(context, 13),
                  ),
                ),
                const SizedBox(width: 8),
                InkWell(
                  onTap: _useGps,
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                    decoration: BoxDecoration(
                      color: const Color(0x2610B981),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0x4D10B981)),
                    ),
                    child: const Icon(Icons.gps_fixed, size: 16, color: Color(0xFF10B981)),
                  ),
                ),
              ],
            ),
          ),
          if (_searching)
            const Padding(padding: EdgeInsets.all(6), child: Text('Searching places…', style: TextStyle(fontSize: 11))),
          if (_results.isNotEmpty)
            Container(
              margin: const EdgeInsets.fromLTRB(12, 0, 12, 4),
              constraints: const BoxConstraints(maxHeight: 130),
              decoration: BoxDecoration(
                color: dark ? T1SColors.slate800 : Colors.white,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: border(context)),
              ),
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: _results.length,
                itemBuilder: (_, i) {
                  final r = _results[i];
                  return ListTile(
                    dense: true,
                    visualDensity: VisualDensity.compact,
                    leading: Icon(Icons.location_on, size: 14, color: T1SColors.red),
                    title: Text('${r['label'] ?? ''}', maxLines: 2, overflow: TextOverflow.ellipsis, style: tx(context, 11)),
                    onTap: () => _jumpTo(r),
                  );
                },
              ),
            ),
          // Map with the fixed center pin (Uber-style: map moves, pin stays)
          Expanded(
            child: Stack(
              children: [
                FlutterMap(
                  mapController: _mapController,
                  options: MapOptions(
                    initialCenter: LatLng(
                      widget.initialLat ?? 28.6139,
                      widget.initialLng ?? 77.209,
                    ),
                    initialZoom: 15,
                    onPositionChanged: _onMapMoved,
                  ),
                  children: [
                    TileLayer(
                      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'com.try1second.app',
                    ),
                  ],
                ),
                // Center pin overlay
                IgnorePointer(
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.location_on, size: 42, color: accent, shadows: const [Shadow(color: Colors.black38, blurRadius: 6)]),
                        const SizedBox(height: 36),
                      ],
                    ),
                  ),
                ),
                Positioned(
                  right: 12,
                  bottom: 12,
                  child: IgnorePointer(
                    child: Text(
                      '© OpenStreetMap contributors',
                      style: TextStyle(fontSize: 8, color: muted(context)),
                    ),
                  ),
                ),
              ],
            ),
          ),
          // Footer: resolved address + apply
          SafeArea(
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
              decoration: BoxDecoration(
                color: dark ? T1SColors.slate900 : Colors.white,
                border: Border(top: BorderSide(color: border(context))),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.isPickup ? 'PICKUP POINT' : 'DROP POINT',
                          style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: accent, letterSpacing: 1),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          _spot?.address ?? 'Drag the map to place the pin',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: tx(context, 12, w: FontWeight.w700),
                        ),
                        if (_busy) const Text('Naming address…', style: TextStyle(fontSize: 9, fontStyle: FontStyle.italic)),
                        if (_spot?.pincode != null)
                          Text('Pincode ${_spot!.pincode}${_spot!.city.isNotEmpty ? ' · ${_spot!.city}' : ''}',
                              style: TextStyle(fontSize: 9, color: muted(context))),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  ElevatedButton(
                    onPressed: _spot == null
                        ? null
                        : () => Navigator.of(context).pop(_spot),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: accent,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: Text(
                      widget.isPickup ? 'Set pickup' : 'Set drop',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
