import 'package:flutter/material.dart';

import '../../core/api.dart';
import '../../core/storage.dart';
import '../../core/theme.dart';
import '../../core/verticals.dart';
import '../widgets/common.dart';

/// Watchlist: tracked products re-checked against the real backend on demand.
/// Honest note: the app does not poll in the OS background — prices refresh
/// when you open this screen or tap "Check now".
class TrackedScreen extends StatefulWidget {
  const TrackedScreen({super.key});

  @override
  State<TrackedScreen> createState() => _TrackedScreenState();
}

class _TrackedScreenState extends State<TrackedScreen> {
  final _store = AppStore();
  List<TrackedItem> _items = [];
  bool _busy = false;
  List<(TrackedItem, double, double)> _changes = const [];

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init({bool refresh = false}) async {
    setState(() => _busy = true);
    if (refresh) {
      _changes = await _store.refreshTracked();
    }
    final items = await _store.tracked();
    if (!mounted) return;
    setState(() { _items = items; _busy = false; });
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: LayoutBuilder(builder: (context, constraints) {
        final wide = constraints.maxWidth > 760;
        final maxW = wide ? 760.0 : constraints.maxWidth;
        return Center(
          child: SizedBox(
            width: maxW,
            child: ListView(
              padding: const EdgeInsets.all(14),
              children: [
                Text('Watchlist', style: T1SText.headline(context)),
                const SizedBox(height: 4),
                Text(
                  _changes.isEmpty
                      ? 'Prices re-check against the live engine every time you open this screen.'
                      : '${_changes.length} price${_changes.length == 1 ? '' : 's'} changed on the last check.',
                  style: T1SText.body(context).copyWith(color: T1SColors.slate500, fontSize: 11.5),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  height: 40,
                  child: T1SButton.secondary(
                    label: 'Check prices now',
                    icon: _busy
                        ? const SizedBox(
                            width: 14, height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2, color: T1SColors.red))
                        : const Icon(Icons.refresh, size: 16),
                    onTap: _busy ? null : () => _init(refresh: true),
                  ),
                ),
                const SizedBox(height: 14),

                if (_items.isEmpty)
                  const HonestNote(
                      'Nothing tracked yet. Search a product, open it and press "Track price".'),
                for (final item in _items)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _TrackedCard(
                      item: item,
                      change: _changes
                          .where((c) => c.$1.key == item.key)
                          .firstOrNull,
                      onRemove: () async {
                        await _store.toggleTrack(item);
                        _init();
                      },
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

class _TrackedCard extends StatelessWidget {
  const _TrackedCard({required this.item, required this.onRemove, this.change});

  final TrackedItem item;
  final VoidCallback onRemove;
  final (TrackedItem, double, double)? change;

  @override
  Widget build(BuildContext context) {
    final v = verticalById(item.vertical);
    final dropped = change != null && change!.$3 < change!.$2;
    return T1SCard(
      child: Row(
        children: [
          Icon(v.icon, size: 22, color: T1SColors.red),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: T1SText.title(context)),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Text(inr(item.lastPrice),
                        style: T1SText.title(context).copyWith(fontSize: 13)),
                    const SizedBox(width: 8),
                    if (change != null)
                      Text(
                        dropped ? '↓ ${inr(change!.$2 - change!.$3)}' : '↑ ${inr(change!.$3 - change!.$2)}',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: dropped ? T1SColors.green : T1SColors.red,
                        ),
                      ),
                    const Spacer(),
                    Text(v.name,
                        style: T1SText.label(context).copyWith(color: T1SColors.slate400)),
                  ],
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.delete_outline, size: 18, color: T1SColors.slate400),
            onPressed: onRemove,
          ),
        ],
      ),
    );
  }
}
