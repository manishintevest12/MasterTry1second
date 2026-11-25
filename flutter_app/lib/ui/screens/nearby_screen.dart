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
  /// OWNER 17 Nov: petrol, CNG, LPG, repairs, tyres, battery, denting, car wash, detailing, PUCC, insurance, RTO,
  /// rentals and scrapping — the everyday errands around a vehicle, answered by the same OSM data as the rest.
  static const _vehicleCategories = <String>[
    'petrol', 'cng', 'ev_charging', 'lpg', 'car_repair', 'bike_repair', 'puncture', 'battery', 'tyres', 'denting',
    'accessories', 'car_wash', 'detailing', 'pucc', 'insurance', 'rto', 'bike_rental', 'car_rental', 'scrapping',
  ];

  /// The id is the API contract; the label is what a person reads (an underscore would look like a bug).
  static const _categoryLabels = <String, String>{
    'all': 'All',
    'restaurants': 'Restaurants',
    'cafes': 'Cafes',
    'hotels': 'Hotels',
    'stays': 'Stays',
    'cabs': 'Cabs',
    'stores': 'Stores',
    'movies': 'Cinemas',
    'petrol': 'Petrol Pumps',
    'cng': 'CNG Stations',
    'ev_charging': 'EV Charging',
    'lpg': 'LPG & Gas',
    'car_repair': 'Car Repair',
    'bike_repair': 'Bike Repair',
    'puncture': 'Puncture',
    'battery': 'Battery Shops',
    'tyres': 'Tyre Shops',
    'denting': 'Denting & Painting',
    'accessories': 'Accessories',
    'car_wash': 'Car Wash',
    'detailing': 'Detailing',
    'pucc': 'PUCC Centres',
    'insurance': 'Insurance Offices',
    'rto': 'RTO Office',
    'bike_rental': 'Bike & Scooty Rentals',
    'car_rental': 'Car Rentals',
    'scrapping': 'Vehicle Scrapping',
  };
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
    // OWNER 16 Nov: "nearby mai muje click na krna pde use my location, wo by default hi kare hamesha".
    // The screen now anchors on the phone's own location the moment it opens: permission is asked once, the last
    // known fix paints immediately, and a live fix refines it. Only when location is off or refused does it fall
    // back to the city box (and the button stays there for a manual re-sync).
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final located = await _locateQuietly();
    if (!located && mounted) await _load();
  }

  /// The automatic version of _useMyLocation: no error banners for a normal refusal, no double load, and never a
  /// blocking wait - a fix that takes longer than the last known one just lands when it lands.
  Future<bool> _locateQuietly() async {
    if (_locating) return false;
    if (mounted) setState(() => _locating = true);
    try {
      if (!await Geolocator.isLocationServiceEnabled()) return false;
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) return false;
      var painted = false;
      final last = await Geolocator.getLastKnownPosition().catchError((_) => null);
      if (last != null) {
        await _load(lat: last.latitude, lng: last.longitude, city: null, located: true);
        painted = true;
      }
      try {
        final pos = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.medium)
            .timeout(const Duration(seconds: 10));
        await _load(lat: pos.latitude, lng: pos.longitude, city: null, located: true);
        return true;
      } catch (_) {
        // A live fix that never arrives must not throw away a list built from the last known one.
        return painted;
      }
    } catch (_) {
      return false;
    } finally {
      if (mounted) setState(() => _locating = false);
    }
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
        // A FULL first page is itself evidence of more, even if an older or cached server answer omits
        // hasMore. If that guess is wrong the next press returns nothing new and the footer removes itself,
        // so the cost is one wasted request - cheaper than a list that dead-ends at 20 with no way forward.
        _hasMore = res.places.isNotEmpty && (res.hasMore || res.places.length >= _pageSize);
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
        _hasMore = appended.isNotEmpty && (res.hasMore || appended.length >= _pageSize);
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

  /// OWNER 14 Nov: "book button is not working in the app" — the server mints exits as root-relative
  /// masking pointers (`/api/out?t=...`), which need [exitUrl] on a phone.
  ///
  /// OWNER 21 Nov: "nearby section mai visit/book pr click krne se app mai website... app mai try1second ke
  /// andar hi jata hai... site ke bahar partner site pr jana chaiye." A Custom Tab (inAppBrowserView) still
  /// looks and feels like our own chrome, so the shopper never sees that they left. Nearby is a discovery
  /// surface — like the mobile site, its Visit/book hands the shopper to the partner in their own browser:
  /// externalApplication, same as the site's target=_blank. The `/api/out?t=` pointer still records the click
  /// server-side because the partner page is loaded through it.
  /// True when a link already IS a map page: Google Maps, Apple/OSM, or a `geo:` intent.
  static bool _isMapUrl(String url) {
    final u = Uri.tryParse(url.trim());
    if (u == null) return false;
    final scheme = u.scheme.toLowerCase();
    if (scheme == 'geo' || scheme == 'maps') return true;
    final host = u.host.toLowerCase();
    final path = u.path.toLowerCase();
    if (host.startsWith('maps.google.')) return true;
    if (host.contains('google.') && path.contains('maps')) return true;
    if (host == 'goo.gl' || host == 'maps.app.goo.gl') return true;
    if (host.contains('openstreetmap.org')) return true;
    return false;
  }

  /// The ONE place a card's "Get directions" may go: Google Maps.
  ///
  /// OWNER 25 Nov ("directin google map pr le jaayega, abhi kahi kahi ni le jata"): the button fell back to
  /// `exitUrl` whenever the feed sent no directionsUrl, so it opened the merchant's own page instead of a map.
  /// When there is no usable map link, the destination is built from what the card already shows (name + address),
  /// so the tap always lands on directions and never on a shop.
  static Uri _directionsUri(NearbyPlace p) {
    final raw = p.directionsUrl.trim();
    if (raw.isNotEmpty && _isMapUrl(raw)) {
      final u = Uri.tryParse(raw);
      if (u != null) return u;
    }
    final query = [p.name, p.address].where((x) => x != null && x.trim().isNotEmpty).join(', ');
    return Uri.parse('https://www.google.com/maps/search/?api=1&query=${Uri.encodeQueryComponent(query)}');
  }

  /// Directions leave the app for the maps app; a failure falls back to the plain intent, never to a dead button.
  Future<void> _openMap(NearbyPlace p) async {
    final uri = _directionsUri(p);
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      try { await launchUrl(uri); } catch (_) {}
    }
  }

  Future<void> _open(String url) async {
    // A map link must leave the app for the maps app: an in-app browser would only show a map inside our own chrome.
    final parsed = Uri.tryParse(url);
    if (parsed?.host.contains('google.com') == true && (parsed?.path.contains('maps') ?? false)) {
      try { await launchUrl(parsed!, mode: LaunchMode.externalApplication); return; } catch (_) {}
    }
    // OWNER 22 Nov ("nearby vertical mai visit/book ka try1second ke andar hi redirect hota hai"): the card's
    // link is our OWN masking pointer (try1second.com/api/out?t=...), and the app holds autoVerify App Links for
    // try1second.com — so ACTION_VIEW never reached a browser, Android handed the link back to this app and the
    // shopper stayed inside Try1Second. Resolve the pointer to the partner url FIRST (the same request records
    // the click), then hand THAT to the OS: no App Link of ours can claim a partner host, so the phone's browser
    // opens and Nearby leaves the app exactly like every other vertical.
    final abs = await AppState.instance.api.resolveExitPointer(url);
    final uri = Uri.tryParse(abs);
    if (uri == null || !uri.hasScheme) return;
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      // Last resort: the platform browser intent. Never leave a dead button.
      try { await launchUrl(uri); } catch (_) {}
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
                    // Keep the anchor the list was built with: tapping "Cabs" while on GPS used to reload a
                    // different (city) place without saying so.
                    _load(lat: _lat, lng: _lng, located: _located);
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                    decoration: BoxDecoration(
                      color: active ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: active ? const Color(0xFF0F172A) : const Color(0xFFE2E8F0)),
                    ),
                    child: Text(
                      _categoryLabels[c] ?? (c[0].toUpperCase() + c.substring(1)),
                      style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: active ? Colors.white : const Color(0xFF0F172A)),
                    ),
                  ),
                );
              },
            ),
          ),
          // Vehicle & paperwork errands (owner 17 Nov): same tap behaviour, on their own scrollable row.
          SizedBox(
            height: 40,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              itemCount: _vehicleCategories.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) {
                final c = _vehicleCategories[i];
                final active = c == _category;
                return GestureDetector(
                  onTap: () {
                    setState(() => _category = c);
                    _load(lat: _lat, lng: _lng, located: _located);
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                    decoration: BoxDecoration(
                      color: active ? T1SColors.red : const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: active ? T1SColors.red : const Color(0xFFE2E8F0)),
                    ),
                    child: Text(
                      _categoryLabels[c] ?? c,
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: active ? Colors.white : const Color(0xFF0F172A)),
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
              // OWNER 25 Nov ("price 2 dikh raha hai ek hi dikhana chaiye"): the label already carries the amount
              // ("₹150 for two") and the bare number was printed again right beside it. One price per card: the
              // labelled one when the feed sent a label, otherwise the amount.
              if (p.priceLabel != null)
                Text(p.priceLabel!, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: const Color(0xFF0F172A)))
              else if (p.price != null)
                Text('₹${p.price!.round()}', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: const Color(0xFF0F172A))),
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
              if (p.exitUrl.isNotEmpty && !p.serviceOnly)
                FilledButton(
                  // OWNER 17 Nov: a place that only exists on the map opens the MAP. The old code handed this row a
                  // link to our own site, the App Link swallowed it and the person landed on the Bus tab.
                  onPressed: () => p.mapOnly ? _openMap(p) : _open(p.exitUrl),
                  style: FilledButton.styleFrom(backgroundColor: const Color(0xFF0F172A), padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8)),
                  child: Text(p.mapOnly ? 'Open in Maps' : 'Visit / book',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
                ),
              const SizedBox(width: 8),
              OutlinedButton(
                onPressed: () => _openMap(p),
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
