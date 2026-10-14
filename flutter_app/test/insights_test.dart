import 'package:flutter_test/flutter_test.dart';
import 'package:try1second/core/compare.dart';
import 'package:try1second/core/insights.dart';

CompareItem it(String id, double p) => CompareItem(id: id, vertical: 'flights', title: 'T$id', subtitle: 'S$id', provider: 'P', primaryPrice: p);

void main() {
  test('fewer than 2 priced offers yields no insight (never fabricated)', () {
    expect(computeInsight([]), isNull);
    expect(computeInsight([it('a', 100)]), isNull);
    expect(computeInsight([it('a', 100), it('b', 0)]), isNull);
  });

  test('spread, median, saving and top-2 come from real prices', () {
    final s = computeInsight([it('a', 500), it('b', 1000), it('c', 800), it('d', 0)])!;
    expect(s.lowest, 500);
    expect(s.highest, 1000);
    expect(s.count, 3);
    expect(s.median, 800);
    expect(s.spreadPct, 50);
    expect(s.saving, 500);
    expect(s.top.map((e) => e.id).toList(), ['a', 'c']);
    expect(s.cheapest.id, 'a');
  });

  test('recommendation mirrors the website rule', () {
    // lo <= median*0.9 -> BUY_NOW
    expect(computeInsight([it('a', 80), it('b', 100), it('c', 120)])!.recommendation, 'BUY_NOW');
    // lo above 0.9*median and spread > 40 -> VOLATILE
    expect(computeInsight([it('a', 95), it('b', 100), it('c', 200)])!.recommendation, 'VOLATILE');
    // small spread -> BUY_NOW
    expect(computeInsight([it('a', 95), it('b', 100), it('c', 105)])!.recommendation, 'BUY_NOW');
  });

  test('confidence and score are capped at 95', () {
    final many = [for (var i = 0; i < 40; i++) it('$i', 100.0 + i * 20)];
    final s = computeInsight(many)!;
    expect(s.confidence, 95);
    expect(s.dealScore <= 95, isTrue);
  });

  test('9 probes cover the website verticals', () {
    expect(kInsightProbes.length, 9);
    expect(kInsightProbes.map((p) => p.vertical).toSet().length, 9);
  });
}
