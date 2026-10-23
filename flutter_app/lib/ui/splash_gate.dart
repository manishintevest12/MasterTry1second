import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../core/app_state.dart';
import '../core/theme.dart';
import '../core/verticals.dart';
import 'widgets/logo.dart';

/// Animated splash. Stays up until:
///  * the session is verified ([ready]), and
///  * the minimum display time has passed (so it never flashes).
/// SPEED FIX (21 Oct owner report: app very slow): the splash used to ALSO wait
/// for every vertical's default search (warmProgress >= 1.0, up to an 8s cap) —
/// that gate alone made every cold start feel like an 8-second hang. The server
/// already keep-warms all seed queries on a 12-min cron, and verticals now
/// render instantly from the on-disk live cache + skeleton, so the splash must
/// never block on the warm-up. warmProgress only drives the progress label now.
/// Behind the logo: soft floating icons of all 12 verticals (flights, food, ...).
class SplashGate extends StatefulWidget {
  const SplashGate({
    super.key,
    required this.child,
    required this.ready,
    this.minDuration = const Duration(milliseconds: 1200),
    this.maxDuration = const Duration(seconds: 6),
  });

  final Widget child;
  final bool ready;
  final Duration minDuration;
  final Duration maxDuration;

  @override
  State<SplashGate> createState() => _SplashGateState();
}

class _SplashGateState extends State<SplashGate> with SingleTickerProviderStateMixin {
  bool _minDone = false;
  bool _faded = false;
  bool _gone = false;
  late final AnimationController _float = AnimationController(vsync: this, duration: const Duration(seconds: 14))..repeat();

  @override
  void initState() {
    super.initState();
    Future.delayed(widget.minDuration, () {
      if (mounted) setState(() => _minDone = true);
    });
    AppState.instance.warmProgress.addListener(_tick);
  }

  @override
  void dispose() {
    AppState.instance.warmProgress.removeListener(_tick);
    _float.dispose();
    super.dispose();
  }

  void _tick() {
    if (mounted) setState(() {});
  }

  bool get _warm => AppState.instance.warmProgress.value >= 1.0;

  @override
  Widget build(BuildContext context) {
    // SPEED FIX: session + minimum display only — never blocks on the warm-up.
    final canLeave = widget.ready && _minDone;
    if (canLeave && !_faded) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && !_faded) setState(() => _faded = true);
      });
    }
    if (_gone) return widget.child;

    final dark = Theme.of(context).brightness == Brightness.dark;
    final progress = AppState.instance.warmProgress.value;
    final label = !widget.ready
        ? 'verifying session…'
        : (_warm ? 'ready' : 'loading live prices… ${(progress * 100).round()}%');

    return Stack(children: [
      widget.child,
      IgnorePointer(
        ignoring: _faded,
        child: AnimatedOpacity(
          opacity: _faded ? 0 : 1,
          duration: const Duration(milliseconds: 420),
          onEnd: () {
            if (_faded && mounted) setState(() => _gone = true);
          },
          child: Container(
            color: dark ? T1SColors.heroBg : Colors.white,
            width: double.infinity,
            height: double.infinity,
            child: Stack(children: [
              Positioned.fill(child: _VerticalBackdrop(animation: _float, dark: dark)),
              Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const T1SLogo(size: 64, tagline: true),
                    const SizedBox(height: 26),
                    SizedBox(
                      width: 150,
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: TweenAnimationBuilder<double>(
                          tween: Tween(begin: 0, end: widget.ready ? math.max(progress, 0.08) : 0.04),
                          duration: const Duration(milliseconds: 350),
                          builder: (_, v, __) => LinearProgressIndicator(
                            value: v.clamp(0.0, 1.0),
                            minHeight: 4,
                            color: T1SColors.red,
                            backgroundColor: dark ? T1SColors.slate800 : const Color(0xFFF1E3E6),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(label, style: T1SText.label(context).copyWith(color: T1SColors.slate400)),
                  ],
                ),
              ),
            ]),
          ),
        ),
      ),
    ]);
  }
}

/// Soft, slowly drifting icons of every vertical, scattered on a fixed grid so
/// the logo area (centre) stays clean. Pure paint, no assets, very low alpha.
class _VerticalBackdrop extends StatelessWidget {
  const _VerticalBackdrop({required this.animation, required this.dark});
  final Animation<double> animation;
  final bool dark;

  // (x, y) in 0..1 screen fractions, avoiding the centre band (y 0.38..0.62).
  static const _spots = <Offset>[
    Offset(0.13, 0.08), Offset(0.50, 0.05), Offset(0.86, 0.10),
    Offset(0.28, 0.20), Offset(0.72, 0.22), Offset(0.10, 0.32),
    Offset(0.90, 0.34), Offset(0.12, 0.68), Offset(0.88, 0.66),
    Offset(0.30, 0.78), Offset(0.70, 0.80), Offset(0.14, 0.90),
    Offset(0.50, 0.93), Offset(0.86, 0.91), Offset(0.50, 0.17),
    Offset(0.50, 0.84),
  ];

  @override
  Widget build(BuildContext context) {
    final color = dark ? Colors.white : T1SColors.red;
    return AnimatedBuilder(
      animation: animation,
      builder: (_, __) {
        return LayoutBuilder(builder: (_, c) {
          final t = animation.value * 2 * math.pi;
          return Stack(children: [
            for (var i = 0; i < _spots.length; i++)
              Positioned(
                left: _spots[i].dx * c.maxWidth - 20 + math.sin(t + i) * 7,
                top: _spots[i].dy * c.maxHeight - 20 + math.cos(t * 1.3 + i * 1.7) * 9,
                child: Transform.rotate(
                  angle: math.sin(t + i * 0.9) * 0.18,
                  child: Icon(
                    kVerticals[i % kVerticals.length].icon,
                    size: i % 3 == 0 ? 38 : (i % 3 == 1 ? 30 : 24),
                    color: color.withValues(alpha: dark ? 0.07 : 0.085),
                  ),
                ),
              ),
          ]);
        });
      },
    );
  }
}
