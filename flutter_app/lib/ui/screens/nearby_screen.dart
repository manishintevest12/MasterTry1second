import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api.dart';
import '../../core/app_state.dart';
import '../../core/theme.dart';

/// Nearby & local discovery (owner 13 Nov).
///
/// Cards render only what the source supplies. Google Places (when the server has a key) gives rating,
/// review count and price level; OpenStreetMap gives name, address and distance and nothing else, so those
/// cards honestly say "rating unknown" instead of inventing a star count.
class NearbyScreen extends StatefulWidget {
  const NearbyScreen({super.key});

  @override
  State<NearbyScreen> createState() => _NearbyScreenState();
}

class _NearbyScreenState extends State<NearbyScreen> {
  static const _categories = <String>['all', 'restaurants', 'cafes', 'hotels', 'stays', 'cabs', 'stores', 'movies'];
  final _cityController = TextEditingController();
  String _category = 'all';
  List<NearbyPlace> _rows = const [];
  List<String> _notes = const [];
  String _where = '';
  bool _loading = false;
  String? _error;

  // ---- paging (owner 14 Nov: "add load more option at the end of the page") -------------------------
  // One page is fetched at a time and appended. `_total` and `_hasMore` come from the server, so "Load more"
  // is drawn only while there really is another page - never a button that returns nothing.
  static const _pageSize = 20;
  bool _loadingMore = false;
  bool _hasMore = false;
  int _total = 0;

  // The anchor the current list was loaded with, so every page comes from the same place:
  // your GPS fix when you tapped "Use my location", otherwise the city you typed.
  double? _lat;
  double? _lng;
  String? _cityAnchor;

