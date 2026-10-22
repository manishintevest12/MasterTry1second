import 'package:flutter_test/flutter_test.dart';

import 'package:try1second/core/api.dart';

/// Home showcase (owner spec 21 Oct): section/item parsing from
/// /api/home/showcase — every item carries a masking-pointer url.
void main() {
  test('ShowcaseSection.fromJson parses sections and items honestly', () {
    final sec = ShowcaseSection.fromJson({
      'id': 'picked',
      'title': 'Picked Just for You',
      'subtitle': 'real products, live-acquired prices',
      'items': [
        {
          'id': 'off-1', 'title': 'boAt Airdopes 141', 'merchant': 'Amazon',
          'merchantLogo': null, 'image': 'https://m.media-amazon.com/i.jpg',
          'price': 766, 'mrp': 1499, 'discountPct': 49, 'rating': 4.1, 'badge': '49% OFF',
          'url': '/api/out?t=abc.sig',
        },
        {'id': 'aff-2', 'title': 'Flat 20% off', 'merchant': 'Myntra', 'image': null,
          'price': null, 'mrp': null, 'discountPct': 20, 'badge': 'Code: MYN20',
          'url': '/api/out?t=def.sig'},
        // malformed rows are skipped, never crash the feed
        'garbage-row',
      ],
    });
    expect(sec.id, 'picked');
    expect(sec.items.length, 2);
    expect(sec.items.first.price, 766);
    expect(sec.items.first.mrp, 1499);
    expect(sec.items.first.discountPct, 49);
    expect(sec.items.first.rating, 4.1);
    expect(sec.items.first.merchantLogo, isNull);
    expect(sec.items.first.url, startsWith('/api/out?t='));
    expect(sec.items.last.badge, 'Code: MYN20');
    expect(sec.items.last.price, isNull);
  });

  test('empty sections stay empty (server omits them; client renders nothing)', () {
    final sec = ShowcaseSection.fromJson({'id': 'steals', 'title': 'x', 'subtitle': '', 'items': []});
    expect(sec.items, isEmpty);
  });
}
