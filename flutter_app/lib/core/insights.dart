import 'compare.dart';

/// Real market stats for one vertical, computed ONLY from live priced offers
/// (mirrors AiInsightsView.tsx). Returns null when there is no honest spread.
class InsightStats {
  final CompareItem cheapest;
  final double lowest;
  final double highest;
  final double median;
  final int spreadPct;
  final int count;
  final String recommendation; // BUY_NOW | VOLATILE
  final int confidence;
  final int dealScore;
  final List<CompareItem> top;
  const InsightStats({
    required this.cheapest,
    required this.lowest,
    required this.highest,
    required this.median,
    required this.spreadPct,
    required this.count,
    required this.recommendation,
    required this.confidence,
    required this.dealScore,
    required this.top,
  });

  double get saving => highest - lowest;
}

InsightStats? computeInsight(List<CompareItem> items) {
  final priced = items.where((i) => i.primaryPrice > 0).toList()..sort((a, b) => a.primaryPrice.compareTo(b.primaryPrice));
  if (priced.length < 2) return null; // need a real spread to say anything
  final lo = priced.first;
  final hi = priced.last;
  final med = priced[priced.length ~/ 2].primaryPrice;
  final spread = hi.primaryPrice > 0 ? ((1 - lo.primaryPrice / hi.primaryPrice) * 100).round() : 0;
  final rec = lo.primaryPrice <= med * 0.9 ? 'BUY_NOW' : (spread > 40 ? 'VOLATILE' : 'BUY_NOW');
  final conf = (50 + priced.length * 3).clamp(0, 95);
  final score = (55 + spread.clamp(0, 30)).clamp(0, 95);
  return InsightStats(
    cheapest: lo,
    lowest: lo.primaryPrice,
    highest: hi.primaryPrice,
    median: med,
    spreadPct: spread,
    count: priced.length,
    recommendation: rec,
    confidence: conf,
    dealScore: score,
    top: priced.take(2).toList(),
  );
}

/// The 9 live probes (same queries as the website).
class InsightProbe {
  final String vertical;
  final String label;
  final String query;
  final String group; // TRAVEL | SHOPPING | DINING | FINANCE
  const InsightProbe(this.vertical, this.label, this.query, this.group);
}

const kInsightProbes = <InsightProbe>[
  InsightProbe('flights', 'Delhi → Mumbai Flights', 'delhi to mumbai', 'TRAVEL'),
  InsightProbe('hotels', 'Goa Hotels', 'goa', 'TRAVEL'),
  InsightProbe('bus', 'Delhi → Jaipur Buses', 'delhi to jaipur', 'TRAVEL'),
  InsightProbe('ecommerce', 'Mobile Phones', 'mobile phone', 'SHOPPING'),
  InsightProbe('grocery', 'Milk (10-min delivery)', 'milk', 'SHOPPING'),
  InsightProbe('food', 'Biryani Delivery', 'biryani', 'DINING'),
  InsightProbe('movie', 'Movies Near You', 'movies', 'DINING'),
  InsightProbe('loans', 'Personal Loans', 'personal loan', 'FINANCE'),
  InsightProbe('insurance', 'Health Insurance', 'health insurance', 'FINANCE'),
];
