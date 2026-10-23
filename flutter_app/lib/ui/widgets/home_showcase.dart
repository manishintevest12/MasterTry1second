import 'package:flutter/material.dart';

import '../../core/api.dart';
import '../../core/session_cache.dart';
import '../../core/app_state.dart';
import '../../core/theme.dart';
import '../widgets/kit.dart';
import 'home_banner_strip.dart';

/// Home Showcase (owner spec 21 Oct, reference restyle 22 Oct): the eight curated
/// sections directly under the "Instant Launch Verticals" grid, now styled with
/// the reference-design ideas in the Try1Second RED brand — hero strip
/// "DEALS WORTH GRABBING", category pills that launch REAL metasearch, and a
/// 3-column product grid with seller chip, star rating, discount ring, price +
/// struck MRP, and red "EPIC STEAL" / "HOT DEAL" badges.
///
/// Server returns only REAL items; empty sections are omitted server-side, so
/// an empty feed here means "nothing live" (never mock). Every tap opens the
/// masking pointer (/api/out) in the in-app browser, so the Amazon Associates
/// tag and Myntra INR-Deals/Cuelinks routing are injected server-side exactly
/// like the website.
class HomeShowcase extends StatefulWidget {
  const HomeShowcase({super.key, required this.state});
  final AppState state;

  @override
  State<HomeShowcase> createState() => _HomeShowcaseState();
}

class _HomeShowcaseState extends State<HomeShowcase> {
  // Session cache (owner 23 Oct): showcase sections load once per app
  // session — instant paint on every return to the Home tab.
  List<ShowcaseSection>? _sections = SessionCache.has('home.showcase')
      ? SessionCache.get('home.showcase', const <ShowcaseSection>[])
      : null;

  /// Reference (Deal Drop) pill queries — each launches a real ecommerce search.
  static const _pillQueries = [
    "men's Wrist Watches",
    'Smart Televisions',
    "men's Running Shoes",
    'Headphones',
    'Mobile Power Banks',
    'Smart Watches',
    'Tablets',
    "men's Shirts",
  ];

  @override
  void initState() {
    super.initState();
    if (_sections != null) return; // session cache hit — no refetch
    SessionCache.once('home.showcase', () => fetchHomeShowcase(widget.state.api)).then((s) {
      if (mounted) setState(() => _sections = s);
    }).catchError((_) {
      if (mounted) setState(() => _sections = const []);
    });
  }

  void _launchQuery(String q) =>
      widget.state.openVertical('ecommerce', search: PendingSearch('ecommerce', q));

  @override
  Widget build(BuildContext context) {
    final sections = _sections;
    if (sections == null || sections.isEmpty) return const SizedBox.shrink();

    // Owner 23 Oct: 'Special Offers For You' belongs in the REWARDS tab, not
    // the homepage — filtered out here, rendered by RewardsScreen instead.
    final homeSections = sections.where((s) => s.id != 'special').toList();

    final heroArts = homeSections
        .expand((s) => s.items)
        .where((i) => (i.image ?? '').isNotEmpty)
        .take(3)
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // HERO STRIP (reference: "Deals Worth Grabbing") — red brand, real art.
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Container(
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFFFF1F2), Color(0xFFFFF7ED), Color(0xFFFFFBEB)],
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFFFE4E6)),
            ),
            padding: const EdgeInsets.fromLTRB(16, 14, 12, 14),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('DEALS WORTH GRABBING',
                      style: TextStyle(fontSize: 16, height: 1.05, fontWeight: FontWeight.w900, color: T1SColors.red, letterSpacing: -0.2)),
                  const SizedBox(height: 5),
                  Text('Live-acquired prices from India\u2019s biggest stores. No guesswork, just the lowest.',
                      style: tx(context, 10.5, color: muted(context), h: 1.25)),
                ]),
              ),
              if (heroArts.isNotEmpty)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    for (final a in heroArts)
                      Container(
                        margin: const EdgeInsets.only(left: 6),
                        width: 46,
                        height: 46,
                        padding: const EdgeInsets.all(3),
                        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10), border: Border.all(color: T1SColors.slate200)),
                        child: NetImage(a.image, fit: BoxFit.contain, width: 46, height: 46),
                      ),
                  ],
                ),
            ]),
          ),
        ),
        const SizedBox(height: 12),

        // CATEGORY PILLS (reference: Deal Drop pills) — real searches.
        SizedBox(
          height: 32,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: _pillQueries.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (c, i) => OutlinedButton(
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                side: BorderSide(color: border(context)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
              ),
              onPressed: () => _launchQuery(_pillQueries[i]),
              child: Text(_pillQueries[i], style: tx(context, 10.5, w: FontWeight.w700)),
            ),
          ),
        ),
        const SizedBox(height: 18),

        for (final sec in homeSections.indexed) ...[
          _SectionHeader(sec: sec.$2),
          const SizedBox(height: 10),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 12),
            gridDelegate: kShowcaseGridDelegate,
            itemCount: sec.$2.items.length,
            itemBuilder: (c, i) => _isCouponItem(sec.$2.items[i])
                ? CouponCard(item: sec.$2.items[i], state: widget.state)
                : _ShowcaseCard(item: sec.$2.items[i], state: widget.state),
          ),
          const SizedBox(height: 20),
          // Owner 23 Oct: admin-managed wide banner strip between EVERY section
          // (parity with web HomeBannerStrip).
          HomeBannerStrip(
            api: widget.state.api,
            slot: sec.$1 + 1,
            onOpenVertical: (v) => widget.state.openVertical(v),
          ),
          const SizedBox(height: 20),
        ],
      ],
    );
  }
}

