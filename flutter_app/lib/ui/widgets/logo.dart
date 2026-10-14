import 'package:flutter/material.dart';

import '../../core/theme.dart';

/// Official Try1Second logo (PNG layers) with a dynamic "1-second tap":
/// the hand icon taps with a ripple ring, the wordmark slides in once.
/// Respects the OS "reduce motion" setting.
class T1SLogo extends StatefulWidget {
  const T1SLogo({super.key, this.size = 40, this.showWordmark = true, this.animate = true});

  /// Height of the logo in logical pixels.
  final double size;
  final bool showWordmark;
  final bool animate;

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

  // 0..1 progress -> tap curve matching the web keyframes (tap at 70-90%).
  double _tap(double t) {
    if (t < .70 || t > .90) return 0;
    final p = (t - .70) / .20;
    return p < .5 ? p * 2 : (1 - p) * 2; // 0 -> 1 -> 0
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
          final tap = _tap(t);
          final ringP = t < .74 ? 0.0 : ((t - .74) / .26).clamp(0.0, 1.0);
          final icon = SizedBox(
            height: h,
            child: Stack(
              alignment: Alignment.center,
              children: [
                if (ringP > 0)
                  Opacity(
                    opacity: (1 - ringP) * .8,
                    child: Transform.scale(
                      scale: .6 + ringP * 1.1,
                      child: Container(
                        width: h * .84,
                        height: h * .84,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: T1SColors.red.withValues(alpha: .6), width: 2),
                        ),
                      ),
                    ),
                  ),
                Transform.translate(
                  offset: Offset(0, 2 * tap),
                  child: Transform.rotate(
                    angle: -0.07 * tap,
                    child: Transform.scale(
                      scale: 1 - .07 * tap,
                      child: Image.asset('assets/images/logo-icon.png', height: h, filterQuality: FilterQuality.high),
                    ),
                  ),
                ),
              ],
            ),
          );
          if (!widget.showWordmark) return icon;
          return Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              icon,
              const SizedBox(width: 2),
              TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: 1),
                duration: const Duration(milliseconds: 700),
                curve: Curves.easeOutCubic,
                builder: (context, v, child) => Opacity(
                  opacity: v,
                  child: Transform.translate(offset: Offset(-10 * (1 - v), 0), child: child),
                ),
                child: Image.asset('assets/images/logo-wordmark.png', height: h, filterQuality: FilterQuality.high),
              ),
            ],
          );
        },
      ),
    );
  }
}
