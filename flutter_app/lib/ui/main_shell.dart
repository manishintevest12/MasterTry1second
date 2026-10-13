import 'package:flutter/material.dart';

import '../../core/theme.dart';
import 'screens/home_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/tracked_screen.dart';
import 'widgets/logo.dart';

/// Adaptive shell: bottom navigation bar on phones, NavigationRail on
/// tablets/desktop — platform responsive on Android and iOS.
class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _index = 0;

  static const _screens = [HomeScreen(), TrackedScreen(), SettingsScreen()];

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final wide = width >= 840;
    final dark = Theme.of(context).brightness == Brightness.dark;

    final navBar = NavigationBar(
      selectedIndex: _index,
      onDestinationSelected: (i) => setState(() => _index = i),
      indicatorColor: dark ? const Color(0xFF1E293B) : T1SColors.slate100,
      height: 64,
      destinations: const [
        NavigationDestination(icon: Icon(Icons.search_outlined), selectedIcon: Icon(Icons.search, color: T1SColors.red), label: 'Search'),
        NavigationDestination(icon: Icon(Icons.notifications_none_outlined), selectedIcon: Icon(Icons.notifications, color: T1SColors.red), label: 'Watchlist'),
        NavigationDestination(icon: Icon(Icons.settings_outlined), selectedIcon: Icon(Icons.settings, color: T1SColors.red), label: 'Settings'),
      ],
    );

    if (!wide) {
      return Scaffold(
        body: IndexedStack(index: _index, children: _screens),
        bottomNavigationBar: navBar,
      );
    }

    // Tablet / landscape / desktop: rail + centered content
    return Scaffold(
      body: Row(
        children: [
          NavigationRail(
            selectedIndex: _index,
            onDestinationSelected: (i) => setState(() => _index = i),
            labelType: NavigationRailLabelType.all,
            backgroundColor: dark ? T1SColors.slate900 : Colors.white,
            indicatorColor: dark ? const Color(0xFF1E293B) : T1SColors.slate100,
            leading: const Padding(
              padding: EdgeInsets.only(top: 18, bottom: 12),
              child: T1SLogo(size: 34, showWordmark: false),
            ),
            destinations: const [
              NavigationRailDestination(icon: Icon(Icons.search_outlined), selectedIcon: Icon(Icons.search, color: T1SColors.red), label: Text('Search')),
              NavigationRailDestination(icon: Icon(Icons.notifications_none_outlined), selectedIcon: Icon(Icons.notifications, color: T1SColors.red), label: Text('Watchlist')),
              NavigationRailDestination(icon: Icon(Icons.settings_outlined), selectedIcon: Icon(Icons.settings, color: T1SColors.red), label: Text('Settings')),
           ],
          ),
          const VerticalDivider(width: 1),
          Expanded(child: IndexedStack(index: _index, children: _screens)),
        ],
      ),
    );
  }
}
