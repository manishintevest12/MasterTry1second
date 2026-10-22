import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../core/theme.dart';
import '../widgets/kit.dart';
import '../widgets/journey_date_picker_modal.dart';

class HotelPickerResult {
  final String destination;
  final DateTime checkIn;
  final DateTime checkOut;
  final int adults;
  final int children;
  final int rooms;

  const HotelPickerResult({
    required this.destination,
    required this.checkIn,
    required this.checkOut,
    required this.adults,
    required this.children,
    required this.rooms,
  });

  String get guestsSummary =>
      '$adults Adult${adults == 1 ? '' : 's'}${children > 0 ? ' · $children Child${children == 1 ? '' : 'ren'}' : ''} · $rooms Room${rooms == 1 ? '' : 's'}';
}

class HotelPickerScreen extends StatefulWidget {
  const HotelPickerScreen({
    super.key,
    required this.initialDestination,
    required this.initialCheckIn,
    required this.initialCheckOut,
    this.initialAdults = 2,
    this.initialChildren = 0,
    this.initialRooms = 1,
  });

  final String initialDestination;
  final DateTime initialCheckIn;
  final DateTime initialCheckOut;
  final int initialAdults;
  final int initialChildren;
  final int initialRooms;

  @override
  State<HotelPickerScreen> createState() => _HotelPickerScreenState();
}

class _HotelPickerScreenState extends State<HotelPickerScreen> {
  late final TextEditingController _searchController;
  late DateTime _checkIn;
  late DateTime _checkOut;
  Timer? _typeaheadDebounce;
  List<Map<String, dynamic>> _liveResults = const [];
  bool _liveLoading = false;
  late int _adults;
  late int _children;
  late int _rooms;

  static const _popularDestinations = <Map<String, String>>[
    {'city': 'Goa, India', 'label': 'City'},
    {'city': 'Mumbai, India', 'label': 'City'},
    {'city': 'Udaipur, India', 'label': 'City'},
    {'city': 'Jaipur, India', 'label': 'City'},
    {'city': 'Bengaluru, India', 'label': 'City'},
    {'city': 'New Delhi, India', 'label': 'City'},
    {'city': 'Manali, India', 'label': 'Hill Station'},
    {'city': 'Shimla, India', 'label': 'Hill Station'},
    {'city': 'Ooty, India', 'label': 'Hill Station'},
    {'city': 'Munnar, Kerala', 'label': 'Hill Station'},
  ];

  static const _beachDestinations = <Map<String, dynamic>>[
    {'name': 'Goa', 'colors': [Color(0xFF0F766E), Color(0xFF06B6D4)]},
    {'name': 'Alibaug', 'colors': [Color(0xFF1E40AF), Color(0xFF3B82F6)]},
    {'name': 'Pondicherry', 'colors': [Color(0xFF0369A1), Color(0xFF38BDF8)]},
    {'name': 'Kovalam', 'colors': [Color(0xFF0D9488), Color(0xFF2DD4BF)]},
    {'name': 'Varkala', 'colors': [Color(0xFF0284C7), Color(0xFF60A5FA)]},
  ];

