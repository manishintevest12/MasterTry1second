import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';

import 'package:try1second/core/api.dart';
import 'package:try1second/core/session_cache.dart';
import 'package:try1second/ui/widgets/hero_banner_carousel.dart';

/// Hero banner carousel (owner 23 Oct): mixed movie / food / ecom-deal
/// slides render — poster left, badge + heading + meta right, one active
/// pagination dot per slide. Session-cached so no network is needed.
void main() {
  setUp(() {
    SessionCache.reset();
  });

  testWidgets('renders mixed movie/food/ecom slides with dots', (tester) async {
    final slides = <HeroSlide>[
      const HeroSlide(
        id: 'movie-x',
        kind: 'movie',
        badge: 'PREMIERE',
        subheading: 'Brand new releases every Friday',
        heading: 'Fall 2: Deadpoint',
        meta: 'Adventure, Drama • 397K+ Likes',
        synopsis: null,
        poster: null,
        cta: 'Watch Trailer',
        url: 'https://example.com/trailer',
      ),
      const HeroSlide(
        id: 'food-1',
        kind: 'food',
        badge: 'FOOD PICK',
        subheading: 'Fresh dishes from top-rated kitchens near you',
        heading: 'Margherita Pizza',
        meta: 'Domino\'s · Indore',
        poster: null,
        cta: 'Order Now',
        launchVertical: 'food',
        launchQuery: 'Margherita Pizza',
      ),
      const HeroSlide(
        id: 'ecom-1',
        kind: 'ecommerce',
        badge: 'MEGA DEAL',
        heading: 'Sony WH-1000XM5',
        meta: '45% OFF · now ₹24,999',
        poster: null,
        cta: 'Grab Deal',
        launchVertical: 'ecommerce',
        launchQuery: 'Sony WH-1000XM5',
      ),
    ];
    SessionCache.put('home.hero', slides);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: HeroBannerCarousel(
            api: Try1SecondApi(),
            onLaunch: (_, __) {},
          ),
        ),
      ),
    );
    await tester.pump();

    // slide 1 content visible
    expect(find.text('PREMIERE'), findsOneWidget);
    expect(find.text('Fall 2: Deadpoint'), findsOneWidget);
    expect(find.text('Watch Trailer'), findsOneWidget);
    // Owner 23 Oct: the "Video Library" chip is REMOVED from every slide.
    expect(find.text('Video Library'), findsNothing);

    // 3 pagination dots render (one active)
    expect(find.byKey(const ValueKey('hero-dot-0')), findsOneWidget);
    expect(find.byKey(const ValueKey('hero-dot-2')), findsOneWidget);

    // swipe to the food slide
    await tester.fling(find.byType(PageView), const Offset(-400, 0), 900);
    await tester.pumpAndSettle();
    expect(find.text('FOOD PICK'), findsOneWidget);
    expect(find.text('Margherita Pizza'), findsOneWidget);

    // swipe again to the ecom slide
    await tester.fling(find.byType(PageView), const Offset(-400, 0), 900);
    await tester.pumpAndSettle();
    expect(find.text('MEGA DEAL'), findsOneWidget);
    expect(find.text('Sony WH-1000XM5'), findsOneWidget);
  });

  testWidgets('hides honestly when no slides exist', (tester) async {
    SessionCache.put('home.hero', const <HeroSlide>[]);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: HeroBannerCarousel(api: Try1SecondApi(), onLaunch: (_, __) {}),
        ),
      ),
    );
    await tester.pump();
    // honest: nothing renders — no pager, no content
    expect(find.byType(PageView), findsNothing);
    expect(find.text('Video Library'), findsNothing);
  });
}
