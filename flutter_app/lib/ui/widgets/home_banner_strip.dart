import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api.dart';
import '../../core/session_cache.dart';
import '../../core/theme.dart';
import 'kit.dart';

/// Home banner strip (owner 23 Oct, image-1 reference): dark cinematic banner
/// rendered BETWEEN every home section (parity with the web HomeBannerStrip).
/// Layout: rounded image left, kind badge pill, headline, sub, red CTA,
/// pagination dots + auto-cycle every 5s. No "Video Library" chip (removed).
/// Loads once per app session via SessionCache, mirrors /api/home-banners.
/// Tap: a vertical id ('movies', 'flights', ...) opens that vertical inside
/// the app; an https URL opens in the in-app browser via the global openDeal.
class HomeBannerStrip extends StatefulWidget {
  const HomeBannerStrip({super.key, required this.api, required this.onOpenVertical, this.slot = 0});
  final Try1SecondApi api;
  final void Function(String vertical) onOpenVertical;
  final int slot;

  @override
  State<HomeBannerStrip> createState() => _HomeBannerStripState();
}

class _HomeBannerStripState extends State<HomeBannerStrip> {
  List<HomeBanner>? _banners;
  int _idx = 0;
  Timer? _timer;

  static const _badges = {'movies': 'MOVIE PICK', 'food': 'FOOD PICK', 'ecommerce': 'MEGA DEAL'};
  static const _ctas = {'movies': 'Book Now', 'food': 'Order Now', 'ecommerce': 'Grab Deal'};

  @override
  void initState() {
    super.initState();
    _idx = widget.slot;
    if (SessionCache.has('home.banners')) {
      _banners = SessionCache.get('home.banners', const <HomeBanner>[]);
      _startCycle();
      return;
    }
    widget.api.homeBanners().then((b) {
      SessionCache.put('home.banners', b);
      if (mounted) {
        setState(() => _banners = b);
        _startCycle();
      }
    }).catchError((_) {
      if (mounted) setState(() => _banners = const []);
    });
  }

  void _startCycle() {
    _timer?.cancel();
    if ((_banners?.length ?? 0) < 2) return;
    _timer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (mounted) setState(() => _idx = _idx + 1);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final banners = _banners;
    if (banners == null || banners.isEmpty) return const SizedBox.shrink();
    final n = banners.length;
    final i = ((_idx % n) + n) % n;
    final b = banners[i];
    if (b.imageUrl.isEmpty) return const SizedBox.shrink();

    final isExternal = b.link.startsWith('http');
    final badge = _badges[b.link] ?? 'TOP PICK';
    final cta = _ctas[b.link] ?? 'Order Now';
    final wide = MediaQuery.of(context).size.width >= 480;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF0D0D0D),
          borderRadius: BorderRadius.circular(16),
          boxShadow: const [BoxShadow(color: Color(0x14000000), blurRadius: 6, offset: Offset(0, 2))],
        ),
        child: Stack(
          children: [
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () {
                if (isExternal) {
                  openDeal(b.link, sellerName: (b.title ?? 'Try1Second').trim());
                } else {
                  widget.onOpenVertical(b.link);
                }
              },
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // left: rounded image
                    ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: NetImage(
                        b.imageUrl,
                        width: wide ? 150 : 96,
                        height: wide ? 100 : 72,
                        fit: BoxFit.cover,
                      ),
                    ),
                    const SizedBox(width: 12),
                    // middle: badge + headline + sub
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(color: const Color(0xFF1A1A2E), borderRadius: BorderRadius.circular(999)),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.play_arrow_rounded, size: 10, color: T1SColors.red),
                                const SizedBox(width: 3),
                                Text(badge, style: tx(context, wide ? 10 : 9, w: FontWeight.w900, ls: .8, color: Colors.white)),
                              ],
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            (b.title ?? 'Featured pick').trim(),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: tx(context, wide ? 17 : 13, w: FontWeight.w900, color: Colors.white, h: 1.15),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            (b.subtitle ?? 'Live offer').trim(),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: tx(context, wide ? 12 : 10.5, color: const Color(0xFFA0A0A0)),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 10),
                    // right: red CTA
                    Container(
                      padding: EdgeInsets.symmetric(horizontal: wide ? 18 : 12, vertical: wide ? 10 : 8),
                      decoration: BoxDecoration(color: T1SColors.red, borderRadius: BorderRadius.circular(12)),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(cta, style: tx(context, wide ? 13 : 11, w: FontWeight.w900, color: Colors.white)),
                          const SizedBox(width: 4),
                          const Icon(Icons.chevron_right_rounded, size: 15, color: Colors.white),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            // pagination dots (bottom-center) + next arrow when multiple slides
            if (n > 1) ...[
              Positioned(
                bottom: 5,
                left: 0,
                right: 0,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    for (var d = 0; d < n; d++)
                      GestureDetector(
                        onTap: () {
                          _timer?.cancel();
                          if (mounted) setState(() => _idx = d);
                          _startCycle();
                        },
                        child: Container(
                          key: ValueKey('strip-dot-$d'),
                          width: 7,
                          height: 7,
                          margin: const EdgeInsets.symmetric(horizontal: 3),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: d == i ? Colors.white : Colors.white.withValues(alpha: 0.30),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              Positioned(
                top: 12,
                bottom: 12,
                right: 6,
                child: Center(
                  child: GestureDetector(
                    onTap: () {
                      _timer?.cancel();
                      if (mounted) setState(() => _idx = _idx + 1);
                      _startCycle();
                    },
                    child: Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.10),
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white24, width: 0.5),
                      ),
                      child: const Icon(Icons.chevron_right_rounded, size: 16, color: Colors.white),
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