/// Owner 22 Oct (reference screenshot): Special Offers items are ALL merchant
/// logos — they must never go through the product-image pipeline. Same
/// detector as the web CouponCard: a "Code: ..." badge means coupon card.
bool _isCouponItem(ShowcaseItem item) =>
    (item.badge ?? '').startsWith('Code: ');

/// Owner 23 Oct: public so RewardsScreen renders the relocated Special Offers
/// section with the identical card (logo tile + code pill).
class CouponCard extends StatelessWidget {
  const CouponCard({super.key, required this.item, required this.state});
  final ShowcaseItem item;
  final AppState state;

  @override
  Widget build(BuildContext context) {
    final dark = isDark(context);
    final code = (item.badge ?? '').startsWith('Code: ')
        ? (item.badge ?? '').substring(6)
        : (item.badge ?? '');
    final fallback = 'https://ui-avatars.com/api/?name=${Uri.encodeComponent(item.merchant)}&background=1e293b&color=ffffff&size=160';
    return GestureDetector(
      onTap: () {
        if (item.url.isEmpty) return;
        openDeal(item.url, sellerName: item.merchant);
      },
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: dark ? T1SColors.slate900 : Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: border(context)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Logo tile: fixed height, centered contain — a logo is never cropped.
          SizedBox(
            height: 84,
            width: double.infinity,
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: NetImage(
                item.image ?? item.merchantLogo ?? fallback,
                fit: BoxFit.contain,
                cacheWidthPx: 240,
              ),
            ),
          ),
          Divider(height: 1, color: dark ? T1SColors.slate800 : T1SColors.slate100),
          Expanded(
            child: Padding(
            padding: const EdgeInsets.fromLTRB(8, 6, 8, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.merchant.toUpperCase(),
                    maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: tx(context, 9, w: FontWeight.w900)),
                const SizedBox(height: 2),
                Text(item.title,
                    maxLines: 2, overflow: TextOverflow.ellipsis,
                    style: tx(context, 9, h: 1.25, color: muted(context))),
                const Expanded(child: SizedBox(height: 4)),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: T1SColors.red50.withValues(alpha: .6),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: T1SColors.red.withValues(alpha: .2)),
                  ),
                  child: Text(
                    code.isEmpty ? '' : 'CODE: $code',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: tx(context, 8, w: FontWeight.w900, color: T1SColors.red),
                  ),
                ),
              ],
            ),
          ),
          ),
        ]),
      ),
    );
  }
}

