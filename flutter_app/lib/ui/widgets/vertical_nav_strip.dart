import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../core/vertical_nav.dart';
import '../../core/verticals.dart';
import '../screens/nearby_screen.dart';
import 'kit.dart';

/// The website's vertical strip (`src/components/VerticalNav.tsx`), on the app home page.
///
/// OWNER 21 Nov (screenshots: mobile site vs app home): "mobile website pr dekho header ke neeche kaise
/// home page pr nearby, flights, Hotels ...... app ke homepage mai ni aa raha". The row now sits at the
/// top of the home page exactly as on the site — Home, Nearby, then every vertical with its row count —
/// and scrolls sideways on a phone instead of wrapping.
class VerticalNavStrip extends StatelessWidget {
  const VerticalNavStrip({super.key, required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    // Every row the app already holds, so a chip shows the same number the site prints for it.
    final rows = <String>[];
    for (final entry in state.cache.entries) {
      for (final item in entry.value.items) {
        rows.add(item.vertical.isEmpty ? entry.key : item.vertical);
      }
    }
    final counts = navBadgeCounts(rows);
    final items = verticalNavItems(
      kVerticals.map((v) => v.id).toList(),
      (id) => verticalById(id).name,
    );
    final onHome = state.tab == NavTab.home;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: muted(context).withValues(alpha: 0.18))),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          children: [
            for (final item in items) ...[
              _chip(context, item, counts[item.id] ?? 0, onHome),
              const SizedBox(width: 6),
            ],
          ],
        ),
      ),
    );
  }

  Widget _chip(BuildContext context, VerticalNavItem item, int count, bool onHome) {
    final active = item.isHome
        ? onHome
        : (!item.isNearby && state.tab == NavTab.compare && navVerticalId(state.vertical) == item.id);
    final icon = item.isHome
        ? Icons.home_rounded
        : item.isNearby
            ? Icons.place_rounded
            : verticalById(item.id).icon;
    final badge = item.isHome || item.isNearby ? '' : navBadgeLabel(count);

    return GestureDetector(
      onTap: () => _select(context, item),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
          color: active ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(9),
          border: Border.all(color: active ? const Color(0xFF0F172A) : muted(context).withValues(alpha: 0.18)),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 15, color: active ? const Color(0xFFFFA94D) : muted(context)),
          const SizedBox(width: 5),
          Text(
            item.label,
            style: tx(context, 11.5,
                w: FontWeight.w700, color: active ? Colors.white : const Color(0xFF334155)),
          ),
          if (badge.isNotEmpty) ...[
            const SizedBox(width: 5),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
              decoration: BoxDecoration(
                color: active ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                badge,
                style: tx(context, 9.5,
                    w: FontWeight.w800, color: active ? const Color(0xFFCBD5E1) : muted(context)),
              ),
            ),
          ],
        ]),
      ),
    );
  }

  void _select(BuildContext context, VerticalNavItem item) {
    if (item.isHome) {
      state.go(NavTab.home);
      return;
    }
    if (item.isNearby) {
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => const NearbyScreen()));
      return;
    }
    // Website `setVertical(v) + setActiveNavTab('compare')`: the chip opens that vertical's feed.
    state.openVertical(item.id);
  }
}
