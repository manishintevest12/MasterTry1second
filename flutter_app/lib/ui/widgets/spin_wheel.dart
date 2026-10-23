import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/rewards_wallet.dart';

/// The 8-slice prize wheel (owner 23 Oct, web SpinAndEarnWheel parity):
/// CustomPainter segments with white separators, top needle indicator, and a
/// center SPIN hub. Rotates via [rotation] (degrees) from the parent
/// AnimationController using the web's cubic-bezier feel.
class SpinWheel extends StatelessWidget {
  const SpinWheel({
    super.key,
    required this.rotation,
    required this.onSpin,
    required this.enabled,
    required this.spinning,
    this.size = 280,
  });
  final double rotation; // degrees
  final VoidCallback onSpin;
  final bool enabled;
  final bool spinning;
  final double size;

  @override
  Widget build(BuildContext context) {
    final slices = kSpinSlices;
    final n = slices.length;
    final sliceAngle = 360 / n;

    return SizedBox(
      width: size,
      height: size,
      child: Stack(alignment: Alignment.center, children: [
        // wheel disc
        Transform.rotate(
          angle: rotation * math.pi / 180,
          child: Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: const Color(0x1A0F172A), width: 4),
              boxShadow: const [BoxShadow(color: Color(0x1F000000), blurRadius: 14, spreadRadius: 2)],
            ),
            child: CustomPaint(painter: _WheelPainter(slices), size: Size.square(size)),
          ),
        ),
        // top needle
        Positioned(
          top: -2,
          child: Column(children: [
            CustomPaint(
              size: const Size(28, 22),
              painter: _NeedlePainter(),
            ),
            Container(
              width: 10,
              height: 10,
              margin: const EdgeInsets.only(top: 2),
              decoration: BoxDecoration(
                color: T1SWheel.orange,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 2),
              ),
            ),
          ]),
        ),
        // center hub = spin trigger
        GestureDetector(
          onTap: enabled ? onSpin : null,
          child: Container(
            width: size * 0.28,
            height: size * 0.28,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: enabled ? const Color(0xFF0F172A) : const Color(0xFF94A3B8),
              border: Border.all(color: T1SWheel.orange, width: 4),
              boxShadow: enabled
                  ? const [BoxShadow(color: Color(0x40000000), blurRadius: 12)]
                  : null,
            ),
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(Icons.rotate_right, size: 18, color: Colors.white,
                  semanticLabel: spinning ? 'Spinning' : 'Spin'),
              const SizedBox(height: 1),
              Text(
                spinning ? 'SPINNING' : 'SPIN',
                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 0.8, color: Colors.white),
              ),
              Text(
                '$kSpinCostPoints pts',
                style: const TextStyle(fontSize: 8.5, fontWeight: FontWeight.w600, color: Color(0xFF6EE7B7)),
              ),
            ]),
          ),
        ),
      ]),
    );
  }
}

class T1SWheel {
  static const orange = Color(0xFFF97316);
}

class _WheelPainter extends CustomPainter {
  _WheelPainter(this.slices);
  final List<SpinSlice> slices;

  @override
  void paint(Canvas canvas, Size size) {
    final c = Offset(size.width / 2, size.height / 2);
    final r = size.width / 2;
    final n = slices.length;
    final sweep = 2 * math.pi / n;
    for (var i = 0; i < n; i++) {
      final start = -math.pi / 2 + i * sweep;
      final paint = Paint()..style = PaintingStyle.fill..color = slices[i].asColor;
      canvas.drawArc(Rect.fromCircle(center: c, radius: r), start, sweep, true, paint);
      canvas.drawArc(
        Rect.fromCircle(center: c, radius: r),
        start,
        sweep,
        true,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..color = Colors.white,
      );
      // label along the bisector, rotated like the web SVG text
      final mid = start + sweep / 2;
      final tp = TextPainter(
        text: TextSpan(text: slices[i].value, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Colors.white)),
        textDirection: TextDirection.ltr,
      )..layout();
      canvas.save();
      canvas.translate(c.dx + (r * 0.65) * math.cos(mid), c.dy + (r * 0.65) * math.sin(mid));
      canvas.rotate(mid + math.pi / 2);
      canvas.translate(-tp.width / 2, -tp.height / 2);
      tp.paint(canvas, Offset.zero);
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(_WheelPainter oldDelegate) => false;
}

class _NeedlePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(size.width / 2, size.height)
      ..lineTo(0, 0)
      ..lineTo(size.width, 0)
      ..close();
    canvas.drawPath(path, Paint()..color = const Color(0xFF0F172A));
  }

  @override
  bool shouldRepaint(_NeedlePainter oldDelegate) => false;
}
