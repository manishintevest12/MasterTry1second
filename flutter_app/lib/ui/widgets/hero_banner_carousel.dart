import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../core/api.dart';
import '../../core/session_cache.dart';
import '../../core/theme.dart';
import 'kit.dart';

/// Hero banner carousel (owner 23 Oct, BookMyShow reference): the big dark
/// hero at the top of the home tab. MIXED content — one movie slide, one food
/// slide, one ecom-deal slide from /api/home/hero-banners (live data, never
/// mock). PageView with auto-advance (5s), swipe, pagination dots, poster
/// left + text right, fully responsive: on narrow phones the poster shrinks
/// and the synopsis hides so the slide stays clearly visible.
class HeroBannerCarousel extends StatefulWidget {
  const HeroBannerCarousel({
    super.key,
    required this.api,
    required this.onLaunch,
  });
  final Try1SecondApi api;
  final void Function(String vertical, String query) onLaunch;

  @override
  State<HeroBannerCarousel> createState() => _HeroBannerCarouselState();
}

class _HeroBannerCarouselState extends State<HeroBannerCarousel> {
  List<HeroSlide>? _slides;
  final PageController _page = PageController(viewportFraction: 1);
  int _idx = 0;
  Timer? _auto;

  @override
  void initState() {
    super.initState();
    if (SessionCache.has('home.hero')) {
      _slides = SessionCache.get('home.hero', const <HeroSlide>[]);
      _startAuto();
      return;
    }
    widget.api.heroBanners().then((s) {
      SessionCache.put('home.hero', s);
      if (mounted) setState(() => _slides = s);
      _startAuto();
    }).catchError((_) {
      if (mounted) setState(() => _slides = const []);
    });
  }

  void _startAuto() {
    _auto?.cancel();
    if ((_slides ?? const []).length < 2) return;
    _auto = Timer.periodic(const Duration(seconds: 5), (_) {
      if (!mounted || !_page.hasClients) return;
      final n = (_slides ?? const []).length;
      _page.animateToPage(
        (_idx + 1) % n,
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeOutCubic,
      );
    });
  }

  @override
  void dispose() {
    _auto?.cancel();
    _page.dispose();
    super.dispose();
  }

  void _activate(HeroSlide s) {
    final url = s.url;
    if (url != null && url.startsWith('http')) {
      openDeal(url, sellerName: s.heading);
    } else if (s.launchVertical != null) {
      widget.onLaunch(s.launchVertical!, s.launchQuery ?? '');
    }
  }

