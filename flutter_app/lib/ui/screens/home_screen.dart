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
          child: Text('11 INSTANT LAUNCH VERTICALS · 1-CLICK SEARCH',
              style: tx(context, 12, w: FontWeight.w900, ls: 0.6)),
        ),
      ]),
      const SizedBox(height: 12),
      LayoutBuilder(builder: (c, cons) {
        final cols = cons.maxWidth > 640 ? 4 : (cons.maxWidth > 420 ? 3 : 2);
        final w = (cons.maxWidth - 10 * (cols - 1)) / cols;
        return Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [for (final v in kVerticals) _VerticalCard(meta: v, width: w, onTap: () => state.openVertical(v.id))],
        );
      }),
    ]);
  }
}

class _VerticalCard extends StatelessWidget {
  const _VerticalCard({required this.meta, required this.width, required this.onTap});
  final VerticalMeta meta;
  final double width;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: width,
        decoration: BoxDecoration(
          color: isDark(context) ? T1SColors.slate900 : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: border(context)),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          // photo header
          SizedBox(
            height: 76,
            child: Stack(fit: StackFit.expand, children: [
              NetImage(meta.cover, height: 76),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.transparent, Color(0x3320627b), Color(0xCC0F172A)]),
                ),
              ),
              Positioned(top: 8, left: 8, child: _IconBadge(icon: meta.icon)),
              Positioned(
                bottom: 6,
                right: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(6), border: Border.all(color: Colors.white24)),
                  child: Text('1-Click', style: tx(context, 9, w: FontWeight.w800, color: Colors.white, mono: true)),
                ),
              ),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.all(10),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(meta.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 13, w: FontWeight.w800)),
              const SizedBox(height: 3),
              Text(meta.description, maxLines: 2, overflow: TextOverflow.ellipsis, style: tx(context, 10, color: muted(context), h: 1.25)),
              const SizedBox(height: 8),
              Row(children: [
                Text('Instant Sync', style: tx(context, 9, w: FontWeight.w800, color: muted(context), ls: 0.5)),
                const Spacer(),
                Text('Compare →', style: tx(context, 10.5, w: FontWeight.w800, color: T1SColors.red)),
              ]),
            ]),
          ),
        ]),
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
