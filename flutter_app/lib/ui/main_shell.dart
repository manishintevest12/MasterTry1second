import 'package:flutter/material.dart';

import '../core/app_state.dart';
import '../core/auth.dart';
import '../core/theme.dart';
import '../core/verticals.dart';
import 'screens/ai_insights_screen.dart';
import 'screens/alerts_screen.dart';
import 'screens/spend_lens_screen.dart';
import 'screens/compare_screen.dart';
import 'screens/home_screen.dart';
import 'screens/notifications_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/quick_apps_screen.dart';
import 'screens/rewards_screen.dart';
import 'widgets/sponsored_pill.dart';
import 'widgets/kit.dart';
import 'widgets/logo.dart';
import 'screens/nearby_screen.dart';

/// Website shell: sticky white header (logo, red bell with unread badge, hamburger menu)
/// + fixed 5-tab bottom bar (Home, Quick Apps, AI INSIGHTS blue pill, Compare, Rewards).
class MainShell extends StatefulWidget {
  const MainShell({super.key});
  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  final _state = AppState.instance;
  final _scaffoldKey = GlobalKey<ScaffoldState>();
  bool _menuOpen = false;

  // SPEED (22 Oct): the shell paints only tab + header/menu/bottom-bar badges.
  // AppState notifies on EVERY warm/search tick (~15x per app open), and each
  // notify used to rebuild the whole shell — including the active screen with
  // its image-heavy cards. Screens listen to AppState themselves, so the shell
  // rebuilds ONLY when a value it actually shows changes.
  NavTab _lastTab = NavTab.home;
  int _lastUnread = 0;
  int _lastPoints = 0;
  int _lastTracked = 0;
  int _lastSpins = 0;
  int _lastRewardsTab = 0;

  @override
  void initState() {
    super.initState();
    _syncShellFields();
    _state.addListener(_rebuild);
    _state.init();
  }

  @override
  void dispose() {
    _state.removeListener(_rebuild);
    super.dispose();
  }

  void _syncShellFields() {
    _lastTab = _state.tab;
    _lastUnread = _state.unread;
    _lastPoints = _state.points;
    _lastTracked = _state.trackedCount;
    _lastSpins = _state.spinsAvailable;
    _lastRewardsTab = _state.pendingRewardsTab;
  }

  void _rebuild() {
    if (!mounted) return;
    final changed = _lastTab != _state.tab ||
        _lastUnread != _state.unread ||
        _lastPoints != _state.points ||
        _lastTracked != _state.trackedCount ||
        _lastSpins != _state.spinsAvailable ||
        _lastRewardsTab != _state.pendingRewardsTab;
    if (!changed) return; // warm/search ticks: nothing the shell shows moved
    _syncShellFields();
    setState(() {});
  }

  Widget _body() {
    switch (_state.tab) {
      case NavTab.home:
        return const HomeScreen();
      case NavTab.quickApps:
        return const QuickAppsScreen();
      case NavTab.insights:
        return const AiInsightsScreen();
      case NavTab.compare:
        return const CompareScreen();
      case NavTab.rewards:
        return RewardsScreen(initialTab: _state.pendingRewardsTab);
    }
  }

