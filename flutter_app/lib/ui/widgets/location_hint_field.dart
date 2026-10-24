import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../core/theme.dart';
import 'kit.dart';

/// Uber-style location hint field (mirror of web LocationHintInput, owner request 17 Oct).
/// Editable pickup/drop input with a live suggestion list from GET /api/geo/search
/// (Nominatim proxy, India-bounded). Rows show a pin icon, bold place name, grey address
/// line; a "Search in a different city" footer keeps the raw typed text. Never invents
/// places — empty state says try a nearby landmark.
/// Owner 23 Oct fix: the suggestion list previously floated in a root Overlay via a
/// LayerLink and rendered detached from its field on device; it now renders INLINE
/// directly beneath the field box, so it can never misalign.
class LocationHintField extends StatefulWidget {
  const LocationHintField({
    super.key,
    required this.controller,
    required this.label,
    required this.placeholder,
    this.mode = 'drop',
    this.onSelect,
    this.onSubmitted,
    this.trailing,
    this.large = false,
  });

  final TextEditingController controller;
  final String label;
  final String placeholder;

  /// 'pickup' (green dot) or 'drop' (red dot) — mirrors the web field accents.
  final String mode;
  final void Function(String short, Map<String, dynamic> place)? onSelect;
  final void Function(String text)? onSubmitted;

  /// Optional trailing widget (map pin button, GPS button) shown inside the field row.
  final Widget? trailing;

  /// Owner 22 Oct: Uber-style roomy field (bigger label + text, 56px+ tap area, big clear
  /// button) for the Cab form, where 12px text in a 26px strip made typing painful.
  final bool large;

  @override
  State<LocationHintField> createState() => _LocationHintFieldState();
}

