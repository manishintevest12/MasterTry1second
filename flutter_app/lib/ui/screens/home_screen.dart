import 'package:flutter/material.dart';

import '../../core/storage.dart';
import '../../core/theme.dart';
import '../../core/verticals.dart';
import '../widgets/common.dart';
import '../widgets/logo.dart';
import 'results_screen.dart';

/// Home: brand header, search bar, vertical grid, recents.
/// Fully responsive: 2-col grid on phones, 3-4 columns on wide screens.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, this.initialVertical});

  final String? initialVertical;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _q = TextEditingController();
  final _store = AppStore();
  String _vertical = 'ecommerce';
  List<String> _recents = [];

  @override
  void initState() {
    super.initState();
    _vertical = widget.initialVertical ?? 'ecommerce';
    _store.recents().then((r) => setState(() => _recents = r));
  }

  void _go([String? overrideQuery]) {
    final q = (overrideQuery ?? _q.text).trim();
    if (q.isEmpty) return;
    _store.addRecent(q);
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => ResultsScreen(query: q, vertical: _vertical),
    ));
  }

  void _openVertical(VerticalMeta v) {
    setState(() => _vertical = v.id);
    _q.text = '';
    // focus hint via placeholder; user types then searches
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final gridCols = width > 1100 ? 4 : (width > 700 ? 3 : 2);
    final current = verticalById(_vertical);
    final dark = Theme.of(context).brightness == Brightness.dark;

    return SafeArea(
      child: LayoutBuilder(builder: (context, constraints) {
        final maxW = constraints.maxWidth > 760 ? 760.0 : constraints.maxWidth;
        return Center(
          child: SizedBox(
            width: maxW,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              children: [
                Row(
                  children: [
                    const T1SLogo(size: 44),
                    const Spacer(),
                    if (dark)
                      const Icon(Icons.dark_mode_outlined, size: 20, color: T1SColors.slate400),
                  ],
                ),
                const SizedBox(height: 18),
                Text('Search once.\nSee every real price.',
                    style: T1SText.display(context).copyWith(height: 1.15)),
                const SizedBox(height: 6),
                Text(
                  'India\'s independent metasearch — verified offers only, never invented.',
                  style: T1SText.body(context).copyWith(color: T1SColors.slate500),
                ),
                const SizedBox(height: 18),

                // Search bar
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
                    SizedBox(
                      height: 46,
                      child: T1SButton.primary(label: 'Search', onTap: _go),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  'Searching in: ${current.name}',
                  style: T1SText.label(context).copyWith(color: T1SColors.red),
                ),

                const SizedBox(height: 22),
                const SectionHeader('VERTICALS'),
                GridView.count(
                  crossAxisCount: gridCols,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 10,
                  crossAxisSpacing: 10,
                  childAspectRatio: 1.05,
                  children: [
                    for (final v in kVerticals)
                      VerticalTile(
                        vertical: v,
                        onTap: () => _openVertical(v),
                      ),
                  ],
                ),

                if (_recents.isNotEmpty) ...[
                  const SizedBox(height: 22),
                  SectionHeader('RECENT SEARCHES',
                      trailing: TextButton(
                        onPressed: () async {
                          await _store.clearRecents();
                          setState(() => _recents = []);
                        },
                        child: Text('Clear', style: T1SText.label(context).copyWith(color: T1SColors.slate400)),
                      )),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final r in _recents)
                        ActionChip(
                          label: Text(r, style: T1SText.body(context).copyWith(fontSize: 11.5)),
                          backgroundColor: dark ? T1SColors.slate900 : Colors.white,
                          side: BorderSide(color: dark ? const Color(0xFF334155) : T1SColors.slate200),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                          onPressed: () => _go(r),
                        ),
                    ],
                  ),
                ],

                const SizedBox(height: 24),
                T1SCard(
                  child: Row(
                    children: [
                      const Icon(Icons.verified_outlined, color: T1SColors.green, size: 22),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Every price in this app is fetched live from the Try1Second engine. '
                          'If a source is unavailable, we say so — no mock data, ever.',
                          style: T1SText.body(context).copyWith(fontSize: 11.5),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      }),
    );
  }
}
