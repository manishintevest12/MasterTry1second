import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:flutter/services.dart';

import '../../core/app_state.dart';
import '../../core/autocomplete_data.dart';
import '../../core/theme.dart';
import 'kit.dart';

/// Reference-style hint dropdown (owner 22 Oct: "jaise site mai autocomplete hai
/// hr vertical mai — place ho ya naam ya date — waise hi app mai hints MANDATORY
/// har vertical pr"). White rounded card directly under the field, header line
/// ("LIVE HOTELS • DESTINATIONS & PROPERTIES" left, "↕ TO NAVIGATE • ↵ SELECT"
/// right), rows: icon, bold title, grey subtitle, badge pill on the right.
/// Owner 23 Oct fix: the dropdown previously floated in a root Overlay via a
/// LayerLink; on device it rendered far below its field (misaligned card over
/// the results). It is now rendered INLINE directly beneath the field — in-flow
/// layout can never detach from its anchor.
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
  Timer? _debounce;
  List<HintRow> _rows = const [];
  bool _loading = false;
  int _seq = 0;
  int _highlight = -1;
  bool _showing = false;
  bool _gpsBusy = false;

  /// Owner 23 Oct (web parity): the web dropdown shows the one-tap GPS option
  /// for city/location-style inputs — the Flutter hint field mirrors it for
  /// the cities + hotels sources (bus locations are a live registry type).
  bool get _isLocationLike =>
      widget.source == HintSource.cities || widget.source == HintSource.hotels;

  /// GPS fix -> /api/geo/reverse for the honest place name; falls back to the
  /// nearest supported city (kCityCoords registry). Never invents a place.
  Future<void> _detectLocation() async {
    if (_gpsBusy) return;
    setState(() => _gpsBusy = true);
    try {
      bool enabled = await Geolocator.isLocationServiceEnabled();
      if (!enabled) {
        if (mounted) toast(context, 'Location services are disabled', error: true);
        return;
      }
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          if (mounted) toast(context, 'Location permission denied', error: true);
          return;
        }
      }
      if (permission == LocationPermission.deniedForever) {
        if (mounted) toast(context, 'Location permission permanently denied', error: true);
        return;
      }
      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.low,
        timeLimit: const Duration(seconds: 8),
      );
      String? detected;
      try {
        final place = await AppState.instance.api.geoReverse(pos.latitude, pos.longitude);
        final city = (place?['city'] ?? place?['name'] ?? '') as String;
        if (city.isNotEmpty) {
          detected = kAutoCities
              .map((c) => c.text)
              .firstWhere((t) => t.toLowerCase().contains(city.toLowerCase()), orElse: () => '');
        }
      } catch (_) {/* offline reverse-geocode -> nearest-city fallback below */}
      if ((detected ?? '').isEmpty) {
        String? nearestCity;
        double minDistance = double.infinity;
        for (final entry in kCityCoords.entries) {
          final dist = Geolocator.distanceBetween(
            pos.latitude, pos.longitude, entry.value['lat']!, entry.value['lng']!,
          );
          if (dist < minDistance) {
            minDistance = dist;
            nearestCity = entry.key;
          }
        }
        if (nearestCity != null && minDistance <= 150000) {
          detected = kAutoCities
              .map((c) => c.text)
              .firstWhere((t) => t.toLowerCase().contains(nearestCity!.toLowerCase()), orElse: () => nearestCity ?? '');
        }
      }
      if (!mounted) return;
      final value = detected ?? '';
      if (value.isNotEmpty) {
        widget.controller.text = value;
        widget.controller.selection = TextSelection.collapsed(offset: value.length);
        widget.onSelect?.call(value);
      } else {
        toast(context, 'Could not detect a supported city here', error: true);
      }
    } catch (e) {
      if (mounted) toast(context, 'Could not detect location: $e', error: true);
    } finally {
      if (mounted) setState(() => _gpsBusy = false);
    }
  }

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
    _showing = false;
    _ownFocus.dispose();
    super.dispose();
  }

  void _onFocus() {
    if (!_focus.hasFocus) {
      _hide();
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
        return KeyEventResult.handled;
      }
      if (e.logicalKey == LogicalKeyboardKey.arrowUp) {
        setState(() => _highlight = _highlight <= 0 ? _rows.length - 1 : _highlight - 1);
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
      _show();
      return;
    }
    if (widget.source == HintSource.cities || widget.source == HintSource.presets) {
      _rows = _localRows(q);
      _highlight = -1;
      _show();
      return;
    }
    // Remote sources (bus / hotels): debounced LIVE fetch.
    _debounce?.cancel();
    if (q.length < 2) {
      _rows = const [];
      _loading = false;
      _show();
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
        // Owner 23 Oct: rich subtexts ('Indira Gandhi...', 'Industrial Hub')
        // made loose substring matching swamp the direct city-name hits
        // (typing 'ind' surfaced Delhi/Kanpur before Indore). Rank matches:
        // text startsWith > text contains > subtext/badge contains.
        final prefix = <CitySuggestion>[], contains = <CitySuggestion>[], fuzzy = <CitySuggestion>[];
        for (final c in kAutoCities) {
          final t = c.text.toLowerCase();
          if (t.startsWith(lq)) {
            prefix.add(c);
          } else if (t.contains(lq)) {
            contains.add(c);
          } else if (c.subtext.toLowerCase().contains(lq) || c.badge.toLowerCase().contains(lq)) {
            fuzzy.add(c);
          }
        }
        list = [...prefix, ...contains, ...fuzzy];
      }
      return [
        for (final c in list.take(8))
          HintRow(c.text,
              subtitle: c.subtext.isEmpty ? null : c.subtext,
              badge: c.badge,
              value: c.text,
              icon: c.icon),
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
      if (_focus.hasFocus) _show();
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
    _hide();
    _focus.unfocus();
    widget.controller.text = r.value;
    widget.controller.selection = TextSelection.collapsed(offset: r.value.length);
    widget.onSelect?.call(r.value);
  }

  void _submit() {
    _hide();
    _focus.unfocus();
    widget.onSubmitted?.call(widget.controller.text);
  }

  void _show() {
    if (!mounted) return;
    // Always setState: the inline dropdown re-renders from _rows/_loading on
    // every keystroke. Skipping the repaint when _showing was already true
    // left the card showing the previous (often empty-query) rows forever.
    setState(() => _showing = true);
  }

  void _hide() {
    if (!mounted) return;
    if (_showing) {
      setState(() => _showing = false);
    }
  }

  /// The inline dropdown card. Rendered in-flow under the field so it can
  /// never float detached (owner 23 Oct overlay misalignment fix).
  Widget _buildDropdown(BuildContext c) {
    final dark = isDark(c);
    final card = dark ? T1SColors.slate800 : Colors.white;
    final titleColor = dark ? T1SColors.slate50 : Colors.black;
    final mutedColor = dark ? T1SColors.slate400 : T1SColors.slate500;
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Material(
        elevation: 6,
        borderRadius: BorderRadius.circular(12),
        color: card,
        clipBehavior: Clip.antiAlias,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: dark ? T1SColors.slate700 : T1SColors.slate200),
          ),
          constraints: const BoxConstraints(maxHeight: 300),
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
                    itemCount: _rows.length + (_isLocationLike ? 1 : 0),
                    itemBuilder: (c, i) {
                      if (_isLocationLike && i == 0) {
                        return _GpsTile(
                          busy: _gpsBusy,
                          onTap: _detectLocation,
                        );
                      }
                      final row = _rows[_isLocationLike ? i - 1 : i];
                      return _row(c, row, _isLocationLike ? i - 1 : i, dark, titleColor, mutedColor);
                    },
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
              Builder(builder: (c) {
                final capital = kCapitalBadges.contains(r.badge);
                return Container(
                  margin: const EdgeInsets.only(top: 2),
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: capital
                        ? const Color(0xFFFFE0B2)
                        : (dark ? T1SColors.slate900 : const Color(0xFFECEFF1)),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: capital
                          ? const Color(0xFFF5CBA7)
                          : (dark ? T1SColors.slate700 : T1SColors.slate200),
                    ),
                  ),
                  child: Text(
                    r.badge,
                    style: tx(c, 9, w: FontWeight.w800,
                        color: capital ? const Color(0xFFCC5500) : mutedColor),
                  ),
                );
              }),
            ],
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasContent = _loading || _rows.isNotEmpty ||
        (widget.controller.text.trim().isNotEmpty &&
            widget.source != HintSource.cities &&
            widget.source != HintSource.presets);
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
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
        if (_showing && hasContent) _buildDropdown(context),
      ],
    );
  }
}


