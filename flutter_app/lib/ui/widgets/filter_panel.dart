import 'package:flutter/material.dart';

import '../../core/compare.dart';
import '../../core/theme.dart';
import 'kit.dart';

enum SortOrder { best, priceLowToHigh, priceHighToLow }

class FilterOptions {
  final SortOrder sortOrder;
  final double? minPrice;
  final double? maxPrice;
  final Set<String> selectedSellers;
  final bool vegOnly;
  final Set<String> departureBuckets; // 'Morning', 'Afternoon', 'Evening', 'Night'
  final Set<int> starRatings; // 3, 4, 5

  const FilterOptions({
    this.sortOrder = SortOrder.best,
    this.minPrice,
    this.maxPrice,
    this.selectedSellers = const {},
    this.vegOnly = false,
    this.departureBuckets = const {},
    this.starRatings = const {},
  });

  FilterOptions copyWith({
    SortOrder? sortOrder,
    double? minPrice,
    double? maxPrice,
    Set<String>? selectedSellers,
    bool? vegOnly,
    Set<String>? departureBuckets,
    Set<int>? starRatings,
  }) {
    return FilterOptions(
      sortOrder: sortOrder ?? this.sortOrder,
      minPrice: minPrice ?? this.minPrice,
      maxPrice: maxPrice ?? this.maxPrice,
      selectedSellers: selectedSellers ?? this.selectedSellers,
      vegOnly: vegOnly ?? this.vegOnly,
      departureBuckets: departureBuckets ?? this.departureBuckets,
      starRatings: starRatings ?? this.starRatings,
    );
  }

  int activeCount(double boundsMin, double boundsMax) {
    int count = 0;
    if (sortOrder != SortOrder.best) count++;
    if (minPrice != null && minPrice! > boundsMin + 0.5) count++;
    if (maxPrice != null && maxPrice! < boundsMax - 0.5) count++;
    if (selectedSellers.isNotEmpty) count++;
    if (vegOnly) count++;
    if (departureBuckets.isNotEmpty) count++;
    if (starRatings.isNotEmpty) count++;
    return count;
  }
}

class FilterPanel extends StatefulWidget {
  const FilterPanel({
    super.key,
    required this.vertical,
    required this.items,
    required this.options,
    required this.onChanged,
  });

  final String vertical;
  final List<CompareItem> items;
  final FilterOptions options;
  final ValueChanged<FilterOptions> onChanged;

  @override
  State<FilterPanel> createState() => _FilterPanelState();
}

