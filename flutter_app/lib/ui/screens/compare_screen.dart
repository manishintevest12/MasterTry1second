import 'package:flutter/material.dart';

import '../../core/api.dart';
import '../../core/app_state.dart';
import '../../core/auth.dart';
import '../../core/compare.dart';
import '../../core/theme.dart';
import '../../core/autocomplete_data.dart';
import '../../core/verticals.dart';
import '../widgets/compare_cards.dart';
import '../widgets/kit.dart';
import '../widgets/typeahead_field.dart';
import 'product_screen.dart';

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

  bool _loading = false;
  bool _initialLoaded = false;
  LiveResponse? _res;
  String? _error;
  SortMode _sort = SortMode.best;
  String _filterText = '';

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
      _filterText = '';
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
    _q.text = _meta.kind == SearchKind.text || _meta.kind == SearchKind.hotel || _meta.kind == SearchKind.movie
        ? ''
        : '';
    _from.text = _meta.defaultFrom;
    _to.text = _meta.defaultTo;
  }

  String _effectiveQuery() {
    switch (_meta.kind) {
      case SearchKind.route:
        return '${_from.text.trim()} to ${_to.text.trim()}';
      case SearchKind.dateRoute:
      case SearchKind.cab:
        return '${_from.text.trim()} to ${_to.text.trim()}';
      case SearchKind.hotel:
        return _to.text.trim().isNotEmpty ? _to.text.trim() : _state.city;
      default:
        return _q.text.trim();
    }
  }

  Future<void> _runSearch({String? query, bool auto = false, bool force = false}) async {
    final q = (query ?? _effectiveQuery()).trim();
    if (q.isEmpty) return;
    setState(() { _loading = true; _error = null; });
    try {
      _res = await _state.live(_meta.id, q, depart: _iso(_date), force: force);
      _initialLoaded = true;
    } catch (e) {
      _error = '$e'.replaceFirst(RegExp(r'^Exception: ?'), '');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _iso(DateTime d) => '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

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
      lastDate: DateTime.now().add(const Duration(days: 90)),
    );
    if (d != null) {
      setState(() => _date = d);
      await _runSearch();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      _VerticalTabs(current: _meta.id, onPick: (id) { _state.selectVertical(id); }),
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
                city: _state.city,
                onPickDate: _pickDate,
                onSearch: () => _runSearch(force: true),
                onPickCity: _pickCity,
              ),
              const SizedBox(height: 12),
              _StatusStrip(res: _res, loading: _loading, error: _error, onRetry: () => _runSearch(force: true)),
              if (_res != null && _res!.items.isNotEmpty) ...[
                const SizedBox(height: 12),
                _SortBar(
                  sort: _sort,
                  filter: _filterText,
                  onSort: (s) => setState(() => _sort = s),
                  onFilter: (f) => setState(() => _filterText = f),
                ),
                const SizedBox(height: 12),
                _FeedBody(meta: _meta, res: _res!, sort: _sort, filter: _filterText),
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
      await _runSearch(force: true);
    }
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
    required this.city,
    required this.onPickDate,
    required this.onSearch,
    required this.onPickCity,
  });
  final VoidCallback onSwap;
  final VerticalMeta meta;
  final TextEditingController q;
  final TextEditingController from;
  final TextEditingController to;
  final DateTime date;
  final String city;
  final VoidCallback onPickDate;
  final VoidCallback onSearch;
  final VoidCallback onPickCity;

  @override
  Widget build(BuildContext context) {
    // Route fields use the website's city autocomplete (1:1 dataset);
    // text fields use each vertical's preset suggestion list.
    final presets = kAutoCategories[meta.id] ?? const <String>[];
    final field = (TextEditingController c, String hint, {IconData? icon, bool isCity = false}) => Expanded(
          child: TypeaheadField(
            controller: c,
            hint: hint,
            cities: isCity,
            presets: presets,
            icon: icon,
            onSubmitted: (_) => onSearch(),
          ),
        );

    Widget body;
    switch (meta.kind) {
      case SearchKind.route:
      case SearchKind.dateRoute:
      case SearchKind.cab:
        body = Column(children: [
          Row(children: [
            field(from, 'From', icon: Icons.flight_takeoff_outlined, isCity: true),
            const SizedBox(width: 4),
            GestureDetector(onTap: onSwap, child: Icon(Icons.swap_horiz_rounded, size: 16, color: muted(context))),
            const SizedBox(width: 4),
            field(to, 'To', icon: Icons.location_on_outlined, isCity: true),
          ]),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: _DateChip(date: date, onTap: onPickDate)),
            const SizedBox(width: 8),
            Expanded(child: _CityChip(city: city, onTap: onPickCity)),
          ]),
        ]);
      case SearchKind.hotel:
        body = Column(children: [
          Row(children: [field(to, 'City, resort or landmark', icon: Icons.search)]),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: _DateChip(date: date, onTap: onPickDate)),
            const SizedBox(width: 8),
            Expanded(child: _CityChip(city: city, onTap: onPickCity)),
          ]),
        ]);
      case SearchKind.movie:
        body = Column(children: [
          Row(children: [field(q, 'Movie or cinema name', icon: Icons.search)]),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: _DateChip(date: date, onTap: onPickDate, label: 'Show date')),
            const SizedBox(width: 8),
            Expanded(child: _CityChip(city: city, onTap: onPickCity)),
          ]),
        ]);
      default:
        body = Column(children: [
          Row(children: [
            field(q, meta.placeholder, icon: Icons.search),
            const SizedBox(width: 8),
            GestureDetector(onTap: onSearch, child: Container(
              height: 44,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(color: T1SColors.red, borderRadius: BorderRadius.circular(10)),
              alignment: Alignment.center,
              child: Text('Search', style: tx(context, 12, w: FontWeight.w900, color: Colors.white)),
            )),
          ]),
          const SizedBox(height: 8),
          Row(children: [Expanded(child: _CityChip(city: city, onTap: onPickCity))]),
        ]);
    }

    return Box(
      padding: const EdgeInsets.all(12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Icon(meta.icon, size: 14, color: T1SColors.red),
          const SizedBox(width: 6),
          Expanded(child: Text(meta.name.toUpperCase(), style: tx(context, 11, w: FontWeight.w900, ls: 0.7))),
          Text(meta.tagline, style: tx(context, 9.5, color: muted(context))),
        ]),
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
                onTap: () { q.text = meta.samples[i]; onSearch(); },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                  decoration: BoxDecoration(color: isDark(c) ? T1SColors.slate800 : T1SColors.slate50, borderRadius: BorderRadius.circular(999), border: Border.all(color: border(context))),
                  child: Text(meta.samples[i], style: tx(c, 9.5, w: FontWeight.w600, color: muted(context))),
                ),
              ),
            ),
          ),
        ],
      ]),
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
        decoration: BoxDecoration(color: isDark(context) ? T1SColors.slate800 : T1SColors.slate50, borderRadius: BorderRadius.circular(10), border: Border.all(color: border(context))),
        child: Row(children: [
          Icon(Icons.calendar_today_rounded, size: 14, color: T1SColors.red),
          const SizedBox(width: 8),
          Text('$label $d', style: tx(context, 11.5, w: FontWeight.w800), overflow: TextOverflow.ellipsis),
        ]),
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
        decoration: BoxDecoration(color: isDark(context) ? T1SColors.slate800 : T1SColors.slate50, borderRadius: BorderRadius.circular(10), border: Border.all(color: border(context))),
        child: Row(children: [
          Icon(Icons.location_on_outlined, size: 14, color: T1SColors.red),
          const SizedBox(width: 8),
          Expanded(child: Text(city, style: tx(context, 11.5, w: FontWeight.w800), overflow: TextOverflow.ellipsis)),
          const Icon(Icons.expand_more_rounded, size: 15, color: T1SColors.slate400),
        ]),
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
  const _SortBar({required this.sort, required this.filter, required this.onSort, required this.onFilter});
  final SortMode sort;
  final String filter;
  final ValueChanged<SortMode> onSort;
  final ValueChanged<String> onFilter;

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
      const Spacer(),
      SizedBox(
        width: 118,
        child: _FilterField(filter: filter, onFilter: onFilter),
      ),
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
      child: Column(children: [
        Icon(Icons.travel_explore_rounded, size: 34, color: T1SColors.slate300),
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

class _FilterField extends StatefulWidget {
  const _FilterField({required this.filter, required this.onFilter});
  final String filter;
  final ValueChanged<String> onFilter;
  @override
  State<_FilterField> createState() => _FilterFieldState();
}

class _FilterFieldState extends State<_FilterField> {
  late final _c = TextEditingController(text: widget.filter);
  @override
  void dispose() { _c.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: _c,
      onChanged: widget.onFilter,
      decoration: InputDecoration(hintText: 'Filter…', isDense: true, suffixIcon: Icon(Icons.filter_list_rounded, size: 15, color: muted(context))),
      style: tx(context, 11),
    );
  }
}

// ---------------------------------------------------------------------------
// Feed body: groups per vertical
// ---------------------------------------------------------------------------

class _FeedBody extends StatelessWidget {
  const _FeedBody({required this.meta, required this.res, required this.sort, required this.filter});
  final VerticalMeta meta;
  final LiveResponse res;
  final SortMode sort;
  final String filter;

  @override
  Widget build(BuildContext context) {
    var items = res.items;
    if (filter.trim().isNotEmpty) {
      final f = filter.trim().toLowerCase();
      final backendMatched = const ['flights', 'bus', 'cab', 'hotels', 'food', 'movie', 'movies'].contains(meta.id);
      if (!backendMatched) {
        items = items
            .where((it) =>
                it.title.toLowerCase().contains(f) ||
                it.subtitle.toLowerCase().contains(f) ||
                it.provider.toLowerCase().contains(f) ||
                it.specs.values.any((v) => v.toLowerCase().contains(f)))
            .toList();
      }
    }

    if (meta.id == 'hotels') {
      var groups = groupHotels(items);
      if (filter.trim().isNotEmpty) {
        final f = filter.trim().toLowerCase();
        groups = groups.where((g) => g.name.toLowerCase().contains(f) || (g.locality ?? '').toLowerCase().contains(f)).toList();
      }
      groups = sortHotels(groups, sort);
      return Column(children: [
        for (final g in groups) ...[HotelCard(g: g), const SizedBox(height: 12)],
      ]);
    }

    var groups = groupOffers(items);
    groups = sortGroups(groups, sort);
    if (meta.id == 'creditcards' && filter.trim().isNotEmpty) {
      final f = filter.trim().toLowerCase();
      groups = groups.where((g) => g.lead.title.toLowerCase().contains(f) || g.lead.spec('bank').toLowerCase().contains(f)).toList();
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

Future<void> showTrackSheet(BuildContext context, {required String title, required String query, required String vertical, double? price, String? image, String? sourceUrl}) async {
  final auth = AuthService.instance;
  if (!auth.signedIn || auth.token == null) {
    toast(context, 'Sign in to save price alerts', error: true);
    return;
  }
  final ctrl = TextEditingController(text: price != null && price > 0 ? (price * 0.9).round().toString() : '');
  final ok = await showDialog<bool>(
    context: context,
    builder: (c) => AlertDialog(
      title: Text('Track price drop', style: tx(c, 15, w: FontWeight.w900)),
      content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, maxLines: 2, overflow: TextOverflow.ellipsis, style: tx(c, 12, w: FontWeight.w700)),
        const SizedBox(height: 10),
        TextField(
          controller: ctrl,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: 'Alert me under (₹)'),
        ),
        const SizedBox(height: 6),
        Text('We re-check the live engine and email you when a verified price crosses this.', style: tx(c, 10.5, color: muted(c))),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
        RedButton('Create alert', dense: true, onTap: () => Navigator.pop(c, true)),
      ],
    ),
  );
  if (ok != true) return;
  final target = double.tryParse(ctrl.text.trim());
  if (target == null || target <= 0) {
    toast(context, 'Enter a target price', error: true);
    return;
  }
  try {
    await AppState.instance.api.createAlert(
      auth.token!,
      productTitle: title,
      searchQuery: query,
      targetPrice: target,
      priceAtSet: price,
      sourceUrl: sourceUrl,
      image: image,
    );
    await AppState.instance.refreshBadges();
    toast(context, 'Alert saved — we watch live prices for you');
  } catch (e) {
    toast(context, '$e'.replaceFirst('Exception: ', ''), error: true);
  }
}
