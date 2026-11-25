import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../core/theme.dart';
import '../../core/verticals.dart';
import '../screens/nearby_screen.dart';
import 'kit.dart';

/// The website's vertical strip (`src/components/VerticalNav.tsx`) — Home · Nearby · Flights (20) · Hotels · …
///
/// OWNER 21 Nov (screenshots: mobile site vs app home): "mobile website pr dekho header ke neeche kaise home
/// page pr nearby, flights, Hotels ...... app ke homepage mai ni aa raha".
///
/// The strip already existed, but it was built INSIDE the Compare screen, so it only ever painted there: the
/// home page opened straight into the hero with no way to reach a vertical except scrolling to the grid. It
/// is one widget now, used by BOTH screens, so the two can never drift apart again.
///
/// Counts come from `AppState.resultCounts` (a vertical's real settled row count on this device). A vertical
/// that has not been searched yet shows no badge at all — a "0" would claim the catalogue is empty, which we
/// do not know.
class VerticalTabs extends StatelessWidget {
  const VerticalTabs({super.key, required this.current, required this.onPick});

  /// The vertical whose feed is on screen. Empty on the home page: nothing is current there.
  final String current;

  /// Called with a vertical id. The caller decides whether that means "switch the feed" (Compare screen) or
  /// "open that vertical" (home page).
  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    return Container(
      decoration: BoxDecoration(
        color: isDark(context) ? T1SColors.slate900 : Colors.white,
        border: Border(bottom: BorderSide(color: border(context))),
      ),
      child: SizedBox(
        height: 52,
        child: ListenableBuilder(
          listenable: app,
          builder: (context, _) {
            final counts = app.resultCounts;
            Widget chip({
              required IconData icon,
              required String label,
              required bool active,
              required VoidCallback onTap,
              int? count,
            }) {
              final fg = active ? Colors.white : (isDark(context) ? T1SColors.slate300 : T1SColors.slate600);
              final iconColor = active ? const Color(0xFFFB923C) : (isDark(context) ? T1SColors.slate400 : T1SColors.slate500);
              return GestureDetector(
                onTap: onTap,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: active ? T1SColors.slate900 : (isDark(context) ? T1SColors.slate800 : T1SColors.slate50),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: active ? T1SColors.slate900 : border(context)),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(icon, size: 15, color: iconColor),
                    const SizedBox(width: 6),
                    Text(label, style: tx(context, 11.5, w: FontWeight.w700, color: fg)),
                    if (count != null) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                        decoration: BoxDecoration(
                          color: active ? T1SColors.slate800 : (isDark(context) ? T1SColors.slate700 : T1SColors.slate100),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text('$count',
                            style: tx(context, 9.5, w: FontWeight.w900,
                                color: active ? T1SColors.slate300 : muted(context))),
                      ),
                    ],
                  ]),
                ),
              );
            }

            return ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              children: [
                // Home: the website's strip opens with it, so the app does too.
                chip(
                  icon: Icons.home_rounded,
                  label: 'Home',
                  active: app.tab == NavTab.home,
                  onTap: () => app.go(NavTab.home),
                ),
                for (final v in kVerticals) ...[
                  const SizedBox(width: 8),
                  chip(
                    icon: v.icon,
                    label: v.name,
                    active: v.id == current,
                    count: counts[v.id],
                    onTap: () => onPick(v.id),
                  ),
                ],
                // OWNER 25 Nov ("muje flutter app mai nearby bilkul last mai chaiye home ke baad ni header ke
                // neeche jo horizontal bar hai usme"): Nearby sat second, right after Home, where it pushed the
                // comparison verticals one chip further away. It is not a vertical feed — it opens its own screen —
                // so it closes the strip instead of interrupting the shop-by-category run.
                const SizedBox(width: 8),
                chip(
                  icon: Icons.place_rounded,
                  label: 'Nearby',
                  active: current == 'nearby',
                  onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const NearbyScreen())),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