class _FilterPanelState extends State<FilterPanel> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    if (widget.items.isEmpty) return const SizedBox.shrink();

    // Compute actual bounds & sellers from real items
    double boundsMin = double.infinity;
    double boundsMax = 0;
    final sellers = <String>{};

    for (final it in widget.items) {
      final p = it.bestQuote?.price ?? 0;
      if (p > 0) {
        if (p < boundsMin) boundsMin = p;
        if (p > boundsMax) boundsMax = p;
      }
      for (final q in it.sellerQuotes) {
        if (q.sellerName.isNotEmpty) sellers.add(q.sellerName);
      }
      if (it.provider.isNotEmpty) sellers.add(it.provider);
    }

    if (boundsMin == double.infinity) boundsMin = 0;
    final hasPriceRange = boundsMax > boundsMin;

    final currentMin = widget.options.minPrice ?? boundsMin;
    final currentMax = widget.options.maxPrice ?? boundsMax;

    final activeCount = widget.options.activeCount(boundsMin, boundsMax);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Collapsible header bar
        Row(
          children: [
            GestureDetector(
              onTap: () => setState(() => _expanded = !_expanded),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                decoration: BoxDecoration(
                  color: activeCount > 0
                      ? T1SColors.red.withValues(alpha: 0.1)
                      : (isDark(context) ? T1SColors.slate800 : T1SColors.slate50),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: activeCount > 0 ? T1SColors.red : border(context)),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.filter_list_rounded,
                      size: 16,
                      color: activeCount > 0 ? T1SColors.red : muted(context),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'Filters',
                      style: tx(
                        context,
                        11.5,
                        w: FontWeight.w800,
                        color: activeCount > 0 ? T1SColors.red : ink(context),
                      ),
                    ),
                    if (activeCount > 0) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: T1SColors.red,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          '$activeCount',
                          style: tx(context, 9.5, w: FontWeight.w900, color: Colors.white),
                        ),
                      ),
                    ],
                    const SizedBox(width: 4),
                    Icon(
                      _expanded ? Icons.expand_less_rounded : Icons.expand_more_rounded,
                      size: 18,
                      color: muted(context),
                    ),
                  ],
                ),
              ),
            ),
            if (activeCount > 0) ...[
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () => widget.onChanged(const FilterOptions()),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
                  child: Text('Reset', style: tx(context, 11, w: FontWeight.w800, color: T1SColors.red)),
                ),
              ),
            ],
          ],
        ),

        if (_expanded) ...[
          const SizedBox(height: 10),
          Box(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. Sort options
                Text('SORT BY', style: tx(context, 10, w: FontWeight.w900, color: muted(context))),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    _SortChip(
                      label: 'Best Value',
                      selected: widget.options.sortOrder == SortOrder.best,
                      onTap: () => widget.onChanged(widget.options.copyWith(sortOrder: SortOrder.best)),
                    ),
                    _SortChip(
                      label: 'Price: Low to High',
                      selected: widget.options.sortOrder == SortOrder.priceLowToHigh,
                      onTap: () => widget.onChanged(widget.options.copyWith(sortOrder: SortOrder.priceLowToHigh)),
                    ),
                    _SortChip(
                      label: 'Price: High to Low',
                      selected: widget.options.sortOrder == SortOrder.priceHighToLow,
                      onTap: () => widget.onChanged(widget.options.copyWith(sortOrder: SortOrder.priceHighToLow)),
                    ),
                  ],
                ),

                // 2. Price Range Slider
                if (hasPriceRange) ...[
                  const SizedBox(height: 14),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('PRICE RANGE', style: tx(context, 10, w: FontWeight.w900, color: muted(context))),
                      Text(
                        '₹${currentMin.round()} - ₹${currentMax.round()}',
                        style: tx(context, 11, w: FontWeight.w900, mono: true),
                      ),
                    ],
                  ),
                  RangeSlider(
                    values: RangeValues(currentMin.clamp(boundsMin, boundsMax), currentMax.clamp(boundsMin, boundsMax)),
                    min: boundsMin,
                    max: boundsMax,
                    activeColor: T1SColors.red,
                    inactiveColor: border(context),
                    onChanged: (vals) {
                      widget.onChanged(widget.options.copyWith(
                        minPrice: vals.start,
                        maxPrice: vals.end,
                      ));
                    },
                  ),
                ],

                // 3. Seller Multi-select Chips
                if (sellers.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Text('SELLERS', style: tx(context, 10, w: FontWeight.w900, color: muted(context))),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      for (final s in sellers)
                        FilterChip(
                          label: Text(s, style: tx(context, 10.5, w: FontWeight.w700)),
                          selected: widget.options.selectedSellers.contains(s),
                          selectedColor: T1SColors.red.withValues(alpha: 0.15),
                          checkmarkColor: T1SColors.red,
                          onSelected: (sel) {
                            final next = Set<String>.from(widget.options.selectedSellers);
                            if (sel) {
                              next.add(s);
                            } else {
                              next.remove(s);
                            }
                            widget.onChanged(widget.options.copyWith(selectedSellers: next));
                          },
                        ),
                    ],
                  ),
                ],

                // 4. Veg Only Toggle (Food vertical)
                if (widget.vertical == 'food') ...[
                  const SizedBox(height: 10),
                  SwitchListTile(
                    title: Text('Pure Veg Only', style: tx(context, 11.5, w: FontWeight.w800)),
                    value: widget.options.vegOnly,
                    activeColor: T1SColors.emerald600,
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    onChanged: (val) {
                      widget.onChanged(widget.options.copyWith(vegOnly: val));
                    },
                  ),
                ],

                // 5. Departure Time Buckets (Flights / Bus)
                if (widget.vertical == 'flights' || widget.vertical == 'bus') ...[
                  const SizedBox(height: 10),
                  Text('DEPARTURE TIME', style: tx(context, 10, w: FontWeight.w900, color: muted(context))),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      for (final bucket in ['Morning (06-12)', 'Afternoon (12-18)', 'Evening (18-24)', 'Night (00-06)'])
                        FilterChip(
                          label: Text(bucket, style: tx(context, 10.5, w: FontWeight.w700)),
                          selected: widget.options.departureBuckets.contains(bucket),
                          selectedColor: T1SColors.red.withValues(alpha: 0.15),
                          checkmarkColor: T1SColors.red,
                          onSelected: (sel) {
                            final next = Set<String>.from(widget.options.departureBuckets);
                            if (sel) {
                              next.add(bucket);
                            } else {
                              next.remove(bucket);
                            }
                            widget.onChanged(widget.options.copyWith(departureBuckets: next));
                          },
                        ),
                    ],
                  ),
                ],

                // 6. Star Ratings (Hotels)
                if (widget.vertical == 'hotels') ...[
                  const SizedBox(height: 10),
                  Text('STAR RATING', style: tx(context, 10, w: FontWeight.w900, color: muted(context))),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      for (final stars in [3, 4, 5])
                        FilterChip(
                          label: Text('$stars★', style: tx(context, 10.5, w: FontWeight.w800)),
                          selected: widget.options.starRatings.contains(stars),
                          selectedColor: T1SColors.amber400.withValues(alpha: 0.2),
                          checkmarkColor: T1SColors.amber500,
                          onSelected: (sel) {
                            final next = Set<int>.from(widget.options.starRatings);
                            if (sel) {
                              next.add(stars);
                            } else {
                              next.remove(stars);
                            }
                            widget.onChanged(widget.options.copyWith(starRatings: next));
                          },
                        ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _SortChip extends StatelessWidget {
  const _SortChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: selected ? T1SColors.red : (isDark(context) ? T1SColors.slate800 : T1SColors.slate100),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          label,
          style: tx(
            context,
            10.5,
            w: FontWeight.w800,
            color: selected ? Colors.white : muted(context),
          ),
        ),
      ),
    );
  }
}