  void _push(Widget w) {
    setState(() => _menuOpen = false);
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => w));
  }

  @override
  Widget build(BuildContext context) {
    final dark = isDark(context);
    final wide = MediaQuery.sizeOf(context).width >= 900;
    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: dark ? T1SColors.slate950 : T1SColors.slate50,
      body: SafeArea(
        bottom: false,
        child: Column(children: [
          _Header(
            unread: _state.unread,
            menuOpen: _menuOpen,
            onBell: () => _push(const NotificationsScreen()),
            onMenu: () => setState(() => _menuOpen = !_menuOpen),
          ),
          Expanded(
            child: Stack(children: [
              Center(
                child: ConstrainedBox(
                  constraints: BoxConstraints(maxWidth: wide ? 1100 : double.infinity),
                  child: KeyedSubtree(key: ValueKey(_state.tab), child: _body()),
                ),
              ),
              if (_menuOpen) ...[
                Positioned.fill(
                  child: GestureDetector(onTap: () => setState(() => _menuOpen = false), child: Container(color: Colors.black.withValues(alpha: 0.25))),
                ),
                Positioned(
                  top: 8,
                  left: 12,
                  right: 12,
                  child: _MenuSheet(
                    points: _state.points,
                    trackedCount: _state.trackedCount,
                    unread: _state.unread,
                    onVertical: (v) {
                      setState(() => _menuOpen = false);
                      _state.openVertical(v);
                    },
                    onTracker: () => _push(const AlertsScreen()),
                    onSpendLens: () => _push(const SpendLensScreen()),
            onNearby: () => _push(const NearbyScreen()),
                    onAlerts: () => _push(const NotificationsScreen()),
                    onProfile: () => _push(const ProfileScreen()),
                  ),
                ),
              ],
            ]),
          ),
        ]),
      ),
      // OWNER 9 Nov: the smartlink pill sits just above the bottom bar ("bottom navigation bar ke
      // just upar ek patli si clean interactive pill"). It renders nothing unless /api/app-ads
      // publishes a live smartlink, and it only opens on the user's own tap.
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SponsoredDealPill(),
          _BottomBar(
            current: _state.tab,
            spins: _state.spinsAvailable,
            onTap: (t) {
              setState(() => _menuOpen = false);
              _state.go(t);
            },
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

class _Header extends StatelessWidget {
  const _Header({required this.unread, required this.menuOpen, required this.onBell, required this.onMenu});
  final int unread;
  final bool menuOpen;
  final VoidCallback onBell;
  final VoidCallback onMenu;

  @override
  Widget build(BuildContext context) {
    final dark = isDark(context);
    return Container(
      height: 64,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: dark ? T1SColors.slate900 : Colors.white,
        border: Border(bottom: BorderSide(color: border(context))),
      ),
      child: Row(children: [
        const T1SLogo(size: 38),
        const Spacer(),
        // Alerts bell: red circle, white unread badge
        GestureDetector(
          onTap: onBell,
          child: SizedBox(
            width: 44,
            height: 44,
            child: Stack(clipBehavior: Clip.none, alignment: Alignment.center, children: [
              Container(
                width: 40,
                height: 40,
                decoration: const BoxDecoration(color: T1SColors.red, shape: BoxShape.circle),
                child: const Icon(Icons.notifications_none_rounded, color: Colors.white, size: 20),
              ),
              if (unread > 0)
                Positioned(
                  top: 0,
                  right: 0,
                  child: Container(
                    constraints: const BoxConstraints(minWidth: 17, minHeight: 17),
                    padding: const EdgeInsets.symmetric(horizontal: 3),
                    decoration: BoxDecoration(color: Colors.white, shape: BoxShape.rectangle, borderRadius: BorderRadius.circular(9), border: Border.all(color: T1SColors.red)),
                    alignment: Alignment.center,
                    child: Text(unread > 99 ? '99+' : '$unread', style: const TextStyle(color: T1SColors.red, fontSize: 9, fontWeight: FontWeight.w900)),
                  ),
                ),
            ]),
          ),
        ),
        const SizedBox(width: 8),
        GestureDetector(
          onTap: onMenu,
          child: Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: dark ? T1SColors.slate800 : T1SColors.slate50,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: border(context)),
            ),
            child: Icon(menuOpen ? Icons.close_rounded : Icons.menu_rounded, size: 21, color: ink(context)),
          ),
        ),
      ]),
    );
  }
}

