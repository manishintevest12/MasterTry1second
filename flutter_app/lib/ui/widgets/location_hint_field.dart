import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../core/theme.dart';
import 'kit.dart';

/// Uber-style location hint field (mirror of web LocationHintInput, owner request 17 Oct).
/// Editable pickup/drop input with a live suggestion dropdown from GET /api/geo/search
/// (Nominatim proxy, India-bounded). Rows show a pin icon, bold place name, grey address
/// line; a "Search in a different city" footer keeps the raw typed text. Never invents
/// places — empty state says try a nearby landmark.
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
  final LayerLink _link = LayerLink();
  OverlayEntry? _overlay;
  Timer? _debounce;
  List<Map<String, dynamic>> _rows = const [];
  bool _loading = false;
  int _seq = 0;

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
    _removeOverlay();
    super.dispose();
  }

  void _onFocus() {
    if (!_focus.hasFocus) _removeOverlay();
  }

  void _onChanged() {
    final q = widget.controller.text.trim();
    if (q.length < 2) {
      _debounce?.cancel();
      if (_loading) setState(() => _loading = false);
      _rows = const [];
      _removeOverlay();
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
      final rows = await AppState.instance.api.geoSearch(q);
      if (!mounted || seq != _seq) return;
      setState(() {
        _rows = rows.take(6).toList();
        _loading = false;
      });
      if (_focus.hasFocus) _showOverlay();
    } catch (_) {
      // Geo hints are best-effort; typing still works.
      if (mounted && seq == _seq) setState(() => _loading = false);
    }
  }

  void _removeOverlay() {
    _overlay?.remove();
    _overlay = null;
  }

  void _showOverlay() {
    _removeOverlay();
    if (_rows.isEmpty) {
      _overlay = OverlayEntry(builder: (c) => _buildDropdown(c, empty: true));
    } else {
      _overlay = OverlayEntry(builder: _buildDropdown);
    }
    Overlay.of(context).insert(_overlay!);
  }

  void _choose(Map<String, dynamic>? place) {
    _removeOverlay();
    _focus.unfocus();
    if (place == null) {
      widget.onSubmitted?.call(widget.controller.text); // "search in a different city": keep raw text
      return;
    }
    final label = (place['label'] ?? '').toString();
    final short = label.contains(',') ? label.split(',').first.trim() : label;
    widget.controller.text = short;
    widget.controller.selection =
        TextSelection.collapsed(offset: widget.controller.text.length);
    widget.onSelect?.call(short, place);
  }

  Widget _buildDropdown(BuildContext c, {bool empty = false}) {
    return CompositedTransformFollower(
      link: _link,
      showWhenUnlinked: false,
      targetAnchor: Alignment.bottomLeft,
      followerAnchor: Alignment.topLeft,
      offset: const Offset(0, 4),
      child: Material(
        elevation: 12,
        borderRadius: BorderRadius.circular(12),
        color: isDark(c) ? T1SColors.slate800 : Colors.white,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxHeight: 300, maxWidth: 360),
          child: empty
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
                    final full = (p['label'] ?? '').toString();
                    final name =
                        full.contains(',') ? full.split(',').first.trim() : full;
                    final addr = full.contains(',')
                        ? full.split(',').skip(1).join(',').trim()
                        : '';
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
    return CompositedTransformTarget(
      link: _link,
      child: GestureDetector(
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
                    _removeOverlay();
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
    );
  }
}