/// Owner 22 Oct (app home redesign): 3 cards per row, tight 8px gutters, snug
/// fixed-height cells — image 86 + text block; price is bottom-pinned inside the
/// card so there is no dead space under it. Exported for the layout test.
const kShowcaseGridDelegate = SliverGridDelegateWithFixedCrossAxisCount(
  crossAxisCount: 3, mainAxisSpacing: 8, crossAxisSpacing: 8, mainAxisExtent: 162,
);

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.sec});
  final ShowcaseSection sec;

  static const _icons = <String, IconData>{
    'picked': Icons.auto_awesome_rounded,
    'special': Icons.confirmation_number_rounded,
    'goBig': Icons.local_fire_department_rounded,
    'tech': Icons.memory_rounded,
    'steals': Icons.bolt_rounded,
    'places': Icons.location_on_rounded,
    'cards': Icons.credit_card_rounded,
    'destinations': Icons.flight_takeoff_rounded,
  };

  /// Website parity: section "View all" opens the section's real engine.
  static const _vertical = <String, String>{
    'places': 'hotels',
    'cards': 'creditcards',
    'destinations': 'flights',
  };

  @override
  Widget build(BuildContext context) {
    final v = _vertical[sec.id] ?? 'ecommerce';
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(children: [
        Container(
          width: 30,
          height: 30,
          decoration: BoxDecoration(
            color: T1SColors.red50,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: T1SColors.red.withOpacity(.18)),
          ),
          child: Icon(_icons[sec.id] ?? Icons.auto_awesome_rounded, size: 16, color: T1SColors.red),
        ),
        const SizedBox(width: 9),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(sec.title.toUpperCase(), maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 12, w: FontWeight.w900, ls: .5)),
            const SizedBox(height: 1),
            Text(sec.subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 10.5, color: muted(context))),
          ]),
        ),
        GestureDetector(
          onTap: () => AppState.instance.openVertical(v),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Text('View all', style: tx(context, 10.5, w: FontWeight.w900, color: T1SColors.red)),
            Icon(Icons.chevron_right_rounded, size: 16, color: T1SColors.red),
          ]),
        ),
      ]),
    );
  }
}

/// Circular discount ring (reference card element) — real discount percent.
class _DiscountRing extends StatelessWidget {
  const _DiscountRing({required this.pct});
  final int pct;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 26,
      height: 26,
      child: CustomPaint(
        painter: _RingPainter(pct: pct),
        child: Center(
          child: Text('$pct', style: const TextStyle(fontSize: 7.5, fontWeight: FontWeight.w900, color: T1SColors.red)),
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.pct});
  final int pct;

  @override
  void paint(Canvas canvas, Size size) {
    final r = size.width / 2 - 2;
    final c = Offset(size.width / 2, size.height / 2);
    canvas.drawCircle(c, r, Paint()..color = Colors.white);
    canvas.drawArc(Rect.fromCircle(center: c, radius: r), -1.5708, 6.283 * (pct / 100), false,
        Paint()..style = PaintingStyle.stroke..strokeWidth = 3..strokeCap = StrokeCap.round..color = T1SColors.red);
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.pct != pct;
}

class _ShowcaseCard extends StatelessWidget {
  const _ShowcaseCard({required this.item, required this.state});
  final ShowcaseItem item;
  final AppState state;

  String _rupee(double v) {
    final whole = v == v.roundToDouble();
    final n = whole ? v.round() : v;
    final s = whole ? '$n' : n.toStringAsFixed(2);
    if (n < 1000) return s;
    // Indian grouping: 1,23,456
    final t = '$n'.split('.');
    final g = t[0].replaceAll(RegExp(r'\B(?=(\d{2})+(?!\d))'), ',');
    return t.length > 1 ? '$g.${t[1]}' : g;
  }