  static const _mountainDestinations = <Map<String, dynamic>>[
    {'name': 'Manali', 'colors': [Color(0xFF4C1D95), Color(0xFF8B5CF6)]},
    {'name': 'Shimla', 'colors': [Color(0xFF312E81), Color(0xFF6366F1)]},
    {'name': 'Munnar', 'colors': [Color(0xFF065F46), Color(0xFF10B981)]},
    {'name': 'Ooty', 'colors': [Color(0xFF115E59), Color(0xFF14B8A6)]},
    {'name': 'Mussoorie', 'colors': [Color(0xFF1E3A8A), Color(0xFF3B82F6)]},
  ];

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController(text: widget.initialDestination);
    _checkIn = widget.initialCheckIn;
    _checkOut = widget.initialCheckOut;
    _adults = widget.initialAdults;
    _children = widget.initialChildren;
    _rooms = widget.initialRooms;
  }

  @override
  void dispose() {
    _typeaheadDebounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  /// LIVE hotel-name + destination typeahead via /api/hotels/locations
  /// (TravelGuru autosuggest — real properties, never invented).
  void _onSearchChanged(String text) {
    _typeaheadDebounce?.cancel();
    final q = text.trim();
    if (q.length < 2) {
      if (_liveResults.isNotEmpty || _liveLoading) setState(() { _liveResults = const []; _liveLoading = false; });
      return;
    }
    setState(() => _liveLoading = true);
    _typeaheadDebounce = Timer(const Duration(milliseconds: 300), () async {
      try {
        final rows = await AppState.instance.api.hotelLocations(q);
        if (!mounted) return;
        setState(() { _liveResults = rows; _liveLoading = false; });
      } catch (_) {
        if (!mounted) return;
        setState(() { _liveResults = const []; _liveLoading = false; });
      }
    });
  }

  void _finishSelection(String destination) {
    final result = HotelPickerResult(
      destination: destination.trim().isNotEmpty ? destination.trim() : 'Goa, India',
      checkIn: _checkIn,
      checkOut: _checkOut,
      adults: _adults,
      children: _children,
      rooms: _rooms,
    );
    Navigator.pop(context, result);
  }

  /// Owner 22 Oct (mandatory date hints everywhere): check-in + check-out are
  /// now selected together in the site-parity range modal (quick pills, locked
  /// past dates, CONFIRMED CHOICE summary, Apply button).
  Future<void> _pickCheckIn() async {
    final res = await showJourneyDatePicker(
      context,
      title: 'Check-in & Check-out Dates',
      isRange: true,
      initialDeparture: _checkIn,
      initialReturn: _checkOut,
      accent: const Color(0xFF1D64FF),
    );
    if (res != null && mounted) {
      setState(() {
        _checkIn = res.departure;
        _checkOut = res.returnDate ?? _checkIn.add(const Duration(days: 1));
      });
    }
  }

  Future<void> _pickCheckOut() => _pickCheckIn();

  String _fmtDate(DateTime d) => '${d.day}/${d.month}/${d.year}';

  @override
  Widget build(BuildContext context) {
    final query = _searchController.text.trim().toLowerCase();
    final filteredPopular = _popularDestinations.where((item) {
      if (query.isEmpty) return true;
      return item['city']!.toLowerCase().contains(query) || item['label']!.toLowerCase().contains(query);
    }).toList();

    return Scaffold(
      backgroundColor: surface(context),
      appBar: AppBar(
        backgroundColor: surface(context),
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_rounded, color: ink(context)),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('Search Hotels', style: tx(context, 16, w: FontWeight.w900)),
        actions: [
          TextButton(
            onPressed: () => _finishSelection(_searchController.text),
            child: Text('Done', style: tx(context, 13.5, w: FontWeight.w900, color: T1SColors.red)),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Search Input
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: TextField(
                controller: _searchController,
                onChanged: (t) { setState(() {}); _onSearchChanged(t); },
                decoration: InputDecoration(
                  hintText: 'Search hotel, city, or country',
                  prefixIcon: const Icon(Icons.search_rounded, size: 20),
                  suffixIcon: query.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.cancel_rounded, size: 18),
                          onPressed: () {
                            _searchController.clear();
                            setState(() {});
                          },
                        )
                      : null,
                  filled: true,
                  fillColor: isDark(context) ? T1SColors.slate800 : T1SColors.slate50,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: border(context)),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: border(context)),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: T1SColors.red, width: 1.5),
                  ),
                ),
                style: tx(context, 13.5, w: FontWeight.w700),
              ),
            ),

            // Date & Guests selector card
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: isDark(context) ? T1SColors.slate800 : T1SColors.slate50,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: border(context)),
                ),
                child: Column(
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: InkWell(
                            onTap: _pickCheckIn,
                            borderRadius: BorderRadius.circular(10),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('CHECK-IN', style: tx(context, 9.5, w: FontWeight.w800, color: muted(context))),
                                const SizedBox(height: 3),
                                Row(
                                  children: [
                                    const Icon(Icons.calendar_today_rounded, size: 14, color: T1SColors.red),
                                    const SizedBox(width: 6),
                                    Text(_fmtDate(_checkIn), style: tx(context, 12, w: FontWeight.w800)),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                        Container(width: 1, height: 32, color: border(context)),
                        Expanded(
                          child: Padding(
                            padding: const EdgeInsets.only(left: 12),
                            child: InkWell(
                              onTap: _pickCheckOut,
                              borderRadius: BorderRadius.circular(10),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('CHECK-OUT', style: tx(context, 9.5, w: FontWeight.w800, color: muted(context))),
                                  const SizedBox(height: 3),
                                  Row(
                                    children: [
                                      const Icon(Icons.calendar_today_rounded, size: 14, color: T1SColors.red),
                                      const SizedBox(width: 6),
                                      Text(_fmtDate(_checkOut), style: tx(context, 12, w: FontWeight.w800)),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Divider(height: 1, color: border(context)),
                    const SizedBox(height: 10),
                    // Steppers for Adults, Children, Rooms
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        _StepperItem(
                          label: 'Adults',
                          value: _adults,
                          min: 1,
                          onChanged: (v) => setState(() => _adults = v),
                        ),
                        _StepperItem(
                          label: 'Children',
                          value: _children,
                          min: 0,
                          onChanged: (v) => setState(() => _children = v),
                        ),
                        _StepperItem(
                          label: 'Rooms',
                          value: _rooms,
                          min: 1,
                          onChanged: (v) => setState(() => _rooms = v),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 8),

            // Results / Popular lists
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: [
                  if (query.isEmpty) ...[
                    // Horizontal Beach destinations
                    Padding(
                      padding: const EdgeInsets.only(top: 8, bottom: 8),
                      child: Text('TOP BEACHES DESTINATIONS', style: tx(context, 11, w: FontWeight.w900, color: muted(context), ls: 0.8)),
                    ),
                    SizedBox(
                      height: 80,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: _beachDestinations.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 10),
                        itemBuilder: (c, i) {
                          final item = _beachDestinations[i];
                          final colors = item['colors'] as List<Color>;
                          return GestureDetector(
                            onTap: () => _finishSelection('${item['name']}, India'),
                            child: Container(
                              width: 130,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(12),
                                gradient: LinearGradient(colors: colors, begin: Alignment.topLeft, end: Alignment.bottomRight),
                              ),
                              alignment: Alignment.center,
                              padding: const EdgeInsets.all(8),
                              child: Text(
                                item['name'] as String,
                                style: tx(c, 14, w: FontWeight.w900, color: Colors.white),
                              ),
                            ),
                          );
                        },
                      ),
                    ),

                    const SizedBox(height: 12),

                    // Horizontal Mountain destinations
                    Padding(
                      padding: const EdgeInsets.only(top: 8, bottom: 8),
                      child: Text('MOUNTAIN DESTINATIONS', style: tx(context, 11, w: FontWeight.w900, color: muted(context), ls: 0.8)),
                    ),
                    SizedBox(
                      height: 80,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: _mountainDestinations.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 10),
                        itemBuilder: (c, i) {
                          final item = _mountainDestinations[i];
                          final colors = item['colors'] as List<Color>;
                          return GestureDetector(
                            onTap: () => _finishSelection('${item['name']}, India'),
                            child: Container(
                              width: 130,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(12),
                                gradient: LinearGradient(colors: colors, begin: Alignment.topLeft, end: Alignment.bottomRight),
                              ),
                              alignment: Alignment.center,
                              padding: const EdgeInsets.all(8),
                              child: Text(
                                item['name'] as String,
                                style: tx(c, 14, w: FontWeight.w900, color: Colors.white),
                              ),
                            ),
                          );
                        },
                      ),
                    ),

                    const SizedBox(height: 12),
                  ],

                  if (query.isNotEmpty) ...[
                    Padding(
                      padding: const EdgeInsets.only(top: 8, bottom: 8),
                      child: Text(
                        _liveLoading
                            ? 'SEARCHING LIVE HOTELS…'
                            : _liveResults.isNotEmpty
                                ? 'LIVE HOTELS & DESTINATIONS'
                                : 'POPULAR MATCHES',
                        style: tx(context, 11, w: FontWeight.w900, color: muted(context), ls: 0.8),
                      ),
                    ),
                    for (final r in _liveResults)
                      InkWell(
                        onTap: () {
                          final name = '${r['name'] ?? ''}'.trim();
                          final city = '${r['cityName'] ?? ''}'.trim();
                          _finishSelection(r['type'] == 'HOTEL' && city.isNotEmpty ? '$name, $city' : (city.isNotEmpty && r['type'] != 'HOTEL' ? city : name));
                        },
                        borderRadius: BorderRadius.circular(12),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
                          child: Row(
                            children: [
                              Container(
                                width: 36,
                                height: 36,
                                decoration: BoxDecoration(
                                  color: (r['type'] == 'HOTEL' ? T1SColors.blue600 : T1SColors.emerald600).withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                alignment: Alignment.center,
                                child: Icon(
                                  r['type'] == 'HOTEL' ? Icons.hotel_rounded : Icons.location_city_rounded,
                                  size: 18,
                                  color: r['type'] == 'HOTEL' ? T1SColors.blue600 : T1SColors.emerald600,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('${r['name'] ?? ''}', style: tx(context, 13, w: FontWeight.w800), maxLines: 1, overflow: TextOverflow.ellipsis),
                                    const SizedBox(height: 2),
                                    Text(
                                      r['type'] == 'HOTEL'
                                          ? 'Hotel in ${r['cityName'] ?? ''}${(r['stateName'] ?? '') != '' ? ', ${r['stateName']}' : ''}'
                                          : 'Destination · ${r['stateName'] ?? ''}',
                                      style: tx(context, 10.5, color: muted(context)),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ),
                              ),
                              Icon(Icons.chevron_right_rounded, color: muted(context), size: 20),
                            ],
                          ),
                        ),
                      ),
                  ],

                  Padding(
                    padding: const EdgeInsets.only(top: 8, bottom: 8),
                    child: Text('POPULAR RIGHT NOW', style: tx(context, 11, w: FontWeight.w900, color: muted(context), ls: 0.8)),
                  ),

                  for (final item in filteredPopular)
                    InkWell(
                      onTap: () => _finishSelection(item['city']!),
                      borderRadius: BorderRadius.circular(12),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
                        child: Row(
                          children: [
                            Container(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                color: T1SColors.red.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                item['city']![0].toUpperCase(),
                                style: tx(context, 15, w: FontWeight.w900, color: T1SColors.red),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(item['city']!, style: tx(context, 13, w: FontWeight.w800)),
                                  const SizedBox(height: 2),
                                  Text(item['label']!, style: tx(context, 10.5, color: muted(context))),
                                ],
                              ),
                            ),
                            Icon(Icons.chevron_right_rounded, color: muted(context), size: 20),
                          ],
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
}

class _StepperItem extends StatelessWidget {
  const _StepperItem({
    required this.label,
    required this.value,
    required this.min,
    required this.onChanged,
  });

  final String label;
  final int value;
  final int min;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: tx(context, 10, w: FontWeight.w800, color: muted(context))),
            const SizedBox(height: 2),
            Row(
              children: [
                _StepBtn(
                  icon: Icons.remove,
                  onTap: value > min ? () => onChanged(value - 1) : null,
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Text('$value', style: tx(context, 12, w: FontWeight.w900)),
                ),
                _StepBtn(
                  icon: Icons.add,
                  onTap: () => onChanged(value + 1),
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }
}

class _StepBtn extends StatelessWidget {
  const _StepBtn({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(3),
        decoration: BoxDecoration(
          color: onTap == null ? (isDark(context) ? T1SColors.slate800 : T1SColors.slate200) : T1SColors.red,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Icon(icon, size: 14, color: onTap == null ? muted(context) : Colors.white),
      ),
    );
  }
}
