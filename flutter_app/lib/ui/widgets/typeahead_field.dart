import 'package:flutter/material.dart';

import '../../core/autocomplete_data.dart';
import '../../core/theme.dart';
import 'kit.dart';

/// Website's autocomplete dropdown, ported 1:1: city suggestions for route
/// fields (from/to) and per-vertical preset lists for text search. Local
/// dataset mirrors src/data/autocompleteData.ts exactly.
/// Stateful (owner 23 Oct): RawAutocomplete requires focusNode and
/// textEditingController to be BOTH set or BOTH null — a caller passing only
/// the controller tripped its debug assert (and left autocomplete focus
/// handling broken in release). The widget now owns a persistent FocusNode
/// whenever the caller does not supply one.
class TypeaheadField extends StatefulWidget {
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
  @override
  State<TypeaheadField> createState() => _TypeaheadFieldState();
}

class _TypeaheadFieldState extends State<TypeaheadField> {
  FocusNode? _own;

  @override
  void dispose() {
    _own?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final focus = widget.focusNode ?? (_own ??= FocusNode());
    return RawAutocomplete<String>(
      textEditingController: widget.controller,
      focusNode: focus,
      optionsBuilder: (v) => widget._options(v.text),
      displayStringForOption: (s) => s,
      fieldViewBuilder: (c, ctrl, focus, onSub) => TextField(
        controller: ctrl,
        focusNode: focus,
        onSubmitted: (v) { onSub(); widget.onSubmitted?.call(v); },
        textInputAction: TextInputAction.search,
        decoration: InputDecoration(
          hintText: widget.hint,
          isDense: true,
          prefixIcon: widget.icon == null ? null : Icon(widget.icon, size: 16),
          suffixIcon: widget.trailing,
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
                if (widget.cities)
                  for (final o in options)
                    _CityOption(option: o, onSelected: () { widget.controller.text = o; onSelected(o); }),
                if (!widget.cities)
                  for (final o in options)
                    InkWell(
                      onTap: () { widget.controller.text = o; onSelected(o); },
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
          Icon(c.icon, size: 14, color: T1SColors.red),
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
            // Owner 23 Oct reference: capital-class badges are orange, others gray-blue.
            kCapitalBadges.contains(c.badge)
                ? Pill(c.badge, fg: const Color(0xFFCC5500), bg: const Color(0xFFFFE0B2), size: 8)
                : Pill(c.badge, fg: const Color(0xFF37474F), bg: const Color(0xFFECEFF1), size: 8),
          ],
        ]),
      ),
    );
  }
}
