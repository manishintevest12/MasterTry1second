import 'package:flutter/material.dart';

import '../../core/api.dart';
import '../../core/session_cache.dart';
import '../../core/theme.dart';
import 'kit.dart';

/// Home banner strip (owner 23 Oct): admin-managed WIDE landscape banners
/// rendered BETWEEN every home section (parity with the web HomeBannerStrip).
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

  @override
  void initState() {
    super.initState();
    if (SessionCache.has('home.banners')) {
      _banners = SessionCache.get('home.banners', const <HomeBanner>[]);
      return;
    }
    widget.api.homeBanners().then((b) {
      SessionCache.put('home.banners', b);
      if (mounted) setState(() => _banners = b);
    }).catchError((_) {
      if (mounted) setState(() => _banners = const []);
    });
  }

  @override
  Widget build(BuildContext context) {
    final banners = _banners;
    if (banners == null || banners.isEmpty) return const SizedBox.shrink();
    final b = banners[widget.slot % banners.length];
    if (b.imageUrl.isEmpty) return const SizedBox.shrink();

    final isExternal = b.link.startsWith('http');
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
      child: GestureDetector(
        onTap: () {
          if (isExternal) {
            openDeal(b.link, sellerName: (b.title ?? 'Try1Second').trim());
          } else {
            widget.onOpenVertical(b.link);
          }
        },
        child: ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: Stack(children: [
            // Wide landscape: length zyada, breadth kam — full-width short strip.
            NetImage(b.imageUrl, width: double.infinity, height: 96, fit: BoxFit.cover),
            if ((b.title ?? '').isNotEmpty)
              Positioned(
                left: 10,
                bottom: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(999)),
                  child: Text(
                    b.title!,
                    style: tx(context, 10, w: FontWeight.w900, color: T1SColors.slate900),
                  ),
                ),
              ),
          ]),
        ),
      ),
    );
  }
}