  @override
  Widget build(BuildContext context) {
    final slides = _slides;
    if (slides == null || slides.isEmpty) return const SizedBox.shrink();
    final wide = MediaQuery.of(context).size.width >= 640;
    final posterW = wide ? 176.0 : 104.0;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          height: wide ? 260.0 : 216.0,
          child: PageView.builder(
            controller: _page,
            itemCount: slides.length,
            onPageChanged: (i) => setState(() => _idx = i),
            itemBuilder: (context, i) {
              final s = slides[i];
              return _HeroSlideView(
                slide: s,
                posterW: posterW,
                wide: wide,
                onActivate: () => _activate(s),
                onLibrary: () => widget.onLaunch('movies', ''),
              );
            },
          ),
        ),
        // pagination dots
        SizedBox(
          height: 26,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (var d = 0; d < slides.length; d++)
                Container(
                  key: ValueKey('hero-dot-$d'),
                  width: 8,
                  height: 8,
                  margin: const EdgeInsets.symmetric(horizontal: 4),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: d == _idx ? Colors.white : Colors.white.withValues(alpha: 0.28),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _HeroSlideView extends StatelessWidget {
  const _HeroSlideView({
    required this.slide,
    required this.posterW,
    required this.wide,
    required this.onActivate,
    required this.onLibrary,
  });
  final HeroSlide slide;
  final double posterW;
  final bool wide;
  final VoidCallback onActivate;
  final VoidCallback onLibrary;

  @override
  Widget build(BuildContext context) {
    final poster = slide.poster ?? slide.backdrop;
    return GestureDetector(
      onTap: onActivate,
      child: Container(
        color: const Color(0xFF0A0B1E),
        child: Stack(
          fit: StackFit.expand,
          children: [
            // blurred backdrop
            if (slide.backdrop != null)
              Opacity(
                opacity: 0.28,
                child: ImageFiltered(
                  imageFilter: ui.ImageFilter.blur(sigmaX: 6, sigmaY: 6),
                  child: NetImage(slide.backdrop, width: double.infinity, height: double.infinity, fit: BoxFit.cover),
                ),
              ),
            Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                  colors: [Color(0xF0000000), Color(0x99000000), Color(0xF0000000)],
                ),
              ),
            ),
            // top-right Video Library chip (reference)
            Positioned(
              top: 10,
              right: 12,
              child: GestureDetector(
                onTap: onLibrary,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xF21A1A1A),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.white24, width: 0.5),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.video_library_outlined, size: 14, color: Colors.white),
                      const SizedBox(width: 5),
                      Text('Video Library', style: tx(context, wide ? 12 : 10, w: FontWeight.w700, color: Colors.white)),
                      const Icon(Icons.chevron_right, size: 12, color: Colors.white),
                    ],
                  ),
                ),
              ),
            ),
            // content row
            Padding(
              padding: EdgeInsets.fromLTRB(14, wide ? 26 : 22, 14, 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // poster (left) — shrinks but never disappears
                  GestureDetector(
                    onTap: onActivate,
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: SizedBox(
                        width: posterW,
                        height: double.infinity,
                        child: poster != null
                            ? NetImage(poster, width: posterW, height: double.infinity, fit: BoxFit.cover)
                            : const ColoredBox(color: Color(0xFF14162B)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  // text (right)
                  Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(color: const Color(0xFF1E2235), borderRadius: BorderRadius.circular(6)),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.play_arrow, size: 12, color: Color(0xFFEF4444)),
                              const SizedBox(width: 4),
                              Text(
                                slide.badge,
                                style: tx(context, wide ? 11 : 9.5, w: FontWeight.w900, color: Colors.white, ls: 0.6),
                              ),
                            ],
                          ),
                        ),
                        if ((slide.subheading ?? '').isNotEmpty) ...[
                          const SizedBox(height: 7),
                          Text(
                            slide.subheading!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: tx(context, wide ? 13 : 10.5, w: FontWeight.w600, color: T1SColors.slate300),
                          ),
                        ],
                        const SizedBox(height: 3),
                        Text(
                          slide.heading,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: tx(context, wide ? 26 : 17, w: FontWeight.w900, color: Colors.white, h: 1.1),
                        ),
                        if ((slide.meta ?? '').isNotEmpty) ...[
                          const SizedBox(height: 5),
                          Text(
                            slide.meta!,
                            maxLines: wide ? 2 : 1,
                            overflow: TextOverflow.ellipsis,
                            style: tx(context, wide ? 13 : 10.5, w: FontWeight.w500, color: Colors.white70),
                          ),
                        ],
                        if (wide && (slide.synopsis ?? '').isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Text(
                            slide.synopsis!,
                            maxLines: 3,
                            overflow: TextOverflow.ellipsis,
                            style: tx(context, 12, w: FontWeight.w400, color: T1SColors.slate300, h: 1.4),
                          ),
                        ],
                        const SizedBox(height: 10),
                        ElevatedButton.icon(
                          onPressed: onActivate,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: T1SColors.red,
                            foregroundColor: Colors.white,
                            padding: EdgeInsets.symmetric(horizontal: wide ? 22 : 14, vertical: wide ? 12 : 8),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(9)),
                            elevation: 0,
                          ),
                          icon: Icon(Icons.arrow_forward, size: wide ? 16 : 13),
                          label: Text(slide.cta, style: tx(context, wide ? 14 : 11, w: FontWeight.w800)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
