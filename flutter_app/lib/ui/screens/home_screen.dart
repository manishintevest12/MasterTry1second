import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../core/api.dart';
import '../../core/theme.dart';
import '../../core/verticals.dart';
import '../widgets/home_hero.dart';
import '../widgets/kit.dart';
import '../widgets/home_lens_and_assistant.dart';

/// Website HomeView: dark hero (engine pill, stat tiles, headline, Price Lens,
/// launch buttons) + Ask Try1Second AI + Quick Apps rail + vertical cards grid
/// + radar/referral teaser. All data real; all taps route like the site.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _state = AppState.instance;
  List<QuickApp> _apps = [];

  @override
  void initState() {
    super.initState();
    _loadApps();
  }

  Future<void> _loadApps() async {
    try {
      final apps = await _state.api.quickApps();
      if (mounted) setState(() => _apps = apps);
    } catch (_) {/* honest: rail stays empty */}
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.only(bottom: 24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const HomeHero(),
        // Ask Try1Second AI (Price Lens card sits inside the hero, like the site)
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 18),
          child: HomeLensAndAssistant(api: _state.api),
        ),
        if (_apps.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 18),
            child: _QuickAppsRail(apps: _apps),
          ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: _VerticalGrid(state: _state),
        ),
        const SizedBox(height: 18),
        const Padding(padding: EdgeInsets.symmetric(horizontal: 16), child: _RadarTeaser()),
      ]),
    );
  }
}

// ---------------------------------------------------------------------------
// Quick Apps rail (home strip, website Quick Apps section)
// ---------------------------------------------------------------------------

class _QuickAppsRail extends StatelessWidget {
  const _QuickAppsRail({required this.apps});
  final List<QuickApp> apps;

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Container(width: 8, height: 8, decoration: const BoxDecoration(color: T1SColors.red, shape: BoxShape.circle)),
        const SizedBox(width: 8),
        Expanded(child: Text('QUICK APPS', style: tx(context, 12, w: FontWeight.w900, ls: 0.8))),
        Text('View all →', style: tx(context, 11, w: FontWeight.w800, color: T1SColors.red)),
      ]),
      const SizedBox(height: 10),
      SizedBox(
        height: 56,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: apps.length,
          separatorBuilder: (_, __) => const SizedBox(width: 10),
          itemBuilder: (c, i) => _AppTile(app: apps[i]),
        ),
      ),
    ]);
  }
}

class _AppTile extends StatelessWidget {
  const _AppTile({required this.app});
  final QuickApp app;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => openDeal(app.webUrl),
      child: Container(
        width: 56,
        height: 56,
        padding: const EdgeInsets.all(3),
        decoration: BoxDecoration(
          color: isDark(context) ? T1SColors.slate900 : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: border(context)),
        ),
        child: NetImage(
          app.iconUrl,
          fit: BoxFit.contain,
          radius: 11,
          fallbackIcon: Icons.apps_rounded,
          bg: isDark(context) ? T1SColors.slate800 : T1SColors.slate50,
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Vertical cards (website "Instant Launch Verticals")
// ---------------------------------------------------------------------------

class _VerticalGrid extends StatelessWidget {
  const _VerticalGrid({required this.state});
  final AppState state;

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Container(width: 9, height: 9, decoration: const BoxDecoration(color: T1SColors.red, shape: BoxShape.circle)),
        const SizedBox(width: 8),
        Expanded(
          child: Text('${kVerticals.length} INSTANT LAUNCH VERTICALS · 1-CLICK SEARCH',
              style: tx(context, 12, w: FontWeight.w900, ls: 0.6)),
        ),
      ]),
      const SizedBox(height: 12),
      LayoutBuilder(builder: (c, cons) {
        // Owner reference design (21 Oct): 13 compact action cards (7+6 on wide
        // screens) — icon + bold title + one-line description. 11 verticals plus
        // Coupons (rewards tab 0) and Rewards (rewards tab 1).
        final cols = cons.maxWidth > 1100 ? 7 : cons.maxWidth > 820 ? 5 : cons.maxWidth > 640 ? 4 : (cons.maxWidth > 420 ? 3 : 2);
        final w = (cons.maxWidth - 10 * (cols - 1)) / cols;
        return Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            for (final card in kLaunchCards)
              _LaunchCard(
                card: card,
                width: w,
                onTap: () {
                  if (card.vertical != null) {
                    state.openVertical(card.vertical!);
                  } else {
                    state.goRewards(tab: card.rewardsTab!);
                  }
                },
              ),
          ],
        );
      }),
    ]);
  }
}

