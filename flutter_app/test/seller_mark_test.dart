// OWNER 9 Nov (app screenshot vs site screenshot of the same product page): the site showed a mark for
// every seller, the app showed the grey storefront placeholder for Shopsy and JioMart. The compare row
// only read the product photo, so a seller row without one had nothing to draw.
//
// The row now resolves the seller branch logo the server already ships (/api/logos/<key>, verified on
// production: shopsy 200 image/png, jiomart 200 image/png) and, when a seller has neither a logo nor a
// photo, draws its INITIALS - the same badge the site renders - instead of a placeholder icon.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'product_screen_mark_fixture.dart';

void main() {
  testWidgets('a seller with a brand logo paints the logo, never a storefront icon', (tester) async {
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: markFor('Shopsy', logo: '/api/logos/shopsy'))));
    expect(find.byType(Image), findsOneWidget);
    expect(find.byIcon(Icons.storefront_rounded), findsNothing);
    expect(find.text('SH'), findsNothing, reason: 'a real logo needs no initials');
  });

  testWidgets('a seller with no logo and no photo paints its initials, not a placeholder', (tester) async {
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: markFor('JioMart'))));
    expect(find.text('JI'), findsOneWidget);
    expect(find.byIcon(Icons.storefront_rounded), findsNothing);
  });

  testWidgets('a one-word seller gets a two-letter badge', (tester) async {
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: markFor('Croma'))));
    expect(find.text('CR'), findsOneWidget);
  });
}