class _MenuSheet extends StatelessWidget {
  const _MenuSheet({
    required this.points,
    required this.trackedCount,
    required this.unread,
    required this.onVertical,
    required this.onTracker,
    required this.onSpendLens,
    required this.onNearby,
    required this.onAlerts,
    required this.onProfile,
  });
  final int points;
  final int trackedCount;
  final int unread;
  final ValueChanged<String> onVertical;
  final VoidCallback onTracker;
  final VoidCallback onSpendLens;
  final VoidCallback onNearby;
  final VoidCallback onAlerts;
  final VoidCallback onProfile;

  @override
  Widget build(BuildContext context) {
    final auth = AuthService.instance;
    return Material(
      color: Colors.transparent,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: surface(context),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: border(context)),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.18), blurRadius: 24, offset: const Offset(0, 10))],
        ),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('SELECT COMPARISON VERTICAL', style: tx(context, 10, w: FontWeight.w900, color: muted(context), ls: 0.8)),
          const SizedBox(height: 8),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 6,
            crossAxisSpacing: 6,
            childAspectRatio: 3.6,
            children: [
              for (final v in kVerticals)
                InkWell(
                  borderRadius: BorderRadius.circular(10),
                  onTap: () => onVertical(v.id),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    decoration: BoxDecoration(color: isDark(context) ? T1SColors.slate800 : T1SColors.slate50, borderRadius: BorderRadius.circular(10)),
                    child: Row(children: [
                      Icon(v.icon, size: 16, color: T1SColors.red),
                      const SizedBox(width: 8),
                      Expanded(child: Text(v.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 12, w: FontWeight.w800))),
                    ]),
                  ),
                ),
              // OWNER 14 Nov: "in app in menu still 12 vertical showing". kVerticals holds the twelve
              // comparison verticals and Nearby is the thirteenth, so the menu was a tile short of the
              // count the app itself advertises. Same tile, same red icon, its own callback.
              InkWell(
                borderRadius: BorderRadius.circular(10),
                onTap: onNearby,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  decoration: BoxDecoration(color: isDark(context) ? T1SColors.slate800 : T1SColors.slate50, borderRadius: BorderRadius.circular(10)),
                  child: Row(children: [
                    const Icon(Icons.nearby_error_rounded, size: 16, color: T1SColors.red),
                    const SizedBox(width: 8),
                    Expanded(child: Text('Nearby', maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 12, w: FontWeight.w800))),
                  ]),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: _MenuAction(Icons.favorite_rounded, 'Tracker', badge: trackedCount, color: T1SColors.rose500, onTap: onTracker)),
            const SizedBox(width: 6),
            Expanded(child: _MenuAction(Icons.notifications_rounded, 'Alerts', badge: unread, color: T1SColors.red, onTap: onAlerts)),
            const SizedBox(width: 6),
            Expanded(
              child: _MenuAction(
                Icons.account_balance_wallet_rounded,
                'Spend Lens',
                color: T1SColors.red,
                onTap: onSpendLens,
              ),
            ),
            const SizedBox(width: 6),
            Expanded(
              child: _MenuAction(
                auth.signedIn ? Icons.account_circle_rounded : Icons.login_rounded,
                auth.signedIn ? 'Profile' : 'Sign in',
                color: T1SColors.slate700,
                onTap: onProfile,
              ),
            ),
          ]),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            decoration: BoxDecoration(color: isDark(context) ? T1SColors.slate800 : T1SColors.slate50, borderRadius: BorderRadius.circular(10)),
            child: Row(children: [
              const Icon(Icons.card_giftcard_rounded, size: 15, color: T1SColors.orange500),
              const SizedBox(width: 6),
              Text('$points pts', style: tx(context, 12, w: FontWeight.w900)),
              const Spacer(),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _MenuAction extends StatelessWidget {
  const _MenuAction(this.icon, this.label, {required this.color, required this.onTap, this.badge = 0});
  final IconData icon;
  final String label;
  final Color color;
  final int badge;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(color: isDark(context) ? T1SColors.slate800 : T1SColors.slate50, borderRadius: BorderRadius.circular(10), border: Border.all(color: border(context))),
        child: Column(children: [
          Stack(clipBehavior: Clip.none, children: [
            Icon(icon, size: 19, color: color),
            if (badge > 0)
              Positioned(
                right: -8,
                top: -6,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                  decoration: BoxDecoration(color: T1SColors.red, borderRadius: BorderRadius.circular(8)),
                  child: Text('$badge', style: const TextStyle(color: Colors.white, fontSize: 8.5, fontWeight: FontWeight.w900)),
                ),
              ),
          ]),
          const SizedBox(height: 4),
          Text(label, style: tx(context, 10.5, w: FontWeight.w800)),
        ]),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Bottom bar
// ---------------------------------------------------------------------------

class _BottomBar extends StatelessWidget {
  const _BottomBar({required this.current, required this.onTap, required this.spins});
  final NavTab current;
  final int spins;
  final ValueChanged<NavTab> onTap;

  @override
  Widget build(BuildContext context) {
    final dark = isDark(context);
    return Container(
      decoration: BoxDecoration(
        color: (dark ? T1SColors.slate900 : Colors.white).withValues(alpha: 0.97),
        border: Border(top: BorderSide(color: border(context))),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 20, offset: const Offset(0, -4))],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(8, 6, 8, 6),
          child: Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
            _Item(Icons.home_rounded, 'Home', current == NavTab.home, () => onTap(NavTab.home)),
            _Item(Icons.bolt_rounded, 'Quick Apps', current == NavTab.quickApps, () => onTap(NavTab.quickApps), dot: true),
            _AiPill(active: current == NavTab.insights, onTap: () => onTap(NavTab.insights)),
            _Item(Icons.swap_horiz_rounded, 'Compare', current == NavTab.compare, () => onTap(NavTab.compare)),
            _Item(Icons.card_giftcard_rounded, 'Rewards', current == NavTab.rewards, () => onTap(NavTab.rewards), badge: spins),
          ]),
        ),
      ),
    );
  }
}

