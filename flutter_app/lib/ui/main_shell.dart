import 'package:flutter/material.dart';

import '../../core/theme.dart';
import 'screens/ai_insights_screen.dart';
import 'screens/compare_screen.dart';
import 'screens/home_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/quick_apps_screen.dart';
import 'screens/rewards_screen.dart';
import 'widgets/logo.dart';

/// Adaptive shell with the same 5 sections as the website: Home, Quick Apps,
/// AI Insights, Compare, Rewards. Bottom bar on phones, rail on wide screens.
class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _index = 0;

  static const _screens = [
    HomeScreen(),
    QuickAppsScreen(),
    AiInsightsScreen(),
    CompareScreen(),
    RewardsScreen(),
    ProfileScreen(),
  ];

  static const _labels = ['Home', 'Quick Apps', 'AI Insights', 'Compare', 'Rewards', 'Profile'];

  static const _icons = [
    Icon(Icons.home_outlined),
    Icon(Icons.apps_outlined),
    Icon(Icons.auto_awesome_outlined),
    Icon(Icons.compare_arrows_outlined),
    Icon(Icons.card_giftcard_outlined),
    Icon(Icons.person_outline),
  ];

  static const _selectedIcons = [
    Icon(Icons.home, color: T1SColors.red),
    Icon(Icons.apps, color: T1SColors.red),
    Icon(Icons.auto_awesome, color: T1SColors.red),
    Icon(Icons.compare_arrows, color: T1SColors.red),
    Icon(Icons.card_giftcard, color: T1SColors.red),
    Icon(Icons.person, color: T1SColors.red),
  ];

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final wide = width >= 840;
    final dark = Theme.of(context).brightness == Brightness.dark;

    if (!wide) {
      return Scaffold(
        body: IndexedStack(index: _index, children: _screens),
        bottomNavigationBar: NavigationBar(
          selectedIndex: _index,
          onDestinationSelected: (i) => setState(() => _index = i),
          indicatorColor: dark ? T1SColors.slate800 : T1SColors.slate100,
          height: 68,
          labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
          destinations: [
            for (var i = 0; i < _screens.length; i++)
              NavigationDestination(
                icon: _icons[i],
                selectedIcon: _selectedIcons[i],
                label: _labels[i],
              ),
          ],
        ),
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
            indicatorColor: dark ? T1SColors.slate800 : T1SColors.slate100,
            leading: const Padding(
              padding: EdgeInsets.only(top: 18, bottom: 12),
              child: T1SLogo(size: 34, showWordmark: false),
            ),
            destinations: [
              for (var i = 0; i < _screens.length; i++)
                NavigationRailDestination(icon: _icons[i], selectedIcon: _selectedIcons[i], label: Text(_labels[i])),
            ],
          ),
          const VerticalDivider(width: 1),
          Expanded(child: IndexedStack(index: _index, children: _screens)),
        ],
      ),
    );
  }
}
