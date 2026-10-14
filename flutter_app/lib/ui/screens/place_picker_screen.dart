import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../core/places_data.dart';
import '../../core/theme.dart';
import '../widgets/kit.dart';

/// Full-screen PlacePickerScreen for Flights From/To.
class PlacePickerScreen extends StatefulWidget {
  const PlacePickerScreen({
    super.key,
    required this.isFrom,
    required this.fromCity,
    required this.toCity,
  });

  final bool isFrom;
  final String fromCity;
  final String toCity;

  @override
  State<PlacePickerScreen> createState() => _PlacePickerScreenState();
}

class _PlacePickerScreenState extends State<PlacePickerScreen> {
  late bool _selectingFrom;
  final _searchController = TextEditingController();
  List<PlaceItem> _filteredPlaces = kAllAirports;

  @override
  void initState() {
    super.initState();
    _selectingFrom = widget.isFrom;
    _searchController.addListener(_onSearchChanged);
  }

  @override
  void dispose() {
    _searchController.removeListener(_onSearchChanged);
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged() {
    setState(() {
      _filteredPlaces = searchAirports(_searchController.text);
    });
  }

  PlaceItem? _getNearYouPlace() {
    final userCity = AppState.instance.city.trim().toLowerCase();
    if (userCity.isEmpty) return null;
    return kAllAirports.firstWhere(
      (p) => p.city.toLowerCase().contains(userCity) || userCity.contains(p.city.toLowerCase()),
      orElse: () => kAllAirports.firstWhere(
        (p) => p.iata == 'DEL' || p.iata == 'BOM',
        orElse: () => kAllAirports.first,
      ),
    );
  }

  void _selectPlace(PlaceItem item) {
    Navigator.pop(context, item.formatted);
  }

  @override
  Widget build(BuildContext context) {
    final query = _searchController.text.trim();
    final nearYou = _getNearYouPlace();

    return Scaffold(
      backgroundColor: surface(context),
      appBar: AppBar(
        backgroundColor: surface(context),
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.close_rounded, color: ink(context)),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          _selectingFrom ? 'Select Departure City' : 'Select Destination City',
          style: tx(context, 16, w: FontWeight.w900),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Header rows
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Container(
                decoration: BoxDecoration(
                  color: isDark(context) ? T1SColors.slate800 : T1SColors.slate50,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: border(context)),
                ),
                child: Column(
                  children: [
                    _HeaderRow(
                      label: 'From',
                      value: widget.fromCity.isNotEmpty ? widget.fromCity : 'Select city',
                      isSelected: _selectingFrom,
                      onTap: () => setState(() => _selectingFrom = true),
                    ),
                    Divider(height: 1, color: border(context)),
                    _HeaderRow(
                      label: 'To',
                      value: widget.toCity.isNotEmpty ? widget.toCity : 'Select city',
                      isSelected: !_selectingFrom,
                      onTap: () => setState(() => _selectingFrom = false),
                    ),
                  ],
                ),
              ),
            ),

            // Search input field
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
              child: TextField(
                controller: _searchController,
                autofocus: true,
                decoration: InputDecoration(
                  hintText: 'Search city or airport',
                  prefixIcon: const Icon(Icons.search_rounded, size: 20),
                  suffixIcon: query.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.cancel_rounded, size: 18),
                          onPressed: () {
                            _searchController.clear();
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

            // List of places
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: [
                  if (query.isEmpty) ...[
                    if (nearYou != null) ...[
                      Padding(
                        padding: const EdgeInsets.only(top: 8, bottom: 8),
                        child: Text(
                          'NEAR YOU',
                          style: tx(context, 11, w: FontWeight.w900, color: muted(context), ls: 0.8),
                        ),
                      ),
                      _PlaceRow(
                        item: nearYou,
                        onTap: () => _selectPlace(nearYou),
                      ),
                      const SizedBox(height: 12),
                    ],
                    Padding(
                      padding: const EdgeInsets.only(top: 8, bottom: 8),
                      child: Text(
                        'POPULAR SEARCHES',
                        style: tx(context, 11, w: FontWeight.w900, color: muted(context), ls: 0.8),
                      ),
                    ),
                  ],

                  for (final item in _filteredPlaces)
                    _PlaceRow(
                      item: item,
                      onTap: () => _selectPlace(item),
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

class _HeaderRow extends StatelessWidget {
  const _HeaderRow({
    required this.label,
    required this.value,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final String value;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        decoration: BoxDecoration(
          color: isSelected ? T1SColors.red.withValues(alpha: 0.08) : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          border: isSelected ? Border.all(color: T1SColors.red.withValues(alpha: 0.5), width: 1.5) : null,
        ),
        child: Row(
          children: [
            Text(
              label,
              style: tx(
                context,
                11,
                w: FontWeight.w800,
                color: isSelected ? T1SColors.red : muted(context),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: tx(
                  context,
                  13.5,
                  w: isSelected ? FontWeight.w900 : FontWeight.w700,
                  color: isSelected ? ink(context) : muted(context),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PlaceRow extends StatelessWidget {
  const _PlaceRow({
    required this.item,
    required this.onTap,
  });

  final PlaceItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: isDark(context) ? T1SColors.slate800 : T1SColors.slate100,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.flight_takeoff_rounded,
                size: 18,
                color: T1SColors.red,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${item.city}, ${item.country}',
                    style: tx(context, 13, w: FontWeight.w800),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    item.airport,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: tx(context, 10.5, color: muted(context)),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: isDark(context) ? T1SColors.slate800 : T1SColors.slate100,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                item.iata,
                style: tx(context, 12, w: FontWeight.w900, mono: true),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
