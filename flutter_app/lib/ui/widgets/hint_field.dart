import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/app_state.dart';
import '../../core/autocomplete_data.dart';
import '../../core/theme.dart';
import 'kit.dart';

/// Reference-style hint dropdown (owner 22 Oct: "jaise site mai autocomplete hai
/// hr vertical mai — place ho ya naam ya date — waise hi app mai hints MANDATORY
/// har vertical pr"). White rounded card under the field, header line
/// ("LIVE HOTELS • DESTINATIONS & PROPERTIES" left, "↕ TO NAVIGATE • ↵ SELECT"
/// right), rows: icon, bold title, grey subtitle, badge pill on the right.
/// Data sources are REAL registries only — no invented rows:
///   cities  : local flight city/airport list (kAutoCities mirror of web)
///   bus     : LIVE redBus registry via /api/bus/locations (towns + boarding points)
///   hotels  : LIVE destinations + properties via /api/hotels/locations
///   presets : static popular searches for the vertical (mirror of web presets)
class HintRow {
  final String title;
  final String? subtitle;
  final String badge;
  final String value;
  final IconData icon;
  const HintRow(this.title, {this.subtitle, this.badge = '', required this.value, required this.icon});
}

enum HintSource { cities, bus, hotels, presets }

class HintField extends StatefulWidget {
  const HintField({
    super.key,
    required this.controller,
    required this.hint,
    required this.source,
    this.headerText,
    this.presets = const [],
    this.icon,
    this.onSelect,
    this.onSubmitted,
    this.trailing,
    this.focusNode,
  });

  final TextEditingController controller;
  final String hint;
  final HintSource source;

  /// Dropdown header, e.g. 'LIVE HOTELS • DESTINATIONS & PROPERTIES'.
  final String? headerText;
  final List<String> presets;
  final IconData? icon;
  final ValueChanged<String>? onSelect;
  final ValueChanged<String>? onSubmitted;
  final Widget? trailing;
  final FocusNode? focusNode;

  @override
  State<HintField> createState() => _HintFieldState();
}

class _HintFieldState extends State<HintField> {
  final FocusNode _ownFocus = FocusNode();
  final LayerLink _link = LayerLink();
  OverlayEntry? _overlay;
  Timer? _debounce;
  List<HintRow> _rows = const [];
  bool _loading = false;
  int _seq = 0;
  int _highlight = -1;
  bool _showing = false;