/// Compact launch card from the owner's reference image: icon left, bold title,
/// small one-line description. White surface, light border, red icon.
class _LaunchCardData {
  const _LaunchCardData(this.title, this.desc, this.icon, {this.vertical, this.rewardsTab});
  final String title;
  final String desc;
  final IconData icon;
  final String? vertical; // non-null: launches the vertical's compare engine
  final int? rewardsTab; // non-null: opens the Rewards screen on this tab
}

const kLaunchCards = <_LaunchCardData>[
  _LaunchCardData('Shopping', '6 stores, side by side', Icons.shopping_bag_rounded, vertical: 'ecommerce'),
  _LaunchCardData('10-min Grocery', 'quick-commerce live', Icons.shopping_basket_rounded, vertical: 'grocery'),
  _LaunchCardData('Food Delivery', 'same dish, live prices', Icons.restaurant_rounded, vertical: 'food'),
  _LaunchCardData('Flights', 'live fares, real dates', Icons.flight_takeoff_rounded, vertical: 'flights'),
  _LaunchCardData('Hotels', 'real per-night rates', Icons.apartment_rounded, vertical: 'hotels'),
  _LaunchCardData('Bus', 'tier-1 to tier-3 towns', Icons.directions_bus_rounded, vertical: 'bus'),
  _LaunchCardData('Cab & Ride', 'live fare estimates', Icons.local_taxi_rounded, vertical: 'cab'),
  _LaunchCardData('Movies', 'seats & showtimes', Icons.movie_rounded, vertical: 'movie'),
  _LaunchCardData('Loans', 'real rate ranges', Icons.account_balance_rounded, vertical: 'loans'),
  _LaunchCardData('Insurance', 'premium quotes', Icons.verified_user_rounded, vertical: 'insurance'),
  _LaunchCardData('Credit Cards', 'fees & rewards', Icons.credit_card_rounded, vertical: 'creditcards'),
  _LaunchCardData('Coupons', 'auto-tested on checkout', Icons.local_activity_rounded, rewardsTab: 0),
  _LaunchCardData('Rewards', 'points & daily spin', Icons.card_giftcard_rounded, rewardsTab: 1),
];

class _LaunchCard extends StatelessWidget {
  const _LaunchCard({required this.card, required this.width, required this.onTap});
  final _LaunchCardData card;
  final double width;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: width,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isDark(context) ? T1SColors.slate900 : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: border(context)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(card.icon, size: 20, color: T1SColors.red),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(card.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: tx(context, 12.5, w: FontWeight.w900, h: 1.15)),
                  const SizedBox(height: 3),
                  Text(card.desc,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: tx(context, 10.5, color: muted(context), h: 1.2)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _IconBadge extends StatelessWidget {
  const _IconBadge({required this.icon});
  final IconData icon;
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 28,
      height: 28,
      decoration: BoxDecoration(
        color: const Color(0xCC0F172A),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.white24),
      ),
      child: Icon(icon, size: 16, color: T1SColors.amber400),
    );
  }
}

// ---------------------------------------------------------------------------
// Radar + referral teaser (website dark banner)
// ---------------------------------------------------------------------------

class _RadarTeaser extends StatelessWidget {
  const _RadarTeaser();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [T1SColors.slate900, T1SColors.slate950, T1SColors.slate900],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF1E293B)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: T1SColors.emerald500.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: T1SColors.emerald500.withValues(alpha: 0.3)),
            ),
            child: Row(children: [
              Container(width: 7, height: 7, decoration: const BoxDecoration(color: T1SColors.emerald500, shape: BoxShape.circle)),
              const SizedBox(width: 6),
              Text('Real-Time Redirection Tracker Active',
                  style: tx(context, 10.5, w: FontWeight.w800, color: T1SColors.emerald400)),
            ]),
          ),
        ]),
        const SizedBox(height: 14),
        Text('Earn 1 Point for Every Referral. Spin at 100 Points.',
            style: tx(context, 17, w: FontWeight.w900, color: Colors.white, h: 1.2)),
        const SizedBox(height: 8),
        Text(
          'Invite friends using your personal Try1Second referral link. Every friend who joins accredits 1 point directly to your wallet for guaranteed vouchers on the wheel.',
          style: tx(context, 11.5, color: T1SColors.slate400, h: 1.45),
        ),
        const SizedBox(height: 14),
        Row(children: [
          GestureDetector(
            onTap: () => AppState.instance.go(NavTab.rewards),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 11),
              decoration: BoxDecoration(
                gradient: T1SColors.ctaGradient,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(children: [
                const Icon(Icons.card_giftcard_rounded, size: 15, color: Colors.white),
                const SizedBox(width: 7),
                Text('Open Rewards Hub', style: tx(context, 12, w: FontWeight.w900, color: Colors.white)),
              ]),
            ),
          ),
        ]),
      ]),
    );
  }
}
