import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Official Try1Second logo (PNG layers) with the same dynamic behaviour as the website:
/// one 3.6s cycle = a bright arc sweeps around the dial, the tile "ticks" (press + gold ring
/// pulse), the corner sparkle twinkles; the wordmark slides in once.
/// Respects the OS "reduce motion" setting.
class T1SLogo extends StatefulWidget {
  const T1SLogo({super.key, this.size = 40, this.showWordmark = true, this.animate = true, this.tagline = false});

  /// Height of the stopwatch icon in logical pixels.
  final double size;
  final bool showWordmark;
  final bool animate;

  /// Show "1 SECOND IS ALL IT TAKES" under the wordmark.
  final bool tagline;

  @override
  State<T1SLogo> createState() => _T1SLogoState();
}

class _T1SLogoState extends State<T1SLogo> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 3600),
  );
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final reduce = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    if (widget.animate && !reduce) {
      if (!_started) {
        _started = true;
        _c.repeat();
      }
    } else {
      _c.stop();
      _started = false;
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  /// Press-and-rebound between 62% and 90% of the cycle (matches the web keyframes). 0 -> 1 -> 0.
  static double tick(double t) {
    if (t < .62 || t > .90) return 0;
    final p = (t - .62) / .28;
    return p < .4 ? p / .4 : 1 - (p - .4) / .6;
  }

  /// Sweep progress 0..1 while the arc runs (0..58% of the cycle), else null.
  static double? sweep(double t) => t <= .58 ? t / .58 : null;

  /// Sparkle strength 0..1: twinkles at ~18% and ~82%.
  static double twinkle(double t) {
    double bump(double c, double w) => (1 - ((t - c).abs() / w)).clamp(0.0, 1.0);
    return math.max(bump(.18, .08), bump(.82, .07));
  }

  @override
  Widget build(BuildContext context) {
    final h = widget.size;
    return Semantics(
      label: 'Try1Second - 1 Second Is All It Takes',
      child: AnimatedBuilder(
        animation: _c,
        builder: (context, _) {
          final t = _c.value;
          final k = tick(t);
          final ringP = t < .66 ? 0.0 : ((t - .66) / .34).clamp(0.0, 1.0);
          final icon = SizedBox(
            height: h,
            width: h * 259 / 254,
            child: Stack(
              alignment: Alignment.center,
              clipBehavior: Clip.none,
              children: [
                if (ringP > 0)
                  Opacity(
                    opacity: (1 - ringP) * .8,
                    child: Transform.scale(
                      scale: .7 + ringP * .85,
                      child: Container(
                        width: h * .72,
                        height: h * .72,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: const Color(0xFFFBBF24).withValues(alpha: .75), width: 2),
                        ),
                      ),
                    ),
                  ),
                Transform.translate(
                  offset: Offset(0, 2 * k),
                  child: Transform.rotate(
                    angle: -0.05 * k,
                    child: Transform.scale(
                      scale: 1 - .06 * k,
                      child: Image.asset('assets/images/logo-icon.png', height: h, filterQuality: FilterQuality.high),
                    ),
                  ),
                ),
                Positioned.fill(
                  child: CustomPaint(painter: _SweepAndSparkPainter(sweep(t), twinkle(t))),
                ),
              ],
            ),
          );
          if (!widget.showWordmark) return icon;
          final wordH = h * .54;
          return Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              icon,
              SizedBox(width: h * .08),
              TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: 1),
                duration: const Duration(milliseconds: 750),
                curve: Curves.easeOutCubic,
                builder: (context, v, child) => Opacity(
                  opacity: v,
                  child: Transform.translate(offset: Offset(-10 * (1 - v), 0), child: child),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Image.asset('assets/images/logo-wordmark.png', height: wordH, filterQuality: FilterQuality.high),
                    if (widget.tagline) ...[
                      SizedBox(height: h * .06),
                      Image.asset('assets/images/logo-tagline.png', height: h * .1, filterQuality: FilterQuality.high),
                    ],
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// Draws the bright arc that runs around the gold ring plus the twinkling corner star.
class _SweepAndSparkPainter extends CustomPainter {
  _SweepAndSparkPainter(this.sweep, this.twinkle);
  final double? sweep;
  final double twinkle;

  @override
  void paint(Canvas canvas, Size size) {
    // dial centre measured from the artwork: (122, 128.5) of 259x254, ring radius ~ 88
    final c = Offset(size.width * 122 / 259, size.height * 128.5 / 254);
    final r = size.width * 88 / 259;
    final s = sweep;
    if (s != null) {
      final fade = s < .06 ? s / .06 : (s > .92 ? (1 - s) / .08 : 1.0);
      final start = -math.pi / 2 + s * 2 * math.pi;
      final paint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeWidth = size.width * 0.028
        ..color = const Color(0xFFFFECAA).withValues(alpha: .95 * fade.clamp(0.0, 1.0));
      canvas.drawArc(Rect.fromCircle(center: c, radius: r), start - 0.55, 0.55, false, paint);
    }
    if (twinkle > 0) {
      // sparkle sits in the top-right corner of the tile
      final sc = Offset(size.width * 208 / 259, size.height * 39 / 254);
      final rr = size.width * 0.085 * twinkle;
      final star = Path()
        ..moveTo(sc.dx, sc.dy - rr)
        ..lineTo(sc.dx + rr * .17, sc.dy - rr * .17)
        ..lineTo(sc.dx + rr, sc.dy)
        ..lineTo(sc.dx + rr * .17, sc.dy + rr * .17)
        ..lineTo(sc.dx, sc.dy + rr)
        ..lineTo(sc.dx - rr * .17, sc.dy + rr * .17)
        ..lineTo(sc.dx - rr, sc.dy)
        ..lineTo(sc.dx - rr * .17, sc.dy - rr * .17)
        ..close();
      canvas.drawShadow(star, Colors.white, 2, false);
      canvas.drawPath(star, Paint()..color = Colors.white.withValues(alpha: twinkle));
    }
  }

  @override
  bool shouldRepaint(covariant _SweepAndSparkPainter old) => old.sweep != sweep || old.twinkle != twinkle;
}
