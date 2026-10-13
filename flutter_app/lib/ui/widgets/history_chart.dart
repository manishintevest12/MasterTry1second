import 'package:flutter/material.dart';

import '../../core/api.dart';
import '../../core/theme.dart';

/// Real price-history sparkline (CustomPainter, mirrors the web SVG chart).
/// Renders ONLY recorded backend points; callers show an honest empty state
/// when [points] is empty.
class HistoryChart extends StatelessWidget {
  const HistoryChart({super.key, required this.points, this.height = 120});

  final List<HistoryPoint> points;
  final double height;

  @override
  Widget build(BuildContext context) {
    if (points.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Text(
          'No price history recorded yet. Try1Second never generates synthetic history.',
          style: T1SText.body(context).copyWith(color: T1SColors.slate400),
        ),
      );
    }
    final pts = points; // oldest -> newest assumed sorted upstream
    final low = pts.map((p) => p.price).reduce((a, b) => a < b ? a : b);
    final high = pts.map((p) => p.price).reduce((a, b) => a > b ? a : b);
    final latest = pts.last;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('PRICE HISTORY',
                style: T1SText.label(context).copyWith(letterSpacing: 0.5)),
            Text('${pts.length} recorded points',
                style: T1SText.label(context).copyWith(
                    color: T1SColors.slate400, letterSpacing: 0)),
          ],
        ),
        const SizedBox(height: 8),
        SizedBox(
          height: height,
          width: double.infinity,
          child: CustomPaint(
            painter: _HistoryPainter(
              prices: pts.map((p) => p.price).toList(),
              line: T1SColors.red,
              gradient: T1SColors.red.withValues(alpha: 0.15),
              lowDot: T1SColors.green,
            ),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            _stat(context, 'Lowest', inr(low)),
            _stat(context, 'Highest', inr(high)),
            _stat(context, 'Latest', inr(latest.price)),
          ],
        ),
      ],
    );
  }

  Widget _stat(BuildContext context, String label, String value) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: T1SText.label(context)),
          Text(value,
              style: T1SText.title(context).copyWith(fontWeight: FontWeight.w900)),
        ],
      );
}

class _HistoryPainter extends CustomPainter {
  _HistoryPainter({
    required this.prices,
    required this.line,
    required this.gradient,
    required this.lowDot,
  });

  final List<double> prices;
  final Color line;
  final Color gradient;
  final Color lowDot;

  @override
  void paint(Canvas canvas, Size size) {
    if (prices.length < 2) return;
    final low = prices.reduce((a, b) => a < b ? a : b);
    final high = prices.reduce((a, b) => a > b ? a : b);
    final min = low * 0.97;
    final max = high * 1.03;
    final pad = 6.0;
    final spanX = size.width - pad * 2;
    final spanY = size.height - pad * 2;

    Offset pos(int i, double p) => Offset(
          pad + i * spanX / (prices.length - 1),
          size.height - pad - (p - min) / (max - min).clamp(1.0, double.infinity) * spanY,
        );

    final path = Path()..moveTo(pos(0, prices.first).dx, pos(0, prices.first).dy);
    for (var i = 1; i < prices.length; i++) {
      path.lineTo(pos(i, prices[i]).dx, pos(i, prices[i]).dy);
    }

    // area fill
    final area = Path.from(path)
      ..lineTo(pos(prices.length - 1, prices.first).dx, size.height - pad)
      ..lineTo(pos(0, prices.first).dx, size.height - pad)
      ..close();
    canvas.drawPath(area, Paint()..color = gradient);

    // line
    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.4
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..color = line,
    );

    // lowest marker
    var lowIdx = 0;
    for (var i = 0; i < prices.length; i++) {
      if (prices[i] == low) lowIdx = i;
    }
    canvas.drawCircle(pos(lowIdx, low), 4, Paint()..color = lowDot);
  }

  @override
  bool shouldRepaint(covariant _HistoryPainter old) =>
      old.prices.length != prices.length || old.prices.first != prices.first;
}
