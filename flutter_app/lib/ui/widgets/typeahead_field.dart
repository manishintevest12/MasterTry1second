import 'package:flutter/material.dart';

import '../../core/autocomplete_data.dart';
import '../../core/theme.dart';
import 'kit.dart';

/// Website's autocomplete dropdown, ported 1:1: city suggestions for route
/// fields (from/to) and per-vertical preset lists for text search. Local
/// dataset mirrors src/data/autocompleteData.ts exactly.
class TypeaheadField extends StatelessWidget {
  const TypeaheadField({
    super.key,
    required this.controller,
    required this.hint,
    required this.cities,
    this.presets = const [],
    this.icon,
    this.onSubmitted,
    this.focusNode,
    this.trailing,
  });

  final TextEditingController controller;
  final String hint;
  final bool cities;
  final List<String> presets;
  final IconData? icon;
  final ValueChanged<String>? onSubmitted;
  final FocusNode? focusNode;
  final Widget? trailing;

  List<String> _options(String query) {
    final q = query.trim().toLowerCase();
    if (cities) {
      final list = [for (final c in kAutoCities) c.text];
      if (q.isEmpty) return list.take(8).toList();
      final starts = list.where((t) => t.toLowerCase().startsWith(q)).toList();
      final contains = list.where((t) => !t.toLowerCase().startsWith(q) && t.toLowerCase().contains(q)).toList();
      return [...starts, ...contains].take(8).toList();
    }
    if (q.isEmpty) return presets.take(6).toList();
    return presets.where((t) => t.toLowerCase().contains(q)).take(6).toList();
  }

  @override
  Widget build(BuildContext context) {
    return RawAutocomplete<String>(
      textEditingController: controller,
      focusNode: focusNode,
      optionsBuilder: (v) => _options(v.text),
      displayStringForOption: (s) => s,
      fieldViewBuilder: (c, ctrl, focus, onSub) => TextField(
        controller: ctrl,
        focusNode: focus,
        onSubmitted: (v) { onSub(); onSubmitted?.call(v); },
        textInputAction: TextInputAction.search,
        decoration: InputDecoration(
          hintText: hint,
          isDense: true,
          prefixIcon: icon == null ? null : Icon(icon, size: 16),
          suffixIcon: trailing,
        ),
        style: tx(context, 13),
      ),
      optionsViewBuilder: (c, onSelected, options) => Align(
        alignment: Alignment.topLeft,
        child: Material(
          elevation: 6,
          borderRadius: BorderRadius.circular(12),
          color: surface(c),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 264, maxWidth: 320),
            child: ListView(
              padding: const EdgeInsets.symmetric(vertical: 4),
              shrinkWrap: true,
              children: [
                if (cities)
                  for (final o in options)
                    _CityOption(option: o, onSelected: () { controller.text = o; onSelected(o); }),
                if (!cities)
                  for (final o in options)
                    InkWell(
                      onTap: () { controller.text = o; onSelected(o); },
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                        child: Row(children: [
                          Icon(Icons.search_rounded, size: 14, color: muted(c)),
                          const SizedBox(width: 8),
                          Expanded(child: Text(o, maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(c, 12.5, w: FontWeight.w700))),
                        ]),
                      ),
                    ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CityOption extends StatelessWidget {
  const _CityOption({required this.option, required this.onSelected});
  final String option;
  final VoidCallback onSelected;

  CitySuggestion get _city => kAutoCities.firstWhere((c) => c.text == option);

  @override
  Widget build(BuildContext context) {
    final c = _city;
    return InkWell(
      onTap: onSelected,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(children: [
          const Icon(Icons.flight_takeoff_rounded, size: 14, color: T1SColors.red),
          const SizedBox(width: 9),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(c.text, maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 12.5, w: FontWeight.w800)),
              const SizedBox(height: 1),
              Text(c.subtext, maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 9.5, color: muted(context))),
            ]),
          ),
          if (c.badge.isNotEmpty) ...[
            const SizedBox(width: 8),
            Pill(c.badge, fg: T1SColors.red, bg: T1SColors.red50, size: 8),
          ],
        ]),
      ),
    );
  }
}
