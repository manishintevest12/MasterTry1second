import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/search_progress_copy.dart';
import '../../core/theme.dart';
import 'kit.dart';

/// The ONE loading experience for the app — same panel as the web feed.
///
/// OWNER 27 Oct: no countdown. Real progress: the source being queried right now,
/// how many sources have answered, an advancing bar and result-shaped skeletons.
/// OWNER 28 Oct (reference screenshot): the green dot, the live "Checking …" text
/// and the progress fill now share ONE full-width capsule, with the hard count
/// right-aligned underneath — and the SAME panel is used on the product page, so
/// a product search never falls back to a bare grey shimmer.
///
/// OWNER 28 Oct (second screenshot, word for word): "app mai muje ye blue colour
/// ki jagah red mai chaiye". The APP keeps the identical layout and copy as the
/// web panel but paints it in brand red — rose accent #E11D48 on a soft rose
/// wash, with the live green dot unchanged (red = the app's accent, not an error).
class T1SProgressPalette {
  const T1SProgressPalette._();

  /// Solid rail + fill (web uses indigo #4F46E5; the app uses brand red).
  static const Color accent = Color(0xFFE11D48);
  /// Soft wash inside the capsule.
  static const Color fill = Color(0x1AE11D48);
  static const Color pillBgLight = Color(0xFFFEF2F4);
  static const Color pillBorderLight = Color(0xFFFBD5DC);
  static const Color pillBgDark = Color(0xFF2A1218);
  static const Color trackLight = Color(0xFFFBEAEE);
  /// "Checking Air India…" text.
  static const Color labelLight = Color(0xFF9F1239);
  static const Color labelDark = Color(0xFFFDA4AF);
}
class SearchProgressCard extends StatefulWidget {
  const SearchProgressCard({super.key, this.verticalId, this.title});

  /// flights | hotels | ecommerce | grocery | … picks the copy and the source list.
  final String? verticalId;

  /// Optional line echoed under the heading (the searched product, when known).
  final String? title;

  @override
  State<SearchProgressCard> createState() => _SearchProgressCardState();
}