class _Item extends StatelessWidget {
  const _Item(this.icon, this.label, this.active, this.onTap, {this.dot = false, this.badge = 0});
  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;
  final bool dot;
  final int badge;
  @override
  Widget build(BuildContext context) {
    final c = active ? T1SColors.red : (isDark(context) ? T1SColors.slate400 : T1SColors.slate500);
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Stack(clipBehavior: Clip.none, children: [
            Icon(icon, size: 23, color: c),
            if (dot) Positioned(top: -2, right: -4, child: Container(width: 8, height: 8, decoration: const BoxDecoration(color: T1SColors.emerald500, shape: BoxShape.circle))),
            if (badge > 0)
              Positioned(
                top: -5,
                right: -9,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                  decoration: BoxDecoration(color: T1SColors.red, borderRadius: BorderRadius.circular(8)),
                  child: Text('$badge', style: const TextStyle(color: Colors.white, fontSize: 8.5, fontWeight: FontWeight.w900)),
                ),
              ),
          ]),
          const SizedBox(height: 3),
          Text(label, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: c)),
        ]),
      ),
    );
  }
}

/// Prominent blue "AI INSIGHTS" pill (active: solid blue, white text, slightly larger).
class _AiPill extends StatelessWidget {
  const _AiPill({required this.active, required this.onTap});
  final bool active;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedScale(
        scale: active ? 1.05 : 1,
        duration: const Duration(milliseconds: 160),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 5),
          decoration: BoxDecoration(
            color: active ? T1SColors.blue600 : Colors.transparent,
            borderRadius: BorderRadius.circular(16),
            boxShadow: active ? [BoxShadow(color: T1SColors.blue600.withValues(alpha: 0.28), blurRadius: 10, offset: const Offset(0, 3))] : null,
          ),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.auto_awesome_rounded, size: 22, color: active ? Colors.white : T1SColors.blue600),
            const SizedBox(height: 2),
            Text('AI INSIGHTS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: -0.2, color: active ? Colors.white : T1SColors.blue600)),
          ]),
        ),
      ),
    );
  }
}
