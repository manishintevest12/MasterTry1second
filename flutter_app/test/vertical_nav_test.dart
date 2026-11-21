import 'package:flutter_test/flutter_test.dart';
import 'package:try1second/core/vertical_nav.dart';

/// OWNER 21 Nov (two screenshots: mobile site vs app home): "mobile website pr dekho header ke neeche
/// kaise home page pr nearby, flights, Hotels ...... app ke homepage mai ni aa raha". The strip is the
/// website's `VerticalNav` in app form; these tests pin its order, its one-chip-per-shelf rule and the
/// badge it prints, so the app row can never drift from the site row.
void main() {
  final ids = [
    'flights', 'hotels', 'bus', 'ecommerce', 'grocery', 'food',
    'movie', 'cab', 'loans', 'insurance', 'creditcards', 'account',
  ];

  test('the strip opens with Home and Nearby, then every vertical in site order', () {
    final items = verticalNavItems(ids, (id) => id.toUpperCase());
    expect(items.first.isHome, isTrue);
    expect(items[1].isNearby, isTrue);
    expect(items.map((i) => i.id).toList(),
        ['home', 'nearby', ...ids]);
  });

  test('a site-style id list with both movies and movie still yields one Movies chip', () {
    final items = verticalNavItems([...ids, 'movies'], (id) => id);
    expect(items.where((i) => i.id == 'movie').length, 1);
    expect(items.where((i) => i.id == 'movies').length, 0);
  });

  test('the badge counts rows already held, folding movies onto movie', () {
    final counts = navBadgeCounts([
      'flights', 'flights', 'flights',
      'movie', 'movies', 'movies',
      'grocery',
      '',
    ]);
    expect(counts['flights'], 3);
    expect(counts['movie'], 3);
    expect(counts['movies'], isNull);
    expect(counts['grocery'], 1);
    expect(counts['hotels'], isNull);
  });

  test('a chip prints its count, hides a zero, and caps at 99+', () {
    expect(navBadgeLabel(0), '');
    expect(navBadgeLabel(20), '20');
    expect(navBadgeLabel(99), '99');
    expect(navBadgeLabel(120), '99+');
  });
}
