import 'package:flutter/material.dart';

import '../core/theme.dart';
import 'widgets/logo.dart';

/// Animated logo loader shown briefly on app start, then fades to [child].
class SplashGate extends StatefulWidget {
  const SplashGate({super.key, required this.child, this.duration = const Duration(milliseconds: 1600)});

  final Widget child;
  final Duration duration;

  @override
  State<SplashGate> createState() => _SplashGateState();
}

class _SplashGateState extends State<SplashGate> {
  bool _done = false;

  @override
  void initState() {
    super.initState();
    Future.delayed(widget.duration, () {
      if (mounted) setState(() => _done = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        widget.child,
        IgnorePointer(
          ignoring: _done,
          child: AnimatedOpacity(
            opacity: _done ? 0 : 1,
            duration: const Duration(milliseconds: 350),
            child: Container(
              color: Theme.of(context).brightness == Brightness.dark ? T1SColors.slate900 : Colors.white,
              alignment: Alignment.center,
              child: const Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  T1SLogo(size: 64, tagline: true),
                  SizedBox(height: 26),
                  SizedBox(
                    width: 150,
                    child: LinearProgressIndicator(minHeight: 4, color: T1SColors.red, backgroundColor: Color(0xFFF1E3E6)),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}