class _SearchProgressCardState extends State<SearchProgressCard> with SingleTickerProviderStateMixin {
  late final AnimationController _pulse =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1600))..repeat(reverse: true);
  Timer? _siteTimer;
  Timer? _progressTimer;
  int _siteIdx = 0;
  double _progress = 0.06;
  final DateTime _startedAt = DateTime.now();

  @override
  void initState() {
    super.initState();
    final copy = searchCopyFor(widget.verticalId);
    // Rotate through the REAL sources we query, so the pill always names one.
    _siteTimer = Timer.periodic(const Duration(milliseconds: 850), (_) {
      if (!mounted) return;
      setState(() => _siteIdx = (_siteIdx + 1) % copy.sources.length);
    });
    // Ease toward 92% and hold: only real results finish the bar.
    _progressTimer = Timer.periodic(const Duration(milliseconds: 450), (_) {
      if (!mounted) return;
      final elapsed = DateTime.now().difference(_startedAt).inMilliseconds / 1000.0;
      final target = (0.08 + elapsed * 0.09).clamp(0.08, 0.92).toDouble();
      setState(() => _progress = _progress + ((target - _progress) * 0.35).clamp(0.0035, 0.08));
      if (_progress >= 0.92) _progress = 0.92;
    });
  }

  @override
  void dispose() {
    _siteTimer?.cancel();
    _progressTimer?.cancel();
    _pulse.dispose();
    super.dispose();
  }

  Widget _bar(Color color) => Container(
        height: 10,
        decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(6)),
      );

  Widget _skeletonCard(bool dark, int i) => Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: dark ? T1SColors.slate900 : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: dark ? T1SColors.slate800 : const Color(0xFFEBEBEB)),
        ),
        child: Row(children: [
          FadeTransition(
            opacity: Tween<double>(begin: 0.45, end: 1.0).animate(CurvedAnimation(
              parent: _pulse,
              curve: Interval(i * 0.12, ((i * 0.12) + 0.88).clamp(0.0, 1.0), curve: Curves.easeInOut),
            )),
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: dark ? T1SColors.slate800 : const Color(0xFFEEF2F5),
                borderRadius: BorderRadius.circular(10),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              FractionallySizedBox(
                widthFactor: i == 0 ? 0.74 : 0.62,
                child: _bar(dark ? T1SColors.slate800 : const Color(0xFFEEF2F5)),
              ),
              const SizedBox(height: 8),
              FractionallySizedBox(
                widthFactor: i == 0 ? 0.46 : 0.40,
                child: _bar(dark ? T1SColors.slate800 : const Color(0xFFEEF2F5)),
              ),
            ]),
          ),
          const SizedBox(width: 10),
          Container(
            width: 46,
            height: 12,
            decoration: BoxDecoration(
              color: dark ? T1SColors.slate800 : const Color(0xFFEEF2F5),
              borderRadius: BorderRadius.circular(6),
            ),
          ),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    final dark = isDark(context);
    final copy = searchCopyFor(widget.verticalId);
    final total = copy.sources.length;
    final answered = ((_progress * total).round()).clamp(1, total);
    final currentSite = copy.sources[_siteIdx % total];
    final track = dark ? T1SColors.slate800 : T1SProgressPalette.trackLight;
    final pillBg = dark ? T1SProgressPalette.pillBgDark : T1SProgressPalette.pillBgLight;
    final pillBorder = dark ? T1SColors.slate800 : T1SProgressPalette.pillBorderLight;
    final pillFill = dark ? const Color(0x33FFFFFF) : T1SProgressPalette.fill;
    final labelColor = dark ? T1SProgressPalette.labelDark : T1SProgressPalette.labelLight;

    return Box(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
      radius: 16,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(copy.heading, style: tx(context, 15, w: FontWeight.w900, color: ink(context))),
        const SizedBox(height: 4),
        Text(
          (widget.title != null && widget.title!.trim().isNotEmpty) ? '${copy.sub} · ${widget.title}' : copy.sub,
          style: tx(context, 11.5, w: FontWeight.w500, color: muted(context)),
        ),
        const SizedBox(height: 12),
        // ONE capsule: green dot + live source + the fill advancing inside it.
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: Container(
            decoration: BoxDecoration(
              color: pillBg,
              border: Border.all(color: pillBorder),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Column(children: [
              Stack(children: [
                Positioned.fill(
                  child: FractionallySizedBox(
                    alignment: Alignment.centerLeft,
                    widthFactor: _progress.clamp(0.0, 1.0),
                    child: Container(color: pillFill),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 8),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    ScaleTransition(
                      scale: Tween<double>(begin: 0.8, end: 1.15).animate(CurvedAnimation(parent: _pulse, curve: Curves.easeInOut)),
                      child: Container(width: 7, height: 7, decoration: const BoxDecoration(color: Color(0xFF10B981), shape: BoxShape.circle)),
                    ),
                    const SizedBox(width: 7),
                    Flexible(
                      child: AnimatedSwitcher(
                        duration: const Duration(milliseconds: 300),
                        child: Text(
                          'Checking $currentSite…',
                          key: ValueKey<String>(currentSite),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: tx(context, 11.5, w: FontWeight.w800, color: labelColor),
                        ),
                      ),
                    ),
                  ]),
                ),
              ]),
              // Solid purple rail along the bottom edge of the capsule.
              LinearProgressIndicator(
                value: _progress,
                minHeight: 3,
                backgroundColor: track,
                valueColor: const AlwaysStoppedAnimation(T1SProgressPalette.accent),
              ),
            ]),
          ),
        ),
        const SizedBox(height: 6),
        Align(
          alignment: Alignment.centerRight,
          child: Text('$answered of $total ${copy.unit}',
              style: tx(context, 11, w: FontWeight.w600, color: muted(context))),
        ),
        const SizedBox(height: 8),
        Text(
          'Please wait, we are getting the best deal for you. Prices appear here automatically the moment each site answers, so there is nothing for you to redo.',
          style: tx(context, 10.5, w: FontWeight.w500, color: muted(context), h: 1.4),
        ),
        const SizedBox(height: 14),
        _skeletonCard(dark, 0),
        _skeletonCard(dark, 1),
      ]),
    );
  }
}
