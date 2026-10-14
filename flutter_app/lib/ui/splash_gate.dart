import 'package:flutter/material.dart';

import '../core/theme.dart';
import 'widgets/logo.dart';

/// Animated splash: stays up until [ready] (session token verified via the
/// backend, badges fetched), then fades into the app. Matches the site loader.
class SplashGate extends StatefulWidget {
  const SplashGate({super.key, required this.child, required this.ready, this.minDuration = const Duration(milliseconds: 1400)});

  final Widget child;
  final bool ready;
  final Duration minDuration;

  @override
  State<SplashGate> createState() => _SplashGateState();
}

class _SplashGateState extends State<SplashGate> {
  bool _minDone = false;
  bool _faded = false;

  @override
  void initState() {
    super.initState();
    Future.delayed(widget.minDuration, () {
      if (mounted) setState(() => _minDone = true);
    });
  }

  void _maybeFade() {
    if (widget.ready && _minDone && !_faded) {
      setState(() => _faded = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.ready && _minDone) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _maybeFade());
    }
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Stack(children: [
      widget.child,
      IgnorePointer(
        ignoring: _faded,
        child: AnimatedOpacity(
          opacity: _faded ? 0 : 1,
          duration: const Duration(milliseconds: 380),
          onEnd: () {},
          child: Container(
            color: dark ? T1SColors.heroBg : Colors.white,
            alignment: Alignment.center,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const T1SLogo(size: 64, tagline: true),
                const SizedBox(height: 26),
                SizedBox(
                  width: 150,
                  child: LinearProgressIndicator(minHeight: 4, color: T1SColors.red, backgroundColor: dark ? T1SColors.slate800 : const Color(0xFFF1E3E6)),
                ),
                const SizedBox(height: 12),
                Text('verifying session…', style: T1SText.label(context).copyWith(color: T1SColors.slate400)),
              ],
            ),
          ),
        ),
      ),
    ]);
  }
}