  /// True once the list is built from the device's own location, so the UI can say so instead of guessing.
  bool _located = false;
  bool _locating = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _cityController.dispose();
    super.dispose();
  }

  /// Load page one for an anchor. A new search or category always starts from the top.
  Future<void> _load({double? lat, double? lng, String? city, bool located = false}) async {
    final anchorCity = city ?? (_cityController.text.trim().isEmpty ? null : _cityController.text.trim());
    setState(() {
      _loading = true;
      _error = null;
      _lat = lat;
      _lng = lng;
      _cityAnchor = anchorCity;
      _located = located && lat != null && lng != null;
      _rows = const [];
      _hasMore = false;
      _total = 0;
    });
    try {
      final res = await Try1SecondApi().nearby(
        lat: lat,
        lng: lng,
        city: anchorCity,
        category: _category,
        limit: _pageSize,
        offset: 0,
      );
      if (!mounted) return;
      setState(() {
        _rows = res.places;
        _notes = res.notes;
        _where = res.city ?? (anchorCity ?? '');
        _total = res.total;
        _hasMore = res.hasMore && res.places.isNotEmpty;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString().replaceFirst('Exception: ', '');
        _rows = const [];
        _hasMore = false;
      });
    }
  }

  /// Next page for the SAME anchor, appended after the cards already on screen (deduped by server id).
  Future<void> _loadMore() async {
    if (_loadingMore || !_hasMore) return;
    setState(() {
      _loadingMore = true;
      _error = null;
    });
    try {
      final res = await Try1SecondApi().nearby(
        lat: _lat,
        lng: _lng,
        city: _lat == null ? _cityAnchor : null,
        category: _category,
        limit: _pageSize,
        offset: _rows.length,
      );
      if (!mounted) return;
      final seen = _rows.map((r) => r.id).toSet();
      final appended = res.places.where((p) => !seen.contains(p.id)).toList();
      setState(() {
        _rows = [..._rows, ...appended];
        _total = res.total;
        // No new rows means the tail is genuinely exhausted even if the count said otherwise, so the button
        // disappears instead of asking again for the same page.
        _hasMore = res.hasMore && appended.isNotEmpty;
        _loadingMore = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadingMore = false;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _useMyLocation() async {
    if (_locating) return;
    setState(() {
      _locating = true;
      _error = null;
    });
    try {
      final enabled = await Geolocator.isLocationServiceEnabled();
      if (!enabled) {
        setState(() {
          _error = 'Location service off hai, city box se search karo.';
          _locating = false;
        });
        return;
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
        setState(() {
          _error = 'Location permission nahi mili - city box use karo.';
          _locating = false;
        });
        return;
      }
      final pos = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.medium);
      await _load(lat: pos.latitude, lng: pos.longitude, city: null, located: true);
    } catch (e) {
      setState(() {
        _error = 'Location nahi mili: ${e.toString()}';
        _locating = false;
      });
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  /// OWNER 14 Nov: "book button is not working in the app".
  ///
  /// The server mints exits as root-relative masking pointers (`/api/out?t=...`), which are perfect
  /// for a browser (it has an origin) and useless to a phone (it does not). Every other surface in
  /// the app resolves them through [exitUrl]; nearby did not, so the tap threw away the url and
  /// nothing opened. Now it takes the same route, and falls back to an external open when the
  /// device has no Custom Tabs provider - a dead book button is worse than a browser hop.
  Future<void> _open(String url) async {
    final abs = exitUrl(url);
    final uri = Uri.tryParse(abs);
    if (uri == null || !uri.hasScheme) return;
    try {
      final opened = await launchUrl(uri, mode: LaunchMode.inAppBrowserView);
      if (!opened) await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Text('Nearby', style: const TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.w800)),
        actions: [
          IconButton(
            tooltip: 'Use my location',
            onPressed: _useMyLocation,
            icon: const Icon(Icons.near_me_outlined, color: Color(0xFF0F172A)),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _cityController,
                    style: TextStyle(color: const Color(0xFF0F172A), fontSize: 13),
                    textInputAction: TextInputAction.search,
                    onSubmitted: (_) => _load(),
                    decoration: InputDecoration(
                      isDense: true,
                      hintText: 'City or area (e.g. Pune)',
                      hintStyle: TextStyle(color: const Color(0xFF64748B), fontSize: 12),
                      filled: true,
                      fillColor: const Color(0xFFF8FAFC),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: () => _load(),
                  style: FilledButton.styleFrom(backgroundColor: T1SColors.red, padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12)),
                  child: const Text('Search', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                ),
              ],
            ),
          ),
          // Owner 14 Nov: "give use my location option in nearby vertical" - it is now a labelled button in the
          // body, not only the app-bar icon, so nobody has to guess what the compass does.
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
            child: Row(
              children: [
                OutlinedButton.icon(
                  onPressed: _locating ? null : _useMyLocation,
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    side: BorderSide(color: _located ? T1SColors.red : const Color(0xFFE2E8F0)),
                    backgroundColor: _located ? const Color(0xFFFFF1F2) : Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                  ),
                  icon: _locating
                      ? SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: T1SColors.red))
                      : Icon(Icons.my_location, size: 16, color: _located ? T1SColors.red : const Color(0xFF0F172A)),
                  label: Text(
                    _locating ? 'Finding you...' : (_located ? 'Using your location' : 'Use my location'),
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w800,
                      color: _located ? T1SColors.red : const Color(0xFF0F172A),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                if (_located)
                  Flexible(
                    child: Text(
                      'Showing places around your GPS position',
                      style: TextStyle(fontSize: 10.5, color: const Color(0xFF64748B)),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
            ),
          ),
          SizedBox(
            height: 46,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              itemCount: _categories.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) {
                final c = _categories[i];
                final active = c == _category;
                return GestureDetector(
                  onTap: () {
                    setState(() => _category = c);
                    _load();
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                    decoration: BoxDecoration(
                      color: active ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: active ? const Color(0xFF0F172A) : const Color(0xFFE2E8F0)),
                    ),
                    child: Text(
                      c[0].toUpperCase() + c.substring(1),
                      style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: active ? Colors.white : const Color(0xFF0F172A)),
                    ),
                  ),
                );
              },
            ),
          ),
          if (_where.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text('Around $_where', style: TextStyle(fontSize: 11, color: const Color(0xFF64748B))),
              ),
            ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Text(_error!, style: TextStyle(fontSize: 11.5, color: T1SColors.red)),
            ),
          if (_notes.isNotEmpty && _rows.isEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Text(_notes.first, style: TextStyle(fontSize: 11, color: const Color(0xFF64748B))),
            ),
          Expanded(
            child: _loading
                ? Center(child: CircularProgressIndicator(color: T1SColors.red))
                : _rows.isEmpty
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Text(
                            'Is area ke liye abhi koi live place nahi mila, isliye kuch bhi invent nahi kiya gaya.',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: const Color(0xFF64748B), fontSize: 12.5),
                          ),
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        // Cards + one footer row that holds "Load more". The footer exists only while another
                        // page really exists, so the end of the honest list is also the end of the page.
                        itemCount: _rows.length + (_hasMore || _loadingMore ? 1 : 0),
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (_, i) {
                          if (i < _rows.length) return _card(_rows[i]);
                          return _loadMoreFooter();
                        },
                      ),
          ),
        ],
      ),
    );
  }

  /// "Load more" at the end of the page (owner 14 Nov). It states exactly how many of how many are on screen,
  /// because the list is not infinite: the server holds at most 60 rows for one spot.
  Widget _loadMoreFooter() {
    final shown = _rows.length;
    final total = _total > 0 ? _total : shown;
    return Padding(
      padding: const EdgeInsets.only(top: 4, bottom: 8),
      child: Column(
        children: [
          Text(
            total > shown ? '$shown of $total places shown' : '$shown places shown',
            style: TextStyle(fontSize: 10.5, color: const Color(0xFF64748B)),
          ),
          const SizedBox(height: 6),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: _loadingMore ? null : _loadMore,
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 12),
                side: const BorderSide(color: Color(0xFFE2E8F0)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _loadingMore
                  ? SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: T1SColors.red))
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.expand_more, size: 18, color: const Color(0xFF0F172A)),
                        const SizedBox(width: 4),
                        Text('Load more', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: const Color(0xFF0F172A))),
                      ],
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _card(NearbyPlace p) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // OWNER 13 Nov: "image compulsory hai" - the server always ships one (partner photo, the business's
          // own og:image, or a labelled category tile), so the card always draws an image.
          if ((p.imageUrl ?? '').isNotEmpty)
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.network(
                p.imageUrl!.startsWith('http') ? p.imageUrl! : '${AppState.instance.api.baseUrl}${p.imageUrl}',
                height: 140,
                width: double.infinity,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(
                  height: 140,
                  alignment: Alignment.center,
                  color: const Color(0xFFF1F5F9),
                  child: Icon(Icons.image_outlined, color: const Color(0xFF94A3B8)),
                ),
              ),
            ),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(p.name, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: const Color(0xFF0F172A))),
                    if (p.subcategory != null)
                      Text(p.subcategory!, style: TextStyle(fontSize: 11, color: const Color(0xFF64748B))),
                  ],
                ),
              ),
              if (p.distanceKm != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(999)),
                  child: Text('${p.distanceKm} km', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: const Color(0xFF0F172A))),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 10,
            runSpacing: 4,
            children: [
              if (p.rating != null)
                Text('⭐ ${p.rating!.toStringAsFixed(1)}${p.ratingCount != null ? ' (${p.ratingCount})' : ''}',
                    style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: const Color(0xFFB45309)))
              else
                Text('rating unknown', style: TextStyle(fontSize: 11, color: const Color(0xFF64748B))),
              if (p.priceLabel != null) Text(p.priceLabel!, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: const Color(0xFF0F172A))),
              if (p.price != null) Text('₹${p.price!.round()}', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: const Color(0xFF0F172A))),
            ],
          ),
          if (p.address != null) ...[
            const SizedBox(height: 4),
            Text(p.address!, style: TextStyle(fontSize: 11, color: const Color(0xFF64748B))),
          ],
          const SizedBox(height: 4),
          Text(p.honesty, style: TextStyle(fontSize: 9.5, color: const Color(0xFF64748B))),
          const SizedBox(height: 8),
          Row(
            children: [
              if (p.exitUrl.isNotEmpty)
                FilledButton(
                  onPressed: () => _open(p.exitUrl),
                  style: FilledButton.styleFrom(backgroundColor: const Color(0xFF0F172A), padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8)),
                  child: const Text('Visit / book', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
                ),
              const SizedBox(width: 8),
              OutlinedButton(
                onPressed: () => _open(p.directionsUrl),
                style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8)),
                child: const Text('Get directions', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