// ---------------------------------------------------------------------------
// Owner 23 Oct (web parity): the one-tap GPS tile shown at the top of the
// city/location hint dropdown — mint-green card, crosshair chip, LIVE +
// Auto-Fill pills, exactly like the web dropdown option.
// ---------------------------------------------------------------------------
class _GpsTile extends StatelessWidget {
  const _GpsTile({required this.busy, required this.onTap});
  final bool busy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final dark = isDark(context);
    return InkWell(
      onTap: busy ? null : onTap,
      child: Container(
        margin: const EdgeInsets.fromLTRB(8, 8, 8, 4),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
        decoration: BoxDecoration(
          color: dark ? const Color(0xFF0E2A22) : const Color(0xFFE6F4EA),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFF2E7D32).withValues(alpha: .35)),
        ),
        child: Row(
          children: [
            Container(
              width: 26,
              height: 26,
              decoration: BoxDecoration(
                color: const Color(0xFF2E7D32),
                borderRadius: BorderRadius.circular(8),
              ),
              child: busy
                  ? const Padding(
                      padding: EdgeInsets.all(7),
                      child: CircularProgressIndicator(strokeWidth: 1.6, color: Colors.white),
                    )
                  : const Icon(Icons.my_location_rounded, size: 14, color: Colors.white),
            ),
            const SizedBox(width: 9),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Use Exact Current Location (GPS)',
                    style: tx(context, 11, w: FontWeight.w900, color: const Color(0xFF1B5E20)),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    busy ? 'Detecting…' : 'GPS probe + Auto-Fill',
                    style: tx(context, 8.5, color: const Color(0xFF37623C)),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
              decoration: BoxDecoration(
                color: const Color(0xFF2E7D32),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text('LIVE', style: tx(context, 7.5, w: FontWeight.w900, color: Colors.white)),
            ),
            const SizedBox(width: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: .75),
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: const Color(0xFF2E7D32).withValues(alpha: .4)),
              ),
              child: Text('Auto-Fill', style: tx(context, 7.5, w: FontWeight.w900, color: const Color(0xFF1B5E20))),
            ),
          ],
        ),
      ),
    );
  }
}
