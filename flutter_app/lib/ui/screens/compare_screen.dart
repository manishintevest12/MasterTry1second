import 'package:flutter/material.dart';

import '../../core/storage.dart';
import '../../core/theme.dart';
import '../../core/verticals.dart';
import '../widgets/common.dart';
import 'results_screen.dart';

/// Compare: pick any of the 10 verticals, search once, see every platform.
class CompareScreen extends StatefulWidget {
  const CompareScreen({super.key});

  @override
  State<CompareScreen> createState() => _CompareScreenState();
}

class _CompareScreenState extends State<CompareScreen> {
  final _q = TextEditingController();
  final _store = AppStore();
  String _vertical = 'ecommerce';
  List<String> _recents = [];

  @override
  void initState() {
    super.initState();
    _store.recents().then((r) => setState(() => _recents = r.take(8).toList()));
  }

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  void _go([String? overrideQuery]) {
    final q = (overrideQuery ?? _q.text).trim();
    if (q.isEmpty) return;
    _store.addRecent(q);
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => ResultsScreen(query: q, vertical: _vertical),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final current = verticalById(_vertical);
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  gradient: T1SColors.badgeGradient,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: const Text('10 VERTICALS',
                    style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: 0.5)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text('Compare', style: T1SText.display(context).copyWith(fontSize: 22)),
          const SizedBox(height: 4),
          Text('One search. Every platform\'s real price.',
              style: T1SText.body(context).copyWith(color: T1SColors.slate500)),
          const SizedBox(height: 16),

          // Search
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _q,
                  onSubmitted: (_) => _go(),
                  textInputAction: TextInputAction.search,
                  decoration: InputDecoration(
                    prefixIcon: const Icon(Icons.search, size: 20),
                    hintText: current.placeholder,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              SizedBox(height: 46, child: T1SButton.primary(label: 'Compare', onTap: _go)),
            ],
          ),
          const SizedBox(height: 8),
          Text('Searching in: ${current.name}',
              style: T1SText.label(context).copyWith(color: T1SColors.red)),

          // Vertical picker
          const SizedBox(height: 20),
          const SectionHeader('PICK A VERTICAL'),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final v in kVerticals)
                ChoiceChip(
                  label: Text(v.name, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700)),
                  selected: _vertical == v.id,
                  onSelected: (_) => setState(() { _vertical = v.id; _q.clear(); }),
                  selectedColor: T1SColors.red,
                  labelStyle: TextStyle(
                    color: _vertical == v.id ? Colors.white : T1SColors.ink,
                    fontWeight: FontWeight.w800,
                    fontSize: 11.5,
                  ),
                  showCheckmark: false,
                ),
            ],
          ),

          if (_recents.isNotEmpty) ...[
            const SizedBox(height: 20),
            const SectionHeader('RECENT'),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final r in _recents)
                  ActionChip(
                    label: Text(r, style: T1SText.body(context).copyWith(fontSize: 11.5)),
                    onPressed: () => _go(r),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