  FocusNode get _focus => widget.focusNode ?? _ownFocus;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onChanged);
    _focus.addListener(_onFocus);
    _focus.onKeyEvent = _onKey;
  }

  @override
  void dispose() {
    _debounce?.cancel();
    widget.controller.removeListener(_onChanged);
    _focus.removeListener(_onFocus);
    _focus.onKeyEvent = null;
    _removeOverlay();
    _ownFocus.dispose();
    super.dispose();
  }

  void _onFocus() {
    if (!_focus.hasFocus) {
      _removeOverlay();
    } else if (widget.controller.text.trim().isNotEmpty) {
      _onChanged();
    }
  }

  /// Keyboard navigation (reference header: "↕ TO NAVIGATE • ↵ SELECT").
  KeyEventResult _onKey(FocusNode node, KeyEvent e) {
    if (!_showing || _rows.isEmpty) return KeyEventResult.ignored;
    if (e is KeyDownEvent || e is KeyRepeatEvent) {
      if (e.logicalKey == LogicalKeyboardKey.arrowDown) {
        setState(() => _highlight = (_highlight + 1) % _rows.length);
        _repaint();
        return KeyEventResult.handled;
      }
      if (e.logicalKey == LogicalKeyboardKey.arrowUp) {
        setState(() => _highlight = _highlight <= 0 ? _rows.length - 1 : _highlight - 1);
        _repaint();
        return KeyEventResult.handled;
      }
      if (e.logicalKey == LogicalKeyboardKey.enter || e.logicalKey == LogicalKeyboardKey.numpadEnter) {
        _choose(_rows[_highlight.clamp(0, _rows.length - 1)]);
        return KeyEventResult.handled;
      }
    }
    return KeyEventResult.ignored;
  }

  void _onChanged() {
    final q = widget.controller.text.trim();
    if (q.isEmpty) {
      _debounce?.cancel();
      _rows = _localRows('');
      _loading = false;
      _highlight = -1;
      _showing = true;
      _repaint();
      return;
    }
    if (widget.source == HintSource.cities || widget.source == HintSource.presets) {
      _rows = _localRows(q);
      _highlight = -1;
      _showing = true;
      _repaint();
      return;
    }
    // Remote sources (bus / hotels): debounced LIVE fetch.
    _debounce?.cancel();
    if (q.length < 2) {
      _rows = const [];
      _loading = false;
      _repaint();
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 300), _fetch);
    if (!_loading) setState(() => _loading = true);
  }

  List<HintRow> _localRows(String q) {
    if (widget.source == HintSource.cities) {
      final lq = q.toLowerCase();
      Iterable<CitySuggestion> list = kAutoCities;
      if (lq.isNotEmpty) {
        list = list.where((c) =>
            c.text.toLowerCase().contains(lq) ||
            c.subtext.toLowerCase().contains(lq) ||
            c.badge.toLowerCase().contains(lq));
      }
      return [
        for (final c in list.take(8))
          HintRow(c.text,
              subtitle: c.subtext.isEmpty ? null : c.subtext,
              badge: c.badge,
              value: c.text,
              icon: Icons.flight_takeoff_outlined),
      ];
    }
    final lq = q.toLowerCase();
    Iterable<String> list = widget.presets;
    if (lq.isNotEmpty) list = list.where((p) => p.toLowerCase().contains(lq));
    return [
      for (final p in list.take(6)) HintRow(p, value: p, icon: Icons.search_rounded),
    ];
  }

  Future<void> _fetch() async {
    final q = widget.controller.text.trim();
    if (q.length < 2) return;
    final seq = ++_seq;
    try {
      List<HintRow> rows;
      if (widget.source == HintSource.bus) {
        rows = _busRows(await AppState.instance.api
            .getJson('/api/bus/locations?q=${Uri.encodeComponent(q)}'));
      } else {
        rows = _hotelRows(await AppState.instance.api.hotelLocations(q));
      }
      if (!mounted || seq != _seq) return;
      setState(() {
        _rows = rows.take(10).toList();
        _loading = false;
        _highlight = -1;
      });
      if (_focus.hasFocus) {
        _showing = true;
        _repaint();
      }
    } catch (_) {
      if (mounted && seq == _seq) setState(() => _loading = false);
    }
  }

  List<HintRow> _busRows(Map<String, dynamic> data) {
    final locs = (data['locations'] as List?) ?? const [];
    final rows = <HintRow>[];
    for (final raw in locs) {
      final l = raw as Map<String, dynamic>;
      final name = (l['name'] ?? '') as String;
      if (name.isEmpty) continue;
      final isCity = l['type'] == 'CITY';
      rows.add(HintRow(
        name,
        subtitle: isCity
            ? (((l['region'] ?? '') as String).isNotEmpty
                ? (l['region'] as String)
                : ((l['parentName'] ?? '') as String))
            : (((l['parentName'] ?? '') as String).isNotEmpty
                ? 'Area in ${l['parentName']}'
                : 'Boarding point'),
        badge: isCity ? 'City' : 'Board at',
        value: name,
        icon: isCity ? Icons.location_city_rounded : Icons.push_pin_rounded,
      ));
    }
    return rows;
  }

  List<HintRow> _hotelRows(List<Map<String, dynamic>> docs) {
    final rows = <HintRow>[];
    for (final d in docs) {
      final name = (d['name'] ?? '') as String;
      if (name.isEmpty) continue;
      final isCity = (d['type'] ?? 'CITY') == 'CITY';
      rows.add(HintRow(
        name,
        subtitle: isCity
            ? ((d['stateName'] ?? '') as String).isNotEmpty
                ? (d['stateName'] as String)
                : 'Destination'
            : 'Hotel in ${d['cityName'] ?? ''}',
        badge: isCity ? 'Destination' : 'Hotel',
        value: name,
        icon: isCity ? Icons.location_on_outlined : Icons.hotel_rounded,
      ));
    }
    return rows;
  }

  void _choose(HintRow r) {
    _removeOverlay();
    _focus.unfocus();
    widget.controller.text = r.value;
    widget.controller.selection = TextSelection.collapsed(offset: r.value.length);
    widget.onSelect?.call(r.value);
  }

  void _submit() {
    _removeOverlay();
    _focus.unfocus();
    widget.onSubmitted?.call(widget.controller.text);
  }

  void _removeOverlay() {
    _overlay?.remove();
    _overlay = null;
    _showing = false;
  }

  void _repaint() {
    if (!_focus.hasFocus) return;
    _removeOverlay();
    _overlay = OverlayEntry(builder: _buildDropdown);
    Overlay.of(context).insert(_overlay!);
    _showing = true;
  }

  Widget _buildDropdown(BuildContext c) {
    final dark = isDark(c);
    final card = dark ? T1SColors.slate800 : Colors.white;
    final titleColor = dark ? T1SColors.slate50 : Colors.black;
    final mutedColor = dark ? T1SColors.slate400 : T1SColors.slate500;
    return CompositedTransformFollower(
      link: _link,
      showWhenUnlinked: false,
      targetAnchor: Alignment.bottomLeft,
      followerAnchor: Alignment.topLeft,
      offset: const Offset(0, 4),
      child: Material(
        elevation: 12,
        borderRadius: BorderRadius.circular(12),
        color: card,
        clipBehavior: Clip.antiAlias,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: dark ? T1SColors.slate700 : T1SColors.slate200),
          ),
          constraints: const BoxConstraints(maxHeight: 320, maxWidth: 380),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header row — reference: title left, "↕ TO NAVIGATE • ↵ SELECT" right.
              Container(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 6),
                decoration: BoxDecoration(
                  color: dark ? T1SColors.slate900 : T1SColors.slate50,
                  border: Border(bottom: BorderSide(color: dark ? T1SColors.slate700 : T1SColors.slate200)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        (widget.headerText ?? 'POPULAR SEARCHES').toUpperCase(),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.w900, letterSpacing: .4, color: mutedColor),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      '↕ TO NAVIGATE • ↵ SELECT',
                      style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.w800, letterSpacing: .4, color: mutedColor),
                    ),
                  ],
                ),
              ),
              if (_loading)
                const Padding(
                  padding: EdgeInsets.all(14),
                  child: SizedBox(
                    height: 14,
                    width: 14,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                )
              else if (_rows.isEmpty)
                Padding(
                  padding: const EdgeInsets.all(14),
                  child: Text(
                    'No live matches yet — type at least 2 letters or search as typed.',
                    style: tx(c, 10.5, color: mutedColor),
                  ),
                )
              else
                Flexible(
                  child: ListView.builder(
                    shrinkWrap: true,
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    itemCount: _rows.length,
                    itemBuilder: (c, i) => _row(c, _rows[i], i, dark, titleColor, mutedColor),
                  ),
                ),
              if (_rows.isNotEmpty)
                InkWell(
                  onTap: _submit,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(
                      border: Border(top: BorderSide(color: dark ? T1SColors.slate700 : T1SColors.slate200)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.search_rounded, size: 12, color: T1SColors.red),
                        const SizedBox(width: 4),
                        Text('Search as typed', style: tx(c, 10, w: FontWeight.w900, color: T1SColors.red)),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _row(BuildContext c, HintRow r, int i, bool dark, Color titleColor, Color mutedColor) {
    final selected = i == _highlight;
    return InkWell(
      onTap: () => _choose(r),
      onHover: (_) {},
      child: Container(
        color: selected
            ? (dark ? T1SColors.slate700 : const Color(0xFFFFF7ED))
            : Colors.transparent,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(r.icon, size: 16, color: mutedColor),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(r.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: tx(c, 12.5, w: FontWeight.w800, color: titleColor)),
                  if (r.subtitle != null && r.subtitle!.isNotEmpty)
                    Text(r.subtitle!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: tx(c, 10, color: mutedColor)),
                ],
              ),
            ),
            if (r.badge.isNotEmpty) ...[
              const SizedBox(width: 8),
              Container(
                margin: const EdgeInsets.only(top: 2),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: dark ? T1SColors.slate900 : T1SColors.slate50,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: dark ? T1SColors.slate700 : T1SColors.slate200),
                ),
                child: Text(r.badge, style: tx(c, 9, w: FontWeight.w800, color: mutedColor)),
              ),
            ],
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return CompositedTransformTarget(
      link: _link,
      child: TextField(
        controller: widget.controller,
        focusNode: _focus,
        textInputAction: TextInputAction.search,
        onSubmitted: (_) => _submit(),
        decoration: InputDecoration(
          hintText: widget.hint,
          isDense: true,
          prefixIcon: widget.icon == null ? null : Icon(widget.icon, size: 16),
          suffixIcon: widget.trailing,
          contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: BorderSide(color: border(context)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: T1SColors.red, width: 1.2),
          ),
        ),
      ),
    );
  }
}