  /// Red-brand hatke badges (reference idea, honest math).
  String? get _stealBadge {
    final p = item.discountPct;
    if (p == null) return null;
    if (p >= 60) return '\u{1F680} EPIC STEAL';
    if (p >= 30) return '\u{1F525} HOT DEAL';
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final price = item.price;
    final mrp = item.mrp;
    final dark = isDark(context);
    return GestureDetector(
      onTap: () {
        // Top Destinations (owner 22 Oct): launch the REAL flights engine for the city —
        // never a fake external link.
        if (item.launch != null) {
          state.openVertical(item.launch!.vertical.isEmpty ? 'flights' : item.launch!.vertical,
              search: PendingSearch(item.launch!.vertical.isEmpty ? 'flights' : item.launch!.vertical, item.launch!.query));
          return;
        }
        if (item.url.isEmpty) return;
        openDeal(item.url, sellerName: item.merchant, price: price);
      },
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: dark ? T1SColors.slate900 : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: border(context)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(
            height: 86,
            width: double.infinity,
            // Owner 23 Oct: StackFit.expand — art fills the tile edge-to-edge on
            // EVERY card (square/p portrait art like credit cards used to render
            // as a small centered thumbnail with white space around it).
            child: Stack(fit: StackFit.expand, children: [
              // Owner 22 Oct: real product/hotel photos fill the tile edge-to-edge
              // (BoxFit.cover at a high decode budget = sharp); merchant-logo
              // fallback keeps contain so logos never crop.
              NetImage(
                item.image ?? item.merchantLogo,
                fit: (item.image ?? '').isNotEmpty ? BoxFit.cover : BoxFit.contain,
                bg: dark ? T1SColors.slate800 : T1SColors.slate50,
                cacheWidthPx: 480,
              ),
              if (item.discountPct != null)
                Positioned(top: 6, right: 6, child: _DiscountRing(pct: item.discountPct!)),
              // seller chip (reference: marketplace logo corner badge)
              Positioned(
                bottom: 5,
                left: 5,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                  decoration: BoxDecoration(
                    color: dark ? Colors.black87 : Colors.white,
                    borderRadius: BorderRadius.circular(7),
                    border: Border.all(color: border(context)),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    if ((item.merchantLogo ?? '').isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(right: 3),
                        child: NetImage(item.merchantLogo, fit: BoxFit.contain, width: 10, height: 10),
                      ),
                    Text(item.merchant.toUpperCase(),
                        maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: tx(context, 7.5, w: FontWeight.w900, color: muted(context))),
                  ]),
                ),
              ),
              // star rating (real source rating only)
              if (item.rating != null)
                Positioned(
                  bottom: 5,
                  right: 5,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                    decoration: BoxDecoration(
                      color: dark ? Colors.black87 : Colors.white,
                      borderRadius: BorderRadius.circular(7),
                      border: Border.all(color: border(context)),
                    ),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      const Icon(Icons.star_rounded, size: 9, color: T1SColors.emerald500),
                      const SizedBox(width: 1),
                      Text(item.rating!.toStringAsFixed(1),
                          style: tx(context, 7.5, w: FontWeight.w900, color: T1SColors.emerald700)),
                    ]),
                  ),
                ),
            ]),
          ),
          // Owner 22 Oct: title at top, price pinned to the card bottom — zero
          // dead space under the price; height differences are absorbed BETWEEN
          // title and price instead of as faaltu bottom padding.
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(6, 5, 6, 6),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Site parity (web HomeShowcase owner-22-Oct hierarchy):
                  // product name in a REGULAR weight and slate gray — the
                  // price is the bold hero of the card, not the title.
                  Text(item.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: tx(context, 9.5, w: FontWeight.w500, h: 1.25,
                          color: dark ? T1SColors.slate300 : T1SColors.slate600)),
                  if (price != null)
                    Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                      Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
                        Flexible(child: Text('\u20B9${_rupee(price)}', maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 12.5, w: FontWeight.w900, color: ink(context)))),
                        if (mrp != null) ...[
                          const SizedBox(width: 3),
                          Flexible(child: Text('\u20B9${_rupee(mrp)}', maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 8, color: T1SColors.slate400).copyWith(decoration: TextDecoration.lineThrough))),
                        ],
                        if (item.discountPct != null) ...[
                          const SizedBox(width: 3),
                          Flexible(
                            child: Text('${item.discountPct}% Off',
                                maxLines: 1, overflow: TextOverflow.ellipsis,
                                style: tx(context, 8.5, w: FontWeight.w900, color: T1SColors.emerald600)),
                          ),
                        ],
                      ]),
                    ])
                  else if (item.badge != null)
                    Text(item.badge!, maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 9.5, w: FontWeight.w900, color: T1SColors.red)),
                  if (_stealBadge != null)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                      decoration: BoxDecoration(
                        color: T1SColors.emerald50,
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: T1SColors.emerald200.withOpacity(.8)),
                      ),
                      child: Text(_stealBadge!, maxLines: 1, style: tx(context, 7, w: FontWeight.w900, color: T1SColors.emerald700)),
                    ),
                ],
              ),
            ),
          ),
        ]),
      ),
    );
  }
}
