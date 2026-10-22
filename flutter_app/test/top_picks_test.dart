import 'package:flutter_test/flutter_test.dart';

import 'package:try1second/core/api.dart';

/// Rewards Top Picks + Famous Destinations models (owner 21-22 Oct).
void main() {
  test('ShowcaseItem parses the launch field (famous destinations)', () {
    final it = ShowcaseItem.fromJson({
      'id': 'dest-goa', 'title': 'Goa', 'merchant': 'EaseMyTrip',
      'merchantLogo': null, 'image': 'https://x/hotel.jpg',
      'price': 3299, 'mrp': null, 'discountPct': null, 'rating': null,
      'badge': 'lowest recorded fare', 'url': '',
      'launch': {'vertical': 'flights', 'query': 'to Goa'},
    });
    expect(it.launch, isNotNull);
    expect(it.launch!.vertical, 'flights');
    expect(it.launch!.query, 'to Goa');
    // a plain product item has no launch
    expect(ShowcaseItem.fromJson({
      'id': 'off-1', 'title': 'x', 'merchant': 'Amazon', 'image': 'https://x/i.jpg',
      'price': 1, 'url': '/api/out?t=1',
    }).launch, isNull);
  });

  test('RewardTopPick parses admin and live picks honestly', () {
    final p = RewardTopPick.fromJson({
      'vertical': 'ecommerce', 'source': 'admin', 'partnerName': 'Flipkart',
      'headline': 'Big Saving Days', 'offerText': 'Up to 80% off', 'priceBadge': 'Rs 999',
      'badgeText': '80% OFF', 'rating': 4.2, 'image': 'https://x/img.jpg',
      'ctaText': 'Shop Now', 'url': '/api/out?t=abc.sig',
    });
    expect(p.vertical, 'ecommerce');
    expect(p.source, 'admin');
    expect(p.ctaText, 'Shop Now');
    expect(p.url, startsWith('/api/out?t='));

    final live = RewardTopPick.fromJson({'vertical': 'hotels', 'source': 'live', 'partnerName': 'Agoda', 'headline': 'h', 'url': ''});
    expect(live.offerText, isNull);
    expect(live.image, isNull);
  });
}