class _LocationHintFieldState extends State<LocationHintField> {
  final FocusNode _focus = FocusNode();
  Timer? _debounce;
  List<Map<String, dynamic>> _rows = const [];
  bool _loading = false;
  bool _empty = false;
  int _seq = 0;
  bool _showing = false;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onChanged);
    _focus.addListener(_onFocus);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    widget.controller.removeListener(_onChanged);
    _focus.removeListener(_onFocus);
    _focus.dispose();
    _showing = false;
    super.dispose();
  }

  void _onFocus() {
    if (!_focus.hasFocus) _hide();
  }

  void _onChanged() {
    final q = widget.controller.text.trim();
    if (q.length < 2) {
      _debounce?.cancel();
      if (_loading) setState(() => _loading = false);
      _rows = const [];
      _empty = false;
      _hide();
      return;
    }
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 250), _fetch);
    if (!_loading) setState(() => _loading = true);
  }

  Future<void> _fetch() async {
    final q = widget.controller.text.trim();
    if (q.length < 2) return;
    final seq = ++_seq;
    try {
      // Owner 24 Oct: colony/street-level typeahead (/api/geo/suggest, Photon/OSM)
      // replaces the city-level geoSearch, biased near the user's coordinates.
      final state = AppState.instance;
      final rows = await state.api.geoSuggest(q, lat: state.pickLat, lng: state.pickLng);
      if (!mounted || seq != _seq) return;
      setState(() {
        _rows = rows.take(6).toList();
        _loading = false;
        _empty = _rows.isEmpty;
        _showing = true;
      });
    } catch (_) {
      // Geo hints are best-effort; typing still works.
      if (mounted && seq == _seq) setState(() => _loading = false);
    }
  }

  void _hide() {
    if (!mounted) return;
    if (_showing) setState(() => _showing = false);
  }

  void _choose(Map<String, dynamic>? place) {
    _hide();
    _focus.unfocus();
    if (place == null) {
      widget.onSubmitted?.call(widget.controller.text); // "search in a different city": keep raw text
      return;
    }
    // Owner 24 Oct: suggest rows carry a structured name + granular address.
    final label = (place['label'] ?? place['name'] ?? '').toString();
    final short = (place['name'] ?? '').toString().isNotEmpty
        ? (place['name'] as String).trim()
        : (label.contains(',') ? label.split(',').first.trim() : label);
    widget.controller.text = short;
    widget.controller.selection =
        TextSelection.collapsed(offset: widget.controller.text.length);
    widget.onSelect?.call(short, place);
  }

  /// Inline suggestion card, rendered in-flow under the field box.
  Widget _buildDropdown(BuildContext c) {
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Material(
        elevation: 6,
        borderRadius: BorderRadius.circular(12),
        color: isDark(c) ? T1SColors.slate800 : Colors.white,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxHeight: 300),
          child: _rows.isEmpty
              ? Padding(
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.explore_outlined, size: 14, color: muted(c)),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          'No matching place found — try a nearby landmark or city.',
                          style: tx(c, 11, color: muted(c)),
                        ),
                      ),
                    ],
                  ),
                )
              : ListView.builder(
                  shrinkWrap: true,
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  itemCount: _rows.length + 1,
                  itemBuilder: (c, i) {
                    if (i == _rows.length) {
                      return _row(
                        c,
                        icon: Icons.search,
                        darkIconCircle: true,
                        title: 'Search in a different city',
                        subtitle: null,
                        onTap: () => _choose(null),
                      );
                    }
                    final p = _rows[i];
                    final name = (p['name'] ?? '').toString().isNotEmpty
                        ? (p['name'] as String)
                        : ((p['label'] ?? '').toString());
                    var addr = (p['address'] ?? '').toString();
                    final km = (p['distanceKm'] as num?)?.toDouble();
                    if (km != null) {
                      final dist = km < 1 ? '\${(km * 1000).round()} m' : '\$km km';
                      addr = addr.isEmpty ? dist : '\$addr \u00b7 \$dist';
                    }
                    return _row(
                      c,
                      icon: Icons.location_on_outlined,
                      darkIconCircle: false,
                      title: name,
                      subtitle: addr.isNotEmpty ? addr : null,
                      onTap: () => _choose(p),
                    );
                  },
                ),
        ),
      ),
    );
  }

  Widget _row(
    BuildContext c, {
    required IconData icon,
    required bool darkIconCircle,
    required String title,
    String? subtitle,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 26,
              height: 26,
              margin: const EdgeInsets.only(top: 2),
              decoration: BoxDecoration(
                color: darkIconCircle
                    ? (isDark(c) ? T1SColors.slate100 : T1SColors.slate900)
                    : (isDark(c) ? T1SColors.slate700 : T1SColors.slate100),
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                size: 14,
                color: darkIconCircle
                    ? (isDark(c) ? T1SColors.slate900 : Colors.white)
                    : (isDark(c) ? T1SColors.slate200 : T1SColors.slate700),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: tx(c, 12.5, w: FontWeight.w800),
                      maxLines: 1, overflow: TextOverflow.ellipsis),
                  if (subtitle != null)
                    Text(subtitle, style: tx(c, 10.5, color: muted(c)),
                        maxLines: 1, overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final dotColor =
        widget.mode == 'pickup' ? const Color(0xFF34D399) : T1SColors.red;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          // Whole box focuses the field: a thin 26px TextField strip was the hard-to-hit target.
          onTap: () => _focus.requestFocus(),
          child: Container(
            key: ValueKey('hintfield-box-${widget.mode}'),
            constraints: BoxConstraints(minHeight: widget.large ? 60 : 0),
            padding: EdgeInsets.symmetric(horizontal: widget.large ? 14 : 10, vertical: widget.large ? 8 : 4),
            decoration: BoxDecoration(
              color: isDark(context) ? T1SColors.slate800 : T1SColors.slate50,
              borderRadius: BorderRadius.circular(widget.large ? 14 : 10),
              border: Border.all(color: border(context)),
            ),
            child: Row(
              children: [
                Container(
                  width: widget.large ? 10 : 8,
                  height: widget.large ? 10 : 8,
                  margin: EdgeInsets.only(right: widget.large ? 12 : 8),
                  decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
                ),
                Expanded(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.label.toUpperCase(),
                        style: tx(context, widget.large ? 10 : 8, color: muted(context), w: FontWeight.w800),
                      ),
                      SizedBox(height: widget.large ? 2 : 0),
                      TextField(
                        controller: widget.controller,
                        focusNode: _focus,
                        style: tx(context, widget.large ? 16 : 12, w: FontWeight.w800),
                        textInputAction: TextInputAction.search,
                        onSubmitted: (v) => widget.onSubmitted?.call(v),
                        decoration: InputDecoration(
                          isDense: true,
                          contentPadding: EdgeInsets.symmetric(vertical: widget.large ? 6 : 0),
                          border: InputBorder.none,
                          hintText: widget.placeholder,
                          hintStyle: tx(context, widget.large ? 14 : 11, color: muted(context)),
                        ),
                      ),
                    ],
                  ),
                ),
                if (_loading)
                  const SizedBox(
                    width: 14, height: 14,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                if (widget.controller.text.isNotEmpty)
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () {
                      widget.controller.clear();
                      _rows = const [];
                      _empty = false;
                      _hide();
                    },
                    child: Padding(
                      padding: EdgeInsets.all(widget.large ? 8 : 2),
                      child: Icon(Icons.cancel, size: widget.large ? 20 : 15, color: muted(context)),
                    ),
                  ),
                if (widget.trailing != null) ...[SizedBox(width: widget.large ? 8 : 6), widget.trailing!],
              ],
            ),
          ),
        ),
        // Inline hint list (owner 23 Oct): in-flow under the field, never detached.
        if (_showing && (_rows.isNotEmpty || _empty)) _buildDropdown(context),
      ],
    );
  }
}
