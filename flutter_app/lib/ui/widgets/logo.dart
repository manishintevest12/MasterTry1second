import 'package:flutter/material.dart';

import '../../core/theme.dart';

/// The Try1Second badge logo, drawn to match the site SVG:
/// red gradient rounded badge, gold ring, white "1s".
class T1SLogo extends StatelessWidget {
  const T1SLogo({super.key, this.size = 40, this.showWordmark = true});

  final double size;
  final bool showWordmark;

  @override
  Widget build(BuildContext context) {
    final badge = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: T1SColors.badgeGradient,
        borderRadius: BorderRadius.circular(size * 0.26),
        boxShadow: [
          BoxShadow(
            color: T1SColors.red.withValues(alpha: 0.35),
            blurRadius: size * 0.14,
            offset: Offset(0, size * 0.06),
          ),
        ],
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            width: size * 0.68,
            height: size * 0.68,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: T1SColors.gold, width: size * 0.05),
            ),
          ),
          Text(
            '1s',
            style: TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w900,
              fontSize: size * 0.36,
              height: 1,
            ),
          ),
        ],
      ),
    );

    if (!showWordmark) return badge;

    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        badge,
        const SizedBox(width: 10),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            RichText(
              text: TextSpan(
                style: TextStyle(
                  fontSize: size * 0.42,
                  fontWeight: FontWeight.w900,
                  color: T1SColors.ink,
                  height: 1.1,
                ),
                children: [
                  const TextSpan(text: 'Try'),
                  TextSpan(text: '1', style: TextStyle(color: T1SColors.red)),
                  const TextSpan(text: 'Second'),
                ],
              ),
            ),
            Text(
              'One second is all it takes',
              style: TextStyle(
                fontSize: size * 0.16,
                color: T1SColors.slate500,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ],
    );
  }
}
